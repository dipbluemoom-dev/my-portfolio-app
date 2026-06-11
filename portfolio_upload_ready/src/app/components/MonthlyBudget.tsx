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

// ✅ V3: 섹터(카테고리)를 사용자가 추가/삭제/편집할 수 있는 동적 구조
interface BudgetSection {
  id: string;
  name: string;
  tone: 'expense' | 'income';
  items: BudgetItem[];
}

interface BudgetData {
  salary: number;
  cardBill: number;
  categories: BudgetSection[];
}

interface MonthlyBudgetProps {
  selectedMonth: number;
}

const defaultFixedCosts: BudgetItem[] = [
  { id: '1', name: '핸드폰 통신비', amount: 0, subItems: [] },
  { id: '2', name: '티빙', amount: 0, subItems: [] },
  { id: '3', name: '쿠팡', amount: 0, subItems: [] },
  { id: '4', name: '월세', amount: 0, subItems: [] },
];

const normalizeItems = (items: any): BudgetItem[] =>
  Array.isArray(items)
    ? items.map((item: any) => ({
        id: String(item?.id ?? Date.now()),
        name: String(item?.name ?? ''),
        amount: Number(item?.amount) || 0,
        subItems: Array.isArray(item?.subItems) ? item.subItems : [],
      }))
    : [];

const defaultCategories = (): BudgetSection[] => [
  { id: 'fixedCosts', name: '고정비', tone: 'expense', items: structuredClone(defaultFixedCosts) },
  { id: 'livingExpenses', name: '생활비 (카드)', tone: 'expense', items: [] },
  { id: 'accountExpenses', name: '계좌 지출비', tone: 'expense', items: [] },
  { id: 'income', name: '추가 소득', tone: 'income', items: [] },
];

// ✅ 데이터 정규화 + 구버전(고정 4섹터) → 동적 섹터 자동 마이그레이션
const normalizeBudgetData = (parsedData: any): BudgetData => {
  const salary = Number(parsedData?.salary) || 0;
  const cardBill = Number(parsedData?.cardBill) || 0;

  // 신버전: categories 배열이 있으면 그대로 사용
  if (Array.isArray(parsedData?.categories) && parsedData.categories.length > 0) {
    return {
      salary,
      cardBill,
      categories: parsedData.categories.map((c: any, idx: number) => ({
        id: String(c?.id ?? `cat_${idx}`),
        name: String(c?.name ?? `섹터 ${idx + 1}`),
        tone: c?.tone === 'income' ? 'income' : 'expense',
        items: normalizeItems(c?.items),
      })),
    };
  }

  // 구버전: 고정 4필드 → 섹터로 변환
  return {
    salary,
    cardBill,
    categories: [
      {
        id: 'fixedCosts',
        name: '고정비',
        tone: 'expense',
        items: parsedData?.fixedCosts ? normalizeItems(parsedData.fixedCosts) : structuredClone(defaultFixedCosts),
      },
      { id: 'livingExpenses', name: '생활비 (카드)', tone: 'expense', items: normalizeItems(parsedData?.livingExpenses) },
      { id: 'accountExpenses', name: '계좌 지출비', tone: 'expense', items: normalizeItems(parsedData?.accountExpenses) },
      { id: 'income', name: '추가 소득', tone: 'income', items: normalizeItems(parsedData?.income) },
    ],
  };
};

const parseMonthData = (saved: string | null): BudgetData | null => {
  if (!saved) return null;
  try {
    return normalizeBudgetData(JSON.parse(saved));
  } catch {
    return null;
  }
};

const freshBudget = (): BudgetData => ({ salary: 0, cardBill: 0, categories: defaultCategories() });

interface DraggableItemProps {
  item: BudgetItem;
  index: number;
  dndType: string;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  renderContent: () => React.ReactNode;
}

const DraggableItem = ({ item, index, dndType, moveItem, renderContent }: DraggableItemProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: dndType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }, [dndType, index]);

  const [, drop] = useDrop({
    accept: dndType,
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  }, [dndType, index]);

  return (
    <div ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }} className="cursor-move">
      {renderContent()}
    </div>
  );
};

export function MonthlyBudget({ selectedMonth }: MonthlyBudgetProps) {
  const getStorageKey = (month: number) => `monthlyBudget_${month}`;

  const [data, setData] = useState<BudgetData>(() => {
    return parseMonthData(localStorage.getItem(getStorageKey(selectedMonth))) ?? freshBudget();
  });

  // selectedMonth가 변경될 때 데이터 로드
  useEffect(() => {
    setData(parseMonthData(localStorage.getItem(getStorageKey(selectedMonth))) ?? freshBudget());
    setExpandedItems(new Set());
    setEditingId(null);
    setEditingSectionId(null);
  }, [selectedMonth]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: '', amount: 0 });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState('');

  // ✅ 저장: 신구조(categories) + 구버전 미러(롤백 호환) 동시 기록
  useEffect(() => {
    const mirror = (id: string) => data.categories.find((c) => c.id === id)?.items ?? [];
    const payload = {
      salary: data.salary,
      cardBill: data.cardBill,
      categories: data.categories,
      fixedCosts: mirror('fixedCosts'),
      livingExpenses: mirror('livingExpenses'),
      accountExpenses: mirror('accountExpenses'),
      income: mirror('income'),
    };
    localStorage.setItem(getStorageKey(selectedMonth), JSON.stringify(payload));
  }, [data, selectedMonth]);

  const copyJanuaryToOtherMonths = () => {
    const parsedJanData = parseMonthData(localStorage.getItem(getStorageKey(1)));

    if (!parsedJanData) {
      alert('1월 데이터가 없습니다. (먼저 1월에 값을 입력해 주세요)');
      return;
    }

    if (!confirm('1월은 유지하고, 2월~12월 기존 데이터를 모두 지운 뒤 1월 내용으로 복제할까요?')) {
      return;
    }

    const mirror = (id: string) => parsedJanData.categories.find((c) => c.id === id)?.items ?? [];
    const januaryPayload = JSON.stringify({
      ...parsedJanData,
      fixedCosts: mirror('fixedCosts'),
      livingExpenses: mirror('livingExpenses'),
      accountExpenses: mirror('accountExpenses'),
      income: mirror('income'),
    });

    for (let month = 2; month <= 12; month += 1) {
      localStorage.removeItem(getStorageKey(month));
      localStorage.setItem(getStorageKey(month), januaryPayload);
    }

    if (selectedMonth !== 1) {
      setData(structuredClone(parsedJanData));
    }

    alert('1월은 유지하고, 2월~12월을 1월 내용으로 다시 복제했습니다.');
  };

  // ── 섹터(카테고리) 편집 ──────────────────────────────
  const updateCategory = (catId: string, updater: (c: BudgetSection) => BudgetSection) => {
    setData({
      ...data,
      categories: data.categories.map((c) => (c.id === catId ? updater(c) : c)),
    });
  };

  const addCategory = () => {
    const newCat: BudgetSection = {
      id: `cat_${Date.now()}`,
      name: '새 섹터',
      tone: 'expense',
      items: [],
    };
    setData({ ...data, categories: [...data.categories, newCat] });
    setEditingSectionId(newCat.id);
    setSectionNameDraft(newCat.name);
  };

  const deleteCategory = (catId: string) => {
    const cat = data.categories.find((c) => c.id === catId);
    if (!cat) return;
    const hasItems = cat.items.length > 0;
    if (!confirm(hasItems
      ? `'${cat.name}' 섹터와 안의 항목 ${cat.items.length}개를 모두 삭제할까요?\n(이번 달 데이터에서만 삭제됩니다)`
      : `'${cat.name}' 섹터를 삭제할까요?`)) return;
    setData({ ...data, categories: data.categories.filter((c) => c.id !== catId) });
  };

  const startSectionRename = (cat: BudgetSection) => {
    setEditingSectionId(cat.id);
    setSectionNameDraft(cat.name);
  };

  const saveSectionRename = (catId: string) => {
    const name = sectionNameDraft.trim();
    if (name) updateCategory(catId, (c) => ({ ...c, name }));
    setEditingSectionId(null);
  };

  const toggleSectionTone = (catId: string) => {
    updateCategory(catId, (c) => ({ ...c, tone: c.tone === 'expense' ? 'income' : 'expense' }));
  };

  const moveCategory = (catId: string, dir: -1 | 1) => {
    const idx = data.categories.findIndex((c) => c.id === catId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= data.categories.length) return;
    const next = [...data.categories];
    const [moved] = next.splice(idx, 1);
    next.splice(to, 0, moved);
    setData({ ...data, categories: next });
  };

  // ── 항목 편집 ───────────────────────────────────────
  const addItem = (catId: string) => {
    const newItem: BudgetItem = {
      id: Date.now().toString(),
      name: '새 항목',
      amount: 0,
      subItems: [],
    };
    updateCategory(catId, (c) => ({ ...c, items: [...c.items, newItem] }));
  };

  const deleteItem = (catId: string, id: string) => {
    updateCategory(catId, (c) => ({ ...c, items: c.items.filter((item) => item.id !== id) }));
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditValue({ name: item.name, amount: item.amount });
  };

  const saveEdit = (catId: string) => {
    if (!editingId) return;
    updateCategory(catId, (c) => ({
      ...c,
      items: c.items.map((item) =>
        item.id === editingId ? { ...item, name: editValue.name, amount: editValue.amount } : item
      ),
    }));
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

  const addSubItem = (catId: string, itemId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newSubItem: SubItem = {
      id: Date.now().toString(),
      description: '내용',
      amount: 0,
      date: today,
    };
    updateCategory(catId, (c) => ({
      ...c,
      items: c.items.map((item) =>
        item.id === itemId ? { ...item, subItems: [...(item.subItems || []), newSubItem] } : item
      ),
    }));
  };

  const updateSubItem = (catId: string, itemId: string, subItemId: string, updates: Partial<SubItem>) => {
    updateCategory(catId, (c) => ({
      ...c,
      items: c.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              subItems: (item.subItems || []).map((sub) => (sub.id === subItemId ? { ...sub, ...updates } : sub)),
            }
          : item
      ),
    }));
  };

  const deleteSubItem = (catId: string, itemId: string, subItemId: string) => {
    updateCategory(catId, (c) => ({
      ...c,
      items: c.items.map((item) =>
        item.id === itemId
          ? { ...item, subItems: (item.subItems || []).filter((sub) => sub.id !== subItemId) }
          : item
      ),
    }));
  };

  const moveItem = (catId: string, dragIndex: number, hoverIndex: number) => {
    updateCategory(catId, (c) => {
      const items = [...c.items];
      const draggedItem = items[dragIndex];
      items.splice(dragIndex, 1);
      items.splice(hoverIndex, 0, draggedItem);
      return { ...c, items };
    });
  };

  // ── 합계 ────────────────────────────────────────────
  const calculateItemTotal = (item: BudgetItem) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.reduce((sum, sub) => sum + sub.amount, 0);
    }
    return item.amount;
  };

  const categoryTotal = (c: BudgetSection) => c.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  const totalExpenses = data.categories.filter((c) => c.tone === 'expense').reduce((s, c) => s + categoryTotal(c), 0);
  const totalIncome = data.categories.filter((c) => c.tone === 'income').reduce((s, c) => s + categoryTotal(c), 0);
  const totalIncomeSalary = data.salary + totalIncome;
  const remainingSalary = totalIncomeSalary - totalExpenses;
  const numberInputValue = (value: number) => (value === 0 ? '' : String(value));

  // ── 지출 구성 차트 데이터 (표시용) ──
  const expenseRows = data.categories
    .filter((c) => c.tone === 'expense')
    .flatMap((c) => c.items.map((i) => ({ name: i.name, category: c.name, total: calculateItemTotal(i) })))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxExpenseRow = expenseRows[0]?.total || 0;

  const renderSubItem = (subItem: SubItem, itemId: string, catId: string) => {
    return (
      <div key={subItem.id} className="flex items-center gap-1.5">
        <Input
          value={subItem.description}
          onChange={(e) => updateSubItem(catId, itemId, subItem.id, { description: e.target.value })}
          className="h-8 flex-1"
          placeholder="내용"
        />
        <Input
          type="number"
          value={numberInputValue(subItem.amount)}
          onChange={(e) => updateSubItem(catId, itemId, subItem.id, { amount: Number(e.target.value) })}
          className="h-8 w-24"
          placeholder="금액"
        />
        <Input
          type="date"
          value={subItem.date}
          onChange={(e) => updateSubItem(catId, itemId, subItem.id, { date: e.target.value })}
          className="tnum h-8 w-32"
        />
        <Button size="icon" variant="ghost" className="size-7" onClick={() => deleteSubItem(catId, itemId, subItem.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  };

  const renderItem = (item: BudgetItem, catId: string, index: number) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedItems.has(item.id);
    const itemTotal = calculateItemTotal(item);

    return (
      <DraggableItem
        key={item.id}
        item={item}
        index={index}
        dndType={`budget-${catId}`}
        moveItem={(dragIndex, hoverIndex) => moveItem(catId, dragIndex, hoverIndex)}
        renderContent={() => (
          <div className="border-b border-border last:border-0">
            <div className="group flex items-center gap-1.5 py-1.5">
              <GripVertical className="w-3.5 h-3.5 shrink-0 text-border group-hover:text-muted-foreground" />

              {isEditing ? (
                <>
                  <Input value={editValue.name} onChange={(e) => setEditValue({ ...editValue, name: e.target.value })} className="h-8 flex-1" />
                  <Input
                    type="number"
                    value={numberInputValue(editValue.amount)}
                    onChange={(e) => setEditValue({ ...editValue, amount: Number(e.target.value) })}
                    className="h-8 w-28"
                  />
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => saveEdit(catId)}>
                    <Check className="w-4 h-4 text-income" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={cancelEdit}>
                    <X className="w-4 h-4 text-expense" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                  {item.subItems && item.subItems.length > 0 && (
                    <span className="tnum shrink-0 rounded bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">
                      {item.subItems.length}건
                    </span>
                  )}
                  <span className="tnum w-24 shrink-0 text-right text-sm font-medium">
                    {itemTotal.toLocaleString()}원
                  </span>
                  <div className="flex shrink-0 items-center opacity-40 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => startEdit(item)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => deleteItem(catId, item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="mb-2 ml-5 rounded-md border border-border bg-background p-2.5">
                <div className="space-y-1.5">
                  {item.subItems && item.subItems.length > 0 && (
                    <>
                      <div className="flex gap-1.5 border-b border-border pb-1.5 text-[10px] font-medium text-muted-foreground">
                        <span className="flex-1">내용</span>
                        <span className="w-24 text-right">금액</span>
                        <span className="w-32">날짜</span>
                        <span className="w-7"></span>
                      </div>
                      {item.subItems.map((subItem) => renderSubItem(subItem, item.id, catId))}
                    </>
                  )}

                  <Button size="sm" variant="outline" onClick={() => addSubItem(catId, item.id)} className="h-7 w-full text-xs">
                    <Plus className="w-3.5 h-3.5" />
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

  // ── 섹터 카드 렌더러 (이름 변경 / 성격 토글 / 순서 이동 / 삭제 포함) ──
  const renderSection = (cat: BudgetSection, index: number) => {
    const total = categoryTotal(cat);
    const isRenaming = editingSectionId === cat.id;

    return (
      <Card key={cat.id} className="mb-4 break-inside-avoid overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-4 w-1 shrink-0 rounded-full ${cat.tone === 'income' ? 'bg-income' : 'bg-expense'}`} />
            {isRenaming ? (
              <div className="flex items-center gap-1">
                <Input
                  value={sectionNameDraft}
                  onChange={(e) => setSectionNameDraft(e.target.value)}
                  className="h-8 w-36"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveSectionRename(cat.id); if (e.key === 'Escape') setEditingSectionId(null); }}
                />
                <Button size="icon" variant="ghost" className="size-7" onClick={() => saveSectionRename(cat.id)}>
                  <Check className="w-4 h-4 text-income" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingSectionId(null)}>
                  <X className="w-4 h-4 text-expense" />
                </Button>
              </div>
            ) : (
              <div className="min-w-0 leading-tight">
                <div className="eyebrow">{cat.tone === 'income' ? 'Income' : 'Expense'}</div>
                <h2 className="truncate">{cat.name}</h2>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`tnum text-sm font-semibold ${cat.tone === 'income' ? 'text-income' : 'text-foreground'}`}>
              {total.toLocaleString()}원
            </span>
            <Button onClick={() => addItem(cat.id)} size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Plus className="w-3.5 h-3.5" />
              추가
            </Button>
          </div>
        </div>

        {/* 섹터 관리 툴바 */}
        <div className="flex items-center gap-0.5 border-b border-border bg-secondary/30 px-3 py-1">
          <button
            onClick={() => startSectionRename(cat)}
            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            이름 변경
          </button>
          <button
            onClick={() => toggleSectionTone(cat.id)}
            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="이 섹터를 수입/지출 어느 쪽으로 합산할지 전환"
          >
            {cat.tone === 'income' ? '수입 → 지출로' : '지출 → 수입으로'}
          </button>
          <button
            onClick={() => moveCategory(cat.id, -1)}
            disabled={index === 0}
            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={() => moveCategory(cat.id, 1)}
            disabled={index === data.categories.length - 1}
            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            ↓
          </button>
          <button
            onClick={() => deleteCategory(cat.id)}
            className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-expense/70 hover:bg-expense/10 hover:text-expense"
          >
            섹터 삭제
          </button>
        </div>

        <div className="px-4 py-1">
          {cat.items.map((item, i) => renderItem(item, cat.id, i))}
          {cat.items.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">항목을 추가해주세요</div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <div className="eyebrow">Monthly Budget — {selectedMonth}월</div>
            <h1>월급 대비 지출 가이드</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedMonth === 1 && (
              <Button onClick={copyJanuaryToOtherMonths} variant="outline" size="sm">
                <Copy className="w-4 h-4" />
                1월 → 나머지 복제
              </Button>
            )}
            <Button onClick={addCategory} variant="outline" size="sm">
              <Plus className="w-4 h-4" />
              섹터 추가
            </Button>
          </div>
        </div>

        {/* 월급 */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
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
                className="w-40"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">원</span>
            </div>
          </div>
        </Card>

        {/* ✅ 메이슨리 배치: 카드 높이가 달라도 빈 공간 없이 채움 */}
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
          {data.categories.map((cat, index) => renderSection(cat, index))}

          {/* 월별 요약 — 메이슨리에 함께 배치 */}
          <Card className="mb-4 break-inside-avoid overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <div className="eyebrow">Summary</div>
              <h2>월별 요약 — {selectedMonth}월</h2>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">월급</span>
                <span className="tnum font-medium">{data.salary.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">추가 소득</span>
                <span className="tnum font-medium">{totalIncome.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">총 수입</span>
                <span className="tnum font-semibold text-income">{totalIncomeSalary.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">총 지출</span>
                <span className="tnum font-semibold text-expense">{totalExpenses.toLocaleString()}원</span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">잔액</span>
                <span className={`tnum text-xl font-semibold ${remainingSalary >= 0 ? 'text-income' : 'text-expense'}`}>
                  {remainingSalary.toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 지출 구성 차트 */}
            <div className="border-t border-border px-4 py-3">
              <div className="eyebrow mb-2.5">지출 구성 — 항목별 금액</div>
              {expenseRows.length === 0 ? (
                <div className="py-3 text-center text-sm text-muted-foreground">
                  지출 항목에 금액을 입력하면 구성이 표시됩니다
                </div>
              ) : (
                <div className="space-y-1">
                  {expenseRows.map((row, idx) => (
                    <div key={`${row.name}-${idx}`} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[11px] text-muted-foreground" title={`${row.name} (${row.category})`}>
                        {row.name}
                      </span>
                      <div className="h-3.5 flex-1 overflow-hidden rounded-sm bg-secondary">
                        <div
                          className="h-full rounded-sm bg-expense"
                          style={{ width: `${maxExpenseRow > 0 ? Math.max((row.total / maxExpenseRow) * 100, 1.5) : 0}%` }}
                        />
                      </div>
                      <span className="tnum w-20 shrink-0 text-right text-[11px] font-medium text-expense">
                        {row.total.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DndProvider>
  );
}
