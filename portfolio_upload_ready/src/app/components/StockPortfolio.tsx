import { useState, useEffect, useMemo, useRef } from 'react';
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
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { Button, Input, Card } from './ui';
import { numInputValue } from '../lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
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
  // 매도 시점의 평단가(스냅샷). 이후 추가매수로 평단이 바뀌어도 과거 손익 계산이 흔들리지 않게 함
  avgPriceAtSell?: number;
}

// ✅ 매도 원장(레저)
// - 종목을 삭제하더라도 월별 매도 현황(실현손익)이 유지되도록
//   매도 기록을 계좌/종목과 별개로 보관한다.
interface SellLedgerEntry {
  id: string; // ledger entry id
  sourceRecordId: string; // SellRecord.id
  accountId: string;
  // 종목을 삭제해도 유지해야 하므로 ticker/currency는 레저에 독립 보관
  ticker: string;
  currency: 'KRW' | 'USD';
  date: string; // YYYY-MM-DD
  quantity: number;
  sellPrice: number;
  avgPriceAtSell: number;
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

interface CashFlowRecord {
  id: string;
  date: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  memo: string;
}

interface StockAccount {
  id: string;
  name: string;
  cashHoldings: number;
  /** ✅ true면 현금 보유량을 자동 계산 (순입금 − 보유원가 + 실현손익) */
  autoCash?: boolean;
  stocks: Stock[];
  cashFlows: CashFlowRecord[];
}

interface PortfolioData {
  accounts: StockAccount[];
  exchangeRate: number; // 원/달러
  // ✅ 종목 삭제와 무관하게 유지되는 매도 원장
  sellLedger: SellLedgerEntry[];
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
      cashHoldings: Number(a?.cashHoldings) || 0,
      autoCash: Boolean(a?.autoCash),
      cashFlows: Array.isArray(a?.cashFlows)
        ? a.cashFlows.map((f: any, fIdx: number) => ({
            id: String(f?.id ?? `${idx + 1}-cash-${fIdx + 1}`),
            date: String(f?.date ?? ''),
            type: f?.type === 'withdraw' ? 'withdraw' : 'deposit',
            amount: Number(f?.amount) || 0,
            memo: String(f?.memo ?? ''),
          }))
        : [],
      stocks: safeStocks.map((s: any, sIdx: number) => ({
        id: String(s?.id ?? `${idx + 1}-${sIdx + 1}`),
        ticker: String(s?.ticker ?? '티커명'),
        quantity: Number(s?.quantity) || 0,
        avgPrice: Number(s?.avgPrice) || 0,
        currentPrice: Number(s?.currentPrice) || 0,
        targetPrice: Number(s?.targetPrice) || 0,
        currency: (s?.currency === 'KRW' ? 'KRW' : 'USD') as 'KRW' | 'USD',
        buyRecords: Array.isArray(s?.buyRecords) ? s.buyRecords : [],
        sellRecords: Array.isArray(s?.sellRecords)
          ? s.sellRecords.map((r: any, rIdx: number) => ({
              id: String(r?.id ?? `${idx + 1}-${sIdx + 1}-sell-${rIdx + 1}`),
              date: String(r?.date ?? ''),
              quantity: Number(r?.quantity) || 0,
              price: Number(r?.price) || 0,
              avgPriceAtSell: Number(r?.avgPriceAtSell) || (Number(s?.avgPrice) || 0),
            }))
          : [],
        isExpanded: Boolean(s?.isExpanded),
      })),
    } as StockAccount;
  });

  const exchangeRate = Number(raw?.exchangeRate) || 1350;

  // ✅ sellLedger: 있으면 그대로, 없으면 (기존 sellRecords 기반으로) 자동 생성
  const rawLedger = Array.isArray(raw?.sellLedger) ? raw.sellLedger : null;
  const sellLedger: SellLedgerEntry[] = rawLedger
    ? rawLedger
        .filter((x: any) => x && typeof x === 'object')
        .map((x: any, i: number) => ({
          id: String(x?.id ?? `L-${i + 1}`),
          sourceRecordId: String(x?.sourceRecordId ?? ''),
          accountId: String(x?.accountId ?? ''),
          ticker: normalizeTicker(String(x?.ticker ?? '')),
          currency: (x?.currency === 'KRW' ? 'KRW' : 'USD') as 'KRW' | 'USD',
          date: String(x?.date ?? ''),
          quantity: Number(x?.quantity) || 0,
          sellPrice: Number(x?.sellPrice) || 0,
          avgPriceAtSell: Number(x?.avgPriceAtSell) || 0,
        }))
    : (() => {
        const entries: SellLedgerEntry[] = [];
        for (const acc of accounts) {
          for (const st of acc.stocks) {
            const t = normalizeTicker(st.ticker);
            const records = Array.isArray(st.sellRecords) ? st.sellRecords : [];
            for (const r of records) {
              const sourceId = String((r as any).id ?? '');
              entries.push({
                id: `L-${acc.id}-${sourceId || Math.random().toString(16).slice(2)}`,
                sourceRecordId: sourceId,
                accountId: String(acc.id),
                ticker: t,
                currency: st.currency,
                date: String((r as any).date ?? ''),
                quantity: Number((r as any).quantity) || 0,
                sellPrice: Number((r as any).price) || 0,
                avgPriceAtSell: Number((r as any).avgPriceAtSell) || Number(st.avgPrice) || 0,
              });
            }
          }
        }
        return entries;
      })();

  // 중복 sourceRecordId 제거(최초 1개만 유지)
  const deduped: SellLedgerEntry[] = [];
  const seen = new Set<string>();
  for (const e of sellLedger) {
    const key = e.sourceRecordId ? `${e.accountId}::${e.sourceRecordId}` : `${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }

  return {
    accounts:
      accounts.length > 0
        ? accounts
        : [
            { id: '1', name: '1번 계좌', cashHoldings: 0, autoCash: false, stocks: [], cashFlows: [] },
            { id: '2', name: '2번 계좌', cashHoldings: 0, autoCash: false, stocks: [], cashFlows: [] },
          ],
    exchangeRate,
    sellLedger: deduped,
  };
};

export function StockPortfolio() {
  // ✅ 로컬 데이터가 깨졌을 때(예: JSON 파싱 실패) 기본값으로 덮어써서
  // 사용자가 입력해둔 값이 "사라진 것처럼" 보일 수 있어.
  // - 파싱 성공 시: last_good 백업 저장
  // - 파싱 실패 시: corrupt_backup에 원본 보관 + 자동 저장으로 덮어쓰기 방지
  const [loadOk, setLoadOk] = useState(true);

  const [data, setData] = useState<PortfolioData>(() => {
    const saved = localStorage.getItem('stockPortfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizePortfolioData(parsed);
        try {
          localStorage.setItem('stockPortfolio__last_good', JSON.stringify(sanitized));
        } catch {
          // ignore
        }
        return sanitized;
      } catch {
        try {
          localStorage.setItem('stockPortfolio__corrupt_backup__' + new Date().toISOString(), saved);
        } catch {
          // ignore
        }
      }
    }
    return {
      accounts: [
        { id: '1', name: '1번 계좌', cashHoldings: 0, autoCash: false, stocks: [], cashFlows: [] },
        { id: '2', name: '2번 계좌', cashHoldings: 0, autoCash: false, stocks: [], cashFlows: [] },
      ],
      exchangeRate: 1350,
      sellLedger: [],
    };
  });

  useEffect(() => {
    const saved = localStorage.getItem('stockPortfolio');
    if (!saved) return;
    try {
      JSON.parse(saved);
      setLoadOk(true);
    } catch {
      setLoadOk(false);
    }
  }, []);
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

  // =====================
  // Undo / Redo
  // =====================
  type Snapshot = { data: PortfolioData; tickerPrices: TickerPriceMap };
  const deepClone = <T,>(v: T): T => {
    try {
      if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(v);
      }
    } catch {
      // ignore and fall back below
    }
    return JSON.parse(JSON.stringify(v));
  };

  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const lastEditAtRef = useRef<number>(0);

  const pushUndo = (mode: 'edit' | 'action') => {
    const snap: Snapshot = { data: deepClone(data), tickerPrices: deepClone(tickerPrices) };
    setRedoStack([]);
    setUndoStack((prev) => {
      const now = Date.now();
      // 입력 중(연속 수정)은 한 번만 저장해서 "한 번에 되돌리기"가 되도록(coalesce)
      if (mode === 'edit' && now - lastEditAtRef.current < 800 && prev.length > 0) {
        lastEditAtRef.current = now;
        return prev;
      }
      lastEditAtRef.current = now;
      const next = [...prev, snap];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  };

  const doUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const current: Snapshot = { data: deepClone(data), tickerPrices: deepClone(tickerPrices) };
      const last = prev[prev.length - 1];
      setRedoStack((r) => {
        const next = [...r, current];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });
      setData(last.data);
      setTickerPrices(last.tickerPrices);
      setLoadOk(true);
      return prev.slice(0, -1);
    });
  };

  const doRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const current: Snapshot = { data: deepClone(data), tickerPrices: deepClone(tickerPrices) };
      const last = prev[prev.length - 1];
      setUndoStack((u) => {
        const next = [...u, current];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });
      setData(last.data);
      setTickerPrices(last.tickerPrices);
      setLoadOk(true);
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    const isEditable = (el: Element | null) => {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (isEditable(document.activeElement)) return;

      const k = String(e.key || '').toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        doRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data, tickerPrices]);

  const setDataWithUndo = (mode: 'edit' | 'action', updater: (prev: PortfolioData) => PortfolioData) => {
    pushUndo(mode);
    setData((prev) => updater(prev));
  };

  // ✅ 전역 환율(주식/주식대기표/자산추이에서 함께 씀)
  useEffect(() => {
    const rate = data.exchangeRate || 0;
    localStorage.setItem('stockExchangeRate', String(rate));
    // 주식대기표에서도 바로 반영되도록 이벤트 발송
    window.dispatchEvent(new CustomEvent('stockExchangeRateChanged', { detail: rate }));
  }, [data.exchangeRate]);

  useEffect(() => {
    // 파싱 실패(loadOk=false) 상태에서는 자동 저장으로 기존 값을 덮어쓰지 않음.
    // 데이터가 깨진 상태에서 "빈 값"을 다시 저장해버리면 복구가 더 어려워져.
    if (!loadOk) return;
    localStorage.setItem('stockPortfolio', JSON.stringify(data));
    // last_good 백업도 갱신
    try {
      localStorage.setItem('stockPortfolio__last_good', JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data, loadOk]);
  const updateExchangeRate = (rate: number) => {
    setDataWithUndo('edit', (prev) => ({ ...prev, exchangeRate: rate }));
  };

  const addAccount = () => {
    setDataWithUndo('action', (prev) => {
      const newAccount: StockAccount = {
        id: Date.now().toString(),
        name: `${prev.accounts.length + 1}번 계좌`,
        cashHoldings: 0,
        autoCash: false,
        stocks: [],
        cashFlows: [],
      };
      return { ...prev, accounts: [...prev.accounts, newAccount] };
    });
  };

  const updateAccountName = (accountId: string, name: string) => {
    setDataWithUndo('edit', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId ? { ...account, name } : account
      ),
    }));
  };


  const updateAccountCashHoldings = (accountId: string, cashHoldings: number) => {
    setDataWithUndo('edit', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId ? { ...account, cashHoldings } : account
      ),
    }));
  };

  const deleteAccount = (accountId: string) => {
    if (data.accounts.length <= 1) return;
    if (!confirm('이 계좌를 삭제할까요?')) return;
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.filter((account) => account.id !== accountId),
    }));
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

    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? { ...account, stocks: [...account.stocks, newStock] }
          : account
      ),
    }));
  };

  const deleteStock = (accountId: string, stockId: string) => {
    if (!confirm('이 티커(종목)를 삭제할까요?\n*전량 매도된 티커를 삭제해도 월별 매도 현황(실현손익)은 유지됩니다.')) return;
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? { ...account, stocks: account.stocks.filter((stock) => stock.id !== stockId) }
          : account
      ),
      // ✅ sellLedger는 삭제하지 않음 (월별 매도 현황 유지)
    }));
  };

  const updateStock = (accountId: string, stockId: string, updates: Partial<Stock>, mode: 'edit' | 'action' = 'edit') => {
    setDataWithUndo(mode, (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              stocks: account.stocks.map((stock) =>
                stock.id === stockId ? { ...stock, ...updates } : stock
              ),
            }
          : account
      ),
    }));
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
    }, 'action');
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
    }, 'action');
  };

  // 매수기록 -> 수량/평단 반영
  const applyBuyRecordsToStock = (accountId: string, stockId: string) => {
    const account = data.accounts.find((acc) => acc.id === accountId);
    const stock = account?.stocks.find((s) => s.id === stockId);
    if (!stock) return;

    const buyRecords = Array.isArray(stock.buyRecords) ? stock.buyRecords : [];

    const totalQty = buyRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    const totalCost = buyRecords.reduce(
      (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0),
      0
    );

    if (totalQty <= 0) {
      alert('매수기록이 비어있거나 수량이 0이에요. (수량/평단을 0으로 덮어쓰지 않도록) 반영을 취소했어요.');
      return;
    }

    const avgPrice = round2(totalCost / totalQty);

    updateStock(accountId, stockId, {
      quantity: totalQty,
      avgPrice,
    }, 'action');
  };

  const addSellRecord = (accountId: string, stockId: string) => {
    const recordId = Date.now().toString();
    const today = new Date().toISOString().split('T')[0];

    setDataWithUndo('action', (prev) => {
      let ledgerEntry: SellLedgerEntry | null = null;

      const accounts = prev.accounts.map((acc) => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          stocks: acc.stocks.map((st) => {
            if (st.id !== stockId) return st;
            const newRecord: SellRecord = {
              id: recordId,
              date: today,
              quantity: 0,
              price: 0,
              avgPriceAtSell: round2(Number(st.avgPrice) || 0),
            };

            ledgerEntry = {
              id: `L-${accountId}-${recordId}`,
              sourceRecordId: recordId,
              accountId,
              ticker: normalizeTicker(st.ticker),
              currency: st.currency,
              date: newRecord.date,
              quantity: newRecord.quantity,
              sellPrice: newRecord.price,
              avgPriceAtSell: Number(newRecord.avgPriceAtSell) || 0,
            };

            return {
              ...st,
              sellRecords: [...(Array.isArray(st.sellRecords) ? st.sellRecords : []), newRecord],
            };
          }),
        };
      });

      const nextLedger = ledgerEntry
        ? [...(Array.isArray(prev.sellLedger) ? prev.sellLedger : []).filter((e) => !(e.accountId === accountId && e.sourceRecordId === recordId)), ledgerEntry]
        : prev.sellLedger;

      return { ...prev, accounts, sellLedger: nextLedger };
    });
  };

  const updateSellRecord = (accountId: string, stockId: string, recordId: string, updates: Partial<SellRecord>) => {
    setDataWithUndo('edit', (prev) => {
      let nextLedgerEntry: SellLedgerEntry | null = null;
      let nextTicker = '';
      let nextCurrency: 'KRW' | 'USD' = 'USD';

      const accounts = prev.accounts.map((acc) => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          stocks: acc.stocks.map((st) => {
            if (st.id !== stockId) return st;
            nextTicker = normalizeTicker(st.ticker);
            nextCurrency = st.currency;
            const nextSellRecords = (Array.isArray(st.sellRecords) ? st.sellRecords : []).map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    ...updates,
                    // avgPriceAtSell가 비면 현재 평단으로 보정(과거 데이터 호환)
                    avgPriceAtSell:
                      Number((updates as any).avgPriceAtSell) || Number((r as any).avgPriceAtSell) || round2(Number(st.avgPrice) || 0),
                  }
                : r
            );

            const updated = nextSellRecords.find((r) => r.id === recordId);
            if (updated) {
              nextLedgerEntry = {
                id: `L-${accountId}-${recordId}`,
                sourceRecordId: recordId,
                accountId,
                ticker: nextTicker,
                currency: nextCurrency,
                date: String((updated as any).date ?? ''),
                quantity: Number((updated as any).quantity) || 0,
                sellPrice: Number((updated as any).price) || 0,
                avgPriceAtSell: Number((updated as any).avgPriceAtSell) || round2(Number(st.avgPrice) || 0),
              };
            }

            return { ...st, sellRecords: nextSellRecords };
          }),
        };
      });

      const prevLedger = Array.isArray(prev.sellLedger) ? prev.sellLedger : [];
      const nextLedger = nextLedgerEntry
        ? [...prevLedger.filter((e) => !(e.accountId === accountId && e.sourceRecordId === recordId)), nextLedgerEntry]
        : prevLedger;

      return { ...prev, accounts, sellLedger: nextLedger };
    });
  };

  const deleteSellRecord = (accountId: string, stockId: string, recordId: string) => {
    if (!confirm('이 매도 기록을 삭제할까요? (월별 매도 현황에서도 함께 빠져요)')) return;
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) =>
        acc.id === accountId
          ? {
              ...acc,
              stocks: acc.stocks.map((st) =>
                st.id === stockId
                  ? {
                      ...st,
                      sellRecords: (Array.isArray(st.sellRecords) ? st.sellRecords : []).filter((r) => r.id !== recordId),
                    }
                  : st
              ),
            }
          : acc
      ),
      sellLedger: (Array.isArray(prev.sellLedger) ? prev.sellLedger : []).filter((e) => !(e.accountId === accountId && e.sourceRecordId === recordId)),
    }));
  };


  // 매도기록 -> 수량 반영(평단 유지)
  // + 매도 손익 계산을 위해, 각 매도기록에 매도 시점 평단(avgPriceAtSell)을 스냅샷으로 저장한다.
  const applySellRecordsToStock = (accountId: string, stockId: string) => {
    setDataWithUndo('action', (prev) => {
      let didApply = false;
      let nextLedger = Array.isArray(prev.sellLedger) ? [...prev.sellLedger] : [];

      const accounts = prev.accounts.map((acc) => {
        if (acc.id !== accountId) return acc;
        return {
          ...acc,
          stocks: acc.stocks.map((st) => {
            if (st.id !== stockId) return st;

            const sr = Array.isArray(st.sellRecords) ? st.sellRecords : [];
            const fixedSellRecords = sr.map((r) => ({
              ...r,
              avgPriceAtSell: Number((r as any).avgPriceAtSell) || round2(Number(st.avgPrice) || 0),
            }));

            const sellQty = fixedSellRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
            if (sellQty <= 0) {
              return st;
            }

            // ✅ 레저 동기화(삭제해도 월별 매도 현황 유지)
            for (const r of fixedSellRecords) {
              const rid = String((r as any).id ?? '');
              const entry: SellLedgerEntry = {
                id: `L-${accountId}-${rid}`,
                sourceRecordId: rid,
                accountId,
                ticker: normalizeTicker(st.ticker),
                currency: st.currency,
                date: String((r as any).date ?? ''),
                quantity: Number((r as any).quantity) || 0,
                sellPrice: Number((r as any).price) || 0,
                avgPriceAtSell: Number((r as any).avgPriceAtSell) || round2(Number(st.avgPrice) || 0),
              };
              nextLedger = [...nextLedger.filter((e) => !(e.accountId === accountId && e.sourceRecordId === rid)), entry];
            }

            didApply = true;
            const currentQty = Number(st.quantity) || 0;
            const nextQty = Math.max(0, currentQty - sellQty);

            return {
              ...st,
              quantity: nextQty,
              sellRecords: fixedSellRecords,
            };
          }),
        };
      });

      if (!didApply) {
        // 매도 수량 0이면 원본 유지
        alert('매도기록 수량이 0이에요. 수량 반영을 취소했어요.');
        return prev;
      }

      return { ...prev, accounts, sellLedger: nextLedger };
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

  const getAccountStockTotalKRW = (account: StockAccount) => {
    const rate = Number(data.exchangeRate) || 0;
    return account.stocks.reduce((sum, stock) => {
      const k = tickerKey(stock.ticker, stock.currency);
      const eff = Number.isFinite(tickerPrices[k]) ? tickerPrices[k] : Number(stock.currentPrice) || 0;
      const currentValue = eff * (Number(stock.quantity) || 0);
      return sum + (stock.currency === 'USD' ? currentValue * rate : currentValue);
    }, 0);
  };

  const getAccountNetCashFlowKRW = (account: StockAccount) =>
    (Array.isArray(account.cashFlows) ? account.cashFlows : []).reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0;
      return sum + (entry.type === 'withdraw' ? -amount : amount);
    }, 0);

  // ✅ 보유종목 매수원가 합 (원화 환산)
  const getAccountHoldingCostKRW = (account: StockAccount) => {
    const rate = Number(data.exchangeRate) || 0;
    return account.stocks.reduce((sum, stock) => {
      const cost = (Number(stock.avgPrice) || 0) * (Number(stock.quantity) || 0);
      return sum + (stock.currency === 'USD' ? cost * rate : cost);
    }, 0);
  };

  // ✅ 계좌별 실현손익 합 (매도 원장 기준, 원화 환산)
  const getAccountRealizedPnLKRW = (accountId: string) => {
    const rate = Number(data.exchangeRate) || 0;
    const ledger = Array.isArray(data.sellLedger) ? data.sellLedger : [];
    return ledger.reduce((sum, e) => {
      if (String(e.accountId) !== String(accountId)) return sum;
      const qty = Number(e.quantity) || 0;
      const pnl = ((Number(e.sellPrice) || 0) - (Number(e.avgPriceAtSell) || 0)) * qty;
      return sum + (e.currency === 'USD' ? pnl * rate : pnl);
    }, 0);
  };

  // ✅ 자동 계산 현금 = 순입금액 − 보유원가 + 실현손익
  //    (매수/매도 기록이 정확히 입력돼 있어야 맞음. USD는 현재 환율 기준 환산)
  const getAutoCashKRW = (account: StockAccount) =>
    getAccountNetCashFlowKRW(account) - getAccountHoldingCostKRW(account) + getAccountRealizedPnLKRW(account.id);

  // ✅ 화면·합계에 사용할 실효 현금
  const getEffectiveCashKRW = (account: StockAccount) =>
    account.autoCash ? getAutoCashKRW(account) : (Number(account.cashHoldings) || 0);

  const toggleAutoCash = (accountId: string) => {
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId ? { ...account, autoCash: !account.autoCash } : account
      ),
    }));
  };

  const getAccountTotalKRW = (account: StockAccount) => getAccountStockTotalKRW(account) + getEffectiveCashKRW(account);

  const addCashFlow = (accountId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              cashFlows: [
                ...(Array.isArray(account.cashFlows) ? account.cashFlows : []),
                { id: Date.now().toString(), date: today, type: 'deposit', amount: 0, memo: '입금' },
              ],
            }
          : account
      ),
    }));
  };

  const updateCashFlow = (accountId: string, cashFlowId: string, updates: Partial<CashFlowRecord>) => {
    setDataWithUndo('edit', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              cashFlows: (Array.isArray(account.cashFlows) ? account.cashFlows : []).map((entry) =>
                entry.id === cashFlowId ? { ...entry, ...updates } : entry
              ),
            }
          : account
      ),
    }));
  };

  const deleteCashFlow = (accountId: string, cashFlowId: string) => {
    setDataWithUndo('action', (prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              cashFlows: (Array.isArray(account.cashFlows) ? account.cashFlows : []).filter((entry) => entry.id !== cashFlowId),
            }
          : account
      ),
    }));
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
  // ✅ 계좌별 입출금 현황 접기/펴기 (기본: 접힘)
  const [openCashFlows, setOpenCashFlows] = useState<Set<string>>(new Set());
  const toggleCashFlowOpen = (accountId: string) => {
    setOpenCashFlows((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const [avgDownKey, setAvgDownKey] = useState<string>('');
  const [avgDownAvg, setAvgDownAvg] = useState<number>(0);
  const [avgDownQty, setAvgDownQty] = useState<number>(0);
  const [avgDownCur, setAvgDownCur] = useState<number>(0);
  const [avgDownAddQty, setAvgDownAddQty] = useState<number>(0);

  // ✅ 월별 매도 손익(원) 자동 집계
  // - 매도기록의 (매도단가 - 매도시점 평단가) * 수량
  // - USD 종목은 환율로 원화 환산
  const monthlyRealizedPnL = useMemo(() => {
    const rate = Number(data.exchangeRate) || 0;
    const totalArr = Array.from({ length: 12 }, () => 0);
    const byAccount: Record<string, number[]> = {};
    for (const acc of data.accounts) byAccount[acc.id] = Array.from({ length: 12 }, () => 0);

    const ledger = Array.isArray(data.sellLedger) ? data.sellLedger : [];
    for (const e of ledger) {
      const date = String((e as any).date || '');
      const m = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(5, 7)) : NaN;
      if (!Number.isFinite(m) || m < 1 || m > 12) continue;

      const qty = Number((e as any).quantity) || 0;
      const sellPrice = Number((e as any).sellPrice) || 0;
      if (qty === 0) continue;

      const avgAtSell = Number((e as any).avgPriceAtSell) || 0;
      const pnl = (sellPrice - avgAtSell) * qty;
      const pnlKRW = (e as any).currency === 'USD' ? pnl * rate : pnl;
      totalArr[m - 1] += pnlKRW;
      const accId = String((e as any).accountId || '');
      if (byAccount[accId]) byAccount[accId][m - 1] += pnlKRW;
    }

    const toRows = (arr: number[]) => arr.map((v, i) => ({ month: i + 1, pnlKRW: v }));
    return {
      total: toRows(totalArr),
      byAccount: data.accounts.map((acc) => ({ accountId: acc.id, name: acc.name, rows: toRows(byAccount[acc.id] || []) })),
    };
  }, [data.accounts, data.sellLedger, data.exchangeRate]);
  const updateTickerPrice = (key: string, raw: string) => {
    const v = raw.trim();
    pushUndo('edit');
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


  const recoverFromLastGood = () => {
    const last = localStorage.getItem('stockPortfolio__last_good');
    if (!last) {
      alert('복구할 백업이 없어요. (stockPortfolio__last_good 없음)');
      return;
    }
    try {
      const parsed = JSON.parse(last);
      const sanitized = sanitizePortfolioData(parsed);
      setData(sanitized);
      setLoadOk(true);
      alert('마지막 정상 데이터로 복구했어요.');
    } catch {
      alert('백업 데이터가 깨져있어서 복구에 실패했어요.');
    }
  };

  const enableSavingAnyway = () => {
    if (!confirm('지금 상태에서 저장을 다시 켜면(자동 저장) 현재 화면 값이 저장돼요. 계속할까요?')) return;
    setLoadOk(true);
  };

  // ✅ 저채도 웜톤 파스텔(눈 편한) 차트 컬러
  // 파란 계열은 UI 전체 톤에서 제외(단, 손익(-) 표시는 별도 규칙으로 파스텔 블루 유지)
  const COLORS = [
    '#a23b2e', // brick
    '#176b4d', // deep green
    '#1c1c1a', // ink
    '#8a8478', // warm gray
    '#b3552e', // rust
    '#3f7a68', // sea green
    '#c9b89a', // sand
    '#54524e', // graphite
    '#9b978f', // stone
    '#d8d5cf', // light stone
    '#e0d4c3', // pale sand
    '#6e6b66', // slate
  ];
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-4">
          <div className="leading-tight">
            <div className="eyebrow">Stock Portfolio</div>
            <h1>주식 포트폴리오</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5">
            <span className="whitespace-nowrap text-xs text-muted-foreground">원/달러 환율</span>
            <Input
              type="number"
              value={numInputValue(data.exchangeRate)}
              onChange={(e) => updateExchangeRate(Number(e.target.value))}
              className="h-7 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
            <span className="text-xs text-muted-foreground">원/$</span>
            {(!data.exchangeRate || data.exchangeRate <= 0) && (
              <span
                className="text-xs text-expense"
                title="환율이 0이면 USD 종목의 원화 계산이 이상하게 나올 수 있어요"
              >
                ⚠
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={doUndo}
            disabled={undoStack.length === 0}
            className="gap-2"
            title="되돌리기 (Ctrl/⌘ + Z)"
          >
            <RotateCcw className="w-4 h-4" />
            되돌리기
          </Button>
          <Button
            variant="outline"
            onClick={doRedo}
            disabled={redoStack.length === 0}
            className="gap-2"
            title="다시 실행 (Ctrl/⌘ + Shift + Z 또는 Ctrl/⌘ + Y)"
          >
            <RotateCw className="w-4 h-4" />
            다시
          </Button>
        </div>
      </div>

      {/* 데이터 로드 에러(파싱 실패) 안내 */}
      {!loadOk && (
        <Card className="p-4 rounded-xl border-expense/25 bg-expense/5">
          <div className="text-sm font-semibold text-expense">데이터 복구 안내</div>
          <div className="mt-1 text-sm text-foreground/80 leading-relaxed">
            브라우저에 저장된 주식 데이터가 깨져서(파싱 실패) 일단 빈 화면으로 열렸어요.
            <br />
            <span className="font-semibold">아래 버튼으로 복구</span>를 먼저 해보고, 그래도 안 되면 예전 도메인에서 데이터를 가져와야 할 수 있어요.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={recoverFromLastGood} className="bg-expense text-white hover:bg-expense/90">마지막 정상 데이터로 복구</Button>
            <Button variant="outline" onClick={enableSavingAnyway}>저장 다시 켜기(초기화 포함)</Button>
          </div>
        </Card>
      )}

      {/* ✅ 공통(티커별) 현재가 입력 */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">공통 현재가 (티커별)</span>
          </div>
        </div>

        {holdingsByTickerKey.length === 0 ? (
          <div className="mt-3 text-sm text-muted-foreground/70">보유 종목이 없습니다</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {holdingsByTickerKey.map((g) => {
              const has = Number.isFinite(tickerPrices[g.key]);
              return (
                <div
                  key={g.key}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate">{g.ticker}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border text-muted-foreground">
                        {g.currency}
                      </span>
                      {has && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-expense">
                          적용
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      보유 {fmt0(g.totalQty)}주 · 평단 {fmtMoney(g.avgPrice, g.currency)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={has ? numInputValue(tickerPrices[g.key] as number) : ''}
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

        <div className="mt-2 text-xs text-muted-foreground">
          * 공통 현재가를 비우면(삭제) 기존 종목별 현재가 입력값이 다시 사용돼요.
        </div>
      </Card>

      {/* 자산 현황 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-muted-foreground">총 주식 평가금액(원화)</div>
              <div className="text-3xl font-bold mt-1">₩ {fmt0(totalAssetsKRW)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </Card>

        {data.accounts.map((account) => {
          const accountTotalKRW = getAccountTotalKRW(account);
          const accountNetCashFlowKRW = getAccountNetCashFlowKRW(account);
          const accountPnLKRW = accountTotalKRW - accountNetCashFlowKRW;
          const accountPnLPct = accountNetCashFlowKRW !== 0 ? (accountPnLKRW / accountNetCashFlowKRW) * 100 : 0;
          return (
            <Card key={account.id} className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-muted-foreground">{account.name}</div>
                  <div className="text-3xl font-bold mt-1">₩ {fmt0(accountTotalKRW)}</div>
                  <div className="mt-2 text-xs text-muted-foreground">순입금액: ₩ {fmt0(accountNetCashFlowKRW)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">보유 현금: ₩ {fmt0(getEffectiveCashKRW(account))}{account.autoCash ? ' (자동)' : ''}</div>
                  <div className={`mt-1 text-sm font-semibold ${accountPnLKRW >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {accountPnLKRW >= 0 ? '수익' : '손실'} ₩ {fmt0(accountPnLKRW)} ({fmtPct(accountPnLPct)})
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* ✅ 종목별 수익률 — 전체 계좌 티커 합산, 매수원가 대비 */}
      {(() => {
        const perfRows = duplicateTickerSummary
          .filter((g) => g.buyCostKRW > 0 && g.ticker && g.ticker !== '티커명')
          .sort((a, b) => a.profitLossPct - b.profitLossPct);
        if (perfRows.length === 0) return null;

        // ✅ 동적 0% 축: 음수만 있으면 축이 오른쪽 끝, 양수만 있으면 왼쪽 끝
        //    → 빈 절반 없이 전체 폭을 그래프로 사용
        const negSpan = Math.max(0, -Math.min(...perfRows.map((r) => r.profitLossPct)));
        const posSpan = Math.max(0, Math.max(...perfRows.map((r) => r.profitLossPct)));
        const span = Math.max(negSpan + posSpan, 0.0001);
        const axisPct = (negSpan / span) * 100; // 0% 축의 가로 위치(%)

        // ✅ 적응형 밀도: 종목 수가 늘어나도 카드 안에서 촘촘하게
        const n = perfRows.length;
        const barH = n <= 8 ? 'h-4' : n <= 14 ? 'h-3' : n <= 22 ? 'h-2.5' : 'h-2';
        const labelText = n <= 14 ? 'text-xs' : 'text-[11px]';

        return (
          <Card className="h-full overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="eyebrow">Performance</div>
              <h2>종목별 수익률 (%) — 매수원가 대비</h2>
            </div>
            <div className="flex flex-1 flex-col justify-evenly gap-0.5 px-4 py-3">
              {perfRows.map((g) => {
                const positive = g.profitLossPct >= 0;
                const w = Math.max((Math.abs(g.profitLossPct) / span) * 100, 0.8);
                return (
                  <div key={g.ticker} className="flex items-center gap-2">
                    <span className={`tnum w-12 shrink-0 truncate ${labelText} font-semibold`}>{g.ticker}</span>
                    <div className={`relative ${barH} flex-1 overflow-hidden rounded-sm bg-secondary`}>
                      <div className="absolute inset-y-0 w-px bg-border" style={{ left: `${axisPct}%` }} />
                      <div
                        className={`absolute inset-y-0 ${positive ? 'rounded-r-sm bg-gain' : 'rounded-l-sm bg-loss'}`}
                        style={
                          positive
                            ? { left: `${axisPct}%`, width: `${Math.min(w, 100 - axisPct)}%` }
                            : { right: `${100 - axisPct}%`, width: `${Math.min(w, axisPct)}%` }
                        }
                      />
                    </div>
                    <span className={`tnum w-16 shrink-0 text-right ${labelText} font-semibold ${positive ? 'text-gain' : 'text-loss'}`}>
                      {positive ? '+' : ''}{fmtPct(g.profitLossPct)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* ✅ 손익 추이 — 월별 실현손익 (계좌별 + 합계) */}
      {(() => {
        const TREND_COLORS = ['#a23b2e', '#1e7350', '#b3552e', '#3f7a68', '#54524e'];
        const hasAny = monthlyRealizedPnL.total.some((r) => r.pnlKRW !== 0);
        const trendData = monthlyRealizedPnL.total.map((r, i) => {
          const row: Record<string, number | string> = { month: `${r.month}월`, 합계: Math.round(r.pnlKRW) };
          monthlyRealizedPnL.byAccount.forEach((acc, ai) => {
            row[acc.name || `계좌 ${ai + 1}`] = Math.round(acc.rows[i]?.pnlKRW || 0);
          });
          return row;
        });
        return (
          <Card className="h-full overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="eyebrow">Realized P/L Trend</div>
              <h2>손익 추이 — 월별 실현손익</h2>
            </div>
            <div className="flex flex-1 flex-col px-3 py-4">
              {!hasAny ? (
                <div className="py-10 text-center text-sm text-muted-foreground">매도 기록이 입력되면 추이가 표시됩니다</div>
              ) : (
                <div className="min-h-72 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#80766a" />
                      <YAxis tickFormatter={(v: number) => fmt0(v)} tick={{ fontSize: 11 }} stroke="#80766a" width={72} />
                      <ReferenceLine y={0} stroke="#e8dfd0" />
                      <Tooltip formatter={(v: any) => `₩ ${fmt0(Number(v))}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {monthlyRealizedPnL.byAccount.map((acc, ai) => (
                        <Line
                          key={acc.accountId}
                          type="monotone"
                          dataKey={acc.name || `계좌 ${ai + 1}`}
                          stroke={TREND_COLORS[ai % TREND_COLORS.length]}
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          dot={{ r: 2.5 }}
                        />
                      ))}
                      <Line type="monotone" dataKey="합계" stroke="#2b2418" strokeWidth={2.5} dot={{ r: 3.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Card>
        );
      })()}
      </div>

      {/* 계좌 섹션 */}
      <div className="space-y-6">
        {data.accounts.map((account) => (
          <Card key={account.id} className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">계좌</span>
                <Input
                  value={account.name}
                  onChange={(e) => updateAccountName(account.id, e.target.value)}
                  className="w-[200px]"
                />
                <span className="text-sm text-muted-foreground">현금 보유량</span>
                {account.autoCash ? (
                  <Input
                    readOnly
                    value={fmt0(getAutoCashKRW(account))}
                    className="tnum w-[160px] text-right"
                    title="자동 계산: 순입금액 − 보유원가 + 실현손익"
                  />
                ) : (
                  <Input
                    type="number"
                    value={numInputValue(account.cashHoldings)}
                    onChange={(e) => updateAccountCashHoldings(account.id, Number(e.target.value))}
                    className="w-[160px]"
                    placeholder="0"
                  />
                )}
                <Button
                  variant={account.autoCash ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleAutoCash(account.id)}
                  title="자동: 순입금액 − 보유종목 매수원가 + 실현손익 (USD는 현재 환율 환산)"
                >
                  {account.autoCash ? '자동 ON' : '자동 OFF'}
                </Button>
                {!account.autoCash && (
                  <span className="tnum text-xs text-muted-foreground/70">
                    계산값 ₩ {fmt0(getAutoCashKRW(account))}
                  </span>
                )}
                {data.accounts.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAccount(account.id)}
                    className="text-expense"
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border bg-secondary/60 p-3">
                <div className="text-xs text-muted-foreground">순입금액</div>
                <div className="text-lg font-semibold">₩ {fmt0(getAccountNetCashFlowKRW(account))}</div>
              </div>
              <div className="rounded-xl border bg-secondary/60 p-3">
                <div className="text-xs text-muted-foreground">현재 평가금액 <span className="text-muted-foreground/60">= 주식 평가 + 현금</span></div>
                <div className="tnum text-lg font-semibold">₩ {fmt0(getAccountTotalKRW(account))}</div>
                <div className="tnum text-xs text-muted-foreground mt-1">주식 ₩ {fmt0(getAccountStockTotalKRW(account))} + 현금 ₩ {fmt0(getEffectiveCashKRW(account))}{account.autoCash ? ' (자동)' : ' (수동)'}</div>
                {!account.autoCash && (
                  <div className="mt-1 text-[11px] text-expense/80">* 수동 현금이 실제와 다르면 평가금액·수익이 어긋나요. '자동 ON' 권장</div>
                )}
              </div>
              <div className="rounded-xl border bg-secondary/60 p-3">
                {(() => {
                  const pnl = getAccountTotalKRW(account) - getAccountNetCashFlowKRW(account);
                  const base = getAccountNetCashFlowKRW(account);
                  const pct = base !== 0 ? (pnl / base) * 100 : 0;
                  return (
                    <>
                      <div className="text-xs text-muted-foreground">계좌 수익 / 손실 <span className="text-muted-foreground/60">= 평가금액 − 순입금액</span></div>
                      <div className={`text-lg font-semibold ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                        ₩ {fmt0(pnl)} ({fmtPct(pct)})
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 종목 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b-2 border-border text-sm text-muted-foreground">
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
                      <tr key={stock.id} className="border-b border-border hover:bg-secondary/60">
                        <td className="p-2 text-center">
                          <button
                            onClick={() => toggleExpand(account.id, stock.id)}
                            className="p-1 hover:bg-border rounded"
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
                            value={numInputValue(stock.quantity)}
                            onChange={(e) => updateStock(account.id, stock.id, { quantity: Number(e.target.value) })}
                            className="w-24 text-center border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={numInputValue(round2(Number(stock.avgPrice) || 0))}
                            onChange={(e) => updateStock(account.id, stock.id, { avgPrice: round2(Number(e.target.value)) })}
                            className="w-28 text-center border-transparent bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={numInputValue(shownCurrent)}
                            onChange={(e) => {
                              if (hasGlobal) {
                                updateTickerPrice(tk, e.target.value);
                              } else {
                                updateStock(account.id, stock.id, { currentPrice: Number(e.target.value) });
                              }
                            }}
                            className="w-28 text-center"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Input
                            type="number"
                            value={numInputValue(stock.targetPrice)}
                            onChange={(e) => updateStock(account.id, stock.id, { targetPrice: Number(e.target.value) })}
                            className="w-28 text-center"
                          />
                        </td>

                        <td className="p-2 text-center font-medium">
                          <span className={metrics.targetProfitLossPercent >= 0 ? 'text-gain' : 'text-loss'}>
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
                          <div className={metrics.profitLoss >= 0 ? 'text-gain font-semibold' : 'text-loss font-semibold'}>
                            {isUSD ? '$ ' + fmt2(metrics.profitLoss) : '₩ ' + fmt0(metrics.profitLoss)}
                          </div>
                          {isUSD && (
                            <div className="text-xs text-muted-foreground">₩ {fmt0(metrics.profitLossKRW)}</div>
                          )}
                        </td>

                        <td className={`p-2 text-right font-bold ${metrics.profitLossPercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {fmtPct(metrics.profitLossPercent)}
                        </td>

                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStock(account.id, stock.id)}
                            className="text-expense/70 hover:text-expense"
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
                    <div key={stock.id} className="p-4 rounded-xl border bg-secondary/60">
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
                            <tr className="border-b border-border text-sm text-muted-foreground">
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
                                <tr key={record.id} className="border-b border-border">
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
                                      value={numInputValue(record.quantity)}
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
                                      value={numInputValue(record.price)}
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
                                      className="text-expense/70 hover:text-expense"
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
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => addSellRecord(account.id, stock.id)}>
                            <Plus className="w-4 h-4 mr-1" /> 기록 추가
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => applySellRecordsToStock(account.id, stock.id)}>
                            매도기록 → 수량 반영
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                          <thead>
                            <tr className="border-b border-border text-sm text-muted-foreground">
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
                                <tr key={record.id} className="border-b border-border">
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
                                      value={numInputValue(record.quantity)}
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
                                      value={numInputValue(record.price)}
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
                                      className="text-expense/70 hover:text-expense"
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

      {/* 월별 매도 현황 — 계좌별 */}
      <Card className="overflow-hidden">
        <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="leading-tight">
            <div className="eyebrow">Realized P/L by Account</div>
            <h2>월별 매도 현황 — 계좌별</h2>
          </div>
          <div className="text-xs text-muted-foreground">단위: 원 (실현손익)</div>
        </div>
        <div className="grid grid-cols-1 gap-5 px-5 py-4 lg:grid-cols-2">
          {monthlyRealizedPnL.byAccount.map((acc) => {
            const accYearTotal = acc.rows.reduce((s, r) => s + r.pnlKRW, 0);
            return (
              <div key={acc.accountId} className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
                  <span className="text-sm font-semibold">{acc.name}</span>
                  <span className={`tnum text-sm font-semibold ${accYearTotal >= 0 ? 'text-gain' : 'text-loss'}`}>
                    연간 {fmt0(accYearTotal)}원
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-3 sm:grid-cols-4">
                  {acc.rows.map((item) => (
                    <div key={item.month} className="flex items-center justify-between gap-1 rounded-md bg-secondary/40 px-2.5 py-1.5">
                      <span className="text-[11px] text-muted-foreground">{item.month}월</span>
                      <span className={`tnum text-xs font-medium ${item.pnlKRW === 0 ? 'text-muted-foreground/50' : item.pnlKRW > 0 ? 'text-gain' : 'text-loss'}`}>
                        {fmt0(item.pnlKRW)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 월별 매도 현황 — 전체 합계 */}
      <Card className="overflow-hidden">
        <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="leading-tight">
            <div className="eyebrow">Realized P/L Total</div>
            <h2>월별 매도 현황 — 전체 합계</h2>
          </div>
          <span className={`tnum text-sm font-semibold ${monthlyRealizedPnL.total.reduce((s, r) => s + r.pnlKRW, 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
            연간 {fmt0(monthlyRealizedPnL.total.reduce((s, r) => s + r.pnlKRW, 0))}원
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4">
          {monthlyRealizedPnL.total.map((item) => (
            <div
              key={item.month}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground/80">{item.month}월</span>
              <span className={`tnum text-sm font-semibold ${item.pnlKRW === 0 ? 'text-muted-foreground/50' : item.pnlKRW > 0 ? 'text-gain' : 'text-loss'}`}>
                {fmt0(item.pnlKRW)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 비중 그래프 (가장 하단) */}
      <Card className="p-5">
        <h2 className="text-2xl mb-4">비중 그래프 (구매비용 기준)</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.accounts.map((account, idx) => {
            const weights = getAccountWeights(account);
            return (
              <div key={account.id} className="p-4 rounded-2xl border bg-secondary/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">
                    {idx + 1}번 계좌 비중
                    <span className="ml-2 text-xs text-muted-foreground">({account.name})</span>
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


        {/* 물타기(평단 낮추기) 계산기 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">물타기 프로그램 (평단 낮추기 계산기)</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border bg-secondary/60">
              <div className="text-sm text-muted-foreground">입력</div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">티커(선택)</div>
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
                  <div className="text-xs text-muted-foreground mb-1">현재가</div>
                  <Input
                    type="number"
                    value={numInputValue(avgDownCur)}
                    onChange={(e) => setAvgDownCur(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">현재 평단가</div>
                  <Input
                    type="number"
                    value={numInputValue(avgDownAvg)}
                    onChange={(e) => setAvgDownAvg(round2(Number(e.target.value)))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">현재 수량</div>
                  <Input
                    type="number"
                    value={numInputValue(avgDownQty)}
                    onChange={(e) => setAvgDownQty(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">물탈 주식 수(추가 매수 수량)</div>
                  <Input
                    type="number"
                    value={numInputValue(avgDownAddQty)}
                    onChange={(e) => setAvgDownAddQty(Number(e.target.value))}
                    className="h-9 text-right"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                계산식: (평단×수량 + 현재가×추가수량) ÷ (수량+추가수량)
              </div>
            </div>

            <div className="p-4 rounded-2xl border bg-white">
              <div className="text-sm text-muted-foreground">결과</div>

              {(() => {
                const baseQty = Number(avgDownQty) || 0;
                const addQty = Number(avgDownAddQty) || 0;
                const baseAvg = Number(avgDownAvg) || 0;
                const cur = Number(avgDownCur) || 0;
                const newQty = baseQty + addQty;
                const newAvg = newQty > 0 ? round2((baseAvg * baseQty + cur * addQty) / newQty) : 0;
                const drop = round2(baseAvg - newAvg);
                const dropPct = baseAvg > 0 ? round2((drop / baseAvg) * 100) : 0;

                const dropTone = drop >= 0 ? 'text-gain' : 'text-gain';

                return (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border bg-secondary/60">
                      <div className="text-xs text-muted-foreground">새 평단가</div>
                      <div className="text-lg font-bold mt-1">{fmt2(newAvg)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-secondary/60">
                      <div className="text-xs text-muted-foreground">평단 변화</div>
                      <div className={`text-lg font-bold mt-1 ${dropTone}`}>{fmt2(drop)}</div>
                      <div className="text-xs text-muted-foreground mt-1">({fmt2(dropPct)}%)</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-secondary/60">
                      <div className="text-xs text-muted-foreground">총 수량</div>
                      <div className="text-lg font-bold mt-1">{fmt2(newQty)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-secondary/60">
                      <div className="text-xs text-muted-foreground">추가 매수금</div>
                      <div className="text-lg font-bold mt-1">{fmt2(cur * addQty)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">계좌별 입금 / 출금 현황</h3>
          <div className="space-y-4">
            {data.accounts.map((account) => {
              const netCashFlow = getAccountNetCashFlowKRW(account);
              const stockValuation = getAccountStockTotalKRW(account);
              const valuation = getAccountTotalKRW(account);
              const pnl = valuation - netCashFlow;
              const pct = netCashFlow !== 0 ? (pnl / netCashFlow) * 100 : 0;

              return (
                <div key={account.id} className="rounded-2xl border bg-secondary/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
                    <div>
                      <div className="font-semibold">{account.name}</div>
                      <div className="text-xs text-muted-foreground">
                        순입금액 ₩ {fmt0(netCashFlow)} · 현재 평가금액 ₩ {fmt0(valuation)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        주식 ₩ {fmt0(stockValuation)} · 현금 ₩ {fmt0(getEffectiveCashKRW(account))}
                      </div>
                      <div className={`text-sm font-semibold mt-1 ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {pnl >= 0 ? '수익' : '손실'} ₩ {fmt0(pnl)} ({fmtPct(pct)})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          addCashFlow(account.id);
                          setOpenCashFlows((prev) => new Set(prev).add(account.id));
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        입출금 추가
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleCashFlowOpen(account.id)}>
                        {openCashFlows.has(account.id) ? (
                          <>접기 <ChevronUp className="w-4 h-4" /></>
                        ) : (
                          <>내역 {(account.cashFlows || []).length}건 <ChevronDown className="w-4 h-4" /></>
                        )}
                      </Button>
                    </div>
                  </div>

                  {openCashFlows.has(account.id) && ((account.cashFlows || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground/70 py-4 text-center">입금 / 출금 내역이 없습니다</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px]">
                        <thead>
                          <tr className="border-b text-sm text-muted-foreground">
                            <th className="p-2 text-left">날짜</th>
                            <th className="p-2 text-left">구분</th>
                            <th className="p-2 text-right">금액</th>
                            <th className="p-2 text-left">메모</th>
                            <th className="p-2 text-center">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(account.cashFlows || []).map((entry) => (
                            <tr key={entry.id} className="border-b border-border">
                              <td className="p-2">
                                <Input
                                  type="date"
                                  value={entry.date}
                                  onChange={(e) => updateCashFlow(account.id, entry.id, { date: e.target.value })}
                                  className="w-40"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={entry.type}
                                  onChange={(e) => updateCashFlow(account.id, entry.id, { type: e.target.value as 'deposit' | 'withdraw' })}
                                  className="h-9 rounded-md border px-3 bg-white text-sm"
                                >
                                  <option value="deposit">입금</option>
                                  <option value="withdraw">출금</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={numInputValue(entry.amount)}
                                  onChange={(e) => updateCashFlow(account.id, entry.id, { amount: Number(e.target.value) })}
                                  className="w-36 text-right"
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={entry.memo}
                                  onChange={(e) => updateCashFlow(account.id, entry.id, { memo: e.target.value })}
                                  className="w-full"
                                  placeholder="메모"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Button size="sm" variant="ghost" onClick={() => deleteCashFlow(account.id, entry.id)}>
                                  <Trash2 className="w-4 h-4 text-expense/70" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}