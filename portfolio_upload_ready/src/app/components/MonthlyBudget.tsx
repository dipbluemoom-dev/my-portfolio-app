import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Copy,
} from 'lucide-react';
import { Button, Input, Card } from './ui';

interface SubItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  subItems?: SubItem[];
}

interface BudgetData {
  salary: number;
  fixedCosts: BudgetItem[];
  income: BudgetItem[]; // 추가 소득
  livingExpenses: BudgetItem[];
  accountExpenses: BudgetItem[];
  cardBill: number;
}

interface MonthlyBudgetProps {
  selectedMonth: number;
}
const normalizeBudgetData = (parsedData: Partial<BudgetData> | null | undefined): BudgetData => ({
  salary: Number(parsedData?.salary) || 0,
  fixedCosts:
    parsedData?.fixedCosts?.map((item: BudgetItem) => ({
      ...item,
      subItems: item.subItems || [],
    })) || defaultFixedCosts,
  income: parsedData?.income || [],
  livingExpenses: parsedData?.livingExpenses || [],
  accountExpenses: parsedData?.accountExpenses || [],
  cardBill: Number(parsedData?.cardBill) || 0,
});

const parseMonthData = (saved: string | null): BudgetData | null => {
  if (!saved) return null;
  try {
    return normalizeBudgetData(JSON.parse(saved));
  } catch {
    return null;
  }
};

const defaultFixedCosts: BudgetItem[] = [
  { id: '1', name: '핸드폰 통신비', amount: 0, subItems: [] },
  { id: '2', name: '티빙', amount: 0, subItems: [] },
  { id: '3', name: '쿠팡', amount: 0, subItems: [] },
  { id: '4', name: '월세', amount: 0, subItems: [] },
];

type BudgetCategory = 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses';

interface DraggableItemProps {
  item: BudgetItem;
  index: number;
  category: BudgetCategory;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  renderContent: () => React.ReactNode;
}

const DraggableItem = ({ item, index, category, moveItem, renderContent }: DraggableItemProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: category,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: category,
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }} className="cursor-move">
      {renderContent()}
    </div>
  );
};

export function MonthlyBudget({ selectedMonth }: MonthlyBudgetProps) {
  const getStorageKey = (month: number) => `monthlyBudget_${month}`;

  const [data, setData] = useState<BudgetData>(() => {
    const parsed = parseMonthData(localStorage.getItem(getStorageKey(selectedMonth)));
    return (
      parsed ?? {
        salary: 0,
        fixedCosts: defaultFixedCosts,
        income: [],
        livingExpenses: [],
        accountExpenses: [],
        cardBill: 0,
      }
    );
  });

  // selectedMonth가 변경될 때 데이터 로드
  useEffect(() => {
    const parsed = parseMonthData(localStorage.getItem(getStorageKey(selectedMonth)));
    setData(
      parsed ?? {
        salary: 0,
        fixedCosts: defaultFixedCosts,
        income: [],
        livingExpenses: [],
        accountExpenses: [],
        cardBill: 0,
      }
    );
    setExpandedItems(new Set());
  }, [selectedMonth]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: '', amount: 0 });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(getStorageKey(selectedMonth), JSON.stringify(data));
  }, [data, selectedMonth]);


  const copyJanuaryToOtherMonths = () => {
    const janData = localStorage.getItem(getStorageKey(1));
    const parsedJanData = parseMonthData(janData);

    if (!parsedJanData) {
      alert('1월 데이터가 없습니다. (먼저 1월에 값을 입력해 주세요)');
      return;
    }

    if (!confirm('1월은 유지하고, 2월~12월 기존 데이터를 모두 지운 뒤 1월 내용으로 복제할까요?')) {
      return;
    }

    const januaryPayload = JSON.stringify(parsedJanData);

    for (let month = 2; month <= 12; month += 1) {
      localStorage.removeItem(getStorageKey(month));
      localStorage.setItem(getStorageKey(month), januaryPayload);
    }

    if (selectedMonth !== 1) {
      setData(structuredClone(parsedJanData));
    }

    alert('1월은 유지하고, 2월~12월을 1월 내용으로 다시 복제했습니다.');
  };


  const addItem = (category: BudgetCategory) => {
    const newItem: BudgetItem = {
      id: Date.now().toString(),
      name: '새 항목',
      amount: 0,
      subItems: [],
    };
    setData({ ...data, [category]: [...data[category], newItem] });
  };

  const deleteItem = (category: BudgetCategory, id: string) => {
    setData({
      ...data,
      [category]: data[category].filter((item) => item.id !== id),
    });
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditValue({ name: item.name, amount: item.amount });
  };

  const saveEdit = (category: BudgetCategory) => {
    if (!editingId) return;
    setData({
      ...data,
      [category]: data[category].map((item) =>
        item.id === editingId ? { ...item, name: editValue.name, amount: editValue.amount } : item
      ),
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleExpand = (itemId: string) => {
    const next = new Set(expandedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setExpandedItems(next);
  };

  const addSubItem = (category: BudgetCategory, itemId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newSubItem: SubItem = {
      id: Date.now().toString(),
      description: '내용',
      amount: 0,
      date: today,
    };
    setData({
      ...data,
      [category]: data[category].map((item) =>
        item.id === itemId ? { ...item, subItems: [...(item.subItems || []), newSubItem] } : item
      ),
    });
  };

  const updateSubItem = (category: BudgetCategory, itemId: string, subItemId: string, updates: Partial<SubItem>) => {
    setData({
      ...data,
      [category]: data[category].map((item) =>
        item.id === itemId
          ? {
              ...item,
              subItems: (item.subItems || []).map((sub) => (sub.id === subItemId ? { ...sub, ...updates } : sub)),
            }
          : item
      ),
    });
  };

  const deleteSubItem = (category: BudgetCategory, itemId: string, subItemId: string) => {
    setData({
      ...data,
      [category]: data[category].map((item) =>
        item.id === itemId
          ? {
              ...item,
              subItems: (item.subItems || []).filter((sub) => sub.id !== subItemId),
            }
          : item
      ),
    });
  };

  const moveItem = (category: BudgetCategory, dragIndex: number, hoverIndex: number) => {
    const items = [...data[category]];
    const draggedItem = items[dragIndex];
    items.splice(dragIndex, 1);
    items.splice(hoverIndex, 0, draggedItem);
    setData({ ...data, [category]: items });
  };

  const calculateItemTotal = (item: BudgetItem) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.reduce((sum, sub) => sum + sub.amount, 0);
    }
    return item.amount;
  };

  const totalFixedCosts = data.fixedCosts.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalIncome = data.income.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalLivingExpenses = data.livingExpenses.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalAccountExpenses = data.accountExpenses.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalExpenses = totalFixedCosts + totalLivingExpenses + totalAccountExpenses;
  const totalIncomeSalary = data.salary + totalIncome;
  const remainingSalary = totalIncomeSalary - totalExpenses;
  const numberInputValue = (value: number) => (value === 0 ? '' : String(value));

  // ── 지출 구성 차트 데이터 (표시용 — 저장 데이터는 건드리지 않음) ──
  const expenseRows = [
    ...data.fixedCosts.map((i) => ({ name: i.name, category: '고정비', total: calculateItemTotal(i) })),
    ...data.livingExpenses.map((i) => ({ name: i.name, category: '생활비', total: calculateItemTotal(i) })),
    ...data.accountExpenses.map((i) => ({ name: i.name, category: '계좌', total: calculateItemTotal(i) })),
  ]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxExpenseRow = expenseRows[0]?.total || 0;

  const renderSubItem = (subItem: SubItem, itemId: string, category: BudgetCategory) => {
    return (
      <div key={subItem.id} className="flex items-center gap-2">
        <Input
          value={subItem.description}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { description: e.target.value })}
          className="h-8 flex-1"
          placeholder="내용"
        />
        <Input
          type="number"
          value={numberInputValue(subItem.amount)}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { amount: Number(e.target.value) })}
          className="tnum h-8 w-32 text-right"
          placeholder="금액"
        />
        <Input
          type="date"
          value={subItem.date}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { date: e.target.value })}
          className="tnum h-8 w-36"
        />
        <Button size="icon" variant="ghost" onClick={() => deleteSubItem(category, itemId, subItem.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const renderItem = (item: BudgetItem, category: BudgetCategory, index: number) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedItems.has(item.id);
    const itemTotal = calculateItemTotal(item);

    return (
      <DraggableItem
        key={item.id}
        item={item}
        index={index}
        category={category}
        moveItem={(dragIndex, hoverIndex) => moveItem(category, dragIndex, hoverIndex)}
        renderContent={() => (
          <div className="border-b border-border last:border-0">
            <div className="group flex items-center gap-2 py-2">
              <GripVertical className="w-4 h-4 shrink-0 text-border group-hover:text-muted-foreground" />

              {isEditing ? (
                <>
                  <Input value={editValue.name} onChange={(e) => setEditValue({ ...editValue, name: e.target.value })} className="h-8 flex-1" />
                  <Input
                    type="number"
                    value={numberInputValue(editValue.amount)}
                    onChange={(e) => setEditValue({ ...editValue, amount: Number(e.target.value) })}
                    className="tnum h-8 w-32 text-right"
                  />
                  <Button size="icon" variant="ghost" onClick={() => saveEdit(category)}>
                    <Check className="w-4 h-4 text-income" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={cancelEdit}>
                    <X className="w-4 h-4 text-expense" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <span className="flex-1 truncate text-sm">{item.name}</span>
                  {item.subItems && item.subItems.length > 0 && (
                    <span className="tnum rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {item.subItems.length}건
                    </span>
                  )}
                  <span className="tnum w-32 shrink-0 text-right text-sm font-medium">
                    {itemTotal.toLocaleString()}원
                  </span>
                  <div className="flex items-center opacity-40 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(item)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteItem(category, item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="mb-3 ml-8 rounded-md border border-border bg-background p-3">
                <div className="space-y-2">
                  {item.subItems && item.subItems.length > 0 && (
                    <>
                      <div className="flex gap-2 border-b border-border pb-2 text-[11px] font-medium text-muted-foreground">
                        <span className="flex-1">내용</span>
                        <span className="w-32 text-right">금액</span>
                        <span className="w-36">날짜</span>
                        <span className="w-8"></span>
                      </div>
                      {item.subItems.map((subItem) => renderSubItem(subItem, item.id, category))}
                    </>
                  )}

                  <Button size="sm" variant="outline" onClick={() => addSubItem(category, item.id)} className="w-full">
                    <Plus className="w-4 h-4" />
                    세부 항목 추가
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      />
    );
  };

  // ── 섹션 카드 공통 렌더러 (표시 전용) ──
  const renderSection = (
    eyebrow: string,
    title: string,
    tone: 'expense' | 'income',
    total: number,
    category: BudgetCategory,
    items: BudgetItem[]
  ) => (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`h-4 w-1 rounded-full ${tone === 'income' ? 'bg-income' : 'bg-expense'}`} />
          <div className="leading-tight">
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`tnum text-base font-semibold ${tone === 'income' ? 'text-income' : 'text-foreground'}`}>
            {total.toLocaleString()}원
          </span>
          <Button onClick={() => addItem(category)} size="sm" variant="outline">
            <Plus className="w-4 h-4" />
            추가
          </Button>
        </div>
      </div>
      <div className="px-5 py-1">
        {items.map((item, index) => renderItem(item, category, index))}
        {items.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">항목을 추가해주세요</div>
        )}
      </div>
    </Card>
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <div className="eyebrow">Monthly Budget — {selectedMonth}월</div>
            <h1>월급 대비 지출 가이드</h1>
          </div>
          {selectedMonth === 1 && (
            <Button onClick={copyJanuaryToOtherMonths} variant="outline" size="sm">
              <Copy className="w-4 h-4" />
              1월 → 나머지 복제
            </Button>
          )}
        </div>

        {/* 월급 */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-4 w-1 rounded-full bg-foreground" />
              <div className="leading-tight">
                <div className="eyebrow">Salary</div>
                <h2>월급</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={numberInputValue(data.salary)}
                onChange={(e) => setData({ ...data, salary: Number(e.target.value) })}
                className="tnum w-44 text-right"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">원</span>
            </div>
          </div>
        </Card>

        {renderSection('Fixed', '고정비', 'expense', totalFixedCosts, 'fixedCosts', data.fixedCosts)}
        {renderSection('Living', '생활비 (카드)', 'expense', totalLivingExpenses, 'livingExpenses', data.livingExpenses)}
        {renderSection('Account', '계좌 지출비', 'expense', totalAccountExpenses, 'accountExpenses', data.accountExpenses)}
        {renderSection('Extra Income', '추가 소득', 'income', totalIncome, 'income', data.income)}

        {/* 월별 요약 */}
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <div className="eyebrow">Summary</div>
            <h2>월별 요약 — {selectedMonth}월</h2>
          </div>

          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
                <span className="text-muted-foreground">월급</span>
                <span className="tnum font-medium">{data.salary.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
                <span className="text-muted-foreground">추가 소득</span>
                <span className="tnum font-medium">{totalIncome.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
                <span className="text-muted-foreground">총 수입</span>
                <span className="tnum font-semibold text-income">{totalIncomeSalary.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2.5 text-sm">
                <span className="text-muted-foreground">총 지출</span>
                <span className="tnum font-semibold text-expense">{totalExpenses.toLocaleString()}원</span>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">잔액 (총 수입 − 총 지출)</span>
              <span className={`tnum text-2xl font-semibold ${remainingSalary >= 0 ? 'text-income' : 'text-expense'}`}>
                {remainingSalary.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 지출 구성 차트 */}
          <div className="border-t border-border px-5 py-4">
            <div className="eyebrow mb-3">지출 구성 — 항목별 금액</div>
            {expenseRows.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                지출 항목에 금액을 입력하면 구성이 표시됩니다
              </div>
            ) : (
              <div className="space-y-1">
                {expenseRows.map((row, idx) => (
                  <div key={`${row.name}-${idx}`} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={`${row.name} (${row.category})`}>
                      {row.name}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-sm bg-secondary">
                      <div
                        className="h-full rounded-sm bg-expense"
                        style={{ width: `${maxExpenseRow > 0 ? Math.max((row.total / maxExpenseRow) * 100, 1.5) : 0}%` }}
                      />
                    </div>
                    <span className="tnum w-28 shrink-0 text-right text-xs font-medium text-expense">
                      {row.total.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </DndProvider>
  );
}
