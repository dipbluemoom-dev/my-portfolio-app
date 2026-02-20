import { useMemo } from 'react';
import { Card } from './ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyData {
  month: string;
  budgetBalance: number;
  bankAsset: number;
  stockAssetOjunseok: number;
  currentAsset: number;
  cumulativeBudgetBalance: number;
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const toNumber = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function AssetTrend() {
  const data = useMemo(() => {
    const getMonthlyData = (): MonthlyData[] => {
      const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

      // ✅ 통장/저축
      const bankData = readJson<any>('bankAccounts', null);
      const bankAccounts = bankData?.accounts || [];
      const savings = bankData?.savings || [];
      const bankAsset = [...bankAccounts, ...savings].reduce((sum, item) => sum + toNumber(item.amount), 0);

      // ✅ 주식(오준석 계좌만)
      const stockPortfolio = readJson<any>('stockPortfolio', null);
      const exchangeRate = toNumber(localStorage.getItem('stockExchangeRate')) || toNumber(stockPortfolio?.exchangeRate) || 0;
      const stockAccounts = stockPortfolio?.accounts || [];

      const findOjunseokAccount = stockAccounts.find((a: any) => {
        const name = String(a?.name || '').trim();
        return name === '오준석' || name.includes('오준석');
      });

      const stockAssetOjunseok = (findOjunseokAccount?.stocks || []).reduce((sum: number, s: any) => {
        const qty = toNumber(s?.quantity);
        const currentPrice = toNumber(s?.currentPrice);
        const currentValue = qty * currentPrice;
        const cur = String(s?.currency || 'USD');
        const currentValueKRW = cur === 'USD' ? currentValue * exchangeRate : currentValue;
        return sum + currentValueKRW;
      }, 0);

      // ✅ 1월 이전달(연초 시작) 자산 시작액 (사용자 지정)
      const START_ASSET_BEFORE_JAN = -4361034;
      let cumulativeBudgetBalance = START_ASSET_BEFORE_JAN;

      return months.map((month, index) => {
        // ✅ 가계부 잔액: 총수입 - 총지출 (MonthlyBudget에서 계산된 값)
        const budgetData = readJson<any>(`monthlyBudget_${index + 1}`, null);
        const budgetBalance = toNumber(budgetData?.remainingSalary ?? budgetData?.balance ?? 0);

        // ✅ 연초 시작액부터 월 잔액을 누적해서 현재 자산을 계산
        cumulativeBudgetBalance += budgetBalance;

        // ✅ 현재 자산 = (연초 시작액 + 누적 월 잔액) + 오준석 주식 평가금액 + 통장 자산
        const currentAsset = cumulativeBudgetBalance + stockAssetOjunseok + bankAsset;

        return {
          month,
          budgetBalance,
          bankAsset,
          stockAssetOjunseok,
          currentAsset,
          cumulativeBudgetBalance,
        };
      });
    };

    return getMonthlyData();
  }, []);

  const currentMonthIndex = new Date().getMonth();
  const current = data[currentMonthIndex] || data[0];

  const formatKRW = (value: number) => Math.round(value).toLocaleString();

  return (
    <Card className="p-6 bg-white shadow-md rounded-2xl border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">자산 추이</h2>
          <div className="text-xs text-gray-500 mt-1">연초 시작 자산(1월 이전): ₩ -4,361,034</div>
        </div>
        <div className="text-sm text-gray-500">
          현재 자산 = (연초 시작액 + 누적 월 잔액) + 오준석 주식 + 통장 자산
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-xl border">
          <div className="text-sm text-gray-600">통장 총 자산</div>
          <div className="text-2xl font-bold text-blue-600">₩ {formatKRW(current?.bankAsset || 0)}</div>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl border">
          <div className="text-sm text-gray-600">오준석 주식 평가금액</div>
          <div className="text-2xl font-bold text-emerald-700">₩ {formatKRW(current?.stockAssetOjunseok || 0)}</div>
        </div>
        <div className="p-4 bg-purple-50 rounded-xl border">
          <div className="text-sm text-gray-600">이번 달 잔액</div>
          <div className="text-2xl font-bold text-purple-600">₩ {formatKRW(current?.budgetBalance || 0)}</div>
        </div>
        <div className="p-4 bg-orange-50 rounded-xl border">
          <div className="text-sm text-gray-600">현재 자산</div>
          <div className="text-2xl font-bold text-orange-600">₩ {formatKRW(current?.currentAsset || 0)}</div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatKRW} />
            <Tooltip
              formatter={(value: any, name: any) => [
                `₩ ${formatKRW(Number(value))}`,
                name === 'currentAsset'
                  ? '현재 자산'
                  : name === 'budgetBalance'
                    ? '월 잔액'
                    : name === 'stockAssetOjunseok'
                      ? '오준석 주식'
                      : '통장 자산',
              ]}
            />
            <Line type="monotone" dataKey="currentAsset" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="budgetBalance" strokeDasharray="5 5" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="stockAssetOjunseok" strokeDasharray="3 3" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="p-3 bg-gray-50 rounded-lg border">
          <div className="font-semibold">💡 참고</div>
          <div className="text-gray-600 mt-1">통장/저축은 고정값(현재 시점) 기준으로 계산돼요.</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border">
          <div className="font-semibold">📈 주식</div>
          <div className="text-gray-600 mt-1">'오준석' 계좌 이름이 포함된 계좌의 평가금액만 반영돼요.</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border">
          <div className="font-semibold">🧾 월 잔액</div>
          <div className="text-gray-600 mt-1">가계부의 “잔액(총수입-총지출)” 값을 사용해요.</div>
        </div>
      </div>
    </Card>
  );
}
