import { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit,
  Package,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { productsService, categoriesService } from '@/lib/data-service';
import { Product, Category } from '@/types';
import { toast } from 'sonner';

interface ProductsPageProps {
  hideHeader?: boolean;
}

export default function ProductsPage({ hideHeader = false }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  // Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    category: '',
    quantity: 0,
    trackInventory: true,
    image: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const unsubProducts = productsService.subscribe(setProducts);
    const unsubCategories = categoriesService.subscribe(setCategories);
    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.category || newProduct.price < 0) {
      toast.error("Mohon isi semua data dengan benar");
      return;
    }

    try {
      if (editingProduct) {
        await productsService.update(editingProduct.id!, newProduct);
        toast.success("Produk diperbarui");
      } else {
        await productsService.add(newProduct);
        toast.success("Produk ditambahkan");
      }
      setIsProductDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Gagal menyimpan produk");
    }
  };

  const resetForm = () => {
    setNewProduct({ name: '', price: 0, category: '', quantity: 0, trackInventory: true, image: '' });
    setEditingProduct(null);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: product.quantity,
      trackInventory: product.trackInventory !== undefined ? product.trackInventory : true,
      image: product.image || ''
    });
    setIsProductDialogOpen(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    try {
      await categoriesService.add(newCategoryName);
      setNewCategoryName('');
      toast.success("Kategori berhasil ditambahkan");
    } catch (error) {
      toast.error("Gagal menambahkan kategori");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await productsService.delete(id);
      toast.success("Produk dihapus");
    } catch (error) {
      toast.error("Gagal menghapus produk");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-zinc-900 text-center md:text-left">Produk</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger render={
                <Button variant="outline" className="w-full sm:w-auto rounded-full gap-2 border-zinc-200 py-6">
                  <Layers className="w-4 h-4 text-zinc-500" />
                  Kelola Kategori
                </Button>
              } />
              <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-none bg-white shadow-2xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-light">Kategori Produk</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Nama kategori baru..." 
                      className="rounded-xl border-zinc-200 py-6"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <Button className="rounded-xl bg-zinc-900 h-auto" onClick={handleAddCategory}>Tambah</Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                        <span className="font-medium text-sm">{cat.name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-zinc-300 hover:text-red-500 h-8 w-8"
                          onClick={() => {
                            categoriesService.delete(cat.id!);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {categories.length === 0 && <p className="text-center text-zinc-400 py-4 italic text-sm">Belum ada kategori</p>}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
              setIsProductDialogOpen(open);
              if(!open) resetForm();
            }}>
              <DialogTrigger render={
                <Button className="w-full sm:w-auto rounded-full gap-2 bg-zinc-900 hover:bg-zinc-800 transition-all shadow-md px-8 py-6">
                  <Plus className="w-4 h-4" />
                  Tambah Produk
                </Button>
              } />
              <DialogContent className="max-w-[95vw] md:max-w-xl rounded-3xl border-none p-0 overflow-hidden bg-white shadow-2xl">
                <div className="p-6 md:p-8 max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl md:text-3xl font-light mb-6">
                      {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] md:text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Nama Produk</label>
                      <Input 
                        placeholder="Contoh: Kopi Susu Gula Aren" 
                        className="rounded-xl py-6 border-zinc-200"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Kategori</label>
                      <select 
                        className="w-full h-[50px] bg-white border border-zinc-200 rounded-xl px-3 text-sm focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m19%209-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_1rem_center] bg-no-repeat"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] md:text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Harga (Rp)</label>
                       <Input 
                        type="number" 
                        placeholder="0" 
                        className="rounded-xl py-6 border-zinc-200"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-1 bg-zinc-100 rounded-xl h-[50px] px-4 mt-5">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Kelola Stok?</span>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-zinc-900 rounded-lg"
                          checked={newProduct.trackInventory}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, trackInventory: e.target.checked }))}
                        />
                      </div>
                      {newProduct.trackInventory && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                           <label className="text-[10px] md:text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Stok Awal</label>
                           <Input 
                            type="number" 
                            placeholder="0" 
                            className="rounded-xl py-6 border-zinc-200"
                            value={newProduct.quantity}
                            onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                       <label className="text-[10px] md:text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Gambar Produk</label>
                       <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-zinc-100 rounded-2xl bg-zinc-50/50">
                          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-100 shadow-sm shrink-0">
                            {newProduct.image ? (
                              <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-zinc-200" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col gap-2 w-full">
                            <div className="flex gap-2">
                              <Input 
                                type="file" 
                                accept="image/*"
                                className="hidden" 
                                id="product-image-upload"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 500000) {
                                      toast.error("Ukuran file terlalu besar (maks 500KB)");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setNewProduct(prev => ({ ...prev, image: reader.result as string }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <label 
                                htmlFor="product-image-upload"
                                className="flex-1 cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white text-center text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Pilih Foto
                              </label>
                              {newProduct.image && (
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="rounded-xl h-[42px] w-[42px] text-red-500 border-red-100 hover:bg-red-50"
                                  onClick={() => setNewProduct(prev => ({ ...prev, image: '' }))}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Format: JPG, PNG. Maksimal 500KB. Gambar akan disimpan secara otomatis.</p>
                          </div>
                       </div>
                    </div>
                  </div>
                  <div className="mt-8">
                    <Button onClick={handleSaveProduct} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-full py-6 transition-all shadow-lg font-bold">
                      {editingProduct ? 'Update Produk' : 'Simpan Produk'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-end gap-2 mb-4">
           <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm" className="rounded-full gap-2 border-zinc-200 text-[10px] py-5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Kategori
              </Button>
            } />
            <DialogContent className="max-w-[95vw] rounded-3xl border-none bg-white shadow-2xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-light">Kategori</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nama..." 
                    className="rounded-xl border-zinc-200 py-5 text-sm"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button className="rounded-xl bg-zinc-900 text-xs px-4" onClick={handleAddCategory}>Tambah</Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto font-medium text-xs">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl">
                      <span>{cat.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-300" onClick={() => categoriesService.delete(cat.id!)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
            setIsProductDialogOpen(open);
            if(!open) resetForm();
          }}>
            <DialogTrigger render={
              <Button size="sm" className="rounded-full gap-1.5 bg-zinc-900 hover:bg-zinc-800 transition-all shadow-md px-4 py-5 text-[10px] uppercase font-bold tracking-wider">
                <Plus className="w-3.5 h-3.5" />
                Produk Baru
              </Button>
            } />
            <DialogContent className="max-w-[95vw] rounded-3xl border-none p-0 overflow-hidden bg-white shadow-2xl">
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-light mb-4">Produk</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                   <Input placeholder="Nama Produk" className="rounded-xl py-6 border-zinc-200" value={newProduct.name} onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))} />
                   <select 
                      className="w-full h-12 bg-white border border-zinc-200 rounded-xl px-3 text-sm focus:outline-none appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m19%209-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_1rem_center] bg-no-repeat"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <div className="space-y-4">
                      <Input type="number" placeholder="Harga" className="rounded-xl py-6 border-zinc-200" value={newProduct.price} onChange={(e) => setNewProduct(prev => ({ ...prev, price: Number(e.target.value) }))} />
                      
                      <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Kelola Stok?</span>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-zinc-900 rounded-lg"
                          checked={newProduct.trackInventory}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, trackInventory: e.target.checked }))}
                        />
                      </div>
                      
                      {newProduct.trackInventory && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <Input type="number" placeholder="Stok Awal" className="rounded-xl py-6 border-zinc-200" value={newProduct.quantity} onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: Number(e.target.value) }))} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Foto Produk</label>
                      <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-zinc-100 shrink-0">
                          {newProduct.image ? (
                            <img src={newProduct.image} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-zinc-200" />
                          )}
                        </div>
                        <div className="flex-1">
                          <Input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            id="mobile-image-upload"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 500000) {
                                  toast.error("Ukuran file terlalu besar (maks 500KB)");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => setNewProduct(prev => ({ ...prev, image: reader.result as string }));
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label 
                            htmlFor="mobile-image-upload"
                            className="block text-center bg-zinc-900 text-white text-[10px] font-bold py-2.5 px-3 rounded-lg"
                          >
                            {newProduct.image ? 'Ganti Foto' : 'Pilih Foto'}
                          </label>
                        </div>
                        {newProduct.image && (
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setNewProduct(prev => ({ ...prev, image: '' }))}>
                             <Trash2 className="w-4 h-4" />
                           </Button>
                        )}
                      </div>
                    </div>
                </div>
                <div className="mt-6">
                  <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-6 font-bold" onClick={handleSaveProduct}>
                    {editingProduct ? 'Update' : 'Simpan'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="bg-white rounded-[2rem] md:rounded-3xl border border-zinc-100 shadow-sm overflow-hidden p-4 md:p-6 lg:p-8">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Cari produk atau kategori..." 
            className="pl-12 py-7 rounded-2xl bg-zinc-50 border-none outline-none focus:ring-1 focus:ring-zinc-200 transition-all font-medium shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl border border-zinc-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead className="w-[100px] py-5 px-6">Foto</TableHead>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead className="text-right px-6">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-zinc-50/50 transition-colors border-b border-zinc-50 last:border-none">
                  <TableCell className="px-6 py-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center overflow-hidden shadow-sm">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-zinc-300" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-zinc-900">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-widest rounded-full border-zinc-100 text-zinc-500 px-3 h-6">
                      {product.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-zinc-900 tracking-tight">Rp {product.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {product.trackInventory !== false ? (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${product.quantity > 5 ? 'text-zinc-600 bg-zinc-100' : 'text-red-600 bg-red-50'}`}>
                        {product.quantity} unit
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest italic">Unlimited</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-1">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl h-10 w-10 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(product);
                        }}
                       >
                          <Edit className="w-5 h-5" />
                       </Button>
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl h-10 w-10 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(product.id!);
                        }}
                       >
                          <Trash2 className="w-5 h-5" />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <Package className="w-20 h-20 mb-4" />
                      <p className="text-xl font-medium tracking-tight">Tidak ada produk ditemukan</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Grid */}
        <div className="md:hidden space-y-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white border border-zinc-100 rounded-3xl shadow-sm flex items-center gap-0 overflow-hidden group">
              <div className="w-24 h-24 bg-zinc-50 flex items-center justify-center overflow-hidden shrink-0 border-r border-zinc-50">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-200" />
                )}
              </div>
              <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-zinc-900 truncate text-sm">{product.name}</h4>
                    <p className="text-xs font-black text-zinc-900 shrink-0">Rp {product.price.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                     <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold uppercase border-zinc-100 text-zinc-400">{product.category}</Badge>
                     {product.trackInventory !== false ? (
                       <span className={`text-[8px] font-bold uppercase rounded-full px-1.5 h-4 flex items-center ${product.quantity > 5 ? 'text-zinc-400 bg-zinc-50' : 'text-red-400 bg-red-50'}`}>
                         {product.quantity} STOK
                       </span>
                     ) : (
                       <span className="text-[8px] font-bold text-zinc-200 uppercase tracking-widest italic">UNLIMITED</span>
                     )}
                  </div>
              </div>
              <div className="flex flex-col border-l border-zinc-50">
                 <Button variant="ghost" size="icon" className="h-12 w-12 rounded-none text-zinc-300 hover:text-zinc-600 active:bg-zinc-50" onClick={() => handleEditClick(product)}>
                   <Edit className="w-4 h-4" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-12 w-12 rounded-none text-zinc-300 hover:text-red-400 active:bg-red-50" onClick={() => handleDeleteProduct(product.id!)}>
                   <Trash2 className="w-4 h-4" />
                 </Button>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
             <div className="py-20 text-center opacity-20">
                <Package className="w-12 h-12 mx-auto mb-4" />
                <p className="text-sm font-medium">Tidak ada produk ditemukan</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
