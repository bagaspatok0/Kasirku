import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Menu
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { productsService, transactionsService, categoriesService } from '@/lib/data-service';
import { Product, CartItem, Transaction } from '@/types';
import { toast } from 'sonner';

export default function CashierPage() {
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
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.category.toLowerCase().includes(search.toLowerCase());
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
  const change = paymentMethod === 'cash' ? (Number(cashReceived) || 0) - total : 0;

  const resetOrder = () => {
    setCart([]);
    setCustomerName('');
    setCashReceived('');
    setPaymentMethod('cash');
    setSelectedPendingId(null);
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
      return {
        ...product!,
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

      resetOrder();
      toast.success("Transaksi berhasil!");
    } catch (error) {
      toast.error("Terjadi kesalahan saat memproses transaksi.");
    }
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 h-full">
        {/* Product Selection */}
        <div className="lg:col-span-8 flex flex-col gap-4 md:gap-6 pb-24 lg:pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Cari produk atau kategori..." 
                className="pl-12 py-6 rounded-full bg-white border-zinc-200 outline-none focus:ring-1 focus:ring-zinc-900 shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Low Stock Alerts */}
          {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
            <div className="flex flex-col gap-2">
              {outOfStockProducts.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-3 md:p-4 flex items-center gap-3">
                  <div className="bg-red-500 rounded-full p-1.5 md:p-2 shrink-0">
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest leading-none mb-1">Stok Habis</p>
                    <p className="text-xs md:text-sm text-red-900 font-medium truncate">
                      {outOfStockProducts.map(p => p.name).join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {lowStockProducts.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 md:p-4 flex items-center gap-3">
                  <div className="bg-amber-500 rounded-full p-1.5 md:p-2 shrink-0">
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none mb-1">Stok Rendah (&lt; 5)</p>
                    <p className="text-xs md:text-sm text-amber-900 font-medium truncate">
                      {lowStockProducts.map(p => `${p.name} (${p.quantity})`).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none shrink-0 -mx-4 px-4 md:mx-0 md:px-0">
            <Button 
              variant={selectedCategory === null ? 'default' : 'ghost'} 
              className={`rounded-full px-5 md:px-6 h-8 md:h-9 flex-shrink-0 text-[10px] md:text-xs font-medium ${selectedCategory === null ? 'bg-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
              onClick={() => setSelectedCategory(null)}
            >
              Semua
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.name ? 'default' : 'ghost'} 
                className={`rounded-full px-5 md:px-6 h-8 md:h-9 flex-shrink-0 text-[10px] md:text-xs font-medium border transition-all ${selectedCategory === cat.name ? 'bg-zinc-900 border-zinc-900' : 'text-zinc-500 border-zinc-50 hover:border-zinc-200'}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1 min-h-[400px]">
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-8">
              {filteredProducts.map(product => (
                  <Card 
                    key={product.id} 
                    className="group relative overflow-hidden bg-white border-zinc-100 hover:border-zinc-300 transition-all cursor-pointer rounded-2xl shadow-sm hover:shadow-md pt-0 pb-0 gap-0"
                    onClick={() => addToCart(product)}
                  >
                    <div className="h-28 md:h-36 bg-zinc-50 flex items-center justify-center overflow-hidden w-full shrink-0">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Package className="w-6 h-6 md:w-8 md:h-8 text-zinc-200" />
                          <span className="text-[8px] text-zinc-300 uppercase font-bold">No Image</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="font-normal text-zinc-500 rounded-full text-[8px] px-1.5 h-3.5 leading-none bg-zinc-50/50">{product.category}</Badge>
                      {product.trackInventory !== false && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${product.quantity > 5 ? 'bg-zinc-100 text-zinc-400' : 'bg-red-50 text-red-500'}`}>
                          {product.quantity}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs md:text-sm font-bold text-zinc-900 truncate mb-1">{product.name}</h3>
                    <span className="text-[11px] md:text-xs text-zinc-900 font-extrabold block">Rp {product.price.toLocaleString()}</span>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-zinc-900 text-white p-1.5 rounded-full shadow-lg">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Desktop Sidebar Cart */}
        <div className="hidden lg:block lg:col-span-4 h-full">
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
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[calc(100vw-2rem)] px-4">
        <Sheet>
          <SheetTrigger render={
            <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl h-16 shadow-2xl flex items-center justify-between px-6 transition-all active:scale-95 group" />
          }>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-zinc-900 ring-2 ring-emerald-500/20">
                    {cart.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-none mb-1">Check Out</p>
                <p className="text-lg font-bold leading-none">Rp {total.toLocaleString()}</p>
              </div>
            </div>
            <Plus className="w-6 h-6" />
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2.5rem] border-none shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
            <SheetTitle className="sr-only">Keranjang Belanja</SheetTitle>
            <div className="h-full flex flex-col pt-4">
              <div className="w-12 h-1.5 bg-zinc-100 rounded-full mx-auto mb-2 shrink-0" />
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
                isMobile
              />
            </div>
          </SheetContent>
        </Sheet>
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
    <div className={`bg-white rounded-3xl border border-zinc-100 shadow-sm flex flex-col overflow-hidden h-full ${!isMobile ? 'xl:sticky xl:top-8 max-h-[calc(100vh-160px)]' : ''}`}>
      <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between shrink-0">
        <div className="p-2 md:p-3 bg-zinc-900 rounded-xl shrink-0">
          <ShoppingBag className="w-4 h-4 md:w-5 h-5 text-white" />
        </div>
        <div className="flex gap-1.5 md:gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full h-8 w-8 md:h-10 md:w-10 border-zinc-100 hover:bg-zinc-50" 
            onClick={() => {
              resetOrder();
              toast.info("Draft direset");
            }}
            disabled={cart.length === 0 && !customerName && !selectedPendingId}
          >
            <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
          </Button>
          <Button 
            variant="outline" 
            className="rounded-full h-8 md:h-10 gap-1.5 md:gap-2 border-zinc-200 text-[10px] md:text-xs font-bold px-3 md:px-4"
            onClick={handleSaveBill}
            disabled={cart.length === 0}
          >
            <Save className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Simpan Bill</span>
            <span className="sm:hidden">Simpan</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 scrollbar-none">
        <div className="space-y-4 mb-6">
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Atas Nama</p>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Masukkan nama customer..." 
                className="w-full bg-zinc-50/50 border border-zinc-100 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-300"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>

          {pendingTransactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Bill Tersimpan</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {pendingTransactions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadPendingBill(t)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${
                      selectedPendingId === t.id 
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg scale-105' 
                        : 'bg-white text-zinc-600 border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    {t.customerName || 'No Name'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-300 py-12 text-center">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-5" />
              <p className="text-sm font-medium">Keranjang masih kosong</p>
              <p className="text-[10px] opacity-60">Pilih produk di sebelah kiri</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="group relative bg-white border border-zinc-50 rounded-2xl p-4 mb-3 hover:border-zinc-200 transition-all shadow-sm">
                <div className="flex justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-zinc-900 truncate leading-tight mb-0.5">{item.name}</h4>
                    <p className="text-xs text-zinc-400 font-medium tracking-tight">Rp {item.price.toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-zinc-900">Rp {(item.price * item.cartQuantity).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center bg-zinc-50 rounded-xl p-1 shrink-0">
                    <button 
                      onClick={() => updateCartQuantity(item.id!, -1)}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-100 active:scale-95 transition-all"
                    >
                      <Minus className="w-3.5 h-3.5 text-zinc-600" />
                    </button>
                    <span className="text-xs font-bold w-10 text-center text-zinc-900">{item.cartQuantity}</span>
                    <button 
                      onClick={() => updateCartQuantity(item.id!, 1)}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2 flex-1 min-w-0">
                    <div className="relative flex-1 group/note">
                      <input 
                        type="text" 
                        placeholder="Tambahkan catatan..." 
                        className="w-full bg-zinc-50/50 border border-zinc-100 px-3 py-2 rounded-xl text-[10px] font-medium focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-300"
                        value={item.note || ''}
                        onChange={(e) => {
                          setCart((prev: any) => prev.map((c: any) => 
                            c.id === item.id ? { ...c, note: e.target.value } : c
                          ));
                        }}
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFromCart(item.id!)}
                      className="h-9 w-9 shrink-0 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-6 pt-6 bg-zinc-50 border-t border-zinc-100 space-y-4 shrink-0">
        <div className="space-y-2">
          <div className="flex justify-between text-zinc-400 text-xs font-bold uppercase tracking-widest">
            <span>Subtotal</span>
            <span>Rp {total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-zinc-200/60">
            <span className="text-sm font-bold text-zinc-900">Total Pembayaran</span>
            <span className="text-2xl font-black text-zinc-900 tracking-tighter">Rp {total.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Pilih Metode Pembayaran</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'cash', label: 'Tunai', icon: Banknote },
              { id: 'transfer', label: 'Transfer', icon: CreditCard },
              { id: 'qris', label: 'QRIS', icon: QrCode },
            ].map((method) => (
              <Button 
                key={method.id}
                variant={paymentMethod === method.id ? 'default' : 'outline'} 
                className={`rounded-2xl h-14 flex flex-col items-center justify-center gap-1 transition-all group ${
                  paymentMethod === method.id 
                    ? 'bg-zinc-900 border-zinc-900 shadow-md ring-2 ring-zinc-900/10 scale-105' 
                    : 'bg-white border-zinc-100 hover:border-zinc-300'
                }`}
                onClick={() => setPaymentMethod(method.id as any)}
              >
                <method.icon className={`w-4 h-4 ${paymentMethod === method.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                <span className="text-[10px] font-bold">{method.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {paymentMethod === 'cash' && (
          <div className="space-y-3 pt-3 border-t border-zinc-100 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nominal Uang Tunai</p>
              <div className="flex gap-1.5">
                {[total, nextRoundAmount(total, 50000), 100000].map((amt, idx) => (
                  amt > 0 && amt >= total && (
                    <button 
                      key={idx}
                      className="text-[9px] font-bold bg-white border border-zinc-200 px-2.5 py-1 rounded-lg hover:border-zinc-900 transition-all shadow-sm active:scale-95"
                      onClick={() => setCashReceived(String(amt))}
                    >
                      {amt === total ? 'Uang Pas' : `Rp ${(amt/1000)}k`}
                    </button>
                  )
                ))}
              </div>
            </div>
            <div className="relative">
              <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
              <Input 
                type="number" 
                placeholder="0" 
                className="bg-white h-12 pl-11 pr-4 rounded-2xl border-zinc-100 text-sm font-bold shadow-sm focus:ring-zinc-900"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
            </div>
            {Number(cashReceived) > 0 && (
              <div className="flex justify-between items-center p-3 bg-zinc-900/5 rounded-2xl border border-dashed border-zinc-200">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kembalian</span>
                <span className={`text-lg font-black tracking-tight ${change < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {change < 0 ? '-' : ''} Rp {Math.abs(change).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        <Button 
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl h-16 text-base font-bold transition-all shadow-[0_10px_30px_rgba(0,0,0,0.1)] active:scale-95 group disabled:opacity-50"
          disabled={cart.length === 0 || (paymentMethod === 'cash' && (Number(cashReceived) || 0) < total)}
          onClick={handleCheckout}
        >
          Konfirmasi Transaksi
        </Button>
      </div>
    </div>
  );
}

function nextRoundAmount(total: number, step: number) {
  if (total <= 0) return 0;
  return Math.ceil(total / step) * step;
}
