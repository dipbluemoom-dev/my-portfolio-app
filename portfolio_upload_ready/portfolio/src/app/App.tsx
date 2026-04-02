import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MonthlyBudget } from './components/MonthlyBudget';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Input } from './components/ui';
import { Wallet, TrendingUp, List, Landmark, LineChart, Save } from 'lucide-react';
import {
  isSupabaseConfigured,
  supabase,
  isLocalDirtyComparedToLastSync,
  markLocalPayloadSynced,
  pullFromCloud,
  pushToCloud,
  readLocalStoragePayload,
  readSyncMeta,
  writeLocalStoragePayload,
} from './lib/cloudSync';

// ✅ 탭별 lazy-load — 초기 번들 가볍게
const StockPortfolio = lazy(() =>
  import('./components/StockPortfolio').then((m) => ({ default: m.StockPortfolio }))
);
const StockWatchlist = lazy(() =>
  import('./components/StockWatchlist').then((m) => ({ default: m.StockWatchlist }))
);
const BankAccounts = lazy(() =>
  import('./components/BankAccounts').then((m) => ({ default: m.BankAccounts }))
);
const AssetTrend = lazy(() =>
  import('./components/AssetTrend').then((m) => ({ default: m.AssetTrend }))
);

// ============================================================
// useSupabaseSession hook
// ============================================================
function useSupabaseSession() {
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error(error);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { loading, user };
}

// ============================================================
// CloudSyncPanel
// ============================================================
const AUTO_PULL_MS = 5 * 60_000;   // 5분 — 서버 확인
const AUTO_PUSH_MS = 30_000;        // 30초 — 자동 업로드
const AUTO_RELOAD_MIN_MS = 60 * 60 * 1000; // 1시간
const AUTO_RELOAD_KEY = 'cloudSyncLastAutoReloadAt';

function shallowEqualPayload(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

function CloudSyncPanel({ onToast }: { onToast?: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'loggedIn' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [autoReloadDisabled, setAutoReloadDisabled] = useState(false);
  const lastEmailSentAtRef = useRef<number>(0);
  const lastAutoReloadAtRef = useRef<number>(0);

  const getLastAutoReloadAt = () => {
    if (autoReloadDisabled) return Date.now();
    try { return Number(localStorage.getItem(AUTO_RELOAD_KEY)) || 0; }
    catch { return lastAutoReloadAtRef.current; }
  };

  const markAutoReloadNow = () => {
    const now = Date.now();
    lastAutoReloadAtRef.current = now;
    try { localStorage.setItem(AUTO_RELOAD_KEY, String(now)); }
    catch { setAutoReloadDisabled(true); }
  };

  const canAutoReloadNow = () =>
    !autoReloadDisabled && Date.now() - getLastAutoReloadAt() >= AUTO_RELOAD_MIN_MS;

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        if (data.session?.user?.id) { setUserId(data.session.user.id); setStatus('loggedIn'); setMessage('로그인 됨'); }
      } catch { /* ignore */ }
    })();
    const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) { setStatus('loggedIn'); setMessage('로그인 됨'); }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) return (setStatus('error'), setMessage('이메일을 입력해줘'));
    const now = Date.now();
    if (now - lastEmailSentAtRef.current < 5 * 60 * 1000)
      return (setStatus('error'), setMessage('방금 보냈어. 5분 정도 기다렸다가 다시 시도해줘'));

    setStatus('sending'); setMessage('메일 보내는 중…');
    try {
      const { error } = await supabase!.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      lastEmailSentAtRef.current = now;
      setStatus('sent'); setMessage('메일 보냈어! 메일함에서 로그인 링크를 눌러줘');
      onToast?.('메일 보냈어. 메일함에서 로그인 링크를 눌러줘.');
    } catch (e: any) {
      setStatus('error');
      const msg = String(e?.message || e);
      setMessage(msg.toLowerCase().includes('rate limit')
        ? '너무 많이 눌렀어(전송 제한). 10분 정도 기다렸다가 다시 해줘'
        : msg);
    }
  };

  const pullOnce = useCallback(async (reason: 'auto' | 'initial' = 'auto') => {
    if (!userId) return;
    try {
      const cloudRecord = await pullFromCloud(userId);
      if (!cloudRecord) return;
      const { payload: cloudPayload, updatedAt } = cloudRecord;
      const localPayload = readLocalStoragePayload();
      const syncMeta = readSyncMeta();
      const localDirty = isLocalDirtyComparedToLastSync(localPayload);
      const cloudIsNewer = !!updatedAt && (!syncMeta.lastKnownCloudUpdatedAt || updatedAt > syncMeta.lastKnownCloudUpdatedAt);

      if (shallowEqualPayload(localPayload, cloudPayload)) {
        writeLocalStoragePayload(cloudPayload, { cloudUpdatedAt: updatedAt, markAsSynced: true }); return;
      }
      if (localDirty && reason === 'auto') { setMessage('이 기기에서 바뀐 내용이 있어서 서버값 자동 덮어쓰기를 건너뛰었어. 먼저 저장해줘.'); return; }
      if (!cloudIsNewer && localDirty) { setMessage('로컬 값이 더 최신으로 보여서 서버값 덮어쓰기를 막았어. 저장 버튼을 눌러줘.'); return; }

      writeLocalStoragePayload(cloudPayload, { cloudUpdatedAt: updatedAt, markAsSynced: true });
      if (canAutoReloadNow()) {
        markAutoReloadNow(); setMessage('다른 기기 값으로 동기화했어. 새로고침 할게!');
        onToast?.('다른 기기 값으로 맞췄어. 새로고침 할게!');
        setTimeout(() => window.location.reload(), 600);
      } else {
        setMessage('다른 기기 값으로 맞췄어. 화면만 한번 새로고침하면 완벽해!');
        onToast?.('다른 기기 값으로 맞췄어. 새로고침 한번 해줘!');
      }
    } catch (e) { console.error(e); throw e; }
  }, [autoReloadDisabled, onToast, userId]);

  const pushOnce = useCallback(async () => {
    if (!userId) return;
    const payload = readLocalStoragePayload();
    const updatedAt = await pushToCloud(userId, payload);
    markLocalPayloadSynced(payload, updatedAt);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    pullOnce('initial').catch(console.error);
    const t = setInterval(() => pullOnce('auto').catch(console.error), AUTO_PULL_MS);
    return () => clearInterval(t);
  }, [pullOnce, userId]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => pushOnce().catch(console.error), AUTO_PUSH_MS);
    return () => clearInterval(t);
  }, [pushOnce, userId]);

  const manualSave = useCallback(async () => {
    if (!userId) return onToast?.('먼저 로그인부터 해줘');
    try { await pushOnce(); onToast?.('저장 완료! (클라우드에 업로드 됨)'); }
    catch { onToast?.('저장 실패… 잠깐 뒤에 다시 해줘'); }
  }, [onToast, pushOnce, userId]);

  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm mb-4">
      <div className="font-semibold mb-2">동기화</div>
      <div className="flex gap-2 items-center flex-wrap">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="w-full sm:w-64" />
        <Button onClick={sendMagicLink} disabled={status === 'sending'}>로그인 링크 받기</Button>
        <Button variant="outline" onClick={manualSave} disabled={!userId}>저장</Button>
      </div>
      <div className="mt-2 text-sm">
        {status === 'error'
          ? <span className="text-rose-500">{message}</span>
          : <span className="text-gray-700">{message}</span>}
      </div>
      <div className="mt-2 text-xs text-gray-400">
        자동 동기화: 서버 확인 5분 / 자동 업로드 30초
        {autoReloadDisabled && (
          <span className="block text-amber-700/80 mt-1">* 이 기기(브라우저)는 저장소가 제한돼서 자동 새로고침을 껐어. 필요한 경우 직접 새로고침만 해줘.</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// App
// ============================================================
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }));

function TabFallback() {
  return <div className="p-6 bg-white rounded-2xl border shadow-sm text-sm text-gray-500">불러오는 중…</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('budget');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const { user } = useSupabaseSession();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!isSupabaseConfigured) {
      alert('클라우드 저장을 사용하려면 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)를 설정해야 해요.');
      return;
    }
    if (!user) { alert('먼저 동기화 패널에서 로그인(이메일) 후 저장할 수 있어요.'); return; }

    setIsSaving(true); setSaveMsg(null);
    try {
      const payload = readLocalStoragePayload();
      const updatedAt = await pushToCloud(user.id, payload);
      markLocalPayloadSynced(payload, updatedAt);
      setSaveMsg('저장 완료');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (e: any) {
      alert(`저장 실패: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-rose-50">
      <div className="container mx-auto py-4 md:py-8 px-2 md:px-4">
        {/* 헤더 */}
        <div className="mb-6 relative">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-rose-300 to-amber-300 bg-clip-text text-transparent">
              자산 포트폴리오
            </h1>
          </div>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <Button onClick={handleSave} disabled={isSaving} variant="outline" className="bg-white">
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? '저장중' : '저장'}
            </Button>
            {saveMsg && <span className="text-xs text-gray-600">{saveMsg}</span>}
          </div>
        </div>

        <CloudSyncPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4 h-auto bg-white/80 backdrop-blur shadow-md rounded-xl p-1">
            {[
              { value: 'budget',    icon: <Wallet className="w-5 h-5" />,     label: '지출관리', active: 'bg-amber-50 border-amber-100' },
              { value: 'stocks',    icon: <TrendingUp className="w-5 h-5" />, label: '주식',     active: 'bg-rose-50 border-rose-100' },
              { value: 'watchlist', icon: <List className="w-5 h-5" />,       label: '주식 일정표', active: 'bg-violet-50 border-violet-100' },
              { value: 'banks',     icon: <Landmark className="w-5 h-5" />,   label: '통장',     active: 'bg-orange-50 border-orange-100' },
              { value: 'trend',     icon: <LineChart className="w-5 h-5" />,  label: '자산 추이', active: 'bg-pink-50 border-pink-100' },
            ].map(({ value, icon, label, active }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:${active} data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border`}
              >
                {icon}
                <span className="text-xs md:text-sm">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 월 선택 */}
          {activeTab === 'budget' && (
            <div className="mb-4 p-4 bg-white/80 backdrop-blur rounded-xl shadow-sm border">
              <div className="flex items-center gap-2 overflow-x-auto">
                {MONTHS.map(({ value, label }) => (
                  <Button
                    key={value}
                    onClick={() => setSelectedMonth(value)}
                    variant={selectedMonth === value ? 'default' : 'outline'}
                    className={`min-w-[60px] ${selectedMonth === value ? 'shadow-sm' : ''}`}
                    size="sm"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <TabsContent value="budget" className="mt-0">
            <MonthlyBudget selectedMonth={selectedMonth} />
          </TabsContent>
          <TabsContent value="stocks" className="mt-0">
            <Suspense fallback={<TabFallback />}><StockPortfolio /></Suspense>
          </TabsContent>
          <TabsContent value="watchlist" className="mt-0">
            <Suspense fallback={<TabFallback />}><StockWatchlist /></Suspense>
          </TabsContent>
          <TabsContent value="banks" className="mt-0">
            <Suspense fallback={<TabFallback />}><BankAccounts /></Suspense>
          </TabsContent>
          <TabsContent value="trend" className="mt-0">
            <Suspense fallback={<TabFallback />}><AssetTrend /></Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
