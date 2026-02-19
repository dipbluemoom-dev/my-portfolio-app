import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, TrendingUp, DollarSign, PieChart as PieChartIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Purchase {
  id: string;
  quantity: number;
  price: number;
}

interface Sale {
  id: string;
  month: number; // 1-12
  quantity: number;
  price: number;
  date: string;
}

interface Stock {
  id: string;
  ticker: string;
  currentPrice: number;
  targetPrice: number;
  purchases: Purchase[];
  sales: Sale[];
  currency: 'KRW' | 'USD';
}

interface Account {
  id: string;
  name: string;
  stocks: Stock[];
}

interface StockData {
  accounts: Account[];
  exchangeRate: number; // USD to KRW
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export function StockPortfolio() {
  const [data, setData] = useState<StockData>(() => {
    const saved = localStorage.getItem('stockPortfolio');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      accounts: [
        { id: '1', name: '계좌 1번', stocks: [] },
        { id: '2', name: '계좌 2번', stocks: [] },
      ],
      exchangeRate: 1100, // Example exchange rate
    };
  });

  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');

  useEffect(() => {
    localStorage.setItem('stockPortfolio', JSON.stringify(data));
  }, [data]);

  // 다른 화면(주식 대기표 등)에서도 같은 환율을 쓰기 위해 별도 키로도 저장
  useEffect(() => {
    localStorage.setItem('stockExchangeRate', String(data.exchangeRate ?? 0));
    window.dispatchEvent(new CustomEvent('stockExchangeRateChanged', { detail: data.exchangeRate }));
  }, [data.exchangeRate]);

  const updateAccountName = (accountId: string, name: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, name } : acc
      ),
    });
  };

  const addStock = (accountId: string) => {
    const newStock: Stock = {
      id: Date.now().toString(),
      ticker: '티커명',
      currentPrice: 0,
      targetPrice: 0,
      purchases: [],
      sales: [],
      currency: 'USD',
    };
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, stocks: [...acc.stocks, newStock] } : acc
      ),
    });
  };

  const deleteStock = (accountId: string, stockId: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? { ...acc, stocks: acc.stocks.filter((s) => s.id !== stockId) }
          : acc
      ),
    });
  };

  const updateStock = (accountId: string, stockId: string, updates: Partial<Stock>) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) => (s.id === stockId ? { ...s, ...updates } : s)),
            }
          : acc
      ),
    });
  };

  const addPurchase = (accountId: string, stockId: string) => {
    const newPurchase: Purchase = {
      id: Date.now().toString(),
      quantity: 0,
      price: 0,
    };
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId ? { ...s, purchases: [...s.purchases, newPurchase] } : s
              ),
            }
          : acc
      ),
    });
  };

  const updatePurchase = (
    accountId: string,
    stockId: string,
    purchaseId: string,
    updates: Partial<Purchase>
  ) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId
                  ? {
                      ...s,
                      purchases: s.purchases.map((p) =>
                        p.id === purchaseId ? { ...p, ...updates } : p
                      ),
                    }
                  : s
              ),
            }
          : acc
      ),
    });
  };

  const deletePurchase = (accountId: string, stockId: string, purchaseId: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId
                  ? { ...s, purchases: s.purchases.filter((p) => p.id !== purchaseId) }
                  : s
              ),
            }
          : acc
      ),
    });
  };

  const addSale = (accountId: string, stockId: string) => {
    const newSale: Sale = {
      id: Date.now().toString(),
      month: new Date().getMonth() + 1, // Current month
      quantity: 0,
      price: 0,
      date: new Date().toISOString().split('T')[0], // Current date
    };
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId ? { ...s, sales: [...s.sales, newSale] } : s
              ),
            }
          : acc
      ),
    });
  };

  const updateSale = (
    accountId: string,
    stockId: string,
    saleId: string,
    updates: Partial<Sale>
  ) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId
                  ? {
                      ...s,
                      sales: s.sales.map((sa) =>
                        sa.id === saleId ? { ...sa, ...updates } : sa
                      ),
                    }
                  : s
              ),
            }
          : acc
      ),
    });
  };

  const deleteSale = (accountId: string, stockId: string, saleId: string) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((s) =>
                s.id === stockId
                  ? { ...s, sales: s.sales.filter((sa) => sa.id !== saleId) }
                  : s
              ),
            }
          : acc
      ),
    });
  };

  const toggleExpand = (stockId: string) => {
    const newExpanded = new Set(expandedStocks);
    if (newExpanded.has(stockId)) {
      newExpanded.delete(stockId);
    } else {
      newExpanded.add(stockId);
    }
    setExpandedStocks(newExpanded);
  };

  const toKRW = (amount: number, currency: 'KRW' | 'USD') => {
    return currency === 'USD' ? amount * data.exchangeRate : amount;
  };

  const calculateStockMetrics = (stock: Stock) => {
    // ✅ 매수 기록(분할매수) 합계
    const totalBuyQuantity = stock.purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalBuyCost = stock.purchases.reduce((sum, p) => sum + p.quantity * p.price, 0);

    // ✅ 매도 기록 합계
    const soldQuantity = stock.sales.reduce((sum, s) => sum + s.quantity, 0);
    const totalSellProceeds = stock.sales.reduce((sum, s) => sum + s.quantity * s.price, 0);

    // 평균 매입단가(간단 평균법)
    const avgPrice = totalBuyQuantity > 0 ? totalBuyCost / totalBuyQuantity : 0;

    // 현재 보유 수량
    const currentQuantity = totalBuyQuantity - soldQuantity;

    // 평가금액(보유수량 * 현재가)
    const currentValue = Math.max(0, currentQuantity) * stock.currentPrice;

    // ✅ 손익은 "총 매수금액" 기준으로 계산(사용자가 매수기록에 입력한 합계와 맞춰서 보여주기)
    //   - 매도를 많이 섞어 계산하면 복잡해져서, 여기서는 단순히 "평가금액 - 총 매수금액"으로 통일
    const profitLoss = currentValue - totalBuyCost;
    const profitLossRate = totalBuyCost > 0 ? (profitLoss / totalBuyCost) * 100 : 0;

    // 목표가 기준 기대수익률(평단 → 목표가)
    const targetProfitRate = avgPrice > 0 ? ((stock.targetPrice - avgPrice) / avgPrice) * 100 : 0;

    // 원화 환산 값
    const totalBuyCostKRW = toKRW(totalBuyCost, stock.currency);
    const currentValueKRW = toKRW(currentValue, stock.currency);
    const profitLossKRW = currentValueKRW - totalBuyCostKRW;
    const totalSellProceedsKRW = toKRW(totalSellProceeds, stock.currency);

    return {
      totalBuyQuantity,
      soldQuantity,
      currentQuantity,
      totalBuyCost,
      totalBuyCostKRW,
      avgPrice,
      currentValue,
      currentValueKRW,
      profitLoss,
      profitLossKRW,
      profitLossRate,
      targetProfitRate,
      totalSellProceeds,
      totalSellProceedsKRW,
    };
  };

  const calculateAccountMetrics = (account: Account) => {
    const stocks = account.stocks.map((stock) => ({
      stock,
      metrics: calculateStockMetrics(stock),
    }));

    const totalCost = stocks.reduce((sum, { metrics }) => sum + metrics.totalBuyCostKRW, 0);
    const totalValue = stocks.reduce((sum, { metrics }) => sum + metrics.currentValueKRW, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    return {
      stocks,
      totalCost,
      totalValue,
      totalProfitLoss,
      totalProfitLossRate,
    };
  };

  // 계좌별 월별 매도 금액 계산
  const calculateMonthlySales = (accountId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    if (!account) return [];

    const monthlySales: Record<number, number> = {};
    for (let month = 1; month <= 12; month++) {
      monthlySales[month] = 0;
    }

    account.stocks.forEach((stock) => {
      stock.sales.forEach((sale) => {
        const saleAmount = sale.quantity * sale.price;
        const saleAmountKRW = toKRW(saleAmount, stock.currency);
        monthlySales[sale.month] += saleAmountKRW;
      });
    });

    return Object.entries(monthlySales).map(([month, amount]) => ({
      month: `${month}월`,
      매도금액: amount,
    }));
  };

  const allStocks = data.accounts.flatMap((acc) =>
    acc.stocks.map((stock) => ({
      accountId: acc.id,
      accountName: acc.name,
      stock,
      metrics: calculateStockMetrics(stock),
    }))
  );

  const totalInvestment = allStocks.reduce((sum, { metrics }) => sum + metrics.totalBuyCostKRW, 0);
  const totalCurrentValue = allStocks.reduce((sum, { metrics }) => sum + metrics.currentValueKRW, 0);
  const totalProfitLoss = totalCurrentValue - totalInvestment;
  const totalProfitLossRate = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;

  const pieData = allStocks
    .filter(({ metrics }) => metrics.totalBuyCostKRW > 0)
    .map(({ stock, metrics }) => ({
      name: stock.ticker,
      value: metrics.totalBuyCostKRW,
      percentage: totalInvestment > 0 ? (metrics.totalBuyCostKRW / totalInvestment) * 100 : 0,
    }));

  const renderStock = (accountId: string, stock: Stock) => {
    const metrics = calculateStockMetrics(stock);
    const isExpanded = expandedStocks.has(stock.id);

    const showKRWSub = stock.currency === 'USD' && data.exchangeRate > 0;
    const unit = stock.currency === 'USD' ? '$' : '원';

    return (
      <div key={stock.id} className="border rounded-xl p-4 mb-4 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={stock.ticker}
            onChange={(e) => updateStock(accountId, stock.id, { ticker: e.target.value })}
            className="w-32"
            placeholder="티커"
          />
          <select
            value={stock.currency}
            onChange={(e) =>
              updateStock(accountId, stock.id, { currency: e.target.value as 'KRW' | 'USD' })
            }
            className="px-3 py-2 border rounded"
          >
            <option value="KRW">₩</option>
            <option value="USD">$</option>
          </select>
          <Input
            type="number"
            value={stock.currentPrice}
            onChange={(e) => updateStock(accountId, stock.id, { currentPrice: Number(e.target.value) })}
            className="w-32"
            placeholder="현재가"
          />
          <Input
            type="number"
            value={stock.targetPrice}
            onChange={(e) => updateStock(accountId, stock.id, { targetPrice: Number(e.target.value) })}
            className="w-32"
            placeholder="목표가"
          />
          <Button size="sm" variant="ghost" onClick={() => toggleExpand(stock.id)}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteStock(accountId, stock.id)}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-2">
          <div>
            <div className="text-gray-500">총 구매가(매수합)</div>
            <div className="font-semibold">{metrics.totalBuyCost.toLocaleString()}{unit}</div>
            {showKRWSub && <div className="text-xs text-gray-400">≈ {metrics.totalBuyCostKRW.toLocaleString()}원</div>}
          </div>

          <div>
            <div className="text-gray-500">평단가</div>
            <div className="font-semibold">{metrics.avgPrice.toFixed(4)}{unit}</div>
          </div>

          <div>
            <div className="text-gray-500">보유 수량</div>
            <div className="font-semibold">{Math.max(0, metrics.currentQuantity).toLocaleString()}주</div>
          </div>

          <div>
            <div className="text-gray-500">평가금액</div>
            <div className="font-semibold">{metrics.currentValue.toLocaleString()}{unit}</div>
            <div className="text-xs text-gray-500">{metrics.currentValueKRW.toLocaleString()}원</div>
          </div>

          <div>
            <div className="text-gray-500">손익</div>
            <div className={metrics.profitLoss >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
              {metrics.profitLoss.toLocaleString()}{unit} ({metrics.profitLossRate.toFixed(2)}%)
            </div>
            <div className={metrics.profitLossKRW >= 0 ? 'text-xs text-green-600' : 'text-xs text-red-600'}>
              {metrics.profitLossKRW.toLocaleString()}원
            </div>
          </div>

          <div>
            <div className="text-gray-500">목표가 이익률</div>
            <div className={metrics.targetProfitRate >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
              {metrics.targetProfitRate.toFixed(2)}%
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4>매수기록</h4>
              <Button size="sm" onClick={() => addPurchase(accountId, stock.id)}>
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
            {stock.purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center gap-2 mb-2">
                <Input
                  type="number"
                  value={purchase.quantity}
                  onChange={(e) =>
                    updatePurchase(accountId, stock.id, purchase.id, {
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-24"
                  placeholder="수량"
                />
                <span>주</span>
                <Input
                  type="number"
                  value={purchase.price}
                  onChange={(e) =>
                    updatePurchase(accountId, stock.id, purchase.id, {
                      price: Number(e.target.value),
                    })
                  }
                  className="w-32"
                  placeholder="단가"
                />
                <span>{stock.currency === 'USD' ? '$' : '원'}</span>
                <span className="text-sm text-gray-600">
                  합계: {(purchase.quantity * purchase.price).toLocaleString()}{stock.currency === 'USD' ? '$' : '원'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePurchase(accountId, stock.id, purchase.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between mb-2 mt-4">
              <h4>매도기록</h4>
              <Button size="sm" onClick={() => addSale(accountId, stock.id)}>
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
            {stock.sales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-2 mb-2">
                <select
                  value={sale.month}
                  onChange={(e) =>
                    updateSale(accountId, stock.id, sale.id, {
                      month: Number(e.target.value),
                    })
                  }
                  className="px-3 py-2 border rounded w-24"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}월
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={sale.quantity}
                  onChange={(e) =>
                    updateSale(accountId, stock.id, sale.id, {
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-24"
                  placeholder="수량"
                />
                <span>주</span>
                <Input
                  type="number"
                  value={sale.price}
                  onChange={(e) =>
                    updateSale(accountId, stock.id, sale.id, {
                      price: Number(e.target.value),
                    })
                  }
                  className="w-32"
                  placeholder="단가"
                />
                <span>{stock.currency === 'USD' ? '$' : '원'}</span>
                <span className="text-sm text-gray-600">
                  합계: {(sale.quantity * sale.price).toLocaleString()}{stock.currency === 'USD' ? '$' : '원'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteSale(accountId, stock.id, sale.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAccount = (account: Account) => {
    const accountMetrics = calculateAccountMetrics(account);
    const isEditingAccount = editingAccountId === account.id;

    // 계좌별 파이 차트 데이터
    const accountPieData = accountMetrics.stocks
      .filter(({ metrics }) => metrics.totalBuyCostKRW > 0)
      .map(({ stock, metrics }) => ({
        name: stock.ticker,
        value: metrics.totalBuyCostKRW,
        percentage: accountMetrics.totalCost > 0 ? (metrics.totalBuyCostKRW / accountMetrics.totalCost) * 100 : 0,
      }));

    return (
      <Card key={account.id} className="p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          {isEditingAccount ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editingAccountName}
                onChange={(e) => setEditingAccountName(e.target.value)}
                className="max-w-xs"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  updateAccountName(account.id, editingAccountName);
                  setEditingAccountId(null);
                }}
              >
                <Check className="w-4 h-4 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingAccountId(null)}
              >
                <X className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl">{account.name}</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingAccountId(account.id);
                  setEditingAccountName(account.name);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button onClick={() => addStock(account.id)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            주식 추가
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded">
          <div>
            <div className="text-sm text-gray-600">총 투자금</div>
            <div>{accountMetrics.totalCost.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">현재 가치</div>
            <div>{accountMetrics.totalValue.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">손익</div>
            <div className={accountMetrics.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
              {accountMetrics.totalProfitLoss.toLocaleString()}원
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">손익률</div>
            <div className={accountMetrics.totalProfitLossRate >= 0 ? 'text-green-600' : 'text-red-600'}>
              {accountMetrics.totalProfitLossRate.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* 계좌별 파이 차트 */}
        {accountPieData.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
            <h3 className="text-lg mb-2 font-semibold">{account.name} 비중</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={accountPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {accountPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString() + '원'} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {account.stocks.map((stock) => renderStock(account.id, stock))}
      </Card>
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-8 h-8 text-green-600" />
        <h1 className="text-2xl">주식 포트폴리오</h1>
      </div>

      {/* 총 합계 */}
      <Card className="p-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6" />
          <h2 className="text-2xl">총 합계</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm opacity-90">총 투자금</div>
            <div className="text-xl font-bold">{totalInvestment.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm opacity-90">현재 가치</div>
            <div className="text-xl font-bold">{totalCurrentValue.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm opacity-90">총 손익</div>
            <div className={`text-xl font-bold ${totalProfitLoss >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
              {totalProfitLoss.toLocaleString()}원
            </div>
          </div>
          <div>
            <div className="text-sm opacity-90">손익률</div>
            <div className={`text-xl font-bold ${totalProfitLossRate >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
              {totalProfitLossRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </Card>

      {/* 환율 설정 */}
      <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 shadow-md">
        <div className="flex items-center gap-4">
          <label className="font-semibold text-amber-900">환율 (USD → KRW):</label>
          <Input
            type="number"
            value={data.exchangeRate}
            onChange={(e) => setData({ ...data, exchangeRate: Number(e.target.value) })}
            className="w-40"
            placeholder="1100"
          />
          <span className="text-sm text-gray-600">원/$</span>
          <span className="text-xs text-gray-500">* 모든 USD 금액이 이 환율로 원화 변환됩니다</span>
        </div>
      </Card>

      {/* 섹터별 비중 차트 */}
      {pieData.length > 0 && (
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-100 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl text-indigo-900">포트폴리오 비중</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString() + '원'} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 계좌별 주식 */}
      {data.accounts.map((account) => renderAccount(account))}

      {/* 월별 매도 금액 섹션 */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-2xl mb-4">월별 매도 금액 추이</h2>
        
        {data.accounts.map((account) => {
          const salesData = calculateMonthlySales(account.id);
          const totalSales = salesData.reduce((sum, item) => sum + item.매도금액, 0);
          
          if (totalSales === 0) return null;

          return (
            <div key={account.id} className="mb-8">
              <h3 className="text-xl mb-4 text-blue-800">{account.name} - 월별 매도</h3>
              
              {/* 그래프 */}
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => value.toLocaleString() + '원'}
                      labelStyle={{ color: '#000' }}
                    />
                    <Legend />
                    <Bar dataKey="매도금액" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-100">
                      <th className="p-3 text-left">월</th>
                      <th className="p-3 text-right">매도금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">{item.month}</td>
                        <td className="p-3 text-right font-semibold text-green-600">
                          {item.매도금액.toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td className="p-3">총 매도금액</td>
                      <td className="p-3 text-right text-lg text-green-700">
                        {totalSales.toLocaleString()}원
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {data.accounts.every((account) => {
          const salesData = calculateMonthlySales(account.id);
          return salesData.reduce((sum, item) => sum + item.매도금액, 0) === 0;
        }) && (
          <div className="text-center text-gray-500 py-8">
            아직 매도 내역이 없습니다.
          </div>
        )}
      </Card>
    </div>
  );
}