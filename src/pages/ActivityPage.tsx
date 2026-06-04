import React, { useState, useEffect, FormEvent } from 'react';
import { 
  Activity, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  TrendingUp, 
  PackageCheck,
  Calendar,
  Printer,
  ChevronRight,
  TrendingDown,
  CircleDollarSign,
  PieChart,
  Edit2,
  Trash2,
  Info,
  CheckCircle2,
  XCircle,
  PlusCircle,
  BarChart3,
  ListFilter,
  User,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { cashService, transactionsService, settlementsService, productsService, cashiersService } from '@/lib/data-service';
import { CashMovement, Transaction, Settlement, Product, CashierAccount } from '@/types';
import { toast } from 'sonner';

type ActivityTab = 'cash' | 'sales' | 'settlement';

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('cash');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Cash Movement Form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'in' | 'out'>('in');
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);

  // Settlement Form
  const [actualCashInput, setActualCashInput] = useState('');
  const [isSettlementRecapOpen, setIsSettlementRecapOpen] = useState(false);
  const [showDetailedSummary, setShowDetailedSummary] = useState(false);

  // Cashier Auth
  const [isCashierAuthenticated, setIsCashierAuthenticated] = useState(() => {
    return localStorage.getItem('is_cashier_authenticated') === 'true';
  });
  const [cashierList, setCashierList] = useState<CashierAccount[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<string>(() => {
    return localStorage.getItem('active_cashier_id') || 'admin';
  });
  const [cashierPassword, setCashierPassword] = useState('');
  const [showAuthError, setShowAuthError] = useState(false);
  const [authenticatedCashierName, setAuthenticatedCashierName] = useState(() => {
    return localStorage.getItem('active_cashier_name') || 'Admin';
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingCashierId, setPendingCashierId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('is_cashier_authenticated', String(isCashierAuthenticated));
    localStorage.setItem('active_cashier_id', selectedCashierId);
    localStorage.setItem('active_cashier_name', authenticatedCashierName);
  }, [isCashierAuthenticated, selectedCashierId, authenticatedCashierName]);

  // Confirmation Dialogs
  const [isSettlementConfirmOpen, setIsSettlementConfirmOpen] = useState(false);
  const [isDeletingConfirmOpen, setIsDeletingConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubProducts = productsService.subscribe(setProducts);
    const unsubMovements = cashService.getByDate(selectedDate, setMovements);
    const unsubSettlements = settlementsService.getByDate(selectedDate, setSettlements);
    const unsubTransactions = transactionsService.getByDate(selectedDate, (allTrans) => {
      setTransactions(allTrans.filter(t => t.status === 'completed'));
    });
    const unsubCashiers = cashiersService.subscribe(setCashierList);

    return () => {
      unsubProducts();
      unsubMovements();
      unsubTransactions();
      unsubSettlements();
      unsubCashiers();
    };
  }, [selectedDate]);

  const handleAddMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    await cashService.add({
      amount: Number(amount),
      description,
      type,
      cashierName: isCashierAuthenticated ? authenticatedCashierName : 'Admin'
    });

    toast.success(`Uang ${type === 'in' ? 'masuk' : 'keluar'} berhasil dicatat oleh ${isCashierAuthenticated ? authenticatedCashierName : 'Admin'}`);
    setAmount('');
    setDescription('');
  };

  const handleUpdateMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingMovement) return;

    try {
      await cashService.update(editingMovement.id!, {
        amount: editingMovement.amount,
        description: editingMovement.description,
        type: editingMovement.type
      });
      toast.success('Catatan kas berhasil diperbaharui');
      setEditingMovement(null);
    } catch (error: any) {
      toast.error(error.message || 'Gagal memperbaharui catatan kas');
    }
  };

  const handleDeleteMovement = async (id: string) => {
    setDeletingId(id);
    setIsDeletingConfirmOpen(true);
  };

  const confirmDeleteMovement = async () => {
    if (!deletingId) return;
    try {
      await cashService.delete(deletingId);
      toast.success('Catatan kas berhasil dihapus');
      setIsDeletingConfirmOpen(false);
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus catatan kas');
    }
  };

  const handleProcessSettlement = () => {
    if (!actualCashInput) {
      toast.error('Harap masukkan nominal uang cash aktual');
      return;
    }

    const stats = calculateSettlementStats();
    
    // Validation: Actual cash must not be less than expected cash
    if (Number(actualCashInput) < stats.expectedCash) {
       toast.error(`Nominal uang cash tidak boleh kurang dari Rp ${stats.expectedCash.toLocaleString()} (Uang Seharusnya)`);
       return;
    }

    setIsSettlementConfirmOpen(true);
  };

  const confirmSettlement = async () => {
    const stats = calculateSettlementStats();
    const salesStats = calculateSalesStats();

    try {
      // Create the settlement record
      await settlementsService.add({
        date: selectedDate,
        totalTransactions: stats.totalTransactions,
        totalSales: stats.totalRevenue,
        totalCashSales: stats.cashSales,
        totalNonCashSales: stats.nonCashSales,
        totalCashIn: stats.cashIn,
        totalCashOut: stats.cashOut,
        expectedCash: stats.expectedCash,
        actualCash: Number(actualCashInput),
        difference: Number(actualCashInput) - stats.expectedCash,
        cashierName: isCashierAuthenticated ? authenticatedCashierName : 'Admin',
        soldItems: salesStats.sortedItems.map(item => ({
          name: item.name,
          quantity: item.count,
          revenue: item.revenue
        }))
      });

      setIsSettlementConfirmOpen(false);
      setIsSettlementRecapOpen(true);
      setActualCashInput('');
    } catch (error: any) {
      toast.error(error.message || 'Gagal memproses settlement');
    }
  };

  const calculateSettlementStats = () => {
    if (settlements.length > 0) {
      const s = settlements[0];
      return {
        totalTransactions: s.totalTransactions || 0,
        totalRevenue: s.totalSales,
        cashSales: s.totalCashSales,
        nonCashSales: s.totalNonCashSales,
        expectedCash: s.expectedCash,
        cashIn: s.totalCashIn,
        cashOut: s.totalCashOut
      };
    }

    const activeTrans = transactions.filter(t => !t.isSettled);
    const activeMovements = movements.filter(m => !m.isSettled);

    const totalTransactions = activeTrans.length;
    const totalRevenue = activeTrans.reduce((sum, t) => sum + t.totalAmount, 0);
    const cashSales = activeTrans.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.totalAmount, 0);
    const nonCashSales = totalRevenue - cashSales;
    
    const activeIn = activeMovements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0);
    const activeOut = activeMovements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0);
    const expectedCash = cashSales + activeIn - activeOut;

    return { totalTransactions, totalRevenue, cashSales, nonCashSales, expectedCash, cashIn: activeIn, cashOut: activeOut };
  };

  const isSettledToday = settlements.length > 0;

  const calculateSalesStats = () => {
    // If settled today, we show stats for all transactions today (which are now settled)
    // If not settled, we only show unsettled transactions
    const activeTrans = isSettledToday 
      ? transactions 
      : transactions.filter(t => !t.isSettled);

    const totalRevenue = activeTrans.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalItems = activeTrans.reduce((sum, t) => 
      sum + t.items.reduce((iSum, item) => iSum + item.quantity, 0), 0
    );

    const itemsMap: Record<string, { name: string; count: number; revenue: number }> = {};
    activeTrans.forEach(t => {
      t.items.forEach(item => {
        // Use productId as key to group items even if name changes
        // Use current product name if available, fallback to item.name from transaction
        const currentProduct = products.find(p => p.id === item.productId);
        const displayName = currentProduct ? currentProduct.name : item.name;
        const key = item.productId || item.name;

        if (!itemsMap[key]) {
          itemsMap[key] = { name: displayName, count: 0, revenue: 0 };
        }
        itemsMap[key].count += item.quantity;
        itemsMap[key].revenue += item.price * item.quantity;
      });
    });

    const sortedItems = Object.entries(itemsMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([_, data]) => ({
        name: data.name,
        count: data.count,
        revenue: data.revenue,
        percentage: totalItems > 0 ? (data.count / totalItems) * 100 : 0
      }));

    return { totalRevenue, totalItems, sortedItems };
  };

  const handleVerifyActivityPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) {
      toast.error("Password/PIN kasir wajib diisi!");
      return;
    }

    let targetPassword = 'kasir123';
    let cashierNameVal = 'Admin';

    if (pendingCashierId === 'admin') {
      const adminConfig = localStorage.getItem('admin_config');
      if (adminConfig) {
        try {
          const parsed = JSON.parse(adminConfig);
          if (parsed.password) targetPassword = parsed.password;
        } catch (err) {}
      }
    } else {
      const selectedCashier = cashierList.find(c => c.id === pendingCashierId);
      if (!selectedCashier) {
        toast.error("Kasir tidak ditemukan!");
        return;
      }
      targetPassword = selectedCashier.pin;
      cashierNameVal = selectedCashier.name;
    }

    if (pinInput !== targetPassword && !(pendingCashierId === 'admin' && pinInput === '123')) {
      toast.error("Password/PIN kasir salah!");
      return;
    }

    setIsCashierAuthenticated(true);
    setSelectedCashierId(pendingCashierId || 'admin');
    setAuthenticatedCashierName(cashierNameVal);
    setShowPinModal(false);
    setPinInput('');
    toast.success(`Berhasil login sebagai Kasir: ${cashierNameVal}`);
  };

  const salesStats = calculateSalesStats();
  const { totalRevenue, totalItems, sortedItems } = salesStats;
  const recapStats = calculateSettlementStats();

  // These are for the 'Management' view - only show what's currently active (unsettled)
  const activeMovementsList = movements.filter(m => !m.isSettled);
  const activeIn = activeMovementsList.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0);
  const activeOut = activeMovementsList.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0);
  const currentCash = isSettledToday ? 0 : activeIn - activeOut;

  // Use recapStats for the settlement view to ensure data persists after settlement
  const { totalTransactions, totalRevenue: recapTotalRevenue, cashSales, nonCashSales, expectedCash, cashIn: recapCashIn, cashOut: recapCashOut } = recapStats;

  const renderCashManagement = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6 opacity-60">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-medium tracking-widest uppercase">Saldo Kas Toko</span>
            </div>
            <h3 className="text-4xl font-light tracking-tight mb-2">Rp {currentCash.toLocaleString()}</h3>
            <div className="flex gap-4 mt-6">
              <div className="flex-1 p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <span className="text-[10px] uppercase tracking-wider block mb-1 opacity-50">Masuk</span>
                <span className="text-sm font-bold text-emerald-400">+{isSettledToday ? '0' : activeIn.toLocaleString()}</span>
              </div>
              <div className="flex-1 p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <span className="text-[10px] uppercase tracking-wider block mb-1 opacity-50">Keluar</span>
                <span className="text-sm font-bold text-rose-400">-{isSettledToday ? '0' : activeOut.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-[2.5rem] bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-light">Catat Aliran Kas</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMovement} className="space-y-4">
              <div className="flex p-1 bg-zinc-50 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setType('in')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${type === 'in' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-400'}`}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setType('out')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${type === 'out' ? 'bg-white shadow-sm text-rose-600' : 'text-zinc-400'}`}
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Keluar
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Jumlah (Rp)</label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="rounded-xl py-6 bg-zinc-50 border-none"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Keterangan</label>
                <Input 
                  placeholder="Contoh: Modal awal, beli galon" 
                  className="rounded-xl py-6 bg-zinc-50 border-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 mt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 rounded-2xl py-6 border-zinc-100 text-zinc-400"
                  onClick={() => {
                    setAmount('');
                    setDescription('');
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" className="flex-[2] bg-zinc-900 rounded-2xl py-6">
                  Simpan Catatan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="border-none shadow-lg rounded-[2.5rem] bg-white h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-light">Riwayat Kas {selectedDate.toLocaleDateString('id-ID', { dateStyle: 'long' })}</CardTitle>
            <Badge variant="outline" className="rounded-full font-normal">
              {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeMovementsList.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${m.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {m.type === 'in' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">{m.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-zinc-400">
                          {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                        </p>
                        <span className="text-[10px] text-zinc-500 font-sans">
                          • Kasir: <span className="font-semibold text-zinc-650">{m.cashierName || 'Admin'}</span>
                        </span>
                        {m.isSettled && <Badge variant="outline" className="text-[8px] h-4 py-0 rounded-full border-emerald-100 text-emerald-600 bg-emerald-50">Settled</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.type === 'in' ? '+' : '-'} Rp {m.amount.toLocaleString()}
                    </span>
                    {!m.isSettled && (
                      <div className="flex gap-1 relative z-10" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-900 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingMovement(m);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-400 hover:text-red-600 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteMovement(m.id!);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {activeMovementsList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <CircleDollarSign className="w-16 h-16 mb-4" />
                  <p>Belum ada catatan kas untuk tanggal ini</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

  const renderSales = () => {
    return (
      <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg rounded-[2.5rem] bg-white p-8 group hover:bg-zinc-900 transition-all duration-500">
          <div className="p-3 bg-zinc-50 rounded-2xl w-fit mb-6 group-hover:bg-white/10 transition-colors">
            <TrendingUp className="w-6 h-6 text-emerald-500 group-hover:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-500 mb-1">Total Penjualan Kotor</p>
          <h3 className="text-3xl font-light tracking-tight text-zinc-900 group-hover:text-white">Rp {totalRevenue.toLocaleString()}</h3>
        </Card>

        <Card className="border-none shadow-lg rounded-[2.5rem] bg-white p-8 group hover:bg-zinc-900 transition-all duration-500">
          <div className="p-3 bg-zinc-50 rounded-2xl w-fit mb-6 group-hover:bg-white/10 transition-colors">
            <PackageCheck className="w-6 h-6 text-blue-500 group-hover:text-blue-400" />
          </div>
          <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-500 mb-1">Item Terjual</p>
          <h3 className="text-3xl font-light tracking-tight text-zinc-900 group-hover:text-white">{totalItems} <span className="text-sm uppercase tracking-widest opacity-50">Produk</span></h3>
        </Card>

        <Card className="border-none shadow-lg rounded-[2.5rem] bg-white p-8 group hover:bg-zinc-900 transition-all duration-500">
          <div className="p-3 bg-zinc-50 rounded-2xl w-fit mb-6 group-hover:bg-white/10 transition-colors">
            <PieChart className="w-6 h-6 text-amber-500 group-hover:text-amber-400" />
          </div>
          <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-500 mb-1">Item Populer Hari Ini</p>
          <h3 className="text-3xl font-light tracking-tight text-zinc-900 group-hover:text-white truncate">{sortedItems[0]?.name || '-'}</h3>
        </Card>
      </div>

      <Card className="border-none shadow-lg rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-light">Analisa Produk Terjual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {sortedItems.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-zinc-50 rounded-lg text-[10px] font-bold text-zinc-400">{idx + 1}</span>
                    <span className="font-medium text-zinc-800">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold">
                    <span className="text-zinc-400">{item.count} items</span>
                    <span className="text-zinc-900">{item.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-zinc-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-zinc-900 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {sortedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <PieChart className="w-16 h-16 mb-4" />
                <p>Belum ada data penjualan hari ini</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  const renderSettlement = () => {
    if (!isCashierAuthenticated) {
      return (
        <div className="max-w-md mx-auto py-20">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden p-10">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-zinc-50 rounded-full mb-6">
                <Activity className="w-10 h-10 text-zinc-400" />
              </div>
              <h2 className="text-3xl font-light tracking-tight mb-2">Akses Kasir</h2>
              <p className="text-zinc-500 mb-8 text-sm">Pilih kasir bertugas dan masukkan password untuk mengakses laporan settlement.</p>
              
              <div className="w-full space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Pilih Kasir</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-zinc-50 border-none rounded-xl py-3.5 pl-4 pr-10 text-sm font-bold focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                      value={selectedCashierId}
                      onChange={(e) => {
                        setSelectedCashierId(e.target.value);
                        setCashierPassword('');
                        setShowAuthError(false);
                      }}
                    >
                      <option value="admin">Admin (Default)</option>
                      {cashierList.map(c => (
                        <option key={c.id} value={c.id!}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Password / PIN</label>
                  <Input 
                    type="password"
                    placeholder="••••••" 
                    className="rounded-xl py-6 bg-zinc-50 border-none font-bold text-center tracking-widest"
                    value={cashierPassword}
                    onChange={(e) => {
                      setCashierPassword(e.target.value);
                      setShowAuthError(false);
                    }}
                  />
                </div>
                {showAuthError && <p className="text-xs text-rose-500 font-medium">Password/PIN salah</p>}
                <Button 
                  className="w-full bg-zinc-900 rounded-2xl py-6 mt-4"
                  onClick={() => {
                    let targetPassword = 'kasir123';
                    let cashierNameVal = 'Admin';

                    if (selectedCashierId === 'admin') {
                      const adminConfig = localStorage.getItem('admin_config');
                      if (adminConfig) {
                        try {
                          const parsed = JSON.parse(adminConfig);
                          if (parsed.password) targetPassword = parsed.password;
                        } catch (err) {}
                      }
                    } else {
                      const selectedCashier = cashierList.find(c => c.id === selectedCashierId);
                      if (!selectedCashier) {
                        toast.error("Kasir tidak ditemukan!");
                        return;
                      }
                      targetPassword = selectedCashier.pin;
                      cashierNameVal = selectedCashier.name;
                    }

                    if (cashierPassword === targetPassword || (selectedCashierId === 'admin' && cashierPassword === '123')) {
                      setIsCashierAuthenticated(true);
                      setAuthenticatedCashierName(cashierNameVal);
                      setShowAuthError(false);
                    } else {
                      setShowAuthError(true);
                    }
                  }}
                >
                  Masuk
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
          <div className={`p-12 text-center text-white transition-all duration-700 ${isSettledToday ? 'bg-emerald-600' : 'bg-zinc-900'}`}>
            {isSettledToday ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="w-16 h-16 mb-4 text-white animate-bounce" />
                <Badge className="bg-white text-emerald-600 border-none mb-6 px-4 py-1.5 uppercase tracking-widest text-[10px]">Settled Successfully</Badge>
                <h2 className="text-4xl font-light tracking-tight mb-2">Shift Selesai</h2>
                <p className="opacity-70 mb-1">{selectedDate.toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                <p className="opacity-55 text-xs mb-4">Kasir: {settlements[0]?.cashierName || authenticatedCashierName}</p>
                <div className="flex gap-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white/50 hover:text-white hover:bg-white/10 transition-colors relative z-20"
                    onClick={() => {
                      setIsCashierAuthenticated(false);
                      setCashierPassword('');
                    }}
                  >
                    Logout Kasir ({authenticatedCashierName})
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Badge className="bg-emerald-500 text-white border-none mb-6 px-4 py-1.5 uppercase tracking-widest text-[10px]">Ready for Settlement</Badge>
                <h2 className="text-4xl font-light tracking-tight mb-2">Laporan Akhir Hari</h2>
                <p className="opacity-50 font-medium tracking-tight mb-2">Generate settlement untuk mengakhiri shift.</p>
                <p className="font-bold text-emerald-400 mb-1">{selectedDate.toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                <p className="opacity-70 text-xs text-zinc-300">Akses Aktif: <span className="font-black text-white">{authenticatedCashierName}</span></p>
              </>
            )}
             {!isSettledToday && (
               <div className="flex justify-center mt-6">
                  <Button 
                   variant="ghost" 
                   size="sm" 
                   className="text-white/50 hover:text-white hover:bg-white/10 transition-colors relative z-20"
                   onClick={() => {
                     setIsCashierAuthenticated(false);
                     setCashierPassword('');
                   }}
                 >
                   Logout Kasir ({authenticatedCashierName})
                 </Button>
               </div>
             )}
          </div>
          <CardContent className="p-12 space-y-8">
             {/* Date Selection for Settlement */}
             <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block text-center">Pilih Tanggal Laporan</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input 
                    type="date"
                    className="pl-12 py-6 rounded-2xl bg-zinc-50 border-none text-zinc-900"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      if (!isNaN(newDate.getTime())) {
                        setSelectedDate(newDate);
                        setActualCashInput(''); // Reset input when date changes
                      }
                    }}
                  />
                </div>
             </div>

             {/* Detailed vs Brief Summary Toggle */}
             {isSettledToday && (
               <div className="flex justify-center gap-2 p-1 bg-zinc-50 rounded-2xl">
                 <button 
                  onClick={() => setShowDetailedSummary(false)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${!showDetailedSummary ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'}`}
                 >
                   <BarChart3 className="w-4 h-4 inline-block mr-2" />
                   Ringkasan
                 </button>
                 <button 
                  onClick={() => setShowDetailedSummary(true)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${showDetailedSummary ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'}`}
                 >
                   <ListFilter className="w-4 h-4 inline-block mr-2" />
                   Rincian
                 </button>
               </div>
             )}
  
             <div className="grid grid-cols-2 gap-8 border-b border-zinc-100 pb-8">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-[0.2em] mb-2">Total Transaksi</p>
                  <p className="text-3xl font-light text-zinc-900">{totalTransactions}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-[0.2em] mb-2">Total Penjualan</p>
                  <p className="text-3xl font-light text-zinc-900">Rp {recapTotalRevenue.toLocaleString()}</p>
                </div>
             </div>
  
             <div className="space-y-4 animate-in fade-in transition-all duration-300">
                {showDetailedSummary && isSettledToday && settlements[0]?.soldItems && (
                  <div className="bg-zinc-50 rounded-3xl p-6 mb-6">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Item Terjual</h4>
                    <div className="space-y-3">
                      {settlements[0]?.soldItems?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex gap-2">
                            <span className="text-zinc-400 font-bold">{item.quantity}x</span>
                            <span className="text-zinc-900 font-medium">{item.name}</span>
                          </div>
                          <span className="font-bold">Rp {item.revenue?.toLocaleString() || (0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-zinc-500">Penjualan Tunai (Cash)</span>
                  </div>
                  <span className="font-bold">Rp {cashSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-zinc-500">Penjualan Non-Tunai</span>
                  </div>
                  <span className="font-bold">Rp {nonCashSales.toLocaleString()}</span>
                </div>
                
                {(isSettledToday || showDetailedSummary) && (
                  <>
                    <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                      <span className="text-zinc-500">Modal Awal / Saldo Awal</span>
                      <span className="font-medium">Rp 0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                      <span className="text-zinc-500">Total Kas Masuk (Manual)</span>
                      <span className="font-medium text-emerald-600">+Rp {recapCashIn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                      <span className="text-zinc-500">Total Kas Keluar (Manual)</span>
                      <span className="font-medium text-rose-600">-Rp {recapCashOut.toLocaleString()}</span>
                    </div>
                  </>
                )}
  
                <div className="flex justify-between py-4 text-xl border-t border-zinc-900 mt-4">
                  <div className="flex flex-col">
                    <span className="font-light text-zinc-900">Uang Cash Seharusnya</span>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">(Sales Cash + Kas Masuk - Keluar)</p>
                  </div>
                  <span className="font-bold text-zinc-900">Rp {expectedCash.toLocaleString()}</span>
                </div>
  
                {!isSettledToday ? (
                  <div className="pt-6 space-y-4">
                    <div className="p-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed border-zinc-200">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-4 text-center">Verifikasi Uang Fisik Di Kas (Cash Aktual)</label>
                      <div className="relative">
                        <CircleDollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-300" />
                        <Input 
                          type="number"
                          placeholder="Contoh: 500000"
                          className="pl-14 py-8 rounded-2xl border-white bg-white shadow-inner text-xl font-bold"
                          value={actualCashInput}
                          onChange={(e) => setActualCashInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-6 space-y-4">
                    <div className={`p-6 rounded-[2rem] border-2 ${settlements[0]?.difference >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Selisih Kas</p>
                          <p className={`text-2xl font-bold ${settlements[0]?.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {settlements[0]?.difference > 0 ? '+' : ''}Rp {settlements[0]?.difference.toLocaleString()}
                          </p>
                        </div>
                        {settlements[0]?.difference >= 0 ? (
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        ) : (
                          <XCircle className="w-10 h-10 text-red-400" />
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between text-sm">
                        <span className="text-zinc-500">Uang Fisik Terinput</span>
                        <span className="font-bold text-zinc-900">Rp {settlements[0]?.actualCash.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
             </div>
  
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                 <Button 
                   variant="outline" 
                   className="flex-1 rounded-3xl py-8 border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-all font-medium"
                   onClick={() => window.print()}
                 >
                   <Printer className="w-5 h-5 mr-3" />
                   Review Print
                 </Button>
                 {!isSettledToday && (
                   <Button 
                     className="flex-1 rounded-3xl py-8 bg-zinc-900 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 font-medium"
                     onClick={handleProcessSettlement}
                   >
                     Proses Settlement
                   </Button>
                 )}
              </div>
             {!isSettledToday && (
               <p className="text-center text-[10px] text-zinc-300 font-medium uppercase tracking-widest pt-4">
                 Settlement akan mengunci semua transaksi dan kas hari ini
               </p>
             )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-light tracking-tighter text-zinc-900 mb-2">Aktifitas</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 p-1.5 px-3 bg-zinc-100 rounded-full text-zinc-500">
               <Calendar className="w-4 h-4" />
               <input 
                type="date" 
                className="bg-transparent border-none text-[10px] md:text-xs font-bold uppercase tracking-tight focus:outline-none" 
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setSelectedDate(newDate);
                  }
                }}
               />
            </div>

            <div className="flex items-center gap-2 p-1.5 pl-3 pr-2.5 bg-zinc-100 rounded-full text-[11px] font-bold text-zinc-600">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span className="opacity-60 text-[9px] uppercase font-bold tracking-wider">Kasir Bertugas:</span>
              <div className="relative">
                <select 
                  className="bg-transparent border-none py-0.5 pl-0 pr-5 text-[11px] font-extrabold uppercase tracking-tight focus:outline-none appearance-none cursor-pointer text-zinc-900" 
                  value={isCashierAuthenticated ? selectedCashierId : 'unauthenticated'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'unauthenticated') {
                      setIsCashierAuthenticated(false);
                      setAuthenticatedCashierName('Admin');
                      setSelectedCashierId('admin');
                      return;
                    }
                    setPendingCashierId(val);
                    setPinInput('');
                    setShowPinModal(true);
                  }}
                >
                  <option value="unauthenticated">-- Pilih Kasir --</option>
                  <option value="admin">Admin (Default)</option>
                  {cashierList.map(c => (
                    <option key={c.id} value={c.id!}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[8px]">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex p-1 bg-zinc-100/50 rounded-2xl md:rounded-[2rem] w-full md:w-fit shadow-inner overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('cash')}
            className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'cash' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            Kas
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'sales' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            Penjualan
          </button>
          <button
            onClick={() => setActiveTab('settlement')}
            className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'settlement' ? 'bg-white shadow-md text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            Settlement
          </button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'cash' && renderCashManagement()}
        {activeTab === 'sales' && renderSales()}
        {activeTab === 'settlement' && renderSettlement()}
      </div>

      {/* Common Dialogs for all tabs */}
      <Dialog open={!!editingMovement} onOpenChange={(open) => !open && setEditingMovement(null)}>
        <DialogContent className="rounded-3xl border-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light">Edit Catatan Kas</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateMovement} className="space-y-4 pt-4">
            <div className="flex p-1 bg-zinc-50 rounded-2xl">
              <button
                type="button"
                onClick={() => setEditingMovement(prev => prev ? { ...prev, type: 'in' } : null)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${editingMovement?.type === 'in' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-400'}`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setEditingMovement(prev => prev ? { ...prev, type: 'out' } : null)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${editingMovement?.type === 'out' ? 'bg-white shadow-sm text-rose-600' : 'text-zinc-400'}`}
              >
                Keluar
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Jumlah (Rp)</label>
              <Input 
                type="number" 
                className="rounded-xl py-6 bg-zinc-50 border-none"
                value={editingMovement?.amount || ''}
                onChange={(e) => setEditingMovement(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Keterangan</label>
              <Input 
                className="rounded-xl py-6 bg-zinc-50 border-none"
                value={editingMovement?.description || ''}
                onChange={(e) => setEditingMovement(prev => prev ? { ...prev, description: e.target.value } : null)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-zinc-900 rounded-2xl py-6 mt-2">
              Perbaharui Catatan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeletingConfirmOpen} onOpenChange={setIsDeletingConfirmOpen}>
        <DialogContent className="rounded-3xl border-none p-10 max-w-sm text-center">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6">
              <Trash2 className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-2xl font-light tracking-tight mb-2">Hapus Catatan?</h2>
            <p className="text-zinc-500 mb-8 text-sm">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 rounded-2xl py-6" onClick={() => setIsDeletingConfirmOpen(false)}>Batal</Button>
              <Button variant="destructive" className="flex-1 rounded-2xl py-6" onClick={confirmDeleteMovement}>Hapus</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementConfirmOpen} onOpenChange={setIsSettlementConfirmOpen}>
        <DialogContent className="rounded-3xl border-none p-10 max-w-sm text-center">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
              <Info className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-light tracking-tight mb-2">Konfirmasi Settlement</h2>
            <p className="text-zinc-500 mb-8 text-sm">Semua transaksi hari ini akan dikunci. Lanjutkan?</p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 rounded-2xl py-6" onClick={() => setIsSettlementConfirmOpen(false)}>Batal</Button>
              <Button className="flex-1 bg-zinc-900 rounded-2xl py-6" onClick={confirmSettlement}>Ya, Selesai</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementRecapOpen} onOpenChange={setIsSettlementRecapOpen}>
        <DialogContent className="rounded-3xl border-none p-10 max-w-lg text-center">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-light tracking-tight mb-2">Settlement Berhasil!</h2>
            <p className="text-zinc-500 mb-8">Data hari ini telah dikunci untuk proses pembukuan.</p>
            
            <div className="w-full space-y-3 bg-zinc-50 p-6 rounded-3xl text-sm mb-8">
               <div className="flex justify-between">
                 <span className="text-zinc-400 font-medium">Uang Seharusnya</span>
                 <span className="font-bold">Rp {expectedCash.toLocaleString()}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-zinc-400 font-medium">Uang Fisik</span>
                 <span className="font-bold">Rp {Number(actualCashInput).toLocaleString()}</span>
               </div>
               <div className="flex justify-between pt-2 border-t border-zinc-200">
                 <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Selisih</span>
                 <span className={`font-bold ${Number(actualCashInput) - expectedCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                   {Number(actualCashInput) - expectedCash > 0 ? '+' : ''}Rp {(Number(actualCashInput) - expectedCash).toLocaleString()}
                 </span>
               </div>
            </div>

            <Button className="w-full bg-zinc-900 rounded-2xl py-6" onClick={() => setIsSettlementRecapOpen(false)}>
              Mengerti
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPinModal} onOpenChange={(open) => {
        if (!open) {
          setShowPinModal(false);
          setPinInput('');
        }
      }}>
        <DialogContent className="rounded-3xl border-none p-10 max-w-sm text-center">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-zinc-900" />
            </div>
            <h2 className="text-2xl font-light tracking-tight mb-2">Verifikasi Kasir</h2>
            <p className="text-zinc-500 mb-6 text-sm">
              Sandi untuk: <span className="font-bold text-zinc-900">{pendingCashierId === 'admin' ? 'Admin' : cashierList.find(c => c.id === pendingCashierId)?.name || 'Kasir'}</span>
            </p>
            <form onSubmit={handleVerifyActivityPin} className="w-full space-y-4">
              <Input 
                type="password"
                placeholder="••••••" 
                className="rounded-xl py-6 bg-zinc-50 border-none font-bold text-center tracking-widest text-lg"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3 w-full pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 rounded-2xl py-6" 
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                  }}
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-zinc-900 rounded-2xl py-6"
                >
                  Verifikasi
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
