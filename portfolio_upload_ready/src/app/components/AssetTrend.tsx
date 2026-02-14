import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { LineChart as LineChartIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MonthData {
  month: number;
  previousMonthAsset: number; // 이전달 자산
}

interface AssetTrendData {
  months: Record<number, MonthData>;
}

export function AssetTrend() {
  const [data, setData] = useState<AssetTrendData>(() => {
    const saved = localStorage.getItem('assetTrend');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      months: {},
    };
  });

  useEffect(() => {
    localStorage.setItem('assetTrend', JSON.stringify(data));
  }, [data]);

  const updateMonthData = (month: number, previousMonthAsset: number) => {
    setData({
      ...data,
      months: {
        ...data.months,
        [month]: {
          month,
          previousMonthAsset,
        },
      },
    });
  };

  // 월별 데이터 가져오기
  const getMonthlyData = () => {
    const monthlyAssets = [];
    const monthlyExpenses = [];
    
    for (let month = 1; month <= 12; month++) {
      // 지출 관리 잔액 가져오기
      const budgetKey = `monthlyBudget_${month}`;
      const savedBudget = localStorage.getItem(budgetKey);
      let budgetBalance = 0;
      
      if (savedBudget) {
        const budgetData = JSON.parse(savedBudget);
        const salary = budgetData.salary || 0;
        const income = budgetData.income?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        const fixedCosts = budgetData.fixedCosts?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        const livingExpenses = budgetData.livingExpenses?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        const accountExpenses = budgetData.accountExpenses?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        
        const totalIncome = salary + income;
        const totalExpense = fixedCosts + livingExpenses + accountExpenses;
        budgetBalance = totalIncome - totalExpense;
      }

      // 통장 자산 가져오기
      const bankKey = `bankAccounts`;
      const savedBank = localStorage.getItem(bankKey);
      let bankAsset = 0;
      
      if (savedBank) {
        const bankData = JSON.parse(savedBank);
        const accountsBalance = bankData.accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0;
        const savingsBalance = bankData.savingsAccounts?.reduce((sum: number, acc: any) => {
          return sum + (acc.deposits?.reduce((depSum: number, dep: any) => depSum + (dep.amount * dep.count || 0), 0) || 0);
        }, 0) || 0;
        
        bankAsset = accountsBalance + savingsBalance;
      }

      // 현재 자산 = (지출관리)잔액 + (통장)총 자산
      const currentAsset = budgetBalance + bankAsset;

      // 이전달 자산 = 전월의 현재 자산
      let previousMonthAsset = 0;
      if (month > 1) {
        const prevMonthIndex = monthlyAssets.length - 1;
        if (prevMonthIndex >= 0) {
          previousMonthAsset = monthlyAssets[prevMonthIndex].현재자산;
        }
      }

      // 손익 = 현재 자산 - 이전달 자산
      const profitLoss = currentAsset - previousMonthAsset;

      monthlyAssets.push({
        month: `${month}월`,
        monthNumber: month,
        현재자산: currentAsset,
        이전달자산: previousMonthAsset,
        손익: profitLoss,
      });

      // 지출 데이터도 저장
      if (savedBudget) {
        const budgetData = JSON.parse(savedBudget);
        const fixedCosts = budgetData.fixedCosts?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        const livingExpenses = budgetData.livingExpenses?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        const accountExpenses = budgetData.accountExpenses?.reduce((sum: number, item: any) => {
          if (item.subItems && item.subItems.length > 0) {
            return sum + item.subItems.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0);
          }
          return sum + (item.amount || 0);
        }, 0) || 0;
        
        const totalExpense = fixedCosts + livingExpenses + accountExpenses;
        monthlyExpenses.push({
          month: `${month}월`,
          monthNumber: month,
          지출: totalExpense,
        });
      } else {
        monthlyExpenses.push({
          month: `${month}월`,
          monthNumber: month,
          지출: 0,
        });
      }
    }

    return { monthlyAssets, monthlyExpenses };
  };

  const { monthlyAssets, monthlyExpenses } = getMonthlyData();

  // 연간 총 손익 계산
  const yearlyProfitLoss = monthlyAssets.reduce((sum, data) => sum + data.손익, 0);

  const months = [
    { value: 1, label: '1월' },
    { value: 2, label: '2월' },
    { value: 3, label: '3월' },
    { value: 4, label: '4월' },
    { value: 5, label: '5월' },
    { value: 6, label: '6월' },
    { value: 7, label: '7월' },
    { value: 8, label: '8월' },
    { value: 9, label: '9월' },
    { value: 10, label: '10월' },
    { value: 11, label: '11월' },
    { value: 12, label: '12월' },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <LineChartIcon className="w-8 h-8 text-rose-600" />
        <h1 className="text-2xl">자산 추이 분석</h1>
      </div>

      {/* 연간 총 손익 */}
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl">연간 총 손익</h2>
          <div className="flex items-center gap-2">
            {yearlyProfitLoss >= 0 ? (
              <TrendingUp className="w-8 h-8 text-yellow-300" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-300" />
            )}
            <span className={`text-4xl font-bold ${yearlyProfitLoss >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>
              {yearlyProfitLoss.toLocaleString()}원
            </span>
          </div>
        </div>
      </Card>

      {/* 월별 손익 테이블 */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 shadow-md">
        <h2 className="text-2xl mb-4 text-purple-900">월별 손익 내역</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-purple-300">
                <th className="p-3 text-left">월</th>
                <th className="p-3 text-right">이전달 자산</th>
                <th className="p-3 text-right">현재 자산</th>
                <th className="p-3 text-right">손익</th>
              </tr>
            </thead>
            <tbody>
              {monthlyAssets.map((asset) => (
                <tr key={asset.monthNumber} className="border-b border-purple-200 hover:bg-purple-50">
                  <td className="p-3">{asset.month}</td>
                  <td className="p-3 text-right">{asset.이전달자산.toLocaleString()}원</td>
                  <td className="p-3 text-right font-semibold">{asset.현재자산.toLocaleString()}원</td>
                  <td className={`p-3 text-right font-bold ${asset.손익 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {asset.손익.toLocaleString()}원
                  </td>
                </tr>
              ))}
              <tr className="bg-purple-200 font-bold">
                <td className="p-3" colSpan={3}>총 손익</td>
                <td className={`p-3 text-right text-lg ${yearlyProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {yearlyProfitLoss.toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* 월별 소비 사용량 그래프 */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-2xl mb-4">월별 소비 사용량</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyExpenses}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => value.toLocaleString() + '원'}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Bar dataKey="지출" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 월별 자산 유동성 그래프 */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-2xl mb-4">월별 전체 자산 유동성</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={monthlyAssets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => value.toLocaleString() + '원'}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Line type="monotone" dataKey="현재자산" stroke="#3b82f6" strokeWidth={3} />
            <Line type="monotone" dataKey="이전달자산" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="손익" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}