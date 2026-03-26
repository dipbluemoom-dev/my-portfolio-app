import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Wallet,
  CreditCard,
  Home,
  ChevronDown,
  ChevronUp,
  GripVertical,
  TrendingUp,
  Copy,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

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

  const renderSubItem = (subItem: SubItem, itemId: string, category: BudgetCategory) => {
    return (
      <div key={subItem.id} className="flex items-center gap-2">
        <Input
          value={subItem.description}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { description: e.target.value })}
          className="flex-1"
          placeholder="내용"
        />
        <Input
          type="number"
          value={numberInputValue(subItem.amount)}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { amount: Number(e.target.value) })}
          className="w-32"
          placeholder="금액"
        />
        <Input
          type="date"
          value={subItem.date}
          onChange={(e) => updateSubItem(category, itemId, subItem.id, { date: e.target.value })}
          className="w-32"
        />
        <Button size="sm" variant="ghost" onClick={() => deleteSubItem(category, itemId, subItem.id)}>
          <Trash2 className="w-4 h-4 text-rose-500" />
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
          <div className="mb-2">
            <div className="flex items-center gap-2 py-2 border-b border-gray-200">
              <GripVertical className="w-4 h-4 text-gray-400" />

              {isEditing ? (
                <>
                  <Input value={editValue.name} onChange={(e) => setEditValue({ ...editValue, name: e.target.value })} className="flex-1" />
                  <Input
                    type="number"
                    value={numberInputValue(editValue.amount)}
                    onChange={(e) => setEditValue({ ...editValue, amount: Number(e.target.value) })}
                    className="w-32"
                  />
                  <Button size="sm" variant="ghost" onClick={() => saveEdit(category)}>
                    <Check className="w-4 h-4 text-emerald-500" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="w-4 h-4 text-rose-500" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => toggleExpand(item.id)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <span className="flex-1">{item.name}</span>
                  <span className={`w-32 text-right font-semibold ${(item.subItems?.length || 0) > 0 ? 'text-amber-700/80' : ''}`}>
                    {itemTotal.toLocaleString()}원
                  </span>
                  {item.subItems && item.subItems.length > 0 && <span className="text-xs text-gray-500">({item.subItems.length}개)</span>}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteItem(category, item.id)}>
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="ml-8 mt-2 p-3 bg-white rounded border">
                <div className="space-y-2">
                  {item.subItems && item.subItems.length > 0 && (
                    <>
                      <div className="flex gap-2 text-xs text-gray-600 font-semibold pb-2 border-b">
                        <span className="flex-1">내용</span>
                        <span className="w-32">금액</span>
                        <span className="w-32">날짜</span>
                        <span className="w-10"></span>
                      </div>
                      {item.subItems.map((subItem) => renderSubItem(subItem, item.id, category))}
                    </>
                  )}

                  <Button size="sm" variant="outline" onClick={() => addSubItem(category, item.id)} className="w-full mt-2">
                    <Plus className="w-4 h-4 mr-1" />
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-amber-500" />
            <h1 className="text-2xl">월급 대비 지출 가이드</h1>
          </div>
          <Button onClick={copyJanuaryToOtherMonths} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" />
            1월 → 나머지 복제
          </Button>
        </div>

        <Card className="p-4 bg-gradient-to-r from-amber-100 to-rose-100 text-slate-900 shadow-sm border border-amber-200/60">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">월급</h2>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={numberInputValue(data.salary)}
                onChange={(e) => setData({ ...data, salary: Number(e.target.value) })}
                className="w-48 bg-white/80 text-slate-900"
              />
              <span className="text-xl font-bold">원</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl text-slate-800">고정비</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-slate-700">{totalFixedCosts.toLocaleString()}원</div>
              <Button onClick={() => addItem('fixedCosts')} size="sm" className="bg-orange-200 hover:bg-orange-300 text-slate-900 border border-orange-200">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>{data.fixedCosts.map((item, index) => renderItem(item, 'fixedCosts', index))}</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl text-slate-800">생활비 (카드)</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-slate-700">{totalLivingExpenses.toLocaleString()}원</div>
              <Button onClick={() => addItem('livingExpenses')} size="sm" className="bg-emerald-200 hover:bg-emerald-300 text-slate-900 border border-emerald-200">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.livingExpenses.map((item, index) => renderItem(item, 'livingExpenses', index))}
            {data.livingExpenses.length === 0 && <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-50 to-amber-100 border-rose-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl text-slate-800">계좌 지출비</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-slate-700">{totalAccountExpenses.toLocaleString()}원</div>
              <Button onClick={() => addItem('accountExpenses')} size="sm" className="bg-amber-200 hover:bg-amber-300 text-slate-900 border border-amber-200">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.accountExpenses.map((item, index) => renderItem(item, 'accountExpenses', index))}
            {data.accountExpenses.length === 0 && <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>}
          </div>
        </Card>

        {/* ✅ 추가 소득: 계좌 지출비 하단 */}
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl text-slate-800">추가 소득</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-slate-700">{totalIncome.toLocaleString()}원</div>
              <Button onClick={() => addItem('income')} size="sm" className="bg-emerald-200 hover:bg-emerald-300 text-slate-900 border border-emerald-200">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.income.map((item, index) => renderItem(item, 'income', index))}
            {data.income.length === 0 && <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-r from-rose-100 to-amber-100 text-slate-900 shadow-sm border border-rose-200/60">
          <h2 className="text-2xl mb-4">월별 요약</h2>
          <div className="grid grid-cols-2 gap-4 text-lg">
            <div className="flex justify-between">
              <span>월급:</span>
              <span className="font-bold">{data.salary.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span>추가 소득:</span>
              <span className="font-bold">{totalIncome.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span>총 수입:</span>
              <span className="font-bold text-amber-700">{totalIncomeSalary.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span>총 지출:</span>
              <span className="font-bold">{totalExpenses.toLocaleString()}원</span>
            </div>
            <div className="col-span-2 flex justify-between pt-4 border-t-2 border-slate-200/70">
              <span className="text-xl">잔액:</span>
              <span className={`text-2xl font-bold ${remainingSalary >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {remainingSalary.toLocaleString()}원
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DndProvider>
  );
}
