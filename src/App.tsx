import { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { whitelistService } from '@/lib/data-service';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { 
  Store, 
  Package, 
  History, 
  LogOut, 
  User as UserIcon,
  Menu,
  Settings as SettingsIcon,
  Activity,
  TrendingUp
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import CashierPage from '@/pages/CashierPage';
import ProductsPage from '@/pages/ProductsPage';
import TransactionsPage from '@/pages/TransactionsPage';
import SettingsPage from '@/pages/SettingsPage';
import ActivityPage from '@/pages/ActivityPage';
import { toast } from 'sonner';
import { getStoreInfo } from '@/lib/utils';

type Page = 'cashier' | 'transactions' | 'settings' | 'activity';

export default function App() {
  const storeInfo = getStoreInfo();
  const [user, setUser] = useState<User | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<Page>('cashier');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const allowed = await whitelistService.checkAccess(user.uid, user.email);
        setIsWhitelisted(allowed);
      } else {
        setIsWhitelisted(false);
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success("Berhasil masuk!");
    } catch (error) {
      toast.error("Gagal masuk. Silakan coba lagi.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Berhasil keluar.");
    } catch (error) {
      toast.error("Gagal keluar.");
    }
  };

  const NavContent = () => (
    <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-8">
      <Button 
        variant={activePage === 'cashier' ? 'secondary' : 'ghost'} 
        className={`w-full justify-start gap-4 rounded-2xl py-7 text-lg transition-all ${activePage === 'cashier' ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
        onClick={() => { setActivePage('cashier'); setIsMobileMenuOpen(false); }}
      >
        <Store className="w-6 h-6" />
        Kasir
      </Button>
      <Button 
        variant={activePage === 'transactions' ? 'secondary' : 'ghost'} 
        className={`w-full justify-start gap-4 rounded-2xl py-7 text-lg transition-all ${activePage === 'transactions' ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
        onClick={() => { setActivePage('transactions'); setIsMobileMenuOpen(false); }}
      >
        <TrendingUp className="w-6 h-6" />
        Dashboard
      </Button>
      <Button 
        variant={activePage === 'activity' ? 'secondary' : 'ghost'} 
        className={`w-full justify-start gap-4 rounded-2xl py-7 text-lg transition-all ${activePage === 'activity' ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
        onClick={() => { setActivePage('activity'); setIsMobileMenuOpen(false); }}
      >
        <Activity className="w-6 h-6" />
        Aktifitas
      </Button>
      <Button 
        variant={activePage === 'settings' ? 'secondary' : 'ghost'} 
        className={`w-full justify-start gap-4 rounded-2xl py-7 text-lg transition-all ${activePage === 'settings' ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
        onClick={() => { setActivePage('settings'); setIsMobileMenuOpen(false); }}
      >
        <SettingsIcon className="w-6 h-6" />
        Pengaturan
      </Button>
    </nav>
  );

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center">
          <Store className="w-12 h-12 text-zinc-400 mb-4" />
          <p className="text-zinc-500 font-medium tracking-tight">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F5F5F5] font-sans">
        <div className="max-w-md w-full p-10 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-zinc-100 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-8 rotate-3">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light tracking-tight text-zinc-900 mb-3">{storeInfo.name}</h1>
          <p className="text-zinc-500 mb-10 leading-relaxed text-lg">
            Sistem Kasir modern yang mudah digunakan untuk mengelola bisnis Anda.
          </p>
          <Button 
            onClick={handleLogin}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-full py-7 text-lg font-medium transition-all transform active:scale-95 shadow-lg"
          >
            Masuk dengan Google
          </Button>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  if (user && !isWhitelisted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F5F5F5] font-sans p-6 text-center">
        <div className="max-w-md w-full p-10 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-zinc-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mb-8">
            <LogOut className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-zinc-900 mb-3">Akses Ditolak</h1>
          <p className="text-zinc-500 mb-10 leading-relaxed">
            Akun Anda (<span className="font-medium text-zinc-900">{user.email}</span>) belum terdaftar dalam sistem akses {storeInfo.name}. Silakan hubungi administrator untuk verifikasi.
          </p>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="w-full rounded-full py-7 text-lg font-medium border-zinc-200 hover:bg-zinc-50"
          >
            Keluar & Gunakan Akun Lain
          </Button>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#F5F5F5] font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-0' : 'w-72'} transition-all duration-300 ease-in-out bg-white border-r border-zinc-100 flex flex-col hidden md:flex shrink-0 overflow-hidden`}>
        <div className="flex-1 py-8 overflow-y-auto">
           <NavContent />
        </div>

        <div className="p-6 border-t border-zinc-50">
          <div className="flex items-center gap-4 px-2 mb-6 p-3 rounded-2xl bg-zinc-50/50 border border-zinc-100">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            ) : (
              <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-zinc-500" />
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-zinc-900 truncate">{user.displayName || 'User'}</span>
              <span className="text-[10px] text-zinc-400 truncate uppercase mt-0.5 tracking-wider">{user.email}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-4 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl py-7 text-lg"
            onClick={handleLogout}
          >
            <LogOut className="w-6 h-6" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex items-center justify-between p-4 md:p-6 bg-white border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-xl h-10 w-10 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileMenuOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
              >
                <Menu className="w-6 h-6" />
              </Button>
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all group"
                onClick={() => {
                  setActivePage('cashier');
                  setIsSidebarCollapsed(false);
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-900 rounded-lg md:rounded-xl flex items-center justify-center transition-transform group-active:scale-95">
                  <Store className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <span className="font-medium text-xl md:text-2xl md:font-light tracking-tighter">{storeInfo.name}</span>
              </div>
              <SheetContent side="left" className="w-72 p-0 rounded-r-[2rem] border-none">
                <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                <div className="flex flex-col h-full bg-white">
                  <div 
                    className="p-8 pb-4 flex items-center gap-3 cursor-pointer"
                    onClick={() => {
                      setActivePage('cashier');
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-light tracking-tighter text-zinc-900">{storeInfo.name}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <NavContent />
                  </div>
                  <div className="p-6 border-t border-zinc-50">
                    <div className="flex items-center gap-4 px-2 mb-6 p-3 rounded-2xl bg-zinc-50/50 border border-zinc-100">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-zinc-500" />
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-zinc-900 truncate">{user.displayName || 'User'}</span>
                        <span className="text-[10px] text-zinc-400 truncate uppercase mt-0.5 tracking-wider">{user.email}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-4 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl py-7 text-lg"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-6 h-6" />
                      Keluar
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="flex items-center gap-2">
            {/* User info or other header actions can go here */}
          </div>
        </header>

        <div className={`flex-1 flex flex-col min-h-0 ${activePage === 'cashier' ? '' : 'overflow-y-auto p-4 md:p-6'}`}>
          <div className={`max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0 ${activePage === 'cashier' ? 'p-4 md:p-6' : ''}`}>
            {activePage === 'cashier' && <CashierPage />}
            {activePage === 'transactions' && <TransactionsPage />}
            {activePage === 'activity' && <ActivityPage />}
            {activePage === 'settings' && <SettingsPage />}
          </div>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
