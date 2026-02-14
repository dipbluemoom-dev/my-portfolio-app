import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Plus, Trash2, Edit2, Check, X, Wallet, CreditCard, Home, Banknote, ChevronDown, ChevronUp, GripVertical, Copy, TrendingUp } from 'lucide-react';
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

const defaultFixedCosts = [
  { id: '1', name: '핸드폰 통신비', amount: 0, subItems: [] },
  { id: '2', name: '티빙', amount: 0, subItems: [] },
  { id: '3', name: '쿠팡', amount: 0, subItems: [] },
  { id: '4', name: '월세', amount: 0, subItems: [] },
];

interface DraggableItemProps {
  item: BudgetItem;
  index: number;
  category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses';
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
    <div
      ref={(node) => drag(drop(node))}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="cursor-move"
    >
      {renderContent()}
    </div>
  );
};

export function MonthlyBudget({ selectedMonth }: MonthlyBudgetProps) {
  const getStorageKey = (month: number) => `monthlyBudget_${month}`;

  const [data, setData] = useState<BudgetData>(() => {
    const saved = localStorage.getItem(getStorageKey(selectedMonth));
    if (saved) {
      const parsedData = JSON.parse(saved);
      // income 필드가 없는 구버전 데이터 처리
      return {
        ...parsedData,
        income: parsedData.income || [],
        fixedCosts: parsedData.fixedCosts?.map((item: BudgetItem) => ({
          ...item,
          subItems: item.subItems || []
        })) || defaultFixedCosts,
      };
    }
    return {
      salary: 0,
      fixedCosts: defaultFixedCosts,
      income: [],
      livingExpenses: [],
      accountExpenses: [],
      cardBill: 0,
    };
  });

  // selectedMonth가 변경될 때 데이터 로드
  useEffect(() => {
    const saved = localStorage.getItem(getStorageKey(selectedMonth));
    if (saved) {
      const parsedData = JSON.parse(saved);
      setData({
        ...parsedData,
        income: parsedData.income || [],
        fixedCosts: parsedData.fixedCosts?.map((item: BudgetItem) => ({
          ...item,
          subItems: item.subItems || []
        })) || defaultFixedCosts,
      });
    } else {
      setData({
        salary: 0,
        fixedCosts: defaultFixedCosts,
        income: [],
        livingExpenses: [],
        accountExpenses: [],
        cardBill: 0,
      });
    }
    setExpandedItems(new Set());
  }, [selectedMonth]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: '', amount: 0 });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(getStorageKey(selectedMonth), JSON.stringify(data));
  }, [data, selectedMonth]);

  // 2월 데이터를 모든 월로 복제
  const copyToAllMonths = () => {
    const currentData = localStorage.getItem('monthlyBudget_2');
    if (!currentData) {
      alert('2월 데이터가 없습니다.');
      return;
    }
    
    if (!confirm('2월 데이터를 1월부터 12월까지 모든 월에 복제하시겠습니까?')) {
      return;
    }

    for (let month = 1; month <= 12; month++) {
      localStorage.setItem(`monthlyBudget_${month}`, currentData);
    }
    
    // 현재 선택된 월 데이터 다시 로드
    setData(JSON.parse(currentData));
    alert('2월 데이터가 모든 월에 복제되었습니다.');
  };

  const addItem = (category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses') => {
    const hasSubItems = category !== 'fixedCosts';
    const newItem: BudgetItem = {
      id: Date.now().toString(),
      name: '새 항목',
      amount: 0,
      subItems: hasSubItems || category === 'fixedCosts' ? [] : undefined,
    };
    setData({ ...data, [category]: [...data[category], newItem] });
  };

  const deleteItem = (category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses', id: string) => {
    setData({
      ...data,
      [category]: data[category].filter((item) => item.id !== id),
    });
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditValue({ name: item.name, amount: item.amount });
  };

  const saveEdit = (category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses') => {
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
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const addSubItem = (category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses', itemId: string) => {
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
        item.id === itemId
          ? { ...item, subItems: [...(item.subItems || []), newSubItem] }
          : item
      ),
    });
  };

  const updateSubItem = (
    category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses',
    itemId: string,
    subItemId: string,
    updates: Partial<SubItem>
  ) => {
    setData({
      ...data,
      [category]: data[category].map((item) =>
        item.id === itemId
          ? {
              ...item,
              subItems: (item.subItems || []).map((sub) =>
                sub.id === subItemId ? { ...sub, ...updates } : sub
              ),
            }
          : item
      ),
    });
  };

  const deleteSubItem = (
    category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses',
    itemId: string,
    subItemId: string
  ) => {
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

  const moveItem = (category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses', dragIndex: number, hoverIndex: number) => {
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

  const renderItem = (
    item: BudgetItem,
    category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses',
    index: number,
    canDelete: boolean = true
  ) => {
    const isEditing = editingId === item.id;
    const isExpanded = expandedItems.has(item.id);
    const hasSubItems = category === 'fixedCosts' || category === 'income' || category === 'livingExpenses' || category === 'accountExpenses';
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
                  <Input
                    value={editValue.name}
                    onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                    className="flex-1"
                  />
                  {!hasSubItems && (
                    <Input
                      type="number"
                      value={editValue.amount}
                      onChange={(e) => setEditValue({ ...editValue, amount: Number(e.target.value) })}
                      className="w-32"
                    />
                  )}
                  <Button size="sm" variant="ghost" onClick={() => saveEdit(category)}>
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="w-4 h-4 text-red-600" />
                  </Button>
                </>
              ) : (
                <>
                  {hasSubItems && (
                    <Button size="sm" variant="ghost" onClick={() => toggleExpand(item.id)}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  <span className="flex-1">{item.name}</span>
                  <span className={`w-32 text-right font-semibold ${hasSubItems && (item.subItems?.length || 0) > 0 ? 'text-blue-600' : ''}`}>
                    {itemTotal.toLocaleString()}원
                  </span>
                  {hasSubItems && item.subItems && item.subItems.length > 0 && (
                    <span className="text-xs text-gray-500">({item.subItems.length}개)</span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteItem(category, item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* 세부 항목 */}
            {hasSubItems && isExpanded && (
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addSubItem(category, item.id)}
                    className="w-full mt-2"
                  >
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

  const renderSubItem = (subItem: SubItem, itemId: string, category: 'fixedCosts' | 'income' | 'livingExpenses' | 'accountExpenses') => {
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
          value={subItem.amount}
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
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl">월급 대비 지출 가이드</h1>
          </div>
          <Button onClick={copyToAllMonths} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" />
            2월 → 전체 복제
          </Button>
        </div>

        {/* 월급 입력 */}
        <Card className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">월급</h2>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={data.salary}
                onChange={(e) => setData({ ...data, salary: Number(e.target.value) })}
                className="w-48 text-black"
              />
              <span className="text-xl font-bold">원</span>
            </div>
          </div>
        </Card>

        {/* 소득 */}
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl text-emerald-900">추가 소득</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-emerald-700">
                {totalIncome.toLocaleString()}원
              </div>
              <Button onClick={() => addItem('income')} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.income.map((item, index) => renderItem(item, 'income', index))}
            {data.income.length === 0 && (
              <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>
            )}
          </div>
        </Card>

        {/* 고정비 */}
        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl text-orange-900">고정비</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-orange-700">
                {totalFixedCosts.toLocaleString()}원
              </div>
              <Button onClick={() => addItem('fixedCosts')} size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.fixedCosts.map((item, index) => renderItem(item, 'fixedCosts', index, false))}
          </div>
        </Card>

        {/* 생활비 */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              <h2 className="text-xl text-green-900">생활비 (카드)</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-green-700">
                {totalLivingExpenses.toLocaleString()}원
              </div>
              <Button onClick={() => addItem('livingExpenses')} size="sm" className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.livingExpenses.map((item, index) => renderItem(item, 'livingExpenses', index))}
            {data.livingExpenses.length === 0 && (
              <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>
            )}
          </div>
        </Card>

        {/* 계좌 지출비 */}
        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl text-indigo-900">계좌 지출비</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-indigo-700">
                {totalAccountExpenses.toLocaleString()}원
              </div>
              <Button onClick={() => addItem('accountExpenses')} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>
          </div>
          <div>
            {data.accountExpenses.map((item, index) => renderItem(item, 'accountExpenses', index))}
            {data.accountExpenses.length === 0 && (
              <div className="text-center text-gray-500 py-4">항목을 추가해주세요</div>
            )}
          </div>
        </Card>

        {/* 요약 */}
        <Card className="p-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-xl">
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
              <span className="font-bold text-yellow-300">{totalIncomeSalary.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span>총 지출:</span>
              <span className="font-bold">{totalExpenses.toLocaleString()}원</span>
            </div>
            <div className="col-span-2 flex justify-between pt-4 border-t-2 border-white/30">
              <span className="text-xl">잔액:</span>
              <span className={`text-2xl font-bold ${remainingSalary >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
                {remainingSalary.toLocaleString()}원
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DndProvider>
  );
}