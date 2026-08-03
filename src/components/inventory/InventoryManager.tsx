import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  Settings,
  Pencil,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,

} from 'lucide-react';

import Modal from '../common/Modal';
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductInput,
} from '../../service/api';
import {
  getCategories,
  addCategory,
  editCategory,
  deleteCategory,
  getCategoryColors,
  type CategoryEntry,
} from '../../utils/storage';

import { formatCurrency } from '../../utils/analytics';
import { getAllUsedColors, loadColorCache } from '../../utils/categoryColors';
import { MAX_STOCK } from '../../utils/limits';

type ProductFormState = {
  name: string;
  category: string;
  modalPrice: string;
  sellPrice: string;
  stock: string;
  minStock: string;
  unit: string;
  isAvailable: boolean;
};

type SortField = 'name' | 'category' | 'stock' | 'sellPrice' | 'modalPrice';
type SortDir = 'asc' | 'desc';

/** Hanya izinkan bilangan bulat 0..MAX_STOCK saat mengetik di kolom stok. */
const clampStock = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits === '') return '';
  return String(Math.min(Number(digits), MAX_STOCK));
};

const formatRupiah = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
};

const parseRupiah = (value: string): number => {
  return Number(value.replace(/\./g, '')) || 0;
};

const emptyForm: ProductFormState = {
  name: '',
  category: '',
  modalPrice: '',
  sellPrice: '',
  stock: '',
  minStock: '',
  unit: 'Pcs',
  isAvailable: true,
};

const InventoryManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [categoryEntries, setCategoryEntries] = useState<CategoryEntry[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#14B8A6');
  const [newCategoryError, setNewCategoryError] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#14B8A6');
  const [editingCategoryError, setEditingCategoryError] = useState('');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormState>(emptyForm);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    return 'Terjadi kesalahan';
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
      setDynamicCategories(await getCategories());
      const entries = await getCategoryColors();
      setCategoryEntries(entries);
      await loadColorCache();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products]
  );

  const getStockStatus = (product: Product) => {
    if (product.isAvailable === false) return { text: 'Tidak Tersedia', color: 'bg-gray-100 text-gray-500 border border-gray-200' };
    if (product.stock === 0) return { text: 'Habis', color: 'bg-red-100 text-red-700 border border-red-200' };
    if (product.stock <= product.minStock) return { text: 'Rendah', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
    return { text: 'Tersedia', color: 'bg-green-100 text-green-700 border border-green-200' };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const filteredProducts = useMemo(() => {
    let list = products.filter((product) => {
      const matchSearch =
        !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = !categoryFilter || product.category === categoryFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === 'habis' && product.stock === 0) ||
        (statusFilter === 'rendah' && product.stock > 0 && product.stock <= product.minStock) ||
        (statusFilter === 'normal' && product.stock > product.minStock && product.isAvailable !== false) ||
        (statusFilter === 'tidak_tersedia' && product.isAvailable === false);
      return matchSearch && matchCategory && matchStatus;
    });

    list = [...list].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      if (sortField === 'name') { valA = a.name; valB = b.name; }
      else if (sortField === 'category') { valA = a.category; valB = b.category; }
      else if (sortField === 'stock') { valA = a.stock; valB = b.stock; }
      else if (sortField === 'sellPrice') { valA = a.sellPrice; valB = b.sellPrice; }
      else if (sortField === 'modalPrice') { valA = a.modalPrice; valB = b.modalPrice; }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return list;
  }, [products, searchTerm, categoryFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingProduct(null);
    setShowModal(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name ?? '',
      category: product.category ?? '',
      modalPrice: product.modalPrice ? Number(product.modalPrice).toLocaleString('id-ID') : '',
      sellPrice: product.sellPrice ? Number(product.sellPrice).toLocaleString('id-ID') : '',
      stock: String(product.stock ?? ''),
      minStock: String(product.minStock ?? ''),
      unit: product.unit ?? 'Pcs',
      isAvailable: product.isAvailable !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const confirmed = window.confirm('Apakah Anda yakin ingin mengupdate produk ini?');
      if (!confirmed) return;
    }
    const stockVal = Number(formData.stock) || 0;
    const minStockVal = Number(formData.minStock) || 0;
    if (!Number.isInteger(stockVal) || !Number.isInteger(minStockVal)) {
      alert('Stok dan stok minimum harus berupa bilangan bulat!');
      return;
    }
    if (stockVal < 0 || minStockVal < 0) {
      alert('Stok tidak boleh bernilai negatif!');
      return;
    }
    if (stockVal > MAX_STOCK) {
      alert(`Stok maksimal ${MAX_STOCK.toLocaleString('id-ID')} unit per produk!`);
      return;
    }
    if (minStockVal > MAX_STOCK) {
      alert(`Stok minimum maksimal ${MAX_STOCK.toLocaleString('id-ID')} unit!`);
      return;
    }
    if (stockVal < minStockVal) {
      alert('Stok awal tidak boleh lebih kecil dari stok minimum!');
      return;
    }
    // Validasi nama duplikat
    const trimmedName = formData.name.trim().toLowerCase();
    const originalName = editingProduct?.name.trim().toLowerCase() ?? '';
    const nameChanged = trimmedName !== originalName;
    const duplicate = nameChanged && products.find(
      (p) => p.name.trim().toLowerCase() === trimmedName && p.id !== editingProduct?.id
    );
    if (duplicate) {
      alert(`Produk dengan nama "${formData.name.trim()}" sudah ada! Gunakan nama yang berbeda.`);
      return;
    }
    const payload: ProductInput = {
      code: '',
      name: formData.name.trim(),
      category: formData.category.trim(),
      modalPrice: parseRupiah(formData.modalPrice),
      sellPrice: parseRupiah(formData.sellPrice),
      stock: stockVal,
      minStock: minStockVal,
      unit: formData.unit.trim() || 'Pcs',
      isAvailable: formData.isAvailable,
    };
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await addProduct(payload);
      }
      await loadProducts();
      resetForm();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const totalProducts = products.length;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
      : <ChevronDown className="h-3.5 w-3.5 text-blue-600" />;
  };

  return (
    <div className="p-6 space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Produk</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Kelola stok dan data produk bengkel</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <Settings className="h-4 w-4" />
            Kelola Kategori
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-blue-50 p-3">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Produk</p>
            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-yellow-50 p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Stok Rendah</p>
            <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="rounded-lg bg-red-50 p-3">
            <Package className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Stok Habis</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama produk"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Status</option>
              <option value="normal">Tersedia</option>
              <option value="rendah">Stok Rendah</option>
              <option value="habis">Habis</option>
              <option value="tidak_tersedia">Tidak Tersedia</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Memuat data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-500 font-medium">Tidak ada produk ditemukan</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm || categoryFilter || statusFilter
                ? 'Coba ubah kata kunci atau filter'
                : 'Mulai dengan menambahkan produk pertama'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-8">No</th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">Nama Produk <SortIcon field="name" /></div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-1">Kategori <SortIcon field="category" /></div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center justify-end gap-1">Stok <SortIcon field="stock" /></div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => handleSort('modalPrice')}
                    >
                      <div className="flex items-center justify-end gap-1">Harga Modal <SortIcon field="modalPrice" /></div>
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600"
                      onClick={() => handleSort('sellPrice')}
                    >
                      <div className="flex items-center justify-end gap-1">Harga Jual <SortIcon field="sellPrice" /></div>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Margin</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedProducts.map((product, idx) => {
                    const status = getStockStatus(product);
                    const profit = product.sellPrice - product.modalPrice;
                    const profitMargin =
                      product.sellPrice > 0
                        ? ((profit / product.sellPrice) * 100).toFixed(1)
                        : '0.0';
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;

                    return (
                      <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{rowNum}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{product.name}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{product.category}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`font-medium ${product.stock === 0 ? 'text-red-600' : product.stock <= product.minStock ? 'text-yellow-600' : 'text-gray-900'}`}>
                              {product.stock}
                            </span>
                            <span className="text-gray-400 text-xs">{product.unit}</span>
                            {product.stock <= product.minStock && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(product.modalPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(product.sellPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {profit > 0 ? (
                              <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                            )}
                            <span className={`text-xs font-medium ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {profitMargin}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
<button
                              onClick={() => handleEdit(product)}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-sm text-gray-500">
                Menampilkan Data ke {(currentPage - 1) * pageSize + 1} sampai {Math.min(currentPage * pageSize, filteredProducts.length)} dari {filteredProducts.length} data produk
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ‹ Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          currentPage === p
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL PRODUK */}
      <Modal isOpen={showModal} onClose={resetForm} title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'} size={editingProduct ? 'xl' : 'md'}>
        {/* LAYOUT: saat edit -> 2 kolom sejajar, saat tambah -> 1 kolom */}
        <div className={editingProduct ? "grid grid-cols-2 gap-6" : ""}>

          {/* KOLOM KIRI: FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Nama Produk *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  (() => {
                    const typed = formData.name.trim().toLowerCase();
                    const originalName = editingProduct?.name.trim().toLowerCase() ?? '';
                    const isUnchanged = typed === originalName;
                    return !isUnchanged && typed && products.some((p) => p.name.trim().toLowerCase() === typed && p.id !== editingProduct?.id);
                  })()
                    ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
                placeholder="Nama produk"
                required
              />
              {(() => {
                const typed = formData.name.trim().toLowerCase();
                const originalName = editingProduct?.name.trim().toLowerCase() ?? '';
                const isUnchanged = typed === originalName;
                return !isUnchanged && typed && products.some((p) => p.name.trim().toLowerCase() === typed && p.id !== editingProduct?.id);
              })() && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Nama produk sudah ada, gunakan nama yang berbeda
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Kategori *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="">-- Pilih Kategori --</option>
                {dynamicCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Harga Modal *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.modalPrice}
                    onChange={(e) => setFormData({ ...formData, modalPrice: formatRupiah(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Harga Jual *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: formatRupiah(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Satuan *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Botol">Botol</option>
                  <option value="Liter">Liter</option>
                  <option value="Set">Set</option>
                  <option value="Kg">Kg</option>
                  <option value="Meter">Meter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Stok *</label>
                <input
                  type="number"
                  min="0"
                  max={MAX_STOCK}
                  step="1"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: clampStock(e.target.value) })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                    (formData.minStock && Number(formData.stock) < Number(formData.minStock)) ||
                    Number(formData.stock) > MAX_STOCK
                      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                  placeholder="0"
                  required
                />
                {formData.minStock && Number(formData.stock) < Number(formData.minStock) && (
                  <p className="mt-1 text-xs text-red-500">Stok tidak boleh kurang dari stok minimum ({formData.minStock})</p>
                )}
                <p className="mt-1 text-xs text-gray-400">Maksimal {MAX_STOCK.toLocaleString('id-ID')} unit</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Stok Minimum *</label>
                <input
                  type="number"
                  min="0"
                  max={MAX_STOCK}
                  step="1"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: clampStock(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            {editingProduct && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={formData.isAvailable ? 'aktif' : 'tidak_aktif'}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.value === 'aktif' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="aktif">Aktif</option>
                  <option value="tidak_aktif">Tidak Aktif</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={resetForm} className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition">
                Batal
              </button>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition">
                {editingProduct ? 'Update Produk' : 'Tambah Produk'}
              </button>
            </div>
          </form>

          {/* KOLOM KANAN: PREVIEW — hanya muncul saat mode edit */}
          {editingProduct && (() => {
            const orig = editingProduct;
            const newModalPrice = parseRupiah(formData.modalPrice);
            const newSellPrice = parseRupiah(formData.sellPrice);
            const newStock = Number(formData.stock) || 0;
            const newMinStock = Number(formData.minStock) || 0;
            const changed = (a: unknown, b: unknown) => String(a) !== String(b);

            const Row = ({ label, before, after, isChanged }: { label: string; before: string; after: string; isChanged: boolean }) => (
              <div className={`rounded-lg px-4 py-3 ${isChanged ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className={isChanged ? 'line-through text-red-400' : 'text-gray-700'}>{before}</span>
                  {isChanged && (
                    <>
                      <span className="text-gray-300 text-base">→</span>
                      <span className="text-green-600 font-semibold">{after}</span>
                    </>
                  )}
                </div>
              </div>
            );

            const anyChanged =
              changed(orig.name.trim(), formData.name.trim()) ||
              changed(orig.category, formData.category) ||
              changed(orig.modalPrice, newModalPrice) ||
              changed(orig.sellPrice, newSellPrice) ||
              changed(orig.unit, formData.unit) ||
              changed(orig.stock, newStock) ||
              changed(orig.minStock, newMinStock) ||
              changed(orig.isAvailable !== false, formData.isAvailable);

            return (
              <div className="flex flex-col border-l border-gray-100 pl-6">
                <p className="text-sm font-semibold text-gray-600 mb-3">Preview Perubahan</p>
                <div className="flex-1 space-y-2">
                  <Row label="Nama Produk" before={orig.name} after={formData.name.trim()} isChanged={changed(orig.name.trim(), formData.name.trim())} />
                  <Row label="Kategori" before={orig.category} after={formData.category} isChanged={changed(orig.category, formData.category)} />
                  <Row label="Harga Modal" before={`Rp ${orig.modalPrice.toLocaleString('id-ID')}`} after={`Rp ${newModalPrice.toLocaleString('id-ID')}`} isChanged={changed(orig.modalPrice, newModalPrice)} />
                  <Row label="Harga Jual" before={`Rp ${orig.sellPrice.toLocaleString('id-ID')}`} after={`Rp ${newSellPrice.toLocaleString('id-ID')}`} isChanged={changed(orig.sellPrice, newSellPrice)} />
                  <Row label="Satuan" before={orig.unit} after={formData.unit} isChanged={changed(orig.unit, formData.unit)} />
                  <Row label="Stok" before={String(orig.stock)} after={String(newStock)} isChanged={changed(orig.stock, newStock)} />
                  <Row label="Stok Minimum" before={String(orig.minStock)} after={String(newMinStock)} isChanged={changed(orig.minStock, newMinStock)} />
                  <Row label="Status" before={orig.isAvailable !== false ? 'Aktif' : 'Tidak Aktif'} after={formData.isAvailable ? 'Aktif' : 'Tidak Aktif'} isChanged={changed(orig.isAvailable !== false, formData.isAvailable)} />
                </div>
                <div className="pt-3 mt-3 border-t border-gray-100 text-center">
                  {anyChanged
                    ? <p className="text-xs text-amber-600 font-medium">⚠ Ada perubahan yang belum disimpan</p>
                    : <p className="text-xs text-gray-400 italic">Belum ada perubahan</p>
                  }
                </div>
              </div>
            );
          })()}

        </div>
      </Modal>


            {/* CATEGORY MANAGEMENT MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Kelola Kategori</h2>
              <button
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); setNewCategoryName(''); setNewCategoryColor('#14B8A6'); setNewCategoryError(''); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Tambah Kategori Baru</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => { setNewCategoryName(e.target.value); setNewCategoryError(''); }}
                  placeholder="Nama kategori..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Warna</label>
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => { setNewCategoryColor(e.target.value); setNewCategoryError(''); }}
                    className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
                  />
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: newCategoryColor }}>
                    {newCategoryName || 'Preview'}
                  </span>
                </div>
                {newCategoryError && <p className="text-sm text-red-600">{newCategoryError}</p>}
                <button
                  type="button"
                  onClick={async () => {
                    const usedColors = getAllUsedColors(undefined, 'category');
                    if (usedColors.includes(newCategoryColor.toLowerCase())) {
                      setNewCategoryError('Warna sudah digunakan, gunakan warna lain');
                      return;
                    }
                    const updated = await addCategory(newCategoryName, newCategoryColor);
                    setDynamicCategories(updated);
                    setCategoryEntries(await getCategoryColors());
                    setNewCategoryName('');
                    setNewCategoryColor('#14B8A6');
                    setNewCategoryError('');
                    window.dispatchEvent(new Event('appDataChanged'));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Tambah Kategori
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Daftar Kategori ({dynamicCategories.length})</label>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {categoryEntries.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2">
                      {editingCategory === entry.name ? (
                        <>
                          <div className="flex flex-col gap-1 flex-1">
                            <input
                              type="text"
                              value={editingCategoryValue}
                              onChange={(e) => { setEditingCategoryValue(e.target.value); setEditingCategoryError(''); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setEditingCategory(null); setEditingCategoryError(''); } }}
                              autoFocus
                              className="rounded border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editingCategoryColor}
                                onChange={(e) => { setEditingCategoryColor(e.target.value); setEditingCategoryError(''); }}
                                className="h-6 w-6 cursor-pointer rounded border border-gray-300 p-0.5"
                              />
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: editingCategoryColor }}>
                                {editingCategoryValue || entry.name}
                              </span>
                            </div>
                            {editingCategoryError && <p className="text-xs text-red-600">{editingCategoryError}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const usedColors = getAllUsedColors(entry.name, 'category');
                              if (usedColors.includes(editingCategoryColor.toLowerCase())) {
                                setEditingCategoryError('Warna sudah digunakan');
                                return;
                              }
                              const updated = await editCategory(entry.name, editingCategoryValue, editingCategoryColor);
                              setDynamicCategories(updated);
                              setCategoryEntries(await getCategoryColors());
                              setEditingCategory(null);
                              setEditingCategoryError('');
                              window.dispatchEvent(new Event('appDataChanged'));
                            }}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                          >Simpan</button>
                          <button
                            type="button"
                            onClick={() => { setEditingCategory(null); setEditingCategoryError(''); }}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                          >Batal</button>
                        </>
                      ) : (
                        <>
                          <span className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="flex-1 text-sm text-gray-800">{entry.name}</span>
                          <button
                            type="button"
                            onClick={() => { setEditingCategory(entry.name); setEditingCategoryValue(entry.name); setEditingCategoryColor(entry.color); setEditingCategoryError(''); }}
                            className="rounded p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600"
                          ><Pencil className="h-3.5 w-3.5" /></button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Hapus kategori "${entry.name}"?`)) return;
                              const updated = await deleteCategory(entry.name);
                              setDynamicCategories(updated);
                              setCategoryEntries(await getCategoryColors());
                              window.dispatchEvent(new Event('appDataChanged'));
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
                          ><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  ))}
                  {categoryEntries.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400">Belum ada kategori</p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4">
              <button
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); setNewCategoryName(''); setNewCategoryColor('#14B8A6'); setNewCategoryError(''); }}
                className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition"
              >Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;
