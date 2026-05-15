import { useState, useEffect, FormEvent } from 'react';
import { 
  Settings as SettingsIcon, 
  Package, 
  User, 
  ShieldCheck,
  ChevronRight,
  Store,
  Layers,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  FileSpreadsheet,
  History,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ProductsPage from './ProductsPage';
import { toast } from 'sonner';
import { whitelistService, settlementsService, transactionsService, cashService, productsService, categoriesService } from '@/lib/data-service';
import { Settlement } from '@/types';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { auth } from '@/lib/firebase';

type SettingsSection = 'overview' | 'products' | 'profile' | 'revenue' | 'whitelist';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Profile management state
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  const [whitelistEmail, setWhitelistEmail] = useState('');
  const isRootAdmin = auth.currentUser?.email === 'cssbagas@gmail.com';

  const handleAddWhitelist = async (e: FormEvent) => {
    e.preventDefault();
    if (!whitelistEmail) return;
    
    try {
      await whitelistService.add(whitelistEmail);
      toast.success('User berhasil ditambahkan ke whitelist');
      setWhitelistEmail('');
    } catch (error) {
      toast.error('Gagal menambahkan user');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      const unsub = settlementsService.getAll(setSettlements);
      return () => unsub();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Initialize default credentials if they don't exist
    if (!localStorage.getItem('admin_config')) {
      localStorage.setItem('admin_config', JSON.stringify({
        username: 'kasir',
        password: 'kasir123'
      }));
    }

    // Check if session exists in memory (not persisting login for security, but keeping it for this turn)
    const sessionToken = sessionStorage.getItem('settings_session');
    if (sessionToken === 'active') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const config = JSON.parse(localStorage.getItem('admin_config') || '{}');
    
    if (loginUsername === config.username && loginPassword === config.password) {
      setIsAuthenticated(true);
      sessionStorage.setItem('settings_session', 'active');
      toast.success('Login berhasil');
    } else {
      toast.error('Username atau password salah');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('settings_session');
    setActiveSection('overview');
  };

  const handleUpdateProfile = (e: FormEvent) => {
    e.preventDefault();
    const config = JSON.parse(localStorage.getItem('admin_config') || '{}');

    if (currentPassword !== config.password) {
      toast.error('Password saat ini salah');
      return;
    }

    const updatedConfig = {
      username: newUsername || config.username,
      password: newPassword || config.password
    };

    localStorage.setItem('admin_config', JSON.stringify(updatedConfig));
    toast.success('Profil berhasil diperbaharui');
    setCurrentPassword('');
    setNewPassword('');
    setNewUsername('');
  };

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleResetData = async () => {
    try {
      const loadingToast = toast.loading('Sedang mereset data...');
      
      await Promise.all([
        productsService.deleteAll(),
        categoriesService.deleteAll(),
        transactionsService.deleteAll(),
        cashService.deleteAll(),
        settlementsService.deleteAll()
      ]);
      
      toast.dismiss(loadingToast);
      toast.success('Data berhasil direset sepenuhnya');
      setIsResetConfirmOpen(false);
      setActiveSection('overview');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mereset data');
    }
  };

  const exportToExcel = (settlement: Settlement) => {
    try {
      const dateStr = format(settlement.date?.toDate ? settlement.date.toDate() : new Date(), 'yyyy-MM-dd_HH-mm');
      
      // Financial Summary Sheet
      const summaryData = [
        ['LAPORAN SETTLEMENT', ''],
        ['Tanggal', format(settlement.date?.toDate ? settlement.date.toDate() : new Date(), 'PPPP p', { locale: id })],
        ['Kasir', 'kasir'], // Since we don't store the specific cashier name in the settlement doc yet
        ['', ''],
        ['RINGKASAN KEUANGAN', ''],
        ['Total Transaksi', settlement.totalTransactions],
        ['Total Omset (Gross)', settlement.totalSales],
        ['Total Sales Cash', settlement.totalCashSales],
        ['Total Sales Non-Cash', settlement.totalNonCashSales],
        ['Total Kas Masuk (Manual)', settlement.totalCashIn],
        ['Total Kas Keluar (Manual)', settlement.totalCashOut],
        ['Uang Cash Seharusnya', settlement.expectedCash],
        ['Uang Fisik Terinput', settlement.actualCash],
        ['Selisih', settlement.difference],
      ];

      // Itemized Sales Sheet
      const itemData = [
        ['RINCIAN PRODUK TERJUAL', '', ''],
        ['Nama Produk', 'Jumlah', 'Total Pendapatan'],
        ...(settlement.soldItems?.map(item => [item.name, item.quantity, item.revenue]) || [])
      ];

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsItems = XLSX.utils.aoa_to_sheet(itemData);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Keuangan');
      XLSX.utils.book_append_sheet(wb, wsItems, 'Rincian Penjualan');

      XLSX.writeFile(wb, `Laporan_Settlement_${dateStr}.xlsx`);
      toast.success('Laporan berhasil diekspor ke Excel');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengekspor laporan');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="p-4 bg-zinc-900 rounded-2xl mb-6 shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-light tracking-tight text-zinc-900 mb-2">Akses Terbatas</h1>
              <p className="text-zinc-500 text-sm">Harap login untuk mengakses pengaturan kasir.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300" />
                  <Input 
                    type="text" 
                    placeholder="Masukkan username" 
                    className="pl-12 pr-4 py-7 rounded-2xl border-zinc-100 bg-zinc-50/50 focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 pointer-events-none" />
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Masukkan password" 
                    className="pl-12 pr-12 py-7 rounded-2xl border-zinc-100 bg-zinc-50/50 focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl py-8 text-lg font-medium transition-all shadow-xl hover:shadow-2xl translate-y-0 active:translate-y-1">
                Masuk
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'products':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveSection('overview')}
                className="rounded-full h-8 w-8"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
              <h2 className="text-2xl font-light tracking-tight">Manajemen Produk</h2>
            </div>
            <ProductsPage hideHeader={true} />
          </div>
        );
      case 'profile':
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveSection('overview')}
                className="rounded-full h-8 w-8"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
              <h2 className="text-2xl font-light tracking-tight">Profil Admin</h2>
            </div>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <form onSubmit={handleUpdateProfile} className="space-y-8">
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 bg-zinc-100 rounded-3xl flex items-center justify-center mb-4 border-2 border-zinc-50 shadow-inner">
                      <User className="w-10 h-10 text-zinc-300" />
                    </div>
                    <p className="text-sm text-zinc-400 font-medium tracking-tight">Ubah kredensial akses admin Anda</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Username Baru</label>
                      <Input 
                        placeholder="Contoh: admin_utama" 
                        className="rounded-xl py-6 border-zinc-100 bg-zinc-50/30"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Password Baru</label>
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        className="rounded-xl py-6 border-zinc-100 bg-zinc-50/30"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2 pt-4">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Konfirmasi Password Saat Ini</label>
                      <Input 
                        type="password"
                        placeholder="Konfirmasi password saat ini untuk menyimpan" 
                        className="rounded-xl py-6 border-red-100 focus:ring-red-200 transition-all font-medium"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="flex-1 rounded-2xl py-6"
                      onClick={() => setActiveSection('overview')}
                    >
                      Batal
                    </Button>
                    <Button type="submit" className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl py-6 transition-all shadow-lg active:scale-95">
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        );
      case 'revenue':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (selectedSettlement) setSelectedSettlement(null);
                    else setActiveSection('overview');
                  }}
                  className="rounded-full h-10 w-10 bg-zinc-50 hover:bg-zinc-100"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </Button>
                <div>
                  <h2 className="text-2xl font-light tracking-tight">
                    {selectedSettlement ? 'Detail Laporan Settlement' : 'Riwayat Pendapatan'}
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">
                    {selectedSettlement ? 'Rincian keuangan & item terjual' : 'Rekapitulasi tutup buku harian'}
                  </p>
                </div>
              </div>
              {selectedSettlement && (
                <Button 
                  className="bg-zinc-900 rounded-full px-6 gap-2"
                  onClick={() => exportToExcel(selectedSettlement)}
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </Button>
              )}
            </div>

            {selectedSettlement ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden">
                    <CardContent className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6 opacity-60">
                        <History className="w-5 h-5" />
                        <span className="text-xs md:text-sm font-medium tracking-widest uppercase">Total Omset (Gross)</span>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-light tracking-tight mb-2">
                        Rp {selectedSettlement.totalSales.toLocaleString()}
                      </h3>
                      <p className="text-[10px] md:text-xs text-white/50 font-medium">
                        {format(selectedSettlement.date?.toDate ? selectedSettlement.date.toDate() : new Date(), 'PPPP', { locale: id })}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-lg rounded-[2rem] md:rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl font-light">Ringkasan Keuangan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                        <span className="text-zinc-500">Total Transaksi</span>
                        <span className="font-bold">{selectedSettlement.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                        <span className="text-zinc-500">Penjualan Tunai</span>
                        <span className="font-bold">Rp {selectedSettlement.totalCashSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                        <span className="text-zinc-500">Penjualan Non-Tunai</span>
                        <span className="font-bold">Rp {selectedSettlement.totalNonCashSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                        <span className="text-zinc-500">Kas Masuk (Manual)</span>
                        <span className="font-medium text-emerald-600">+Rp {selectedSettlement.totalCashIn.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-50 text-sm">
                        <span className="text-zinc-500">Kas Keluar (Manual)</span>
                        <span className="font-medium text-rose-600">-Rp {selectedSettlement.totalCashOut.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-4 text-lg border-t border-zinc-900 mt-4">
                        <span className="font-light">Uang Cash Seharusnya</span>
                        <span className="font-bold">Rp {selectedSettlement.expectedCash.toLocaleString()}</span>
                      </div>
                      <div className={`p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 ${selectedSettlement.difference === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Selisih Kas</p>
                          <p className="text-lg font-bold">Rp {selectedSettlement.difference.toLocaleString()}</p>
                        </div>
                        <p className="text-[10px] md:text-xs font-medium">Uang Fisik: Rp {selectedSettlement.actualCash.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card className="border-none shadow-lg rounded-[2rem] md:rounded-[2.5rem] bg-white h-full">
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl font-light">Rincian Item Terjual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-4 px-2 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-50">
                          <div className="col-span-6">Nama Produk</div>
                          <div className="col-span-2 text-center">Jumlah</div>
                          <div className="col-span-4 text-right">Subtotal</div>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 no-scrollbar">
                          {selectedSettlement.soldItems?.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 py-4 px-4 sm:px-2 items-center rounded-2xl bg-zinc-50/50 sm:bg-transparent sm:hover:bg-zinc-50 transition-all border border-zinc-50 sm:border-none">
                              <div className="w-full sm:col-span-6 font-semibold sm:font-medium text-zinc-900 text-center sm:text-left">{item.name}</div>
                              <div className="sm:col-span-2 text-center">
                                <Badge variant="secondary" className="rounded-lg bg-white sm:bg-zinc-100 text-zinc-600 border-none font-bold sm:font-medium">
                                  {item.quantity} Unit
                                </Badge>
                              </div>
                              <div className="sm:col-span-4 text-center sm:text-right font-black sm:font-bold text-zinc-900 border-t sm:border-none border-zinc-100 w-full pt-2 sm:pt-0">
                                Rp {item.revenue.toLocaleString()}
                              </div>
                            </div>
                          ))}
                          {(!selectedSettlement.soldItems || selectedSettlement.soldItems.length === 0) && (
                            <div className="py-20 text-center text-zinc-400 opacity-20">
                              <p className="text-sm">Tidak ada rincian item untuk settlement ini.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] bg-white overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-zinc-50/50">
                          <th className="py-6 px-6 md:px-8 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-100 whitespace-nowrap">Tanggal</th>
                          <th className="py-6 px-4 md:px-8 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-100 whitespace-nowrap">Transaksi</th>
                          <th className="py-6 px-4 md:px-8 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-100 whitespace-nowrap text-center">Total Omset</th>
                          <th className="py-6 px-4 md:px-8 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-100 whitespace-nowrap text-center">Uang Fisik</th>
                          <th className="py-6 px-6 md:px-8 text-[10px] uppercase font-bold text-zinc-400 tracking-widest border-b border-zinc-100 text-right whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.map((s) => (
                          <tr key={s.id} className="group hover:bg-zinc-50/50 transition-colors border-b border-zinc-50">
                            <td className="py-6 px-6 md:px-8">
                              <p className="font-bold text-zinc-900 whitespace-nowrap">
                                {format(s.date?.toDate ? s.date.toDate() : new Date(), 'dd MMM yyyy', { locale: id })}
                              </p>
                              <p className="text-[10px] text-zinc-400 font-medium">
                                {format(s.date?.toDate ? s.date.toDate() : new Date(), 'HH:mm')}
                              </p>
                            </td>
                            <td className="py-6 px-4 md:px-8">
                              <Badge variant="outline" className="rounded-full border-zinc-100 text-zinc-400 font-bold text-[9px] uppercase tracking-wider px-2 h-5">
                                {s.totalTransactions} Tx
                              </Badge>
                            </td>
                            <td className="py-6 px-4 md:px-8 text-center font-bold text-zinc-900">
                               Rp {s.totalSales.toLocaleString()}
                            </td>
                            <td className="py-6 px-4 md:px-8 text-center">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${s.difference === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {s.difference === 0 ? 'BALANCE' : `Rp ${s.difference.toLocaleString()}`}
                              </span>
                            </td>
                            <td className="py-6 px-6 md:px-8 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-zinc-300 hover:text-zinc-900"
                                  onClick={() => setSelectedSettlement(s)}
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-zinc-300 hover:text-zinc-900"
                                  onClick={() => exportToExcel(s)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {settlements.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-20 text-center opacity-10">
                              <History className="w-16 h-16 mx-auto mb-4" />
                              <p className="text-lg font-light">Belum ada riwayat settlement</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      case 'whitelist':
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveSection('overview')}
                className="rounded-full h-8 w-8"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
              <h2 className="text-2xl font-light tracking-tight">Manajemen Whitelist</h2>
            </div>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <form onSubmit={handleAddWhitelist} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Google User</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300" />
                      <Input 
                        type="email"
                        placeholder="customer@gmail.com" 
                        className="pl-12 py-6 rounded-xl border-zinc-100 bg-zinc-50/30"
                        value={whitelistEmail}
                        onChange={(e) => setWhitelistEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl py-6 transition-all shadow-lg active:scale-95">
                    Izinkan Akses Sekarang
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card 
              className="border-zinc-100 hover:border-zinc-300 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
              onClick={() => setActiveSection('products')}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="p-4 bg-zinc-900 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-medium text-zinc-900 mb-2">Kelola Produk</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Tambah, edit, dan hapus menu atau produk yang tersedia di kasir.
                </p>
              </CardContent>
            </Card>

            <Card 
              className="border-zinc-100 hover:border-zinc-300 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
              onClick={() => setActiveSection('revenue')}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="p-4 bg-emerald-50 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-medium text-zinc-900 mb-2">Laporan Pendapatan</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Lihat rincian hasil settlement, item terjual, dan download laporan Excel.
                </p>
              </CardContent>
            </Card>

            <Card 
              className="border-zinc-100 hover:border-zinc-300 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
              onClick={() => setActiveSection('profile')}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="p-4 bg-white border border-zinc-100 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <ShieldCheck className="w-8 h-8 text-zinc-900" />
                </div>
                <h3 className="text-xl font-medium text-zinc-900 mb-2">Profil Admin</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Edit username dan password akses Anda di sini.
                </p>
              </CardContent>
            </Card>

            <Card 
              className="border-zinc-100 opacity-50 cursor-not-allowed group rounded-3xl overflow-hidden shadow-sm"
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="p-4 bg-zinc-50 rounded-2xl mb-6">
                  <Store className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-medium text-zinc-400 mb-2">Informasi Toko</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Atur nama toko dan info bisnis lainnya.
                </p>
              </CardContent>
            </Card>

            {isRootAdmin && (
              <Card 
                className="border-zinc-100 hover:border-zinc-300 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
                onClick={() => setActiveSection('whitelist')}
              >
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="p-4 bg-blue-50 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-sm">
                    <ShieldCheck className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-medium text-zinc-900 mb-2">Manajemen Whitelist</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    Hanya untuk Root Admin. Tambahkan user yang diizinkan menggunakan aplikasi.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card 
              className={`transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md ${isResetConfirmOpen ? 'border-rose-500 bg-rose-50' : 'border-rose-100 bg-rose-50/10'}`}
              onClick={() => {
                if (!isResetConfirmOpen) {
                  setIsResetConfirmOpen(true);
                } else {
                  handleResetData();
                }
              }}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className={`p-4 rounded-2xl mb-6 group-hover:scale-110 transition-transform shadow-sm ${isResetConfirmOpen ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                  {isResetConfirmOpen ? <AlertTriangle className="w-8 h-8" /> : <Trash2 className="w-8 h-8" />}
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isResetConfirmOpen ? 'text-rose-700' : 'text-rose-600'}`}>
                  {isResetConfirmOpen ? 'YAKIN HAPUS?' : 'Reset Data'}
                </h3>
                <p className={`text-sm leading-relaxed font-medium ${isResetConfirmOpen ? 'text-rose-600' : 'text-rose-400'}`}>
                  {isResetConfirmOpen ? 'Klik sekali lagi untuk menghapus semua riwayat transaksi & laporan.' : 'Hapus semua riwayat laporan, transaksi & catatan kas (Mulai dari Nol).'}
                </p>
                {isResetConfirmOpen && (
                  <Button 
                    variant="link" 
                    className="mt-4 text-zinc-400 p-0 h-auto font-medium hover:text-zinc-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsResetConfirmOpen(false);
                    }}
                  >
                    Batalkan
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-zinc-900 mb-2">Pengaturan</h1>
          <p className="text-zinc-500 font-normal tracking-tight">Kelola konfigurasi sistem dan akses admin.</p>
        </div>
        <div className="flex gap-3">
          {isAuthenticated && (
             <Button 
              variant="outline" 
              className="rounded-full px-6 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all gap-2"
              onClick={handleLogout}
             >
              <LogOut className="w-4 h-4" />
              Keluar
             </Button>
          )}
          {activeSection !== 'overview' && (
             <Button 
              variant="outline" 
              className="rounded-full px-6 border-zinc-200"
              onClick={() => setActiveSection('overview')}
             >
              Kembali
             </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {renderSection()}
      </div>
    </div>
  );
}
