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

const round2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

type TickerPriceMap = Record<string, number>; // key: "TICKER|USD" / "TICKER|KRW"
const tickerKey = (ticker: string, currency: 'KRW' | 'USD') => `${normalizeTicker(ticker)}|${currency}`;

const fmt2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmt0 = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString();

const fmtMoney = (n: number, currency: 'KRW' | 'USD') => (currency === 'KRW' ? fmt0(n) : fmt2(n));

const fmtPct = (n: number) => fmt2(n) + '%';

// ✅ 과거 버전 localStorage 데이터(필드 누락)로 인해 확장(▼) 클릭 시
// buyRecords/sellRecords가 undefined인 경우가 있었음.
// 렌더링 중 reduce/map에서 에러가 나면 화면이 하얗게 멈춘 것처럼 보이므로,
// 로딩 시점에 데이터 스키마를 보정(마이그레이션)한다.
const sanitizePortfolioData = (raw: any): PortfolioData => {
  const safeAccounts: StockAccount[] = Array.isArray(raw?.accounts) ? raw.accounts : [];

  const accounts = safeAccounts.map((a: any, idx: number) => {
    const safeStocks: Stock[] = Array.isArray(a?.stocks) ? a.stocks : [];
    return {
      id: String(a?.id ?? idx + 1),
      name: String(a?.name ?? `${idx + 1}번 계좌`),
      stocks: safeStocks.map((s: any, sIdx: number) => ({
        id: String(s?.id ?? `${idx + 1}-${sIdx + 1}`),
        ticker: String(s?.ticker ?? '티커명'),
        quantity: Number(s?.quantity) || 0,
        avgPrice: Number(s?.avgPrice) || 0,
        currentPrice: Number(s?.currentPrice) || 0,
        targetPrice: Number(s?.targetPrice) || 0,
        currency: (s?.currency === 'KRW' ? 'KRW' : 'USD') as 'KRW' | 'USD',
        buyRecords: Array.isArray(s?.buyRecords) ? s.buyRecords : [],
        sellRecords: Array.isArray(s?.sellRecords) ? s.sellRecords : [],
        isExpanded: Boolean(s?.isExpanded),
      })),
    } as StockAccount;
  });

  const exchangeRate = Number(raw?.exchangeRate) || 1350;
  return {
    accounts:
      accounts.length > 0
        ? accounts
        : [
            { id: '1', name: '1번 계좌', stocks: [] },
            { id: '2', name: '2번 계좌', stocks: [] },
          ],
    exchangeRate,
  };
};

export function StockPortfolio() {
  const [data, setData] = useState<PortfolioData>(() => {
    const saved = localStorage.getItem('stockPortfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return sanitizePortfolioData(parsed);
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

  // ✅ 공통(티커별) 현재가: 동일 티커가 계좌에 여러 개 있어도 한 번만 입력해서 자동 계산
  // (기존 데이터/계산 로직은 유지, 현재가만 공통값이 있으면 우선 적용)
  const [tickerPrices, setTickerPrices] = useState<TickerPriceMap>(() => {
    const saved = localStorage.getItem('stockTickerPrices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // ignore
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('stockTickerPrices', JSON.stringify(tickerPrices));
  }, [tickerPrices]);

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

    const avgPrice = totalQty > 0 ? round2(totalCost / totalQty) : 0;

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
    const effCurrentPrice = (() => {
      const k = tickerKey(stock.ticker, stock.currency);
      const v = tickerPrices[k];
      return Number.isFinite(v) ? v : Number(stock.currentPrice) || 0;
    })();
    const buyCost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
    const currentValue = effCurrentPrice * (Number(stock.quantity) || 0);
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
      effCurrentPrice,
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
        const k = tickerKey(stock.ticker, stock.currency);
        const eff = Number.isFinite(tickerPrices[k]) ? tickerPrices[k] : Number(stock.currentPrice) || 0;
        const currentValue = eff * (Number(stock.quantity) || 0);
        total += stock.currency === 'USD' ? currentValue * rate : currentValue;
      }
    }
    return total;
  }, [data.accounts, data.exchangeRate, tickerPrices]);

  const getAccountTotalKRW = (account: StockAccount) => {
    const rate = Number(data.exchangeRate) || 0;
    return account.stocks.reduce((sum, stock) => {
      const k = tickerKey(stock.ticker, stock.currency);
      const eff = Number.isFinite(tickerPrices[k]) ? tickerPrices[k] : Number(stock.currentPrice) || 0;
      const currentValue = eff * (Number(stock.quantity) || 0);
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
        const k = tickerKey(stock.ticker, stock.currency);
        const eff = Number.isFinite(tickerPrices[k]) ? tickerPrices[k] : Number(stock.currentPrice) || 0;
        const currentValue = eff * (Number(stock.quantity) || 0);

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
  }, [data.accounts, data.exchangeRate, tickerPrices]);

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

  const portfolioTickerKeys = useMemo(() => {
    const s = new Set<string>();
    for (const acc of data.accounts) {
      for (const st of acc.stocks) {
        const t = normalizeTicker(st.ticker);
        if (!t || t === '티커명') continue;
        s.add(tickerKey(t, st.currency));
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [data.accounts]);

  const holdingsByTickerKey = useMemo(() => {
    const grouped: Record<
      string,
      {
        key: string;
        ticker: string;
        currency: 'KRW' | 'USD';
        totalQty: number;
        totalCost: number;
      }
    > = {};

    for (const acc of data.accounts) {
      for (const st of acc.stocks) {
        const t = normalizeTicker(st.ticker);
        if (!t || t === '티커명') continue;
        const k = tickerKey(t, st.currency);
        if (!grouped[k]) {
          grouped[k] = { key: k, ticker: t, currency: st.currency, totalQty: 0, totalCost: 0 };
        }
        const q = Number(st.quantity) || 0;
        const a = Number(st.avgPrice) || 0;
        grouped[k].totalQty += q;
        grouped[k].totalCost += q * a;
      }
    }

    return Object.values(grouped)
      .map((g) => ({
        ...g,
        avgPrice: g.totalQty > 0 ? round2(g.totalCost / g.totalQty) : 0,
        currentPrice: Number.isFinite(tickerPrices[g.key]) ? tickerPrices[g.key] : undefined,
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [data.accounts, tickerPrices]);

  // 물타기 계산기
  const [avgDownKey, setAvgDownKey] = useState<string>('');
  const [avgDownAvg, setAvgDownAvg] = useState<number>(0);
  const [avgDownQty, setAvgDownQty] = useState<number>(0);
  const [avgDownCur, setAvgDownCur] = useState<number>(0);
  const [avgDownAddQty, setAvgDownAddQty] = useState<number>(0);

  const updateMonthlySales = (month: number, sales: number) => {
    setMonthlySales(
      monthlySales.map((item) => (item.month === month ? { ...item, sales } : item))
    );
  };

  const updateTickerPrice = (key: string, raw: string) => {
    const v = raw.trim();
    setTickerPrices((prev) => {
      const next: TickerPriceMap = { ...prev };
      if (v === '' || Number.isNaN(Number(v))) {
        delete next[key];
      } else {
        next[key] = Number(v);
      }
      return next;
    });
  };

  // ✅ 저채도 웜톤 파스텔(눈 편한) 차트 컬러
  // 파란 계열은 UI 전체 톤에서 제외(단, 손익(-) 표시는 별도 규칙으로 파스텔 블루 유지)
  const COLORS = [
    '#e9c7c1', // muted rose
    '#edd8b6', // muted amber
    '#e6d3e9', // muted lilac
    '#d9e4dd', // muted sage
    '#eadfd6', // muted sand
    '#e7d0c8',
    '#efe3d6',
    '#d8e0da',
    '#e2d7e6',
    '#e9e0d8',
    '#dfd9d6',
    '#f1ebe7',
  ];
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-rose-300" />
        <h1 className="text-2xl">주식 포트폴리오</h1>
      </div>

      {/* 환율 입력 */}
      <Card className="p-4 bg-white shadow-md rounded-xl border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-slate-600" />
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

      {/* ✅ 공통(티커별) 현재가 입력 */}
      <Card className="p-4 bg-white shadow-md rounded-xl border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-500" />
            <span className="font-semibold">공통 현재가 (티커별)</span>
          </div>
          <div className="text-xs text-gray-500">
            여기서 입력하면, 동일 티커가 여러 계좌에 있어도 손익/손익률이 자동 계산돼요.
          </div>
        </div>

        {holdingsByTickerKey.length === 0 ? (
          <div className="mt-3 text-sm text-gray-400">보유 종목이 없습니다</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {holdingsByTickerKey.map((g) => {
              const has = Number.isFinite(tickerPrices[g.key]);
              return (
                <div
                  key={g.key}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate">{g.ticker}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border text-gray-600">
                        {g.currency}
                      </span>
                      {has && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700">
                          적용
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      보유 {fmt0(g.totalQty)}주 · 평단 {fmtMoney(g.avgPrice, g.currency)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={has ? (tickerPrices[g.key] as number) : ''}
                      onChange={(e) => updateTickerPrice(g.key, e.target.value)}
                      className="w-28 h-9 text-right"
                      placeholder="현재가"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 text-xs text-gray-500">
          * 공통 현재가를 비우면(삭제) 기존 종목별 현재가 입력값이 다시 사용돼요.
        </div>
      </Card>

      {/* 자산 현황 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-white border shadow-md rounded-2xl">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-gray-600">총 주식 평가금액(원화)</div>
              <div className="text-3xl font-bold mt-1">₩ {fmt0(totalAssetsKRW)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-500" />
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
                  <CreditCard className="w-5 h-5 text-violet-400" />
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
                    className="text-rose-600"
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
                    const tk = tickerKey(stock.ticker, stock.currency);
                    const hasGlobal = Number.isFinite(tickerPrices[tk]);
                    const shownCurrent = hasGlobal ? (tickerPrices[tk] as number) : stock.currentPrice;

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
                            className="w-24 text-center border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={round2(Number(stock.avgPrice) || 0)}
                            onChange={(e) => updateStock(account.id, stock.id, { avgPrice: round2(Number(e.target.value)) })}
                            className="w-28 text-center border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={shownCurrent}
                            onChange={(e) => {
                              if (hasGlobal) {
                                updateTickerPrice(tk, e.target.value);
                              } else {
                                updateStock(account.id, stock.id, { currentPrice: Number(e.target.value) });
                              }
                            }}
                            className="w-28 text-center"
                          />
                          {hasGlobal && (
                            <div className="mt-1 text-[10px] text-gray-400">공통 시세 적용</div>
                          )}
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
                          <span className={metrics.targetProfitLossPercent >= 0 ? 'text-rose-400/80' : 'text-sky-500/80'}>
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
                          <div className={metrics.profitLoss >= 0 ? 'text-rose-400/80 font-semibold' : 'text-sky-500/80 font-semibold'}>
                            {isUSD ? '$ ' + fmt2(metrics.profitLoss) : '₩ ' + fmt0(metrics.profitLoss)}
                          </div>
                          {isUSD && (
                            <div className="text-xs text-gray-500">₩ {fmt0(metrics.profitLossKRW)}</div>
                          )}
                        </td>

                        <td className={`p-2 text-right font-bold ${metrics.profitLossPercent >= 0 ? 'text-rose-400/80' : 'text-sky-500/80'}`}>
                          {fmtPct(metrics.profitLossPercent)}
                        </td>

                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStock(account.id, stock.id)}
                            className="text-rose-500 hover:text-rose-600"
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

                  const buyRecords = Array.isArray(stock.buyRecords) ? stock.buyRecords : [];
                  const sellRecords = Array.isArray(stock.sellRecords) ? stock.sellRecords : [];

                  const buyTotalCost = buyRecords.reduce(
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
                            {buyRecords.map((record) => {
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
                                      className="text-rose-500 hover:text-rose-600"
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
                            {sellRecords.map((record) => {
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
                                      className="text-rose-500 hover:text-rose-600"
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
                        <div className={"font-bold " + (g.profitLossKRW >= 0 ? 'text-rose-400/80' : 'text-sky-500/80')}
                        >
                          {fmt0(g.profitLossKRW)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white border">
                        <div className="text-xs text-gray-500">손익률</div>
                        <div className={"font-bold " + (g.profitLossPct >= 0 ? 'text-rose-400/80' : 'text-sky-500/80')}
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

        {/* 물타기(평단 낮추기) 계산기 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">물타기 프로그램 (평단 낮추기 계산기)</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border bg-gray-50">
              <div className="text-sm text-gray-600">입력</div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">티커(선택)</div>
                  <select
                    value={avgDownKey}
                    onChange={(e) => {
                      const k = e.target.value;
                      setAvgDownKey(k);
                      const found = holdingsByTickerKey.find((x) => x.key === k);
                      if (found) {
                        setAvgDownAvg(found.avgPrice || 0);
                        setAvgDownQty(found.totalQty || 0);
                        setAvgDownCur((found.currentPrice ?? 0) as number);
                      }
                    }}
                    className="w-full h-9 rounded-md border px-3 bg-white text-sm"
                  >
                    <option value="">직접 입력</option>
                    {holdingsByTickerKey.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.ticker} ({g.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">현재가</div>
                  <Input
                    type="number"
                    value={avgDownCur}
                    onChange={(e) => setAvgDownCur(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">현재 평단가</div>
                  <Input
                    type="number"
                    value={avgDownAvg}
                    onChange={(e) => setAvgDownAvg(round2(Number(e.target.value)))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">현재 수량</div>
                  <Input
                    type="number"
                    value={avgDownQty}
                    onChange={(e) => setAvgDownQty(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500 mb-1">물탈 주식 수(추가 매수 수량)</div>
                  <Input
                    type="number"
                    value={avgDownAddQty}
                    onChange={(e) => setAvgDownAddQty(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                계산식: (평단×수량 + 현재가×추가수량) ÷ (수량+추가수량)
              </div>
            </div>

            <div className="p-4 rounded-2xl border bg-white">
              <div className="text-sm text-gray-600">결과</div>

              {(() => {
                const baseQty = Number(avgDownQty) || 0;
                const addQty = Number(avgDownAddQty) || 0;
                const baseAvg = Number(avgDownAvg) || 0;
                const cur = Number(avgDownCur) || 0;
                const newQty = baseQty + addQty;
                const newAvg = newQty > 0 ? round2((baseAvg * baseQty + cur * addQty) / newQty) : 0;
                const drop = round2(baseAvg - newAvg);
                const dropPct = baseAvg > 0 ? round2((drop / baseAvg) * 100) : 0;

                const dropTone = drop >= 0 ? 'text-emerald-700' : 'text-rose-400/80';

                return (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border bg-gray-50">
                      <div className="text-xs text-gray-500">새 평단가</div>
                      <div className="text-lg font-bold mt-1">{fmt2(newAvg)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-gray-50">
                      <div className="text-xs text-gray-500">평단 변화</div>
                      <div className={`text-lg font-bold mt-1 ${dropTone}`}>{fmt2(drop)}</div>
                      <div className="text-xs text-gray-500 mt-1">({fmt2(dropPct)}%)</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-gray-50">
                      <div className="text-xs text-gray-500">총 수량</div>
                      <div className="text-lg font-bold mt-1">{fmt2(newQty)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-gray-50">
                      <div className="text-xs text-gray-500">추가 매수금</div>
                      <div className="text-lg font-bold mt-1">{fmt2(cur * addQty)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
