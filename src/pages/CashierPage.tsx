import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode,
  Package,
  X,
  AlertCircle,
  Save,
  RotateCcw,
  User,
  History,
  ShoppingBag,
  Menu,
  CheckCircle2,
  Printer,
  MessageSquare
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { productsService, transactionsService, categoriesService, cashiersService } from '@/lib/data-service';
import { Product, CartItem, Transaction, CashierAccount } from '@/types';
import { toast } from 'sonner';
import { getStoreInfo } from '@/lib/utils';

export default function CashierPage() {
  const storeInfo = getStoreInfo();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id?: string, name: string}[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    const savedLayout = localStorage.getItem('cashier_layout') as 'list' | 'grid';
    if (savedLayout) setLayout(savedLayout);
  }, []);

  useEffect(() => {
    const unsubscribe = productsService.subscribe(setProducts);
    const unsubCats = categoriesService.subscribe(setCategories);
    const unsubPending = transactionsService.subscribePending(setPendingTransactions);
    return () => {
      unsubscribe();
      unsubCats();
      unsubPending();
    };
  }, []);

  const filteredProducts = products.filter(p => {
    const pName = p.name || '';
    const pCat = p.category || '';
    const matchesSearch = pName.toLowerCase().includes(search.toLowerCase()) || 
                         pCat.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => (p.trackInventory !== false) && p.quantity < 5 && p.quantity > 0);
  const outOfStockProducts = products.filter(p => (p.trackInventory !== false) && p.quantity <= 0);

  const addToCart = (product: Product) => {
    if (product.trackInventory !== false && product.quantity <= 0) {
      toast.error("Stok habis!");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (product.trackInventory !== false && existing.cartQuantity + 1 > product.quantity) {
          toast.error("Stok tidak mencukupi!");
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.cartQuantity + delta;
        if (newQty <= 0) return item;
        if (item.trackInventory !== false && newQty > (item.quantity || 0)) {
          toast.error("Stok tidak mencukupi!");
          return item;
        }
        return { ...item, cartQuantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
  const change = paymentMethod === 'cash' ? (Number(cashReceived) > 0 ? Number(cashReceived) - total : 0) : 0;

  const resetOrder = () => {
    setCart([]);
    setCustomerName('');
    setCashReceived('');
    setPaymentMethod('cash');
    setSelectedPendingId(null);
  };

  const formatPhoneNumber = (num: string) => {
    let cleaned = num.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    if (cleaned.startsWith('8') && cleaned.length >= 9) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  };

  const getWhatsAppReceiptText = (trans: Transaction) => {
    const divider = "\n----------------------------------\n";
    let text = `*${storeInfo.name.toUpperCase()}*\n`;
    if (storeInfo.address) {
      text += `${storeInfo.address}\n`;
    }
    if (storeInfo.phone) {
      text += `Telp: ${storeInfo.phone}\n`;
    }
    text += `\n`;
    
    const shortId = trans.id ? (trans.id.length > 8 ? trans.id.slice(-6).toUpperCase() : trans.id) : 'BARU';
    
    let dateStr = '';
    if (trans.createdAt) {
      if (typeof trans.createdAt.toDate === 'function') {
        dateStr = trans.createdAt.toDate().toLocaleString('id-ID');
      } else if (trans.createdAt.seconds) {
        dateStr = new Date(trans.createdAt.seconds * 1000).toLocaleString('id-ID');
      } else {
        dateStr = new Date(trans.createdAt).toLocaleString('id-ID');
      }
    } else {
      dateStr = new Date().toLocaleString('id-ID');
    }

    text += `*No Bukti:* #${shortId}\n`;
    text += `*Tanggal:* ${dateStr}\n`;
    text += `*Kasir:* ${trans.cashierName || 'Admin'}\n`;
    if (trans.customerName) {
      text += `*Pelanggan:* ${trans.customerName}\n`;
    }
    text += divider;
    
    trans.items.forEach((item) => {
      text += `*${item.name}*\n`;
      text += `  ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')} -> Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`;
    });
    
    text += divider;
    text += `*TOTAL: Rp ${trans.totalAmount.toLocaleString('id-ID')}*\n`;
    text += `*Metode Bayar:* ${trans.paymentMethod.toUpperCase()}\n`;
    
    if (trans.paymentMethod === 'cash') {
      text += `*Diterima:* Rp ${(trans.cashReceived || 0).toLocaleString('id-ID')}\n`;
      text += `*Kembalian:* Rp ${(trans.change || 0).toLocaleString('id-ID')}\n`;
    }
    
    text += divider;
    text += `*TERIMA KASIH*\n`;
    if (storeInfo.footer) {
      text += `${storeInfo.footer}\n`;
    }
    if (storeInfo.mapsLink) {
      text += `📍 *Maps:* ${storeInfo.mapsLink}\n`;
    }
    if (storeInfo.wifiName) {
      text += `📶 *WiFi:* ${storeInfo.wifiName}${storeInfo.wifiPassword ? ` (Pwd: ${storeInfo.wifiPassword})` : ''}\n`;
    }
    
    return encodeURIComponent(text);
  };

  const handleSendWhatsAppReceipt = () => {
    if (!lastTransaction) return;
    const formattedPhone = formatPhoneNumber(whatsappNumber);
    if (!formattedPhone || formattedPhone.length < 9) {
      toast.error("Nomor WhatsApp tidak valid. Masukkan minimal 9 angka.");
      return;
    }
    const text = getWhatsAppReceiptText(lastTransaction);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${text}`;
    window.open(url, '_blank');
  };

  const handleSaveBill = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    try {
      const transactionItems = cart.map(item => ({
        productId: item.id!,
        name: item.name,
        price: item.price,
        quantity: item.cartQuantity,
        note: item.note || ''
      }));

      const transactionData = {
        items: transactionItems,
        totalAmount: total,
        paymentMethod,
        customerName: customerName.trim(),
        status: 'pending' as const,
      };

      if (selectedPendingId) {
        await transactionsService.update(selectedPendingId, transactionData);
        toast.success("Bill diperbarui");
      } else {
        await transactionsService.add(transactionData);
        toast.success("Bill disimpan");
      }
      resetOrder();
    } catch (error) {
      toast.error("Gagal menyimpan bill");
    }
  };

  const loadPendingBill = (t: Transaction) => {
    const newCart = t.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return {
          id: item.productId,
          name: item.name + ' (Terhapus)',
          price: item.price,
          cartQuantity: item.quantity,
          category: 'Uncategorized',
          trackInventory: false,
          quantity: 0
        } as CartItem;
      }
      return {
        ...product,
        id: item.productId,
        name: item.name,
        price: item.price,
        cartQuantity: item.quantity,
        note: item.note
      } as CartItem;
    });
    setCart(newCart);
    setCustomerName(t.customerName || '');
    setSelectedPendingId(t.id!);
    toast.info(`Memuat bill: ${t.customerName || 'No Name'}`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash' && (Number(cashReceived) || 0) < total) {
      toast.error("Uang yang diterima kurang!");
      return;
    }

    const cashierNameVal = localStorage.getItem('active_cashier_name') || 'Admin';

    try {
      const items = cart.map(item => ({
        productId: item.id!,
        name: item.name,
        price: item.price,
        quantity: item.cartQuantity,
        note: item.note || ''
      }));

      const finalData = {
        items,
        totalAmount: total,
        paymentMethod,
        customerName: customerName.trim(),
        cashierName: cashierNameVal,
        cashReceived: paymentMethod === 'cash' ? (Number(cashReceived) || total) : null,
        change: paymentMethod === 'cash' ? (Number(cashReceived) - total || 0) : null,
        status: 'completed' as const,
      };

      if (selectedPendingId) {
        await transactionsService.update(selectedPendingId, finalData);
      } else {
        await transactionsService.add(finalData);
      }

      // Update stock
      for (const item of cart) {
        if (item.trackInventory !== false) {
          await productsService.updateStock(item.id!, -item.cartQuantity);
        }
      }

      // Automatically trigger WhatsApp redirect if WhatsApp number is configured
      const formattedPhone = formatPhoneNumber(whatsappNumber);
      if (formattedPhone && formattedPhone.length >= 9) {
        const text = getWhatsAppReceiptText(finalData as unknown as Transaction);
        const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${text}`;
        window.open(url, '_blank');
        toast.success("Membuka WhatsApp untuk mengirim struk...");
      }

      resetOrder();
      setLastTransaction(finalData as unknown as Transaction);
      setShowSuccessDialog(true);
      toast.success("Transaksi berhasil!");
    } catch (error) {
      toast.error("Terjadi kesalahan saat memproses transaksi.");
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 overflow-hidden bg-zinc-50/30 p-0 relative">
      {/* Segmented Control for Mobile */}
      <div className="flex md:hidden p-1 bg-zinc-100/80 backdrop-blur-md rounded-2xl gap-1 shrink-0 mx-4 mt-4 border border-zinc-200/50">
        <button 
          onClick={() => setMobileTab('products')} 
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-tight rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'products' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Produk ({filteredProducts.length})</span>
        </button>
        <button 
          onClick={() => setMobileTab('cart')} 
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-tight rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
            mobileTab === 'cart' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Pesanan ({cart.reduce((sum, item) => sum + item.cartQuantity, 0)})</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce-short">
              {cart.reduce((sum, item) => sum + item.cartQuantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Product Selection */}
      <div className={`${mobileTab === 'products' ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0 p-4 md:p-0`}>
        <div className="flex flex-col gap-4 mb-6 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Cari produk di sini..." 
              className="pl-10 h-11 rounded-2xl bg-white border-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm text-sm transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0 w-full">
            <Button 
              variant={selectedCategory === null ? 'default' : 'ghost'} 
              className={`rounded-xl px-5 h-9 md:h-10 flex-shrink-0 text-[11px] font-bold uppercase tracking-tight transition-all ${selectedCategory === null ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100'}`}
              onClick={() => setSelectedCategory(null)}
            >
              Semua
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.name ? 'default' : 'ghost'} 
                className={`rounded-xl px-5 h-9 md:h-10 flex-shrink-0 text-[11px] font-bold uppercase tracking-tight border transition-all ${selectedCategory === cat.name ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' : 'text-zinc-500 border-zinc-100 hover:border-zinc-200'}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            {layout === 'list' ? (
              <div className="flex flex-col gap-1 pb-12 pr-4">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="group bg-white border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all cursor-pointer rounded-xl p-2 shadow-sm hover:shadow-md flex items-center gap-3"
                    onClick={() => addToCart(product)}
                  >
                    <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <Package className="w-5 h-5 text-zinc-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-zinc-900 truncate tracking-tight">{product.name}</h3>
                          <Badge variant="secondary" className="bg-zinc-50 text-zinc-400 text-[8px] font-bold px-1 py-0 border-none shrink-0">{product.category}</Badge>
                        </div>
                        <div className="flex flex-col mt-0.5">
                          {product.trackInventory !== false && (
                            <span className={`text-[9px] font-bold ${product.quantity > 5 ? 'text-zinc-400' : 'text-rose-500'}`}>
                              Stok: {product.quantity}
                            </span>
                          )}
                          <span className="text-[11px] font-black text-zinc-900">Rp {product.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 px-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-50 group-hover:bg-zinc-900 flex items-center justify-center transition-all">
                          <Plus className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-12 pr-4">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="group bg-white border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all cursor-pointer rounded-2xl overflow-hidden shadow-sm hover:shadow-md flex flex-col"
                    onClick={() => addToCart(product)}
                  >
                    <div className="aspect-square bg-zinc-100 relative overflow-hidden">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-zinc-200" />
                        </div>
                      )}
                      
                      {/* Add Button Overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center shadow-lg">
                          <Plus className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <div className="flex flex-col min-w-0">
                         <h3 className="text-xs font-bold text-zinc-900 truncate tracking-tight">{product.name}</h3>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">{product.category}</span>
                      </div>
                      
                      <div className="mt-auto space-y-1">
                        {product.trackInventory !== false && (
                          <div>
                            <Badge 
                              variant="secondary" 
                              className={`text-[8px] font-bold px-1.5 py-0 border-none ${
                                product.quantity > 5 ? 'bg-zinc-50 text-zinc-400' : 'bg-rose-50 text-rose-500'
                              }`}
                            >
                              Stok: {product.quantity}
                            </Badge>
                          </div>
                        )}
                        <span className="text-[11px] font-black text-zinc-900 block">Rp {product.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 opacity-20">
                <Package className="w-16 h-16 mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Produk tidak ditemukan</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Floating Cart Active Indicator on Mobile */}
      {mobileTab === 'products' && cart.length > 0 && (
        <div 
          className="md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 cursor-pointer animate-in fade-in slide-in-from-bottom-6 duration-300 border border-zinc-800"
          onClick={() => setMobileTab('cart')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl relative">
              <ShoppingCart className="w-4 h-4 text-white animate-bounce-short" />
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-sm">
                {cart.reduce((sum, item) => sum + item.cartQuantity, 0)}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Total Belanja</p>
              <p className="text-sm font-black">Rp {total.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 px-3 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
            <span>Lihat Keranjang</span>
            <span>➔</span>
          </div>
        </div>
      )}

      {/* Sidebar Cart */}
      <aside className={`${mobileTab === 'cart' ? 'flex flex-1 min-h-0' : 'hidden md:flex'} w-full md:w-[360px] lg:w-[400px] flex-col shrink-0 md:shrink-0 bg-white md:bg-transparent border-l md:border-none border-zinc-100`}>
        <CartSection 
          cart={cart}
          customerName={customerName}
          setCustomerName={setCustomerName}
          pendingTransactions={pendingTransactions}
          selectedPendingId={selectedPendingId}
          loadPendingBill={loadPendingBill}
          resetOrder={resetOrder}
          handleSaveBill={handleSaveBill}
          updateCartQuantity={updateCartQuantity}
          removeFromCart={removeFromCart}
          total={total}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          change={change}
          handleCheckout={handleCheckout}
          setCart={setCart}
        />
      </aside>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-xs rounded-3xl p-6 overflow-hidden">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900">Pembayaran Berhasil</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Transaksi telah disimpan</p>
            </div>

            <div className="w-full border-t border-zinc-100 pt-3 space-y-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Kirim Struk WA</label>
              <div className="flex gap-1.5">
                <Input 
                  type="text" 
                  placeholder="Contoh: 0812345678"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="rounded-xl text-xs h-10 px-3 flex-1 border-zinc-200"
                />
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl h-10 w-10 shrink-0 p-0 flex items-center justify-center transition-all"
                  onClick={handleSendWhatsAppReceipt}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[9px] text-zinc-400 leading-tight">Membuka browser ke WhatsApp Web / Aplikasi WA</p>
            </div>
            
            <div className="w-full space-y-2 border-t border-zinc-100 pt-3">
              <Button 
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl h-10 text-xs font-black uppercase tracking-widest"
                onClick={() => {
                  setShowSuccessDialog(false);
                  setWhatsappNumber('');
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Hidden Receipt for Printing */}
      <div className="print-only fixed inset-0 z-[9999] bg-white p-4 text-black text-[12px] font-mono leading-tight">
        {lastTransaction && (
          <div className="max-w-[300px] mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold uppercase">{storeInfo.name}</h2>
              {storeInfo.address && <p className="text-[10px]">{storeInfo.address}</p>}
              {storeInfo.phone && <p className="text-[10px]">Telp: {storeInfo.phone}</p>}
            </div>

            <div className="border-b border-dashed border-black pb-2 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>No Bukti:</span>
                <span>#{lastTransaction.id?.slice(-6).toUpperCase() || 'NEW'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{new Date().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{lastTransaction.cashierName || 'Admin'}</span>
              </div>
              {lastTransaction.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{lastTransaction.customerName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 py-2 border-b border-dashed border-black">
              {lastTransaction.items.map((item, idx) => (
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
                <span>Rp {lastTransaction.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>PEMBAYARAN</span>
                <span className="uppercase">{lastTransaction.paymentMethod}</span>
              </div>
              {lastTransaction.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>DITERIMA</span>
                    <span>Rp {(lastTransaction.cashReceived || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>KEMBALIAN</span>
                    <span>Rp {(lastTransaction.change || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-6 space-y-1 opacity-80 border-t border-dashed border-black mt-4">
              <p className="text-[10px] font-bold">TERIMA KASIH</p>
              {storeInfo.footer && <p className="text-[9px]">{storeInfo.footer}</p>}
              {(storeInfo.wifiName || storeInfo.mapsLink) && (
                <div className="pt-2 border-t border-dotted border-black mt-2 text-[8px] space-y-0.5 text-left">
                  {storeInfo.wifiName && (
                    <p className="whitespace-nowrap overflow-hidden text-ellipsis">
                      📶 WiFi: {storeInfo.wifiName} {storeInfo.wifiPassword ? `(Pwd: ${storeInfo.wifiPassword})` : ''}
                    </p>
                  )}
                  {storeInfo.mapsLink && (
                    <p className="whitespace-nowrap overflow-hidden text-ellipsis">
                      📍 Maps: {storeInfo.mapsLink}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CartSectionProps {
  cart: CartItem[];
  customerName: string;
  setCustomerName: (name: string) => void;
  pendingTransactions: Transaction[];
  selectedPendingId: string | null;
  loadPendingBill: (t: Transaction) => void;
  resetOrder: () => void;
  handleSaveBill: () => void;
  updateCartQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'qris';
  setPaymentMethod: (method: 'cash' | 'transfer' | 'qris') => void;
  cashReceived: string;
  setCashReceived: (val: string) => void;
  change: number;
  handleCheckout: () => void;
  setCart: (val: any) => void;
  isMobile?: boolean;
}

function CartSection({
  cart,
  customerName,
  setCustomerName,
  pendingTransactions,
  selectedPendingId,
  loadPendingBill,
  resetOrder,
  handleSaveBill,
  updateCartQuantity,
  removeFromCart,
  total,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  change,
  handleCheckout,
  setCart,
  isMobile = false
}: CartSectionProps) {
  return (
    <div className={`bg-white rounded-3xl border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden h-full ${!isMobile ? 'flex-1' : ''}`}>
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 rounded-xl shrink-0 shadow-lg shadow-zinc-200">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-tight text-zinc-900">Pesanan</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="outline" 
            className="rounded-xl h-9 gap-2 border-zinc-200 text-xs font-bold px-4 hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95"
            onClick={handleSaveBill}
            disabled={cart.length === 0}
          >
            <Save className="w-4 h-4" />
            <span>Simpan Bill</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pt-6 pb-4 space-y-4">
            <div className="pb-2 border-b border-zinc-50">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nama Customer</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <input 
                    type="text" 
                    placeholder="Nama customer..." 
                    className="w-full bg-zinc-50/50 border border-zinc-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-300"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {pendingTransactions.length > 0 && (
              <div className="space-y-2 pb-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Simpanan Bill</p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {pendingTransactions.map(t => (
                    <button
                      key={t.id}
                      onClick={() => loadPendingBill(t)}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap shadow-sm ${
                        selectedPendingId === t.id 
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' 
                          : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300'
                      }`}
                    >
                      {t.customerName || 'No Name'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 pb-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-zinc-300 py-12 text-center opacity-40">
                  <div className="p-4 bg-zinc-50 rounded-full mb-3">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Belum ada item</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="group bg-white border border-zinc-100 rounded-2xl p-3 hover:border-zinc-300 transition-all shadow-sm">
                    <div className="flex justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[11px] font-black text-zinc-900 truncate leading-tight mb-0.5">{item.name}</h4>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">Rp {item.price.toLocaleString()}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-black text-zinc-900">Rp {(item.price * item.cartQuantity).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center bg-zinc-50/50 rounded-xl p-0.5 shrink-0 border border-zinc-50">
                        <button 
                          onClick={() => updateCartQuantity(item.id!, -1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-100 hover:text-rose-500 active:scale-90 transition-all outline-none border border-zinc-100"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-black w-6 text-center text-zinc-900">{item.cartQuantity}</span>
                        <button 
                          onClick={() => updateCartQuantity(item.id!, 1)}
                          className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-100 hover:text-emerald-500 active:scale-90 transition-all text-zinc-900 outline-none border border-zinc-100"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <div className="flex flex-1 items-center gap-1.5">
                          <input 
                            type="text" 
                            placeholder="Catatan..." 
                            className="w-full bg-zinc-50/30 border border-zinc-100 px-2 py-1.5 rounded-lg text-[9px] font-bold focus:ring-1 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-300"
                            value={item.note || ''}
                            onChange={(e) => {
                              setCart((prev: any) => prev.map((c: any) => 
                                c.id === item.id ? { ...c, note: e.target.value } : c
                              ));
                            }}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeFromCart(item.id!)}
                            className="h-7 w-7 shrink-0 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 md:p-6 bg-white border-t border-zinc-100 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] shrink-0 relative z-10 overflow-y-auto max-h-[40%] scrollbar-none">
        <div className="space-y-4 md:space-y-5">
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex justify-between text-zinc-400 text-[9px] font-black uppercase tracking-widest px-1">
              <span>Subtotal</span>
              <span>Rp {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 md:py-2 border-t border-zinc-100 px-1">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-tight">Total</span>
              <span className="text-lg md:text-xl font-black text-zinc-100 bg-zinc-900 rounded-lg px-3 py-1 tracking-tighter">Rp {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2 md:space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tight px-1">Metode</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Tunai', icon: Banknote },
                { id: 'transfer', label: 'Transfer', icon: CreditCard },
                { id: 'qris', label: 'QRIS', icon: QrCode },
              ].map((method) => (
                <Button 
                  key={method.id}
                  variant={paymentMethod === method.id ? 'default' : 'outline'} 
                  className={`rounded-xl h-10 md:h-12 flex flex-col items-center justify-center gap-0.5 transition-all group border-2 ${
                    paymentMethod === method.id 
                      ? 'bg-zinc-900 border-zinc-900 shadow-md shadow-zinc-200' 
                      : 'bg-white border-zinc-100 hover:border-zinc-300'
                  }`}
                  onClick={() => setPaymentMethod(method.id as any)}
                >
                  <method.icon className={`w-3.5 h-3.5 md:w-4 ${paymentMethod === method.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-3 md:space-y-4 pt-3 border-t border-zinc-100 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tight">Uang Pas</p>
                <div className="flex gap-1">
                  {[total, 50000, 100000].map((amt, idx) => (
                    amt > 0 && amt >= total && (
                      <button 
                        key={idx}
                        className="text-[9px] font-black bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-lg hover:border-zinc-900 hover:bg-white transition-all shadow-sm active:scale-95"
                        onClick={() => setCashReceived(String(amt))}
                      >
                        {amt === total ? 'Pas' : `Rp ${(amt/1000)}k`}
                      </button>
                    )
                  ))}
                </div>
              </div>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input 
                  type="number" 
                  placeholder="Jumlah bayar..." 
                  className="bg-zinc-50/50 h-10 pl-10 pr-4 rounded-xl border-zinc-100 text-xs font-black shadow-sm focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
              {Number(cashReceived) > total && (
                <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in zoom-in-95 duration-300">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">Kembalian</span>
                  <span className="text-base font-black tracking-tighter text-emerald-600">
                    Rp {Math.abs(change).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button 
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl md:rounded-2xl h-12 md:h-14 text-xs md:text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-zinc-200 active:scale-95 hover:shadow-2xl disabled:opacity-50 disabled:shadow-none"
            disabled={cart.length === 0 || (paymentMethod === 'cash' && (Number(cashReceived) || 0) < total)}
            onClick={handleCheckout}
          >
            Selesaikan Bayar
          </Button>
        </div>
      </div>
    </div>
  );
}

function nextRoundAmount(total: number, step: number) {
  if (total <= 0) return 0;
  return Math.ceil(total / step) * step;
}
