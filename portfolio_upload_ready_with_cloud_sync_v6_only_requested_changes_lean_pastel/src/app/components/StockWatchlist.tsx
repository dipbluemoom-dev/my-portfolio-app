import { useState, useEffect } from 'react';
import { Plus, Trash2, List } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface WatchlistStock {
  id: string;
  ticker: string;
  currentPrice: number;
  targetPrice: number;
  quantity: number;
  currency: 'KRW' | 'USD';
}

interface WatchlistData {
  tier1: WatchlistStock[];
  tier2: WatchlistStock[];
  tier3: WatchlistStock[];
  tier4: WatchlistStock[];
}

export function StockWatchlist() {
  const getGlobalExchangeRate = () => {
    const direct = localStorage.getItem('stockExchangeRate');
    if (direct && !Number.isNaN(Number(direct))) return Number(direct);
    const portfolio = localStorage.getItem('stockPortfolio');
    if (portfolio) {
      try {
        const parsed = JSON.parse(portfolio);
        const v = Number(parsed?.exchangeRate);
        if (!Number.isNaN(v)) return v;
      } catch {}
    }
    return 0;
  };

  const [exchangeRate, setExchangeRate] = useState<number>(() => getGlobalExchangeRate());

  const [data, setData] = useState<WatchlistData>(() => {
    const saved = localStorage.getItem('stockWatchlist');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      tier1: [],
      tier2: [],
      tier3: [],
      tier4: [],
    };
  });

  useEffect(() => {
    localStorage.setItem('stockWatchlist', JSON.stringify(data));
  }, [data]);

  // 주식 포트폴리오에서 환율을 바꾸면 여기에도 자동 반영
  useEffect(() => {
    const onChanged = (e: Event) => {
      const rate = (e as CustomEvent).detail;
      if (typeof rate === 'number') setExchangeRate(rate);
    };
    window.addEventListener('stockExchangeRateChanged', onChanged);

    // 탭 이동/새로고침 등에서 값이 바뀔 수 있으니 포커스 때도 한 번 동기화
    const onFocus = () => setExchangeRate(getGlobalExchangeRate());
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('stockExchangeRateChanged', onChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const addStock = (tier: keyof WatchlistData) => {
    const newStock: WatchlistStock = {
      id: Date.now().toString(),
      ticker: '티커명',
      currentPrice: 0,
      targetPrice: 0,
      quantity: 0,
      currency: 'USD',
    };
    setData({
      ...data,
      [tier]: [...data[tier], newStock],
    });
  };

  const deleteStock = (tier: keyof WatchlistData, id: string) => {
    setData({
      ...data,
      [tier]: data[tier].filter((stock) => stock.id !== id),
    });
  };

  const updateStock = (
    tier: keyof WatchlistData,
    id: string,
    updates: Partial<WatchlistStock>
  ) => {
    setData({
      ...data,
      [tier]: data[tier].map((stock) => (stock.id === id ? { ...stock, ...updates } : stock)),
    });
  };

  const calculateReturn = (currentPrice: number, targetPrice: number) => {
    if (currentPrice === 0) return 0;
    return ((targetPrice - currentPrice) / currentPrice) * 100;
  };

  const renderTier = (tier: keyof WatchlistData, tierName: string) => {
    const stocks = data[tier];

    return (
      <Card key={tier} className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">{tierName}</h2>
          <Button onClick={() => addStock(tier)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>

        {stocks.length === 0 ? (
          <div className="text-center text-gray-400 py-8">대기 중인 주식이 없습니다</div>
        ) : (
          <div className="space-y-4">
            {stocks.map((stock) => {
              const expectedReturn = calculateReturn(stock.currentPrice, stock.targetPrice);
              const totalInvestment = stock.currentPrice * stock.quantity;
              const expectedProfit = (stock.targetPrice - stock.currentPrice) * stock.quantity;

              const showKRW = stock.currency === 'USD' && exchangeRate > 0;
              const totalInvestmentKRW = showKRW ? totalInvestment * exchangeRate : 0;
              const expectedProfitKRW = showKRW ? expectedProfit * exchangeRate : 0;

              return (
                <div key={stock.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-6 gap-4 mb-2">
                    <div>
                      <label className="text-sm text-gray-600">티커</label>
                      <Input
                        value={stock.ticker}
                        onChange={(e) =>
                          updateStock(tier, stock.id, { ticker: e.target.value })
                        }
                        className="mt-1"
                        placeholder="티커명"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">화폐</label>
                      <select
                        value={stock.currency}
                        onChange={(e) =>
                          updateStock(tier, stock.id, { currency: e.target.value as 'KRW' | 'USD' })
                        }
                        className="mt-1 px-3 py-2 border rounded w-full"
                      >
                        <option value="KRW">₩</option>
                        <option value="USD">$</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">현재가</label>
                      <Input
                        type="number"
                        value={stock.currentPrice}
                        onChange={(e) =>
                          updateStock(tier, stock.id, { currentPrice: Number(e.target.value) })
                        }
                        className="mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">목표가</label>
                      <Input
                        type="number"
                        value={stock.targetPrice}
                        onChange={(e) =>
                          updateStock(tier, stock.id, { targetPrice: Number(e.target.value) })
                        }
                        className="mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">주식 수</label>
                      <Input
                        type="number"
                        value={stock.quantity}
                        onChange={(e) =>
                          updateStock(tier, stock.id, { quantity: Number(e.target.value) })
                        }
                        className="mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteStock(tier, stock.id)}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 p-3 bg-gray-50 rounded">
                    <div>
                      <div className="text-sm text-gray-600">목표 수익률</div>
                      <div
                        className={`text-lg ${
                          expectedReturn >= 0 ? 'text-rose-500/80' : 'text-sky-600/80'
                        }`}
                      >
                        {expectedReturn.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">예상 투자금</div>
                      <div>
                        {totalInvestment.toLocaleString()}{stock.currency === 'USD' ? '$' : '원'}
                        {showKRW && (
                          <div className="text-xs text-gray-500">≈ {Math.round(totalInvestmentKRW).toLocaleString()}원</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">예상 수익</div>
                      <div
                        className={`${
                          expectedProfit >= 0 ? 'text-rose-500/80' : 'text-sky-600/80'
                        }`}
                      >
                        {expectedProfit.toLocaleString()}{stock.currency === 'USD' ? '$' : '원'}
                        {showKRW && (
                          <div className="text-xs text-gray-500">≈ {Math.round(expectedProfitKRW).toLocaleString()}원</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <List className="w-8 h-8 text-violet-400" />
        <h1 className="text-2xl">주식 대기표</h1>
      </div>

      <div className="text-sm text-gray-600">
        환율: <span className="font-semibold">{exchangeRate ? exchangeRate.toLocaleString() : '미설정'}</span> 원/$
        <span className="text-xs text-gray-500"> (주식 포트폴리오에서 입력한 값이 자동 적용됩니다)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTier('tier1', '1차 대기')}
        {renderTier('tier2', '2차 대기')}
        {renderTier('tier3', '3차 대기')}
        {renderTier('tier4', '4차 대기')}
      </div>
    </div>
  );
}