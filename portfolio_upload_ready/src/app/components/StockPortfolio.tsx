import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, TrendingUp, ChevronDown, ChevronUp, RotateCcw, Save } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

type Currency = 'USD' | 'KRW';

interface PurchaseRecord {
  id: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  quantity: number;
  price: number;
  date: string; // YYYY-MM-DD
}

interface Stock {
  id: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  targetPrice: number;
  currency: Currency;
  purchases?: PurchaseRecord[];
  sales?: SaleRecord[];
  isExpanded?: boolean;
}

interface Account {
  id: string;
  name: string;
  stocks: Stock[];
}

interface StockPortfolioData {
  exchangeRate: number;
  accounts: Account[];
}

interface StockMetrics {
  totalBuyCost: number;
  totalBuyCostKRW: number;
  currentValue: number;
  currentValueKRW: number;
  profitLoss: number;
  profitLossKRW: number;
  profitLossPercent: number;
  targetValue: number;
  targetValueKRW: number;
  targetProfitLoss: number;
  targetProfitLossKRW: number;
  targetProfitLossPercent: number;
}

const COLORS = [
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#FB7185',
  '#22D3EE',
  '#F97316',
  '#10B981',
  '#6366F1',
];

const STORAGE_KEY = 'stockPortfolio';
const EXCHANGE_RATE_KEY = 'stockExchangeRate';

const fmt2 = (n: number) =>
  (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');
const fmtPct2 = (n: number) => `${Number.isFinite(n) ? n.toFixed(2) : '0.00'}%`;

export function StockPortfolio() {
  const [data, setData] = useState<StockPortfolioData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedExchangeRate = localStorage.getItem(EXCHANGE_RATE_KEY);
    const exchangeRate = savedExchangeRate ? Number(savedExchangeRate) : 1300;

    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        exchangeRate,
        accounts: parsed.accounts || [],
      };
    }

    return {
      exchangeRate,
      accounts: [
        { id: '1', name: '계좌 1', stocks: [] },
        { id: '2', name: '계좌 2', stocks: [] },
      ],
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts: data.accounts }));
  }, [data.accounts]);

  useEffect(() => {
    localStorage.setItem(EXCHANGE_RATE_KEY, String(data.exchangeRate));
    // 다른 컴포넌트(대기표 등)에도 동일 환율을 적용하기 위해 이벤트 발사
    window.dispatchEvent(new Event('stockExchangeRateChanged'));
  }, [data.exchangeRate]);

  const toKRW = (amount: number, currency: Currency) => (currency === 'USD' ? amount * data.exchangeRate : amount);

  const calculateStockMetrics = (stock: Stock): StockMetrics => {
    const totalBuyCost = stock.quantity * stock.avgPrice;
    const currentValue = stock.quantity * stock.currentPrice;
    const profitLoss = currentValue - totalBuyCost;
    const profitLossPercent = totalBuyCost > 0 ? (profitLoss / totalBuyCost) * 100 : 0;

    const targetValue = stock.quantity * stock.targetPrice;
    const targetProfitLoss = targetValue - totalBuyCost;
    const targetProfitLossPercent = totalBuyCost > 0 ? (targetProfitLoss / totalBuyCost) * 100 : 0;

    return {
      totalBuyCost,
      totalBuyCostKRW: toKRW(totalBuyCost, stock.currency),
      currentValue,
      currentValueKRW: toKRW(currentValue, stock.currency),
      profitLoss,
      profitLossKRW: toKRW(profitLoss, stock.currency),
      profitLossPercent,
      targetValue,
      targetValueKRW: toKRW(targetValue, stock.currency),
      targetProfitLoss,
      targetProfitLossKRW: toKRW(targetProfitLoss, stock.currency),
      targetProfitLossPercent,
    };
  };

  const calculateAccountMetrics = (account: Account) => {
    const stocksWithMetrics = account.stocks.map((stock) => ({ stock, metrics: calculateStockMetrics(stock) }));
    const totals = stocksWithMetrics.reduce(
      (acc, { metrics }) => {
        acc.totalBuyCostKRW += metrics.totalBuyCostKRW;
        acc.currentValueKRW += metrics.currentValueKRW;
        acc.profitLossKRW += metrics.profitLossKRW;
        return acc;
      },
      { totalBuyCostKRW: 0, currentValueKRW: 0, profitLossKRW: 0 }
    );

    const profitLossPercent = totals.totalBuyCostKRW > 0 ? (totals.profitLossKRW / totals.totalBuyCostKRW) * 100 : 0;
    return { ...totals, profitLossPercent, stocksWithMetrics };
  };

  const totalMetrics = useMemo(() => {
    const totals = data.accounts.reduce(
      (acc, account) => {
        const m = calculateAccountMetrics(account);
        acc.totalBuyCostKRW += m.totalBuyCostKRW;
        acc.currentValueKRW += m.currentValueKRW;
        acc.profitLossKRW += m.profitLossKRW;
        return acc;
      },
      { totalBuyCostKRW: 0, currentValueKRW: 0, profitLossKRW: 0 }
    );
    const profitLossPercent = totals.totalBuyCostKRW > 0 ? (totals.profitLossKRW / totals.totalBuyCostKRW) * 100 : 0;
    return { ...totals, profitLossPercent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.accounts, data.exchangeRate]);

  const updateAccountName = (accountId: string, name: string) => {
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) => (acc.id === accountId ? { ...acc, name } : acc)),
    }));
  };

  const addStock = (accountId: string) => {
    const newStock: Stock = {
      id: Date.now().toString(),
      ticker: '',
      quantity: 0,
      avgPrice: 0,
      currentPrice: 0,
      targetPrice: 0,
      currency: 'USD',
      purchases: [],
      sales: [],
      isExpanded: true,
    };
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) => (acc.id === accountId ? { ...acc, stocks: [...acc.stocks, newStock] } : acc)),
    }));
  };

  const updateStock = (accountId: string, stockId: string, updates: Partial<Stock>) => {
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((stock) => (stock.id === stockId ? { ...stock, ...updates } : stock)),
            }
          : acc
      ),
    }));
  };

  const deleteStock = (accountId: string, stockId: string) => {
    if (!confirm('이 종목을 삭제할까요?')) return;
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, stocks: acc.stocks.filter((s) => s.id !== stockId) } : acc
      ),
    }));
  };

  const toggleStockExpand = (accountId: string, stockId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    updateStock(accountId, stockId, { isExpanded: !stock?.isExpanded });
  };

  const addPurchaseRecord = (accountId: string, stockId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const purchases = stock?.purchases || [];
    const newRecord: PurchaseRecord = { id: Date.now().toString(), quantity: 0, price: 0 };
    updateStock(accountId, stockId, { purchases: [...purchases, newRecord] });
  };

  const updatePurchaseRecord = (
    accountId: string,
    stockId: string,
    recordId: string,
    updates: Partial<PurchaseRecord>
  ) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const purchases = stock?.purchases || [];
    updateStock(accountId, stockId, {
      purchases: purchases.map((r) => (r.id === recordId ? { ...r, ...updates } : r)),
    });
  };

  const deletePurchaseRecord = (accountId: string, stockId: string, recordId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const purchases = stock?.purchases || [];
    updateStock(accountId, stockId, { purchases: purchases.filter((r) => r.id !== recordId) });
  };

  const applyPurchaseRecords = (accountId: string, stockId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    const purchases = stock.purchases || [];
    const totalQty = purchases.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalCost = purchases.reduce((sum, r) => sum + (r.quantity || 0) * (r.price || 0), 0);

    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
    updateStock(accountId, stockId, { quantity: totalQty, avgPrice });
  };

  const addSaleRecord = (accountId: string, stockId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const sales = stock?.sales || [];
    const today = new Date().toISOString().slice(0, 10);
    const newRecord: SaleRecord = { id: Date.now().toString(), quantity: 0, price: 0, date: today };
    updateStock(accountId, stockId, { sales: [...sales, newRecord] });
  };

  const updateSaleRecord = (accountId: string, stockId: string, recordId: string, updates: Partial<SaleRecord>) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const sales = stock?.sales || [];
    updateStock(accountId, stockId, { sales: sales.map((r) => (r.id === recordId ? { ...r, ...updates } : r)) });
  };

  const deleteSaleRecord = (accountId: string, stockId: string, recordId: string) => {
    const account = data.accounts.find((a) => a.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    const sales = stock?.sales || [];
    updateStock(accountId, stockId, { sales: sales.filter((r) => r.id !== recordId) });
  };

  const calculateMonthlySales = (account: Account) => {
    const monthly: Record<string, number> = {};
    const monthlyQty: Record<string, number> = {};

    for (const stock of account.stocks) {
      const sales = stock.sales || [];
      for (const sale of sales) {
        if (!sale.date) continue;
        const monthKey = sale.date.slice(0, 7); // YYYY-MM
        const amount = (sale.quantity || 0) * (sale.price || 0);
        const amountKRW = toKRW(amount, stock.currency);
        monthly[monthKey] = (monthly[monthKey] || 0) + amountKRW;
        monthlyQty[monthKey] = (monthlyQty[monthKey] || 0) + (sale.quantity || 0);
      }
    }

    const keys = Object.keys(monthly).sort();
    return keys.map((k) => ({ month: k, salesKRW: monthly[k], quantity: monthlyQty[k] }));
  };

  const renderStock = (accountId: string, stock: Stock) => {
    const metrics = calculateStockMetrics(stock);
    const purchases = stock.purchases || [];
    const sales = stock.sales || [];

    const purchaseTotal = purchases.reduce((sum, r) => sum + (r.quantity || 0) * (r.price || 0), 0);
    const purchaseTotalKRW = toKRW(purchaseTotal, stock.currency);
    const saleTotal = sales.reduce((sum, r) => sum + (r.quantity || 0) * (r.price || 0), 0);
    const saleTotalKRW = toKRW(saleTotal, stock.currency);

    return (
      <Card key={stock.id} className="p-4 bg-white shadow-sm border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={stock.ticker}
              onChange={(e) => updateStock(accountId, stock.id, { ticker: e.target.value.toUpperCase() })}
              className="w-28 font-bold"
              placeholder="티커"
            />
            <select
              value={stock.currency}
              onChange={(e) => updateStock(accountId, stock.id, { currency: e.target.value as Currency })}
              className="border rounded px-2 py-1"
            >
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">현재가</span>
              <Input
                type="number"
                value={stock.currentPrice}
                onChange={(e) => updateStock(accountId, stock.id, { currentPrice: Number(e.target.value) })}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">목표가</span>
              <Input
                type="number"
                value={stock.targetPrice}
                onChange={(e) => updateStock(accountId, stock.id, { targetPrice: Number(e.target.value) })}
                className="w-24"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => toggleStockExpand(accountId, stock.id)}>
              {stock.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => deleteStock(accountId, stock.id)}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        </div>

        {/* 핵심 요약 */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-600">보유 수량</div>
            <div className="font-semibold">{fmt2(stock.quantity)}주</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-600">평단가</div>
            <div className="font-semibold">
              {fmt2(stock.avgPrice)} {stock.currency}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-600">평가금액</div>
            <div className="font-semibold">
              {fmt2(metrics.currentValue)} {stock.currency}
            </div>
            <div className="text-xs text-gray-500">{fmt2(metrics.currentValueKRW)}원</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-600">손익</div>
            <div className={`font-semibold ${metrics.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.profitLoss >= 0 ? '+' : ''}{fmt2(metrics.profitLoss)} {stock.currency}
            </div>
            <div className={`text-xs ${metrics.profitLossKRW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.profitLossKRW >= 0 ? '+' : ''}{fmt2(metrics.profitLossKRW)}원
            </div>
            <div className={`text-xs ${metrics.profitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.profitLossPercent >= 0 ? '+' : ''}{fmtPct2(metrics.profitLossPercent)}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-600">목표가 이익률</div>
            <div className={`font-semibold ${metrics.targetProfitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.targetProfitLossPercent >= 0 ? '+' : ''}{fmtPct2(metrics.targetProfitLossPercent)}
            </div>
          </div>
        </div>

        {stock.isExpanded && (
          <div className="mt-4 space-y-4">
            {/* 매수 기록 */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-blue-800">매수 기록</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addPurchaseRecord(accountId, stock.id)}>
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                  </Button>
                  <Button size="sm" onClick={() => applyPurchaseRecords(accountId, stock.id)} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-1" />
                    적용
                  </Button>
                </div>
              </div>

              {purchases.length > 0 ? (
                <div className="space-y-2">
                  {purchases.map((record) => (
                    <div key={record.id} className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={record.quantity}
                        onChange={(e) => updatePurchaseRecord(accountId, stock.id, record.id, { quantity: Number(e.target.value) })}
                        className="w-24"
                        placeholder="수량"
                      />
                      <Input
                        type="number"
                        value={record.price}
                        onChange={(e) => updatePurchaseRecord(accountId, stock.id, record.id, { price: Number(e.target.value) })}
                        className="w-24"
                        placeholder="가격"
                      />
                      <span className="text-sm text-gray-600">=</span>
                      <span className="text-sm font-medium">{fmt2((record.quantity || 0) * (record.price || 0))} {stock.currency}</span>
                      <Button size="sm" variant="ghost" onClick={() => deletePurchaseRecord(accountId, stock.id, record.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">매수 합계</span>
                      <div className="text-right">
                        <div className="font-semibold">{fmt2(purchaseTotal)} {stock.currency}</div>
                        <div className="text-xs text-gray-600">{fmt2(purchaseTotalKRW)}원</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-2">매수 기록이 없습니다.</div>
              )}
            </div>

            {/* 매도 기록 */}
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-red-800">매도 기록</h4>
                <Button size="sm" variant="outline" onClick={() => addSaleRecord(accountId, stock.id)}>
                  <Plus className="w-4 h-4 mr-1" />
                  추가
                </Button>
              </div>

              {sales.length > 0 ? (
                <div className="space-y-2">
                  {sales.map((record) => (
                    <div key={record.id} className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={record.date}
                        onChange={(e) => updateSaleRecord(accountId, stock.id, record.id, { date: e.target.value })}
                        className="w-40"
                      />
                      <Input
                        type="number"
                        value={record.quantity}
                        onChange={(e) => updateSaleRecord(accountId, stock.id, record.id, { quantity: Number(e.target.value) })}
                        className="w-24"
                        placeholder="수량"
                      />
                      <Input
                        type="number"
                        value={record.price}
                        onChange={(e) => updateSaleRecord(accountId, stock.id, record.id, { price: Number(e.target.value) })}
                        className="w-24"
                        placeholder="가격"
                      />
                      <span className="text-sm text-gray-600">=</span>
                      <span className="text-sm font-medium">{fmt2((record.quantity || 0) * (record.price || 0))} {stock.currency}</span>
                      <Button size="sm" variant="ghost" onClick={() => deleteSaleRecord(accountId, stock.id, record.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-red-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">매도 합계</span>
                      <div className="text-right">
                        <div className="font-semibold">{fmt2(saleTotal)} {stock.currency}</div>
                        <div className="text-xs text-gray-600">{fmt2(saleTotalKRW)}원</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-2">매도 기록이 없습니다.</div>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderAccount = (account: Account) => {
    const metrics = calculateAccountMetrics(account);
    return (
      <Card key={account.id} className="p-6 bg-white shadow-md">
        <div className="flex items-center justify-between mb-4">
          <Input
            value={account.name}
            onChange={(e) => updateAccountName(account.id, e.target.value)}
            className="text-xl font-bold border-none p-0 w-48"
          />
          <div className="text-right">
            <div className="text-sm text-gray-600">총 평가금액</div>
            <div className="text-xl font-bold">{fmt2(metrics.currentValueKRW)}원</div>
            <div className={`text-sm font-semibold ${metrics.profitLossKRW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.profitLossKRW >= 0 ? '+' : ''}{fmt2(metrics.profitLossKRW)}원 ({metrics.profitLossPercent >= 0 ? '+' : ''}{fmtPct2(metrics.profitLossPercent)})
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {account.stocks.map((stock) => renderStock(account.id, stock))}
          <Button onClick={() => addStock(account.id)} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            종목 추가
          </Button>
        </div>
      </Card>
    );
  };

  // 전체 포트폴리오 비중 데이터
  const portfolioPieData = useMemo(() => {
    const allStocks = data.accounts.flatMap((acc) => acc.stocks);
    const validStocks = allStocks.filter((s) => s.ticker && s.quantity > 0);
    const totalValueKRW = validStocks.reduce((sum, s) => sum + toKRW(s.quantity * s.currentPrice, s.currency), 0);
    return validStocks
      .map((s) => {
        const valueKRW = toKRW(s.quantity * s.currentPrice, s.currency);
        return {
          name: s.ticker,
          value: valueKRW,
          percentage: totalValueKRW > 0 ? (valueKRW / totalValueKRW) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.accounts, data.exchangeRate]);

  const accountPieData = useMemo(() => {
    return data.accounts.map((acc) => {
      const validStocks = acc.stocks.filter((s) => s.ticker && s.quantity > 0);
      const totalValueKRW = validStocks.reduce((sum, s) => sum + toKRW(s.quantity * s.currentPrice, s.currency), 0);
      const pie = validStocks
        .map((s) => {
          const valueKRW = toKRW(s.quantity * s.currentPrice, s.currency);
          return {
            name: s.ticker,
            value: valueKRW,
            percentage: totalValueKRW > 0 ? (valueKRW / totalValueKRW) * 100 : 0,
          };
        })
        .sort((a, b) => b.value - a.value);
      return { account: acc, pie };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.accounts, data.exchangeRate]);

  // 월별 매도 현황
  const monthlySalesByAccount = useMemo(() => {
    return data.accounts.map((acc) => ({ account: acc, monthly: calculateMonthlySales(acc) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.accounts, data.exchangeRate]);

  const resetAll = () => {
    if (!confirm('주식 데이터(계좌/종목/기록)를 초기화할까요?')) return;
    setData((prev) => ({
      ...prev,
      accounts: [
        { id: '1', name: '계좌 1', stocks: [] },
        { id: '2', name: '계좌 2', stocks: [] },
      ],
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 상단 요약 */}
      <Card className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">전체 포트폴리오</h2>
            <div className="text-sm text-white/80">총 평가금액</div>
            <div className="text-3xl font-bold">{fmt2(totalMetrics.currentValueKRW)}원</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white/80">총 손익</div>
            <div className={`text-2xl font-bold ${totalMetrics.profitLossKRW >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {totalMetrics.profitLossKRW >= 0 ? '+' : ''}{fmt2(totalMetrics.profitLossKRW)}원
            </div>
            <div className={`text-lg ${totalMetrics.profitLossPercent >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {totalMetrics.profitLossPercent >= 0 ? '+' : ''}{fmtPct2(totalMetrics.profitLossPercent)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={resetAll} className="text-xs">
            <RotateCcw className="w-4 h-4 mr-1" />
            전체 초기화
          </Button>
        </div>
      </Card>

      {/* 환율 */}
      <Card className="p-4 bg-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">환율 (USD → KRW)</h3>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={data.exchangeRate}
              onChange={(e) => setData((prev) => ({ ...prev, exchangeRate: Number(e.target.value) }))}
              className="w-32"
            />
            <span className="text-sm text-gray-600">원</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">이 값이 주식/대기표 등 모든 USD 계산에 공통으로 적용돼요.</div>
      </Card>

      {/* 계좌 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{data.accounts.map((acc) => renderAccount(acc))}</div>

      {/* 월별 매도 현황 */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-2xl mb-4">월별 매도 현황</h2>
        <div className="space-y-8">
          {monthlySalesByAccount.map(({ account, monthly }) => {
            const totalSales = monthly.reduce((sum, m) => sum + m.salesKRW, 0);
            return (
              <div key={account.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm text-gray-600">총 매도금액: <span className="font-semibold">{fmt2(totalSales)}원</span></div>
                </div>

                {monthly.length > 0 ? (
                  <>
                    <div className="h-56 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthly}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => [`${fmt2(Number(value))}원`, '매도금액']} />
                          <Legend />
                          <Line type="monotone" dataKey="salesKRW" strokeWidth={2} name="매도금액" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">월</th>
                            <th className="text-right py-2">매도금액(KRW)</th>
                            <th className="text-right py-2">매도수량</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthly.map((m) => (
                            <tr key={m.month} className="border-b">
                              <td className="py-2">{m.month}</td>
                              <td className="py-2 text-right font-medium">{fmt2(m.salesKRW)}원</td>
                              <td className="py-2 text-right">{fmt2(m.quantity)}주</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 text-sm">매도 기록이 없습니다.</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ✅ 비중 그래프: 제일 하단 */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-2xl mb-4">비중 그래프</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accountPieData.map(({ account, pie }) => (
            <div key={account.id} className="border rounded-lg p-4">
              <div className="font-semibold mb-2">{account.name} 비중</div>
              {pie.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pie}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name} ${Number(percentage).toFixed(1)}%`}
                        outerRadius={90}
                        dataKey="value"
                      >
                        {pie.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${fmt2(Number(value))}원`, '평가금액']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">보유 종목이 없습니다.</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 border rounded-lg p-4">
          <div className="font-semibold mb-2">전체 포트폴리오 비중</div>
          {portfolioPieData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${Number(percentage).toFixed(1)}%`}
                    outerRadius={140}
                    dataKey="value"
                  >
                    {portfolioPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${fmt2(Number(value))}원`, '평가금액']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">보유 종목이 없습니다.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
