import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Transaction } from '@/types';
import { 
  TrendingUp, 
  ShoppingBag, 
  CalendarDays, 
  CreditCard,
  Banknote,
  Award,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import { 
  format, 
  subDays, 
  startOfWeek, 
  addDays, 
  isSameDay 
} from 'date-fns';
import { id } from 'date-fns/locale';

interface WeeklySalesChartProps {
  transactions: Transaction[];
}

type MetricType = 'revenue' | 'volume';
type PeriodType = 'last7days' | 'currentWeek';
type ChartStyle = 'area' | 'bar';

function getTransactionDate(createdAt: any): Date | null {
  if (!createdAt) return null;
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }
  if (createdAt instanceof Date) {
    return isNaN(createdAt.getTime()) ? null : createdAt;
  }
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? null : d;
  }
  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000);
  }
  return null;
}

export function WeeklySalesChart({ transactions }: WeeklySalesChartProps) {
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [period, setPeriod] = useState<PeriodType>('last7days');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('area');

  // Generate 7 days based on selected period
  const dayBuckets = useMemo(() => {
    const today = new Date();
    const days: Date[] = [];

    if (period === 'last7days') {
      // Last 7 days ending today
      for (let i = 6; i >= 0; i--) {
        days.push(subDays(today, i));
      }
    } else {
      // Current calendar week (Monday to Sunday)
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
    }

    return days;
  }, [period]);

  // Aggregate completed transactions per day
  const chartData = useMemo(() => {
    // Filter only valid, completed transactions (not void)
    const validTransactions = transactions.filter(
      (t) => (!t.status || t.status === 'completed') && t.status !== 'void'
    );

    return dayBuckets.map((day) => {
      const dayTransactions = validTransactions.filter((t) => {
        const transDate = getTransactionDate(t.createdAt);
        if (!transDate) return false;
        return isSameDay(transDate, day);
      });

      const revenue = dayTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const volume = dayTransactions.length;
      const cashRevenue = dayTransactions
        .filter((t) => t.paymentMethod === 'cash')
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const nonCashRevenue = revenue - cashRevenue;
      const totalItems = dayTransactions.reduce(
        (sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      );

      return {
        dateKey: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEE', { locale: id }), // Sen, Sel, Rab, Kam, Jum, Sab, Min
        fullDayName: format(day, 'EEEE', { locale: id }),
        displayDate: format(day, 'dd MMM', { locale: id }),
        fullDateFormatted: format(day, 'dd MMMM yyyy', { locale: id }),
        revenue,
        volume,
        cashRevenue,
        nonCashRevenue,
        totalItems,
      };
    });
  }, [dayBuckets, transactions]);

  // Summary statistics for the period
  const stats = useMemo(() => {
    const totalRevenue = chartData.reduce((acc, d) => acc + d.revenue, 0);
    const totalTransactions = chartData.reduce((acc, d) => acc + d.volume, 0);
    const avgDailyRevenue = Math.round(totalRevenue / 7);
    const averageOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
    
    // Best selling day
    const bestDay = [...chartData].sort((a, b) => b.revenue - a.revenue)[0];

    return {
      totalRevenue,
      totalTransactions,
      avgDailyRevenue,
      averageOrderValue,
      bestDay: bestDay && bestDay.revenue > 0 ? bestDay : null,
    };
  }, [chartData]);

  // Formatter for IDR currency
  const formatIDR = (value: number) => {
    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}jt`;
    }
    if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)}rb`;
    }
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-zinc-100 rounded-2xl p-4 shadow-xl text-xs space-y-2.5 min-w-[210px] z-50">
        <div className="border-b border-zinc-100 pb-2">
          <p className="font-semibold text-zinc-900">{data.fullDayName}</p>
          <p className="text-[11px] text-zinc-400">{data.fullDateFormatted}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-900" />
              Total Omset:
            </span>
            <span className="font-bold text-zinc-900">
              Rp {data.revenue.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-zinc-500" />
              Total Transaksi:
            </span>
            <span className="font-semibold text-zinc-800">
              {data.volume} transaksi ({data.totalItems} pcs)
            </span>
          </div>

          {data.revenue > 0 && (
            <div className="pt-2 border-t border-dashed border-zinc-100 space-y-1 text-[10px]">
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-emerald-600" />
                  Tunai:
                </span>
                <span className="font-medium text-zinc-700">Rp {data.cashRevenue.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-sky-600" />
                  Non-Tunai:
                </span>
                <span className="font-medium text-zinc-700">Rp {data.nonCashRevenue.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-2xl border border-zinc-100 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-4 md:p-6 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-lg md:text-xl font-light tracking-tight text-zinc-900">
                Ringkasan Penjualan Mingguan
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              Grafik performa omset dan volume pesanan{' '}
              {period === 'last7days' ? '7 hari terakhir' : 'minggu ini'}
            </p>
          </div>

          {/* Controls: Metric Toggle + Period Toggle + Chart Type */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="flex bg-zinc-100/80 p-0.5 rounded-full text-xs">
              <button
                onClick={() => setPeriod('last7days')}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  period === 'last7days'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                onClick={() => setPeriod('currentWeek')}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  period === 'currentWeek'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Minggu Ini
              </button>
            </div>

            {/* Metric Toggle */}
            <div className="flex bg-zinc-100/80 p-0.5 rounded-full text-xs">
              <button
                onClick={() => setMetric('revenue')}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  metric === 'revenue'
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Pendapatan (Rp)
              </button>
              <button
                onClick={() => setMetric('volume')}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                  metric === 'volume'
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Transaksi (Jml)
              </button>
            </div>

            {/* Chart Style (Area vs Bar) */}
            <div className="hidden sm:flex bg-zinc-100/80 p-0.5 rounded-full text-xs">
              <button
                title="Area Chart"
                onClick={() => setChartStyle('area')}
                className={`p-1.5 rounded-full transition-all ${
                  chartStyle === 'area'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
              </button>
              <button
                title="Bar Chart"
                onClick={() => setChartStyle('bar')}
                className={`p-1.5 rounded-full transition-all ${
                  chartStyle === 'bar'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mini KPI Highlights for the selected week */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="bg-zinc-50/70 rounded-xl p-3 border border-zinc-100/80">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Omset Periode
            </span>
            <span className="text-base font-semibold text-zinc-900 tracking-tight">
              Rp {stats.totalRevenue.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="bg-zinc-50/70 rounded-xl p-3 border border-zinc-100/80">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Total Transaksi
            </span>
            <span className="text-base font-semibold text-zinc-900 tracking-tight">
              {stats.totalTransactions} <span className="text-xs font-normal text-zinc-400">order</span>
            </span>
          </div>

          <div className="bg-zinc-50/70 rounded-xl p-3 border border-zinc-100/80">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Rata-rata / Hari
            </span>
            <span className="text-base font-semibold text-zinc-900 tracking-tight">
              Rp {stats.avgDailyRevenue.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="bg-zinc-50/70 rounded-xl p-3 border border-zinc-100/80">
            <div className="flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Hari Tertinggi
              </span>
            </div>
            <span className="text-base font-semibold text-zinc-900 tracking-tight truncate block">
              {stats.bestDay ? `${stats.bestDay.dayName} (${formatIDR(stats.bestDay.revenue)})` : '-'}
            </span>
          </div>
        </div>

        {/* The Recharts Graphic Canvas */}
        <div className="w-full h-72 md:h-80 min-w-0 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartStyle === 'area' ? (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  axisLine={{ stroke: '#f4f4f5' }}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={(val, idx) => {
                    const item = chartData[idx];
                    return item ? `${item.dayName}, ${val}` : val;
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  tickFormatter={(val) =>
                    metric === 'revenue' ? formatIDR(val) : String(val)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                {metric === 'revenue' ? (
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#18181b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGradient)"
                    activeDot={{ r: 5, fill: '#18181b', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#volumeGradient)"
                    activeDot={{ r: 5, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  axisLine={{ stroke: '#f4f4f5' }}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={(val, idx) => {
                    const item = chartData[idx];
                    return item ? `${item.dayName}, ${val}` : val;
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  tickFormatter={(val) =>
                    metric === 'revenue' ? formatIDR(val) : String(val)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                {metric === 'revenue' ? (
                  <Bar
                    dataKey="revenue"
                    fill="#18181b"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                ) : (
                  <Bar
                    dataKey="volume"
                    fill="#0284c7"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
