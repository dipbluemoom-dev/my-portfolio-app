import { useEffect, useState } from 'react';
import { MonthlyBudget } from './components/MonthlyBudget';
import { StockPortfolio } from './components/StockPortfolio';
import { StockWatchlist } from './components/StockWatchlist';
import { BankAccounts } from './components/BankAccounts';
import { AssetTrend } from './components/AssetTrend';
import { CloudSyncPanel } from './components/CloudSyncPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Wallet, TrendingUp, List, Landmark, LineChart, Save } from 'lucide-react';
import { Button } from './components/ui/button';

import { useSupabaseSession } from './hooks/useSupabaseSession';
import { readLocalStoragePayload, pushToCloud } from './lib/cloudSync';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('budget');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12

  // ✅ 저장 버튼용(클라우드로 강제 저장)
  const { user, loading: authLoading } = useSupabaseSession();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const months = [
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

  const onSave = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert('동기화(클라우드 저장) 설정이 아직 안 됐어. Supabase 환경변수를 먼저 연결해야 해.');
      return;
    }
    if (authLoading) return;
    if (!user) {
      alert('클라우드 저장은 로그인 후 가능해. 위쪽 “동기화”에서 로그인 먼저 해줘.');
      return;
    }

    try {
      setSaving(true);
      setSaveMsg('');
      const payload = readLocalStoragePayload();
      await pushToCloud(user.id, payload);
      setSaveMsg('저장 완료!');
    } catch (e) {
      console.error(e);
      setSaveMsg('저장 실패… 잠깐 뒤에 다시 눌러줘.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!saveMsg) return;
    const t = setTimeout(() => setSaveMsg(''), 2000);
    return () => clearTimeout(t);
  }, [saveMsg]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="container mx-auto py-4 md:py-8 px-2 md:px-4">
        {/* ✅ 상단 헤더 + 저장 버튼(오른쪽) */}
        <div className="mb-6 flex items-center justify-between">
          <div className="w-[120px]" />
          <div className="text-center flex-1">
            <h1 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              자산 포트폴리오
            </h1>
            {saveMsg && <div className="text-sm text-gray-600">{saveMsg}</div>}
          </div>

          <div className="w-[120px] flex justify-end">
            <Button onClick={onSave} disabled={saving} className="gap-2 bg-black text-white hover:bg-gray-900">
              <Save className="w-4 h-4" />
              {saving ? '저장 중…' : '저장'}
            </Button>
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
                      selectedMonth === month.value ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' : ''
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
            <StockPortfolio />
          </TabsContent>

          <TabsContent value="watchlist" className="mt-0">
            <StockWatchlist />
          </TabsContent>

          <TabsContent value="banks" className="mt-0">
            <BankAccounts />
          </TabsContent>

          <TabsContent value="trend" className="mt-0">
            <AssetTrend />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
