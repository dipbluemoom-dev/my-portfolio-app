import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Settings,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface BuyRecord {
  id: string;
  date: string;
  quantity: number;
  price: number;
}

interface SellRecord {
  id: string;
  date: string;
  quantity: number;
  price: number;
}

interface Stock {
  id: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  targetPrice: number;
  currency: 'KRW' | 'USD';
  buyRecords: BuyRecord[];
  sellRecords: SellRecord[];
  isExpanded: boolean;
}

interface StockAccount {
  id: string;
  name: string;
  stocks: Stock[];
}

interface PortfolioData {
  accounts: StockAccount[];
  exchangeRate: number; // 원/달러
}

interface MonthlySalesData {
  month: number;
  sales: number;
}

const normalizeTicker = (t: string) => (t || '').trim().toUpperCase();

const fmt2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmt0 = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString();

const fmtMoney = (n: number, currency: 'KRW' | 'USD') => (currency === 'KRW' ? fmt0(n) : fmt2(n));

const fmtPct = (n: number) => fmt2(n) + '%';

export function StockPortfolio() {
  const [data, setData] = useState<PortfolioData>(() => {
    const saved = localStorage.getItem('stockPortfolio');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      accounts: [
        { id: '1', name: '1번 계좌', stocks: [] },
        { id: '2', name: '2번 계좌', stocks: [] },
      ],
      exchangeRate: 1350,
    };
  });

  const [monthlySales, setMonthlySales] = useState<MonthlySalesData[]>(() => {
    const saved = localStorage.getItem('monthlyStockSales');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sales: 0 }));
  });

  // ✅ 전역 환율(주식/주식대기표/자산추이에서 함께 씀)
  useEffect(() => {
    const rate = data.exchangeRate || 0;
    localStorage.setItem('stockExchangeRate', String(rate));
    // 주식대기표에서도 바로 반영되도록 이벤트 발송
    window.dispatchEvent(new CustomEvent('stockExchangeRateChanged', { detail: rate }));
  }, [data.exchangeRate]);

  useEffect(() => {
    localStorage.setItem('stockPortfolio', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('monthlyStockSales', JSON.stringify(monthlySales));
  }, [monthlySales]);

  const updateExchangeRate = (rate: number) => {
    setData({
      ...data,
      exchangeRate: rate,
    });
  };

  const addAccount = () => {
    const newAccount: StockAccount = {
      id: Date.now().toString(),
      name: `${data.accounts.length + 1}번 계좌`,
      stocks: [],
    };
    setData({
      ...data,
      accounts: [...data.accounts, newAccount],
    });
  };

  const updateAccountName = (accountId: string, name: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === accountId ? { ...account, name } : account
      ),
    });
  };

  const deleteAccount = (accountId: string) => {
    if (data.accounts.length <= 1) return;
    if (!confirm('이 계좌를 삭제할까요?')) return;
    setData({
      ...data,
      accounts: data.accounts.filter((account) => account.id !== accountId),
    });
  };

  const addStock = (accountId: string) => {
    const newStock: Stock = {
      id: Date.now().toString(),
      ticker: '티커명',
      quantity: 0,
      avgPrice: 0,
      currentPrice: 0,
      targetPrice: 0,
      currency: 'USD',
      buyRecords: [],
      sellRecords: [],
      isExpanded: false,
    };

    setData({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === accountId
          ? { ...account, stocks: [...account.stocks, newStock] }
          : account
      ),
    });
  };

  const deleteStock = (accountId: string, stockId: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === accountId
          ? { ...account, stocks: account.stocks.filter((stock) => stock.id !== stockId) }
          : account
      ),
    });
  };

  const updateStock = (accountId: string, stockId: string, updates: Partial<Stock>) => {
    setData({
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              stocks: account.stocks.map((stock) =>
                stock.id === stockId ? { ...stock, ...updates } : stock
              ),
            }
          : account
      ),
    });
  };

  const toggleExpand = (accountId: string, stockId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!account || !stock) return;
    updateStock(accountId, stockId, { isExpanded: !stock.isExpanded });
  };

  const addBuyRecord = (accountId: string, stockId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    const newRecord: BuyRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      quantity: 0,
      price: 0,
    };

    updateStock(accountId, stockId, {
      buyRecords: [...stock.buyRecords, newRecord],
    });
  };

  const updateBuyRecord = (accountId: string, stockId: string, recordId: string, updates: Partial<BuyRecord>) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    updateStock(accountId, stockId, {
      buyRecords: stock.buyRecords.map((record) =>
        record.id === recordId ? { ...record, ...updates } : record
      ),
    });
  };

  const deleteBuyRecord = (accountId: string, stockId: string, recordId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    updateStock(accountId, stockId, {
      buyRecords: stock.buyRecords.filter((record) => record.id !== recordId),
    });
  };

  // 매수기록 -> 수량/평단 반영
  const applyBuyRecordsToStock = (accountId: string, stockId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    const totalQty = stock.buyRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    const totalCost = stock.buyRecords.reduce(
      (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0),
      0
    );

    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

    updateStock(accountId, stockId, {
      quantity: totalQty,
      avgPrice,
    });
  };

  const addSellRecord = (accountId: string, stockId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    const newRecord: SellRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      quantity: 0,
      price: 0,
    };

    updateStock(accountId, stockId, {
      sellRecords: [...stock.sellRecords, newRecord],
    });
  };

  const updateSellRecord = (accountId: string, stockId: string, recordId: string, updates: Partial<SellRecord>) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    updateStock(accountId, stockId, {
      sellRecords: stock.sellRecords.map((record) =>
        record.id === recordId ? { ...record, ...updates } : record
      ),
    });
  };

  const deleteSellRecord = (accountId: string, stockId: string, recordId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    updateStock(accountId, stockId, {
      sellRecords: stock.sellRecords.filter((record) => record.id !== recordId),
    });
  };

  const getStockMetrics = (stock: Stock) => {
    const buyCost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
    const currentValue = (Number(stock.currentPrice) || 0) * (Number(stock.quantity) || 0);
    const profitLoss = currentValue - buyCost;

    const profitLossPercent = buyCost !== 0 ? (profitLoss / buyCost) * 100 : 0;

    const targetProfitLossPercent = stock.avgPrice !== 0
      ? ((Number(stock.targetPrice) - Number(stock.avgPrice)) / Number(stock.avgPrice)) * 100
      : 0;

    const exchangeRate = Number(data.exchangeRate) || 0;

    const buyCostKRW = stock.currency === 'USD' ? buyCost * exchangeRate : buyCost;
    const currentValueKRW = stock.currency === 'USD' ? currentValue * exchangeRate : currentValue;
    const profitLossKRW = currentValueKRW - buyCostKRW;

    return {
      buyCost,
      currentValue,
      profitLoss,
      profitLossPercent,
      targetProfitLossPercent,
      buyCostKRW,
      currentValueKRW,
      profitLossKRW,
    };
  };

  // 요약 계산
  const totalAssetsKRW = useMemo(() => {
    const rate = Number(data.exchangeRate) || 0;
    let total = 0;
    for (const account of data.accounts) {
      for (const stock of account.stocks) {
        const currentValue = (Number(stock.currentPrice) || 0) * (Number(stock.quantity) || 0);
        total += stock.currency === 'USD' ? currentValue * rate : currentValue;
      }
    }
    return total;
  }, [data.accounts, data.exchangeRate]);

  const getAccountTotalKRW = (account: StockAccount) => {
    const rate = Number(data.exchangeRate) || 0;
    return account.stocks.reduce((sum, stock) => {
      const currentValue = (Number(stock.currentPrice) || 0) * (Number(stock.quantity) || 0);
      return sum + (stock.currency === 'USD' ? currentValue * rate : currentValue);
    }, 0);
  };

  // 계좌별 비중 (구매비용 기준) - 동일 티커는 합산
  const getAccountWeights = (account: StockAccount) => {
    const rate = Number(data.exchangeRate) || 0;
    const byTicker: Record<string, number> = {};

    for (const stock of account.stocks) {
      const t = normalizeTicker(stock.ticker);
      const buyCost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
      const buyCostKRW = stock.currency === 'USD' ? buyCost * rate : buyCost;
      if (buyCostKRW <= 0) continue;
      byTicker[t] = (byTicker[t] || 0) + buyCostKRW;
    }

    const total = Object.values(byTicker).reduce((a, b) => a + b, 0);
    if (total <= 0) return [];

    return Object.entries(byTicker)
      .map(([ticker, v]) => ({ name: ticker, value: (v / total) * 100, raw: v }))
      .sort((a, b) => b.raw - a.raw)
      .map(({ name, value }) => ({ name, value }));
  };

  // 동일 티커 합산(중복 티커만)
  const duplicateTickerSummary = useMemo(() => {
    const rate = Number(data.exchangeRate) || 0;

    const grouped: Record<
      string,
      {
        ticker: string;
        count: number;
        buyCostKRW: number;
        currentValueKRW: number;
      }
    > = {};

    for (const account of data.accounts) {
      for (const stock of account.stocks) {
        const t = normalizeTicker(stock.ticker);
        const buyCost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
        const currentValue = (Number(stock.currentPrice) || 0) * (Number(stock.quantity) || 0);

        const buyCostKRW = stock.currency === 'USD' ? buyCost * rate : buyCost;
        const currentValueKRW = stock.currency === 'USD' ? currentValue * rate : currentValue;

        if (!grouped[t]) {
          grouped[t] = { ticker: t, count: 0, buyCostKRW: 0, currentValueKRW: 0 };
        }
        grouped[t].count += 1;
        grouped[t].buyCostKRW += buyCostKRW;
        grouped[t].currentValueKRW += currentValueKRW;
      }
    }

    const items = Object.values(grouped)
      .filter((g) => g.count > 1)
      .map((g) => {
        const profitLossKRW = g.currentValueKRW - g.buyCostKRW;
        const profitLossPct = g.buyCostKRW > 0 ? (profitLossKRW / g.buyCostKRW) * 100 : 0;
        return {
          ...g,
          profitLossKRW,
          profitLossPct,
        };
      })
      .sort((a, b) => b.buyCostKRW - a.buyCostKRW);

    return items;
  }, [data.accounts, data.exchangeRate]);

  const totalPortfolioBuyCostKRW = useMemo(() => {
    const rate = Number(data.exchangeRate) || 0;
    let total = 0;
    for (const account of data.accounts) {
      for (const stock of account.stocks) {
        const buyCost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
        total += stock.currency === 'USD' ? buyCost * rate : buyCost;
      }
    }
    return total;
  }, [data.accounts, data.exchangeRate]);

  const updateMonthlySales = (month: number, sales: number) => {
    setMonthlySales(
      monthlySales.map((item) => (item.month === month ? { ...item, sales } : item))
    );
  };

  const COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#22c55e',
    '#ec4899',
    '#64748b',
    '#14b8a6',
    '#eab308',
  ];
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-emerald-600" />
        <h1 className="text-2xl">주식 포트폴리오</h1>
      </div>

      {/* 환율 입력 */}
      <Card className="p-4 bg-white shadow-md rounded-xl border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold">원/달러 환율</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={data.exchangeRate}
              onChange={(e) => updateExchangeRate(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-sm text-gray-500">원/$</span>
          </div>
        </div>
        {(!data.exchangeRate || data.exchangeRate <= 0) && (
          <div className="mt-2 text-sm text-amber-700">
            * 환율이 0이면, 달러(USD) 종목의 원화 계산/비중 그래프가 이상하게 나올 수 있어요.
          </div>
        )}
      </Card>

      {/* 자산 현황 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-white border shadow-md rounded-2xl">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-gray-600">총 주식 평가금액(원화)</div>
              <div className="text-3xl font-bold mt-1">₩ {fmt0(totalAssetsKRW)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {data.accounts.slice(0, 2).map((account, idx) => {
          const accountTotalKRW = getAccountTotalKRW(account);
          const title = idx === 0 ? '1번 계좌 평가금액(원화)' : '2번 계좌 평가금액(원화)';
          return (
            <Card key={account.id} className="p-6 bg-white border shadow-md rounded-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-gray-600">{title}</div>
                  <div className="text-3xl font-bold mt-1">₩ {fmt0(accountTotalKRW)}</div>
                  <div className="mt-2 text-xs text-gray-500">계좌명: {account.name}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 계좌 섹션 */}
      <div className="space-y-6">
        {data.accounts.map((account) => (
          <Card key={account.id} className="p-6 bg-white shadow-md rounded-2xl border">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">계좌</span>
                <Input
                  value={account.name}
                  onChange={(e) => updateAccountName(account.id, e.target.value)}
                  className="w-[200px]"
                />
                {data.accounts.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAccount(account.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    계좌 삭제
                  </Button>
                )}
              </div>

              <Button onClick={() => addStock(account.id)} className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-1" />
                종목 추가
              </Button>
            </div>

            {/* 종목 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-sm text-gray-600">
                    <th className="p-2 w-10"></th>
                    <th className="p-2 text-left">티커</th>
                    <th className="p-2 text-center">수량</th>
                    <th className="p-2 text-center">평단가</th>
                    <th className="p-2 text-center">현재가</th>
                    <th className="p-2 text-center">목표가</th>
                    <th className="p-2 text-center">목표가 이익률</th>
                    <th className="p-2 text-right">평가금액</th>
                    <th className="p-2 text-right">평가금액(원화)</th>
                    <th className="p-2 text-right">손익</th>
                    <th className="p-2 text-right">손익률</th>
                    <th className="p-2 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {account.stocks.map((stock) => {
                    const metrics = getStockMetrics(stock);
                    const isUSD = stock.currency === 'USD';

                    return (
                      <tr key={stock.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-center">
                          <button
                            onClick={() => toggleExpand(account.id, stock.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="expand"
                          >
                            {stock.isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="p-2">
                          <Input
                            value={stock.ticker}
                            onChange={(e) => updateStock(account.id, stock.id, { ticker: e.target.value })}
                            className="w-24"
                          />
                          <div className="mt-1">
                            <select
                              value={stock.currency}
                              onChange={(e) =>
                                updateStock(account.id, stock.id, { currency: e.target.value as 'KRW' | 'USD' })
                              }
                              className="text-xs border rounded px-2 py-1"
                            >
                              <option value="USD">USD</option>
                              <option value="KRW">KRW</option>
                            </select>
                          </div>
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={stock.quantity}
                            onChange={(e) => updateStock(account.id, stock.id, { quantity: Number(e.target.value) })}
                            className="w-24 text-center"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={stock.avgPrice}
                            onChange={(e) => updateStock(account.id, stock.id, { avgPrice: Number(e.target.value) })}
                            className="w-28 text-center"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={stock.currentPrice}
                            onChange={(e) =>
                              updateStock(account.id, stock.id, { currentPrice: Number(e.target.value) })
                            }
                            className="w-28 text-center"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={stock.targetPrice}
                            onChange={(e) => updateStock(account.id, stock.id, { targetPrice: Number(e.target.value) })}
                            className="w-28 text-center"
                          />
                        </td>

                        <td className="p-2 text-center font-medium">
                          <span className={metrics.targetProfitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {fmtPct(metrics.targetProfitLossPercent)}
                          </span>
                        </td>

                        <td className="p-2 text-right font-semibold">
                          {isUSD ? '$ ' + fmt2(metrics.currentValue) : '₩ ' + fmt0(metrics.currentValue)}
                        </td>

                        <td className="p-2 text-right font-semibold">
                          ₩ {fmt0(metrics.currentValueKRW)}
                        </td>

                        <td className="p-2 text-right">
                          <div className={metrics.profitLoss >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {isUSD ? '$ ' + fmt2(metrics.profitLoss) : '₩ ' + fmt0(metrics.profitLoss)}
                          </div>
                          {isUSD && (
                            <div className="text-xs text-gray-500">₩ {fmt0(metrics.profitLossKRW)}</div>
                          )}
                        </td>

                        <td className={`p-2 text-right font-bold ${metrics.profitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtPct(metrics.profitLossPercent)}
                        </td>

                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStock(account.id, stock.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 확장 영역: 매수/매도 기록 */}
            <div className="mt-4 space-y-4">
              {account.stocks
                .filter((s) => s.isExpanded)
                .map((stock) => {
                  const currencySymbol = stock.currency === 'USD' ? '$' : '₩';

                  const buyTotalCost = stock.buyRecords.reduce(
                    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0),
                    0
                  );

                  return (
                    <div key={stock.id} className="p-4 rounded-xl border bg-gray-50">
                      {/* 매수 기록 */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">매수기록</h3>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => addBuyRecord(account.id, stock.id)}>
                            <Plus className="w-4 h-4 mr-1" /> 기록 추가
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyBuyRecordsToStock(account.id, stock.id)}
                          >
                            매수기록 → 수량/평단 반영
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                          <thead>
                            <tr className="border-b border-gray-200 text-sm text-gray-600">
                              <th className="p-2 text-left">매수 일자</th>
                              <th className="p-2 text-center">수량</th>
                              <th className="p-2 text-center">단가 ({currencySymbol})</th>
                              <th className="p-2 text-right">합계</th>
                              <th className="p-2 text-center">삭제</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stock.buyRecords.map((record) => {
                              const total = (Number(record.quantity) || 0) * (Number(record.price) || 0);
                              return (
                                <tr key={record.id} className="border-b border-gray-100">
                                  <td className="p-2">
                                    <Input
                                      type="date"
                                      value={record.date}
                                      onChange={(e) =>
                                        updateBuyRecord(account.id, stock.id, record.id, { date: e.target.value })
                                      }
                                      className="w-44"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <Input
                                      type="number"
                                      value={record.quantity}
                                      onChange={(e) =>
                                        updateBuyRecord(account.id, stock.id, record.id, {
                                          quantity: Number(e.target.value),
                                        })
                                      }
                                      className="w-24 text-center"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <Input
                                      type="number"
                                      value={record.price}
                                      onChange={(e) =>
                                        updateBuyRecord(account.id, stock.id, record.id, {
                                          price: Number(e.target.value),
                                        })
                                      }
                                      className="w-28 text-center"
                                    />
                                  </td>
                                  <td className="p-2 text-right font-semibold">
                                    {currencySymbol} {fmtMoney(total, stock.currency)}
                                  </td>
                                  <td className="p-2 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteBuyRecord(account.id, stock.id, record.id)}
                                      className="text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}

                            <tr className="bg-white">
                              <td className="p-2 font-semibold" colSpan={3}>
                                합계
                              </td>
                              <td className="p-2 text-right font-bold">
                                {currencySymbol} {fmtMoney(buyTotalCost, stock.currency)}
                              </td>
                              <td className="p-2"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 매도 기록 */}
                      <div className="flex items-center justify-between mt-6 mb-3">
                        <h3 className="text-lg font-semibold">매도기록</h3>
                        <Button size="sm" onClick={() => addSellRecord(account.id, stock.id)}>
                          <Plus className="w-4 h-4 mr-1" /> 기록 추가
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                          <thead>
                            <tr className="border-b border-gray-200 text-sm text-gray-600">
                              <th className="p-2 text-left">매도 일자</th>
                              <th className="p-2 text-center">수량</th>
                              <th className="p-2 text-center">단가 ({currencySymbol})</th>
                              <th className="p-2 text-right">합계</th>
                              <th className="p-2 text-center">삭제</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stock.sellRecords.map((record) => {
                              const total = (Number(record.quantity) || 0) * (Number(record.price) || 0);
                              return (
                                <tr key={record.id} className="border-b border-gray-100">
                                  <td className="p-2">
                                    <Input
                                      type="date"
                                      value={record.date}
                                      onChange={(e) =>
                                        updateSellRecord(account.id, stock.id, record.id, { date: e.target.value })
                                      }
                                      className="w-44"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <Input
                                      type="number"
                                      value={record.quantity}
                                      onChange={(e) =>
                                        updateSellRecord(account.id, stock.id, record.id, {
                                          quantity: Number(e.target.value),
                                        })
                                      }
                                      className="w-24 text-center"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <Input
                                      type="number"
                                      value={record.price}
                                      onChange={(e) =>
                                        updateSellRecord(account.id, stock.id, record.id, {
                                          price: Number(e.target.value),
                                        })
                                      }
                                      className="w-28 text-center"
                                    />
                                  </td>
                                  <td className="p-2 text-right font-semibold">
                                    {currencySymbol} {fmtMoney(total, stock.currency)}
                                  </td>
                                  <td className="p-2 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteSellRecord(account.id, stock.id, record.id)}
                                      className="text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        ))}

        {/* 계좌 추가 */}
        <div className="flex justify-center">
          <Button onClick={addAccount} variant="outline" className="bg-white">
            <Plus className="w-4 h-4 mr-1" />
            계좌 추가
          </Button>
        </div>
      </div>

      {/* 월별 매도 현황 */}
      <Card className="p-6 bg-white shadow-md rounded-2xl border">
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-2xl">월별 매도 현황</h2>
          <div className="text-xs text-gray-500">단위: 원</div>
        </div>

        {/* ✅ 부피 줄인 컴팩트 입력 (복제 기능 제거) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {monthlySales.map((item) => (
            <div
              key={item.month}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 border"
            >
              <div className="text-sm font-semibold text-gray-700">{item.month}월</div>
              <Input
                type="number"
                value={item.sales}
                onChange={(e) => updateMonthlySales(item.month, Number(e.target.value))}
                className="w-28 h-9 text-sm text-right"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* 비중 그래프 (가장 하단) */}
      <Card className="p-6 bg-white shadow-md rounded-2xl border">
        <h2 className="text-2xl mb-4">비중 그래프 (구매비용 기준)</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.accounts.slice(0, 2).map((account, idx) => {
            const weights = getAccountWeights(account);
            return (
              <div key={account.id} className="p-4 rounded-2xl border bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">
                    {idx + 1}번 계좌 비중
                    <span className="ml-2 text-xs text-gray-500">({account.name})</span>
                  </div>
                </div>

                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={weights}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, value }) => `${name} (${value.toFixed(1)}%)`}
                      >
                        {weights.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(2)}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}

        </div>

        {/* 동일 티커 합산(중복만) */}
        {duplicateTickerSummary.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">동일 티커 합산 (중복 티커만)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {duplicateTickerSummary.map((g) => {
                const weight = totalPortfolioBuyCostKRW > 0 ? (g.buyCostKRW / totalPortfolioBuyCostKRW) * 100 : 0;
                return (
                  <div key={g.ticker} className="p-4 rounded-2xl border bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">{g.ticker}</div>
                      <div className="text-xs text-gray-500">{g.count}개 포지션 · 비중 {fmt2(weight)}%</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded-lg bg-white border">
                        <div className="text-xs text-gray-500">매입원금(원)</div>
                        <div className="font-semibold">{fmt0(g.buyCostKRW)}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white border">
                        <div className="text-xs text-gray-500">평가금액(원)</div>
                        <div className="font-semibold">{fmt0(g.currentValueKRW)}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white border">
                        <div className="text-xs text-gray-500">손익(원)</div>
                        <div className={"font-bold " + (g.profitLossKRW >= 0 ? 'text-green-600' : 'text-red-600')}
                        >
                          {fmt0(g.profitLossKRW)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white border">
                        <div className="text-xs text-gray-500">손익률</div>
                        <div className={"font-bold " + (g.profitLossPct >= 0 ? 'text-green-600' : 'text-red-600')}
                        >
                          {fmtPct(g.profitLossPct)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
