import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MonthlyBudget } from './components/MonthlyBudget';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Input } from './components/ui';
import { Wallet, TrendingUp, Save } from 'lucide-react';
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
    <div className="rounded-lg border border-border bg-card mb-6">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2 mr-2">
          <span
            className={`inline-block size-2 rounded-full ${
              status === 'loggedIn' ? 'bg-income' : status === 'error' ? 'bg-expense' : 'bg-border'
            }`}
          />
          <span className="eyebrow">동기화</span>
        </div>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          className="w-full sm:w-64"
        />
        <Button variant="outline" size="sm" onClick={sendMagicLink} disabled={status === 'sending'}>
          로그인 링크 받기
        </Button>
        <Button variant="outline" size="sm" onClick={manualSave} disabled={!userId}>
          지금 저장
        </Button>
        {message && (
          <span className={`text-xs ${status === 'error' ? 'text-expense' : 'text-muted-foreground'}`}>
            {message}
          </span>
        )}
        <span className="ml-auto hidden text-xs text-muted-foreground/70 md:inline">
          자동 동기화 · 확인 5분 / 업로드 30초
        </span>
      </div>
      {autoReloadDisabled && (
        <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          * 이 기기(브라우저)는 저장소가 제한돼서 자동 새로고침을 껐어. 필요한 경우 직접 새로고침만 해줘.
        </div>
      )}
    </div>
  );
}

// ============================================================
// App
// ============================================================
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }));

function TabFallback() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      불러오는 중…
    </div>
  );
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
    <div className="min-h-screen bg-background">
      {/* ── 헤더 ───────────────────────────────────── */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="tnum text-sm font-semibold">₩</span>
            </div>
            <div className="leading-tight">
              <div className="eyebrow">Personal Finance</div>
              <div className="text-base font-semibold tracking-tight">자산 포트폴리오</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && <span className="text-xs text-income">{saveMsg}</span>}
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="w-4 h-4" />
              {isSaving ? '저장중' : '저장'}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
        <CloudSyncPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="budget">
              <Wallet className="w-4 h-4" />
              지출관리
            </TabsTrigger>
            <TabsTrigger value="stocks">
              <TrendingUp className="w-4 h-4" />
              주식
            </TabsTrigger>
          </TabsList>

          {/* 월 선택 — 전폭 12등분 세그먼트 */}
          {activeTab === 'budget' && (
            <div className="mb-6 grid w-full grid-cols-6 gap-1 rounded-lg border border-border bg-card p-1 md:grid-cols-12">
              {MONTHS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedMonth(value)}
                  className={`tnum rounded-md px-1 py-1.5 text-center text-sm transition-colors ${
                    selectedMonth === value
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <TabsContent value="budget" className="mt-0">
            <MonthlyBudget selectedMonth={selectedMonth} />
          </TabsContent>
          <TabsContent value="stocks" className="mt-0">
            <Suspense fallback={<TabFallback />}><StockPortfolio /></Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
