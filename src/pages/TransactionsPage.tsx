import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  History, 
  TrendingUp, 
  ShoppingBag, 
  CalendarDays,
  FileText,
  Search,
  Users,
  X,
  Ban,
  User
} from 'lucide-react';
import { transactionsService, productsService } from '@/lib/data-service';
import { Transaction, Product } from '@/types';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [transactionToVoid, setTransactionToVoid] = useState<Transaction | null>(null);

  useEffect(() => {
    const unsubTrans = transactionsService.getAll(setTransactions);
    const unsubProducts = productsService.subscribe(setProducts);
    return () => {
      unsubTrans();
      unsubProducts();
    };
  }, []);

  const filteredTransactions = transactions.filter(t => {
    if (t.status === 'pending') return false;
    
    const matchesSearch = t.id?.toLowerCase().includes(search.toLowerCase()) ||
      t.items.some(item => item.name.toLowerCase().includes(search.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (startDate || endDate) {
      const transactionDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
      const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
      const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
      
      try {
        return isWithinInterval(transactionDate, { start, end });
      } catch (e) {
        return true;
      }
    }

    return true;
  });

  const isCreatedToday = (date: any) => {
    if (!date) return true;
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    return d.getDate() === now.getDate() &&
           d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
  };

  const handleVoid = async (transaction: Transaction, reason: string) => {
    if (!isCreatedToday(transaction.createdAt)) {
      toast.error('Gagal: Transaksi hanya bisa dibatalkan di hari yang sama');
      return;
    }
    if (transaction.isSettled) {
      toast.error('Gagal: Transaksi sudah masuk laporan settlement dan tidak bisa dibatalkan');
      return;
    }
    if (!reason.trim()) {
      toast.error('Gagal: Alasan pembatalan harus diisi');
      return;
    }
    try {
      await transactionsService.void(transaction.id!, reason);
      if (selectedTransaction?.id === transaction.id) {
        setSelectedTransaction(prev => prev ? { ...prev, status: 'void', voidReason: reason } : null);
      }
      toast.success('Transaksi berhasil dibatalkan (void)');
      setIsVoidDialogOpen(false);
      setVoidReason('');
      setTransactionToVoid(null);
    } catch (error: any) {
      const message = error.message?.includes('Transaksi hanya bisa dibatalkan') 
        ? error.message 
        : 'Gagal membatalkan transaksi';
      toast.error(message);
    }
  };

  const openVoidDialog = (transaction: Transaction) => {
    setTransactionToVoid(transaction);
    setIsVoidDialogOpen(true);
  };

  const handleRowClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailOpen(true);
  };

  const completedTransactions = filteredTransactions.filter(t => !t.status || t.status === 'completed');
  
  const totalSales = completedTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalItemsSold = completedTransactions.reduce((acc, t) => acc + t.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  // Calculate best selling items
  const itemStats = completedTransactions.reduce((acc, t) => {
    t.items.forEach(item => {
      const currentProduct = products.find(p => p.id === item.productId);
      const displayName = currentProduct ? currentProduct.name : item.name;
      acc[displayName] = (acc[displayName] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const bestSellingItem = Object.entries(itemStats)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0];

  const setToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeek = () => {
    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setStartDate(start);
    setEndDate(end);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-3xl font-light tracking-tight text-zinc-900">Dashboard Penjualan</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50 h-8"
            onClick={setToday}
          >
            Hari Ini
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50 h-8"
            onClick={setThisWeek}
          >
            Minggu Ini
          </Button>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-100 ml-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Dari</span>
            <input 
              type="date" 
              className="text-xs bg-transparent border-none outline-none focus:ring-0"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-100">
            <span className="text-xs font-semibold text-zinc-400 uppercase">Sampai</span>
            <input 
              type="date" 
              className="text-xs bg-transparent border-none outline-none focus:ring-0"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {(startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="rounded-full hover:bg-red-50 text-red-500 w-8 h-8"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="rounded-2xl border-none shadow-sm bg-zinc-900 text-white">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 md:w-5 h-5 text-zinc-100" />
              </div>
            </div>
            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-0.5">Total Penjualan</p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight">Rp {totalSales.toLocaleString()}</h2>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-50 rounded-xl flex items-center justify-center">
                <History className="w-4 h-4 md:w-5 h-5 text-zinc-900" />
              </div>
            </div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Total Transaksi</p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight text-zinc-900">{completedTransactions.length}</h2>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-50 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 md:w-5 h-5 text-zinc-900" />
              </div>
            </div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Item Terjual</p>
            <h2 className="text-xl md:text-2xl font-medium tracking-tight text-zinc-900">{totalItemsSold} <span className="text-xs md:text-sm font-light text-zinc-400">pcs</span></h2>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white sm:col-span-2 lg:col-span-3">
          <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Item Terlaris</p>
                <h2 className="text-lg md:text-2xl font-medium tracking-tight text-zinc-900 truncate">
                  {bestSellingItem ? `${bestSellingItem[0]} (${bestSellingItem[1]} terjual)` : 'Belum ada data'}
                </h2>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden p-3 md:p-5 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
           <h3 className="text-lg md:text-xl font-light tracking-tight px-1 text-center md:text-left">Riwayat Transaksi</h3>
           <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <Input 
                placeholder="Cari ID atau produk..." 
                className="pl-9 h-10 rounded-full bg-zinc-50 border-none outline-none focus:ring-1 focus:ring-zinc-200 transition-all text-xs shadow-inner"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-xl border border-zinc-50 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead className="py-4 px-5 text-xs">Waktu</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Produk</TableHead>
                <TableHead className="text-xs">Metode</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Total</TableHead>
                <TableHead className="text-right px-5 text-xs">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((t) => (
                <TableRow 
                  key={t.id} 
                  className="hover:bg-zinc-50/50 cursor-pointer transition-colors border-b border-zinc-50 last:border-none"
                  onClick={() => handleRowClick(t)}
                >
                  <TableCell className="px-5 py-4 font-medium text-zinc-400 text-xs">
                    {t.createdAt?.toDate ? format(t.createdAt.toDate(), 'HH:mm, dd MMM', { locale: id }) : 'Recent'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-zinc-900 font-semibold text-xs">{t.customerName || '-'}</span>
                      <span className="text-[9px] text-zinc-400 font-mono tracking-tighter">ID: {t.id?.slice(-8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs space-y-1">
                      {t.items.map((i, idx) => {
                        const currentProduct = products.find(p => p.id === i.productId);
                        const displayName = currentProduct ? currentProduct.name : i.name;
                        return (
                          <div key={idx} className="flex flex-col">
                            <span className="text-zinc-900 font-medium text-xs leading-tight">{displayName} <span className="text-zinc-400 text-[10px] font-bold">(x{i.quantity})</span></span>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.paymentMethod === 'cash' ? 'outline' : 'secondary'} className="rounded-full font-bold text-[9px] uppercase tracking-widest px-2 h-5">
                      {t.paymentMethod === 'cash' ? 'Tunai' : t.paymentMethod === 'transfer' ? 'Transfer' : 'QRIS'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                       <Badge variant={t.status === 'void' ? 'destructive' : 'outline'} className="rounded-full font-bold text-[8px] px-2 h-5 uppercase tracking-widest">
                        {t.status === 'void' ? 'VOID' : 'OK'}
                      </Badge>
                      {t.isSettled && (
                        <Badge variant="secondary" className="rounded-full font-bold text-[8px] h-5 px-2 bg-emerald-50 text-emerald-600 border-emerald-100 uppercase tracking-widest">
                          SENT
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-zinc-900 text-xs">
                    <span className={t.status === 'void' ? 'line-through text-zinc-300' : ''}>
                      Rp {t.totalAmount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right px-5">
                    <div className="flex justify-end gap-0.5 relative z-50">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg h-8 w-8 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(t);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      {t.status !== 'void' && isCreatedToday(t.createdAt) && !t.isSettled && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg h-8 w-8 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVoidDialog(t);
                          }}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <History className="w-12 h-12 mb-3" />
                      <p className="text-base font-medium">Belum ada data</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.map((t) => (
            <div 
              key={t.id} 
              className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all"
              onClick={() => handleRowClick(t)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">
                    {t.createdAt?.toDate ? format(t.createdAt.toDate(), 'HH:mm, dd MMM', { locale: id }) : 'Recent'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-900">{t.customerName || 'No Name'}</span>
                    <Badge variant={t.paymentMethod === 'cash' ? 'outline' : 'secondary'} className="rounded-full text-[8px] h-3.5 leading-none uppercase tracking-widest px-1 font-bold">
                      {t.paymentMethod === 'cash' ? 'Tunai' : t.paymentMethod === 'transfer' ? 'Transfer' : 'QRIS'}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                   <div className="flex gap-1 mb-1">
                      {t.isSettled && (
                        <Badge variant="secondary" className="rounded-full text-[7px] h-3.5 bg-emerald-50 text-emerald-600 border-none font-bold">SETTLED</Badge>
                      )}
                      <Badge variant={t.status === 'void' ? 'destructive' : 'outline'} className="rounded-full text-[7px] h-3.5 font-bold border-none uppercase tracking-widest">
                        {t.status === 'void' ? 'VOID' : 'OK'}
                      </Badge>
                   </div>
                   <span className={`text-base font-black tracking-tight ${t.status === 'void' ? 'line-through text-zinc-200' : 'text-zinc-900'}`}>
                     Rp {t.totalAmount.toLocaleString()}
                   </span>
                </div>
              </div>

              <div className="bg-zinc-50/50 rounded-xl p-3 space-y-1.5 mb-3">
                 {t.items.slice(0, 3).map((i, idx) => {
                   const currentProduct = products.find(p => p.id === i.productId);
                   const displayName = currentProduct ? currentProduct.name : i.name;
                   return (
                     <div key={idx} className="flex justify-between items-center text-[10px]">
                       <span className="text-zinc-600 font-medium">{displayName} <span className="text-zinc-400 font-bold">x{i.quantity}</span></span>
                       <span className="font-bold text-zinc-900">Rp {(i.price * i.quantity).toLocaleString()}</span>
                     </div>
                   );
                 })}
                 {t.items.length > 3 && (
                   <p className="text-[9px] text-zinc-400 font-medium italic">+{t.items.length - 3} item lainnya...</p>
                 )}
              </div>

              <div className="flex justify-between items-center gap-2">
                 <Button 
                    variant="secondary" 
                    className="flex-1 rounded-lg h-8 bg-zinc-100 text-zinc-600 font-bold text-[9px] uppercase tracking-widest hover:bg-zinc-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(t);
                    }}
                  >
                    Detail
                  </Button>
                  {t.status !== 'void' && isCreatedToday(t.createdAt) && !t.isSettled && (
                    <Button 
                      variant="ghost" 
                      className="rounded-lg h-8 text-red-400 hover:text-red-500 font-bold text-[9px] uppercase tracking-widest px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        openVoidDialog(t);
                      }}
                    >
                      Void
                    </Button>
                  )}
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="py-20 text-center opacity-20">
               <History className="w-12 h-12 mx-auto mb-4" />
               <p className="text-sm font-medium">Belum ada riwayat transaksi</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md rounded-3xl border-none p-0 overflow-hidden bg-zinc-50/50 backdrop-blur-xl">
          <div className="p-8 bg-white rounded-b-[2.5rem] shadow-sm">
            <DialogHeader className="mb-6">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-2xl font-light tracking-tight text-zinc-900">Detail Transaksi</DialogTitle>
                <div className="flex gap-2">
                   {selectedTransaction?.isSettled && (
                    <Badge variant="secondary" className="rounded-full font-normal bg-emerald-50 text-emerald-600 border-emerald-100">
                      SETTLED
                    </Badge>
                  )}
                  <Badge variant={selectedTransaction?.status === 'void' ? 'destructive' : 'outline'} className="rounded-full font-normal">
                    {selectedTransaction?.status === 'void' ? 'VOID' : 'COMPLETED'}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-xs text-zinc-400 font-mono">ID: {selectedTransaction?.id}</p>
                {selectedTransaction?.status === 'void' && selectedTransaction?.voidReason && (
                  <div className="bg-red-50 p-3 rounded-xl mt-2 border border-red-100">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Alasan Pembatalan</p>
                    <p className="text-sm text-red-600 font-medium italic">"{selectedTransaction.voidReason}"</p>
                  </div>
                )}
                {selectedTransaction?.customerName && (
                  <p className="text-sm font-medium text-zinc-600 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    {selectedTransaction.customerName}
                  </p>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Item Pesanan</p>
                <div className="space-y-4">
                  {selectedTransaction?.items.map((item, idx) => {
                    const currentProduct = products.find(p => p.id === item.productId);
                    const displayName = currentProduct ? currentProduct.name : item.name;
                    return (
                      <div key={idx} className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900">{displayName}</span>
                            <span className="text-xs text-zinc-400">x{item.quantity}</span>
                          </div>
                          {item.note && (
                            <div className="bg-zinc-50 px-2 py-1 rounded-md">
                              <p className="text-[10px] text-zinc-500 italic">"{item.note}"</p>
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-zinc-900 whitespace-nowrap">
                          Rp {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-zinc-100" />

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Metode Pembayaran</span>
                  <span className="font-medium text-zinc-900 uppercase tracking-wider">{selectedTransaction?.paymentMethod === 'cash' ? 'Tunai' : selectedTransaction?.paymentMethod === 'transfer' ? 'Transfer' : 'QRIS'}</span>
                </div>
                {selectedTransaction?.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Tunai Diterima</span>
                      <span className="text-zinc-900 font-medium">Rp {selectedTransaction?.cashReceived?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Kembalian</span>
                      <span className="text-zinc-900 font-medium font-mono text-zinc-400">Rp {selectedTransaction?.change?.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Total Pembayaran</p>
                <p className="text-xs text-zinc-400">
                  {selectedTransaction?.createdAt?.toDate ? format(selectedTransaction.createdAt.toDate(), 'HH:mm, dd MMMM yyyy', { locale: id }) : ''}
                </p>
              </div>
              <h2 className="text-3xl font-light tracking-tight text-zinc-900">
                Rp {selectedTransaction?.totalAmount.toLocaleString()}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-full border-zinc-200 text-zinc-500 h-12 flex gap-2" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
                Cetak Struk
              </Button>
              {selectedTransaction?.status !== 'void' && isCreatedToday(selectedTransaction?.createdAt) && !selectedTransaction?.isSettled && (
                <Button 
                  variant="destructive" 
                  className="rounded-full h-12 flex gap-2"
                  onClick={() => {
                    openVoidDialog(selectedTransaction!);
                  }}
                >
                  <Ban className="w-4 h-4" />
                  Void Order
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Hidden Receipt for Printing */}
      <div className="print-only fixed inset-0 z-[9999] bg-white p-4 text-black text-[12px] font-mono leading-tight">
        {selectedTransaction && (
          <div className="max-w-[300px] mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold uppercase">KasirKu</h2>
              <p className="text-[10px]">Jl. Contoh No. 123, Kota</p>
              <p className="text-[10px]">Telp: 0812-3456-7890</p>
            </div>

            <div className="border-b border-dashed border-black pb-2 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>No Bukti:</span>
                <span>#{selectedTransaction.id?.slice(-8).toUpperCase() || 'NEW'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{selectedTransaction.createdAt?.toDate ? format(selectedTransaction.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : new Date().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>Admin</span>
              </div>
              {selectedTransaction.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{selectedTransaction.customerName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 py-2 border-b border-dashed border-black">
              {selectedTransaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>{item.name}</span>
                    <span>Rp {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>{item.quantity} x Rp {item.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 py-1">
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>Rp {selectedTransaction.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>PEMBAYARAN</span>
                <span className="uppercase">{selectedTransaction.paymentMethod}</span>
              </div>
              {selectedTransaction.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>DITERIMA</span>
                    <span>Rp {(selectedTransaction.cashReceived || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>KEMBALIAN</span>
                    <span>Rp {(selectedTransaction.change || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-6 space-y-1 opacity-80">
              <p className="text-[10px] font-bold">TERIMA KASIH</p>
              <p className="text-[9px]">Selamat Belanja Kembali</p>
              <p className="text-[8px] italic mt-2">www.kasirku.id</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl border-none p-8 bg-white">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-light tracking-tight text-zinc-900">Batalkan Transaksi</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="bg-zinc-50 p-4 rounded-2xl space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Item yang akan dibatalkan</p>
              <div className="space-y-2">
                {transactionToVoid?.items.map((item, idx) => {
                  const currentProduct = products.find(p => p.id === item.productId);
                  const displayName = currentProduct ? currentProduct.name : item.name;
                  return (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-zinc-600">{displayName} <span className="text-zinc-400">x{item.quantity}</span></span>
                      <span className="font-medium text-zinc-900">Rp {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  );
                })}
                <Separator className="my-2 bg-zinc-200" />
                <div className="flex justify-between items-center font-semibold text-zinc-900">
                  <span>Total</span>
                  <span>Rp {transactionToVoid?.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Alasan Pembatalan</label>
              <Input 
                placeholder="Contoh: Salah input item, Customer batal beli..." 
                className="rounded-xl bg-zinc-50 border-none py-6"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-full h-12" onClick={() => setIsVoidDialogOpen(false)}>
                Kembali
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-full h-12"
                disabled={!voidReason.trim()}
                onClick={() => handleVoid(transactionToVoid!, voidReason)}
              >
                Konfirmasi Void
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
