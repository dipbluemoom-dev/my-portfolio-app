import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { MonthlyBudget } from './components/MonthlyBudget';
import { CloudSyncPanel } from './components/CloudSyncPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Wallet, TrendingUp, List, Landmark, LineChart, Save } from 'lucide-react';
import { Button } from './components/ui/button';
import { useSupabaseSession } from './hooks/useSupabaseSession';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { pushToCloud, readLocalStoragePayload } from './lib/cloudSync';

// ✅ 탭별로 번들을 쪼개서 초기 로딩을 가볍게 (수치/기능은 동일)
// 지출관리는 기본 탭이라(초기 진입) 분리해도 이득이 거의 없어서 그대로 번들에 포함
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

const MONTHS = [
  { value: 1, label: '1월' },
  { value: 2, label: '2월' },
  { value: 3, label: '3월' },
  { value: 4, label: '4월' },
  { value: 5, label: '5월' },
  { value: 6, label: '6월' },
  { value: 7, label: '7월' },
  { value: 8, label: '8월' },
  { value: 9, label: '9월' },
  { value: 10, label: '10월' },
  { value: 11, label: '11월' },
  { value: 12, label: '12월' },
];

function TabFallback() {
  return (
    <div className="p-6 bg-white rounded-2xl border shadow-sm text-sm text-gray-500">
      불러오는 중…
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('budget');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const { user } = useSupabaseSession();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!isSupabaseConfigured) {
      alert('클라우드 저장을 사용하려면 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)를 설정해야 해요.');
      return;
    }
    if (!user) {
      alert('먼저 동기화 패널에서 로그인(이메일) 후 저장할 수 있어요.');
      return;
    }

    setIsSaving(true);
    setSaveMsg(null);
    try {
      await pushToCloud(user.id, readLocalStoragePayload());
      setSaveMsg('저장 완료');
      window.setTimeout(() => setSaveMsg(null), 2000);
    } catch (e: any) {
      alert(`저장 실패: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const months = useMemo(() => MONTHS, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="container mx-auto py-4 md:py-8 px-2 md:px-4">
        <div className="mb-6 relative">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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

        {/* ✅ 회사/집/폰 값 동기화 패널 */}
        <CloudSyncPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4 h-auto bg-white shadow-lg rounded-xl p-1">
            <TabsTrigger 
              value="budget" 
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
            >
              <Wallet className="w-5 h-5" />
              <span className="text-xs md:text-sm">지출관리</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stocks"
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs md:text-sm">주식</span>
            </TabsTrigger>
            <TabsTrigger 
              value="watchlist"
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
            >
              <List className="w-5 h-5" />
              <span className="text-xs md:text-sm">주식 일정표</span>
            </TabsTrigger>
            <TabsTrigger 
              value="banks"
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
            >
              <Landmark className="w-5 h-5" />
              <span className="text-xs md:text-sm">통장</span>
            </TabsTrigger>
            <TabsTrigger 
              value="trend"
              className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white"
            >
              <LineChart className="w-5 h-5" />
              <span className="text-xs md:text-sm">자산 추이</span>
            </TabsTrigger>
          </TabsList>

          {/* 월 선택 바 */}
          {activeTab === 'budget' && (
            <div className="mb-4 p-4 bg-white rounded-xl shadow-md">
              <div className="flex items-center gap-2 overflow-x-auto">
                {months.map((month) => (
                  <Button
                    key={month.value}
                    onClick={() => setSelectedMonth(month.value)}
                    variant={selectedMonth === month.value ? 'default' : 'outline'}
                    className={`min-w-[60px] ${
                      selectedMonth === month.value
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : ''
                    }`}
                    size="sm"
                  >
                    {month.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <TabsContent value="budget" className="mt-0">
            <MonthlyBudget selectedMonth={selectedMonth} />
          </TabsContent>

          <TabsContent value="stocks" className="mt-0">
            <Suspense fallback={<TabFallback />}>
              <StockPortfolio />
            </Suspense>
          </TabsContent>

          <TabsContent value="watchlist" className="mt-0">
            <Suspense fallback={<TabFallback />}>
              <StockWatchlist />
            </Suspense>
          </TabsContent>

          <TabsContent value="banks" className="mt-0">
            <Suspense fallback={<TabFallback />}>
              <BankAccounts />
            </Suspense>
          </TabsContent>

          <TabsContent value="trend" className="mt-0">
            <Suspense fallback={<TabFallback />}>
              <AssetTrend />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}