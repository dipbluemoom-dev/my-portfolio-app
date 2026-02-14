import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Minus, Landmark, PiggyBank } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface RegularDeposit {
  amount: number;
  count: number;
}

interface SavingsAccount {
  id: string;
  name: string;
  totalMonths: number;
  remainingMonths: number;
  deposits: RegularDeposit[];
}

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface BankData {
  accounts: Account[];
  savingsAccounts: SavingsAccount[];
}

export function BankAccounts() {
  const [data, setData] = useState<BankData>(() => {
    const saved = localStorage.getItem('bankAccounts');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      accounts: [],
      savingsAccounts: [],
    };
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: '', balance: 0 });

  useEffect(() => {
    localStorage.setItem('bankAccounts', JSON.stringify(data));
  }, [data]);

  // 일반 계좌 관리
  const addAccount = () => {
    const newAccount: Account = {
      id: Date.now().toString(),
      name: '새 계좌',
      balance: 0,
    };
    setData({ ...data, accounts: [...data.accounts, newAccount] });
  };

  const deleteAccount = (id: string) => {
    setData({
      ...data,
      accounts: data.accounts.filter((acc) => acc.id !== id),
    });
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setData({
      ...data,
      accounts: data.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)),
    });
  };

  // 정기 적금 관리
  const addSavingsAccount = () => {
    const newSavings: SavingsAccount = {
      id: Date.now().toString(),
      name: '새 적금',
      totalMonths: 12,
      remainingMonths: 12,
      deposits: [
        { amount: 700000, count: 0 },
        { amount: 500000, count: 0 },
        { amount: 100000, count: 0 },
      ],
    };
    setData({ ...data, savingsAccounts: [...data.savingsAccounts, newSavings] });
  };

  const deleteSavingsAccount = (id: string) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.filter((acc) => acc.id !== id),
    });
  };

  const updateSavingsAccount = (id: string, updates: Partial<SavingsAccount>) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates } : acc
      ),
    });
  };

  const updateDepositCount = (savingsId: string, depositIndex: number, change: number) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.map((acc) =>
        acc.id === savingsId
          ? {
              ...acc,
              deposits: acc.deposits.map((dep, idx) =>
                idx === depositIndex
                  ? { ...dep, count: Math.max(0, dep.count + change) }
                  : dep
              ),
            }
          : acc
      ),
    });
  };

  const updateDepositAmount = (savingsId: string, depositIndex: number, amount: number) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.map((acc) =>
        acc.id === savingsId
          ? {
              ...acc,
              deposits: acc.deposits.map((dep, idx) =>
                idx === depositIndex ? { ...dep, amount } : dep
              ),
            }
          : acc
      ),
    });
  };

  const addDepositOption = (savingsId: string) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.map((acc) =>
        acc.id === savingsId
          ? {
              ...acc,
              deposits: [...acc.deposits, { amount: 0, count: 0 }],
            }
          : acc
      ),
    });
  };

  const deleteDepositOption = (savingsId: string, depositIndex: number) => {
    setData({
      ...data,
      savingsAccounts: data.savingsAccounts.map((acc) =>
        acc.id === savingsId
          ? {
              ...acc,
              deposits: acc.deposits.filter((_, idx) => idx !== depositIndex),
            }
          : acc
      ),
    });
  };

  const calculateSavingsTotal = (savings: SavingsAccount) => {
    return savings.deposits.reduce((sum, dep) => sum + dep.amount * dep.count, 0);
  };

  const calculateTotalDepositCount = (savings: SavingsAccount) => {
    return savings.deposits.reduce((sum, dep) => sum + dep.count, 0);
  };

  const totalAccountBalance = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalSavingsBalance = data.savingsAccounts.reduce(
    (sum, acc) => sum + calculateSavingsTotal(acc),
    0
  );

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Landmark className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl">통장 정리</h1>
      </div>

      {/* 일반 계좌 */}
      <Card className="p-4 bg-gradient-to-br from-cyan-50 to-blue-100 border-blue-200 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-cyan-600" />
            <h2 className="text-xl text-cyan-900">일반 계좌</h2>
          </div>
          <Button onClick={addAccount} size="sm" className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-1" />
            계좌 추가
          </Button>
        </div>

        {data.accounts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">등록된 계좌가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-4 p-3 border rounded-lg bg-white"
              >
                <Input
                  value={account.name}
                  onChange={(e) => updateAccount(account.id, { name: e.target.value })}
                  className="flex-1"
                  placeholder="계좌명"
                />
                <Input
                  type="number"
                  value={account.balance}
                  onChange={(e) =>
                    updateAccount(account.id, { balance: Number(e.target.value) })
                  }
                  className="w-48"
                  placeholder="잔액"
                />
                <span className="text-sm font-semibold min-w-[100px] text-right">{account.balance.toLocaleString()}원</span>
                <Button size="sm" variant="ghost" onClick={() => deleteAccount(account.id)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t-2 border-cyan-400">
              <div className="text-lg font-bold text-cyan-700">
                총 잔액: {totalAccountBalance.toLocaleString()}원
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 정기 적금 */}
      <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl text-amber-900">정기 적금</h2>
          </div>
          <Button onClick={addSavingsAccount} size="sm" className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-1" />
            적금 추가
          </Button>
        </div>

        {data.savingsAccounts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">등록된 적금이 없습니다</div>
        ) : (
          <div className="space-y-4">
            {data.savingsAccounts.map((savings) => {
              const totalAmount = calculateSavingsTotal(savings);
              const totalCount = calculateTotalDepositCount(savings);

              return (
                <div key={savings.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center gap-4 mb-4">
                    <Input
                      value={savings.name}
                      onChange={(e) =>
                        updateSavingsAccount(savings.id, { name: e.target.value })
                      }
                      className="flex-1"
                      placeholder="적금 이름"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">총 기간:</span>
                      <Input
                        type="number"
                        value={savings.totalMonths}
                        onChange={(e) =>
                          updateSavingsAccount(savings.id, {
                            totalMonths: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                      <span className="text-sm">개월</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">남은 기간:</span>
                      <Input
                        type="number"
                        value={savings.remainingMonths}
                        onChange={(e) =>
                          updateSavingsAccount(savings.id, {
                            remainingMonths: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                      <span className="text-sm">개월</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSavingsAccount(savings.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="space-y-2 mb-4">
                    {savings.deposits.map((deposit, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-2 bg-amber-50 rounded">
                        <Input
                          type="number"
                          value={deposit.amount}
                          onChange={(e) =>
                            updateDepositAmount(savings.id, idx, Number(e.target.value))
                          }
                          className="w-32"
                          placeholder="금액"
                        />
                        <span>원</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateDepositCount(savings.id, idx, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-16 text-center font-semibold">{deposit.count}회</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateDepositCount(savings.id, idx, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-gray-600 flex-1">
                          합계: {(deposit.amount * deposit.count).toLocaleString()}원
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDepositOption(savings.id, idx)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addDepositOption(savings.id)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      납입 옵션 추가
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-amber-100 rounded">
                    <div>
                      <div className="text-sm text-gray-600">총 납입 횟수</div>
                      <div className="text-lg font-semibold">{totalCount}회</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">총 적립액</div>
                      <div className="text-lg font-bold text-amber-700">
                        {totalAmount.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data.savingsAccounts.length > 0 && (
          <div className="flex justify-end pt-4 border-t-2 border-amber-400 mt-4">
            <div className="text-lg font-bold text-amber-700">
              총 적금 잔액: {totalSavingsBalance.toLocaleString()}원
            </div>
          </div>
        )}
      </Card>

      {/* 전체 요약 */}
      <Card className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank className="w-6 h-6" />
          <h2 className="text-2xl">전체 자산 요약</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm opacity-90">일반 계좌 총액</div>
            <div className="text-xl font-bold">{totalAccountBalance.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm opacity-90">적금 총액</div>
            <div className="text-xl font-bold">{totalSavingsBalance.toLocaleString()}원</div>
          </div>
          <div>
            <div className="text-sm opacity-90">총 자산</div>
            <div className="text-3xl font-bold text-yellow-300">
              {(totalAccountBalance + totalSavingsBalance).toLocaleString()}원
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}