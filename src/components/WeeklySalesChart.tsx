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
import { Transaction, Product } from '@/types';
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Banknote,
  Award,
  BarChart3,
  LineChart as LineChartIcon,
  CalendarRange,
  QrCode,
  Package,
} from 'lucide-react';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  differenceInDays,
  isWithinInterval,
} from 'date-fns';
import { id } from 'date-fns/locale';

interface WeeklySalesChartProps {
  transactions: Transaction[];
  products?: Product[];
  startDate: string;
  endDate: string;
}

type MetricType = 'revenue' | 'volume';
type ChartStyle = 'area' | 'bar';
type GranularityType = 'hourly' | 'daily' | 'monthly';

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

export function WeeklySalesChart({
  transactions,
  products = [],
  startDate,
  endDate,
}: WeeklySalesChartProps) {
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('area');
  const [manualGranularity, setManualGranularity] = useState<'auto' | 'daily' | 'monthly'>('auto');

  // All valid completed transactions
  const validTransactions = useMemo(() => {
    return transactions.filter(
      (t) => (!t.status || t.status === 'completed') && t.status !== 'void'
    );
  }, [transactions]);

  // Resolve active date interval from startDate & endDate (supports "All Dates" when empty)
  const { rangeStart, rangeEnd, isSingleDay, isAllTime } = useMemo(() => {
    const now = new Date();

    if (!startDate && !endDate) {
      // All dates: span from earliest transaction to latest/today
      const dates = validTransactions
        .map((t) => getTransactionDate(t.createdAt))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      const earliest = dates.length > 0 ? startOfDay(dates[0]) : startOfDay(subDays(now, 6));
      const latestDate = dates.length > 0 && dates[dates.length - 1] > now ? dates[dates.length - 1] : now;
      const latest = endOfDay(latestDate);

      return {
        rangeStart: earliest,
        rangeEnd: latest,
        isSingleDay: isSameDay(earliest, latest),
        isAllTime: true,
      };
    }

    let parsedStart = startDate ? startOfDay(parseISO(startDate)) : null;
    let parsedEnd = endDate ? endOfDay(parseISO(endDate)) : null;

    if (parsedStart && !parsedEnd) {
      parsedEnd = endOfDay(now > parsedStart ? now : parsedStart);
    } else if (!parsedStart && parsedEnd) {
      const dates = validTransactions
        .map((t) => getTransactionDate(t.createdAt))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      parsedStart = dates.length > 0 && dates[0] < parsedEnd ? startOfDay(dates[0]) : startOfDay(subDays(parsedEnd, 6));
    }

    const finalStart = parsedStart || startOfDay(now);
    const finalEnd = parsedEnd || endOfDay(now);

    // Swap if user entered start > end
    const orderedStart = finalStart <= finalEnd ? finalStart : startOfDay(finalEnd);
    const orderedEnd = finalStart <= finalEnd ? finalEnd : endOfDay(finalStart);

    return {
      rangeStart: orderedStart,
      rangeEnd: orderedEnd,
      isSingleDay: isSameDay(orderedStart, orderedEnd),
      isAllTime: false,
    };
  }, [startDate, endDate, validTransactions]);

  const totalDaysInRange = useMemo(() => {
    return Math.max(1, differenceInDays(rangeEnd, rangeStart) + 1);
  }, [rangeStart, rangeEnd]);

  // Determine effective granularity
  const granularity: GranularityType = useMemo(() => {
    if (isSingleDay) return 'hourly';
    if (manualGranularity === 'monthly') return 'monthly';
    if (manualGranularity === 'daily' && totalDaysInRange <= 366) return 'daily';
    return totalDaysInRange > 62 ? 'monthly' : 'daily';
  }, [isSingleDay, manualGranularity, totalDaysInRange]);

  // Filter transactions strictly within selected date interval
  const rangeTransactions = useMemo(() => {
    return validTransactions.filter((t) => {
      const d = getTransactionDate(t.createdAt);
      if (!d) return false;
      try {
        return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
      } catch {
        return false;
      }
    });
  }, [validTransactions, rangeStart, rangeEnd]);

  // Build chart data points based on granularity
  const chartData = useMemo(() => {
    if (granularity === 'hourly') {
      const hours = Array.from({ length: 24 }, (_, h) => h);
      return hours.map((hour) => {
        const hourTransactions = rangeTransactions.filter((t) => {
          const d = getTransactionDate(t.createdAt);
          return d ? d.getHours() === hour : false;
        });

        const revenue = hourTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const volume = hourTransactions.length;
        const cashRevenue = hourTransactions
          .filter((t) => t.paymentMethod === 'cash')
          .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const nonCashRevenue = revenue - cashRevenue;
        const totalItems = hourTransactions.reduce(
          (sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0
        );

        const hourLabel = `${String(hour).padStart(2, '0')}:00`;
        return {
          label: hourLabel,
          tooltipTitle: `Pukul ${hourLabel} - ${String(hour).padStart(2, '0')}:59`,
          tooltipSubtitle: format(rangeStart, 'EEEE, dd MMMM yyyy', { locale: id }),
          revenue,
          volume,
          cashRevenue,
          nonCashRevenue,
          totalItems,
        };
      });
    }

    if (granularity === 'monthly') {
      const months = eachMonthOfInterval({
        start: startOfMonth(rangeStart),
        end: endOfMonth(rangeEnd),
      });

      return months.map((month) => {
        const monthTransactions = rangeTransactions.filter((t) => {
          const d = getTransactionDate(t.createdAt);
          return d ? isSameMonth(d, month) : false;
        });

        const revenue = monthTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const volume = monthTransactions.length;
        const cashRevenue = monthTransactions
          .filter((t) => t.paymentMethod === 'cash')
          .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const nonCashRevenue = revenue - cashRevenue;
        const totalItems = monthTransactions.reduce(
          (sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0
        );

        return {
          label: format(month, 'MMM yy', { locale: id }),
          tooltipTitle: format(month, 'MMMM yyyy', { locale: id }),
          tooltipSubtitle: 'Ringkasan Bulanan',
          revenue,
          volume,
          cashRevenue,
          nonCashRevenue,
          totalItems,
        };
      });
    }

    // Daily granularity
    const days = eachDayOfInterval({
      start: startOfDay(rangeStart),
      end: startOfDay(rangeEnd),
    });

    return days.map((day) => {
      const dayTransactions = rangeTransactions.filter((t) => {
        const d = getTransactionDate(t.createdAt);
        return d ? isSameDay(d, day) : false;
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
        label: totalDaysInRange <= 14
          ? `${format(day, 'EEE', { locale: id })}, ${format(day, 'dd MMM', { locale: id })}`
          : format(day, 'dd MMM', { locale: id }),
        tooltipTitle: format(day, 'EEEE', { locale: id }),
        tooltipSubtitle: format(day, 'dd MMMM yyyy', { locale: id }),
        revenue,
        volume,
        cashRevenue,
        nonCashRevenue,
        totalItems,
      };
    });
  }, [granularity, rangeTransactions, rangeStart, rangeEnd, totalDaysInRange]);

  // Period KPI summary
  const stats = useMemo(() => {
    const totalRevenue = rangeTransactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const totalTransactions = rangeTransactions.length;
    const totalItems = rangeTransactions.reduce(
      (acc, t) => acc + t.items.reduce((s, item) => s + item.quantity, 0),
      0
    );

    const divisor = granularity === 'monthly'
      ? Math.max(1, chartData.length)
      : totalDaysInRange;
    const avgRevenue = Math.round(totalRevenue / divisor);
    const avgLabel = granularity === 'monthly' ? 'Rata-rata / Bulan' : 'Rata-rata / Hari';

    const bestBucket = [...chartData].sort((a, b) => b.revenue - a.revenue)[0];

    // Payment method breakdown
    const cashTotal = rangeTransactions
      .filter((t) => t.paymentMethod === 'cash')
      .reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const cashCount = rangeTransactions.filter((t) => t.paymentMethod === 'cash').length;

    const transferTotal = rangeTransactions
      .filter((t) => t.paymentMethod === 'transfer')
      .reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const transferCount = rangeTransactions.filter((t) => t.paymentMethod === 'transfer').length;

    const qrisTotal = rangeTransactions
      .filter((t) => t.paymentMethod === 'qris')
      .reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const qrisCount = rangeTransactions.filter((t) => t.paymentMethod === 'qris').length;

    // Top 5 products in selected date range
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    rangeTransactions.forEach((t) => {
      t.items.forEach((item) => {
        const currentProduct = products.find((p) => p.id === item.productId);
        const name = currentProduct ? currentProduct.name : item.name;
        const key = item.productId || name;
        if (!productMap[key]) {
          productMap[key] = { name, qty: 0, revenue: 0 };
        }
        productMap[key].qty += item.quantity;
        productMap[key].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalRevenue,
      totalTransactions,
      totalItems,
      avgRevenue,
      avgLabel,
      bestBucket: bestBucket && bestBucket.revenue > 0 ? bestBucket : null,
      payments: [
        { label: 'Tunai', amount: cashTotal, count: cashCount, icon: Banknote, color: 'bg-emerald-500' },
        { label: 'Transfer', amount: transferTotal, count: transferCount, icon: CreditCard, color: 'bg-sky-500' },
        { label: 'QRIS', amount: qrisTotal, count: qrisCount, icon: QrCode, color: 'bg-violet-500' },
      ],
      topProducts,
    };
  }, [rangeTransactions, chartData, granularity, totalDaysInRange, products]);

  const periodSubtitle = useMemo(() => {
    if (isAllTime) {
      return `Seluruh tanggal (${format(rangeStart, 'dd MMM yyyy', { locale: id })} – ${format(rangeEnd, 'dd MMM yyyy', { locale: id })})`;
    }
    if (isSingleDay) {
      return `${format(rangeStart, 'EEEE, dd MMMM yyyy', { locale: id })} (Grafik per Jam)`;
    }
    return `${format(rangeStart, 'dd MMM yyyy', { locale: id })} – ${format(rangeEnd, 'dd MMM yyyy', { locale: id })} (${totalDaysInRange} hari)`;
  }, [isAllTime, isSingleDay, rangeStart, rangeEnd, totalDaysInRange]);

  const formatIDR = (value: number) => {
    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}jt`;
    }
    if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)}rb`;
    }
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-zinc-100 rounded-2xl p-4 shadow-xl text-xs space-y-2.5 min-w-[220px] z-50">
        <div className="border-b border-zinc-100 pb-2">
          <p className="font-semibold text-zinc-900">{data.tooltipTitle}</p>
          <p className="text-[11px] text-zinc-400">{data.tooltipSubtitle}</p>
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
              {data.volume} order ({data.totalItems} pcs)
            </span>
          </div>

          {data.revenue > 0 && (
            <div className="pt-2 border-t border-dashed border-zinc-100 space-y-1 text-[10px]">
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-emerald-600" />
                  Tunai:
                </span>
                <span className="font-medium text-zinc-700">
                  Rp {data.cashRevenue.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-sky-600" />
                  Non-Tunai:
                </span>
                <span className="font-medium text-zinc-700">
                  Rp {data.nonCashRevenue.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Main Chart Card */}
      <Card className="rounded-2xl border border-zinc-100 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-light tracking-tight text-zinc-900">
                    Ringkasan Penjualan
                  </h3>
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{periodSubtitle}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Chart Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Granularity toggle when multi-day */}
              {!isSingleDay && (
                <div className="flex bg-zinc-100/80 p-0.5 rounded-full text-xs">
                  {totalDaysInRange <= 366 && (
                    <button
                      onClick={() => setManualGranularity('daily')}
                      className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                        granularity === 'daily'
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Harian
                    </button>
                  )}
                  <button
                    onClick={() => setManualGranularity('monthly')}
                    className={`px-3 py-1.5 rounded-full font-medium transition-all ${
                      granularity === 'monthly'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    Bulanan
                  </button>
                </div>
              )}

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
              <div className="flex bg-zinc-100/80 p-0.5 rounded-full text-xs">
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

          {/* Period KPI Highlights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="bg-zinc-900 text-white rounded-xl p-4">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Omset Periode Ini
              </span>
              <span className="text-lg md:text-xl font-semibold tracking-tight">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="bg-zinc-50/80 rounded-xl p-4 border border-zinc-100">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Total Transaksi & Item
              </span>
              <span className="text-lg md:text-xl font-semibold text-zinc-900 tracking-tight">
                {stats.totalTransactions}{' '}
                <span className="text-xs font-normal text-zinc-400">
                  order ({stats.totalItems} pcs)
                </span>
              </span>
            </div>

            <div className="bg-zinc-50/80 rounded-xl p-4 border border-zinc-100">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                {stats.avgLabel}
              </span>
              <span className="text-lg md:text-xl font-semibold text-zinc-900 tracking-tight">
                Rp {stats.avgRevenue.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="bg-zinc-50/80 rounded-xl p-4 border border-zinc-100">
              <div className="flex items-center gap-1 mb-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  {isSingleDay ? 'Jam Tertinggi' : granularity === 'monthly' ? 'Bulan Tertinggi' : 'Hari Tertinggi'}
                </span>
              </div>
              <span className="text-base md:text-lg font-semibold text-zinc-900 tracking-tight truncate block">
                {stats.bestBucket
                  ? `${stats.bestBucket.label} (${formatIDR(stats.bestBucket.revenue)})`
                  : '-'}
              </span>
            </div>
          </div>

          {/* Spacious Recharts Canvas */}
          <div className="w-full h-80 md:h-[400px] min-w-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartStyle === 'area' ? (
                <AreaChart
                  data={chartData}
                  margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
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
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#f4f4f5' }}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    minTickGap={20}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
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
                  margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#f4f4f5' }}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    minTickGap={20}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
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

      {/* Secondary Breakdown Row: Payment Methods & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-zinc-100 shadow-sm bg-white">
          <CardContent className="p-4 md:p-6 space-y-4">
            <h4 className="text-sm font-medium text-zinc-900 uppercase tracking-wider">
              Metode Pembayaran
            </h4>
            <div className="space-y-3.5">
              {stats.payments.map((p) => {
                const Icon = p.icon;
                const pct =
                  stats.totalRevenue > 0
                    ? Math.round((p.amount / stats.totalRevenue) * 100)
                    : 0;
                return (
                  <div key={p.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-zinc-700 font-medium">
                        <Icon className="w-4 h-4 text-zinc-500" />
                        <span>{p.label}</span>
                        <span className="text-zinc-400 font-normal">({p.count}x)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-zinc-900">
                          Rp {p.amount.toLocaleString('id-ID')}
                        </span>
                        <span className="text-zinc-400 ml-1.5">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${p.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-zinc-100 shadow-sm bg-white">
          <CardContent className="p-4 md:p-6 space-y-4">
            <h4 className="text-sm font-medium text-zinc-900 uppercase tracking-wider">
              Top 5 Produk Terlaris
            </h4>
            {stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.map((prod, idx) => (
                  <div
                    key={prod.name + idx}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-50 last:border-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-zinc-800 truncate">{prod.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-zinc-900">{prod.qty} pcs</span>
                      <span className="text-zinc-400 ml-2">
                        (Rp {prod.revenue.toLocaleString('id-ID')})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <Package className="w-8 h-8 opacity-30" />
                <span>Belum ada penjualan pada periode ini</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
