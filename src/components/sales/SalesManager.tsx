import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  ShoppingCart,
  Search,
  Calendar,
  User,
  CreditCard,
  Receipt,
  Trash2,
  Package,
  Minus,
} from 'lucide-react';

import Modal from '../common/Modal';
import { format } from 'date-fns';
import { getCurrentUser } from '../../utils/auth';
import { formatCurrency } from '../../utils/analytics';
import { getCategoryHex } from '../../utils/categoryColors';
import { sanitizePhone, getPhoneError, PHONE_MAX_LENGTH } from '../../utils/phone';
import { clampCash, getCashError, cashLimitFor } from '../../utils/limits';
import { sanitizePlate, getPlateError, PLATE_MAX_INPUT } from '../../utils/plate';
import { getProducts, updateProductStock, addTransaction as addTransactionAPI, deleteTransaction as deleteTransactionAPI, getTransactions, type Product } from '../../service/api';

type PaymentMethod = 'cash' | 'non_tunai';

type CartItem = {
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  quantity: number;
  modalPrice: number;
  sellPrice: number;
  subtotal: number;
  profit: number;
};

type SalesTransaction = {
  id: string;
  invoiceNumber: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountPct: number;
  total: number;
  profit: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  nomorPolisi?: string;
  uangBayar?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
};



const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const formatTanggalID = (dateStr: string, timeStr?: string): string => {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const tanggal = `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
  if (timeStr) {
    const t = new Date(timeStr);
    if (!isNaN(t.getTime())) {
      const jam = String(t.getHours()).padStart(2, '0');
      const menit = String(t.getMinutes()).padStart(2, '0');
      return `${tanggal} : jam ${jam}:${menit}`;
    }
  }
  return tanggal;
};

const normalizeItem = (item: CartItem | Record<string, unknown>): CartItem => {
  const productId = String(item.productId ?? '');
  const productName = String(item.productName ?? 'Unknown');
  const productCode = String(item.productCode ?? '');
  const category = String(item.category ?? 'Unknown');

  const quantity = Number(item.quantity ?? 0);
  const modalPrice = Number(item.modalPrice ?? 0);
  const sellPrice = Number(item.sellPrice ?? 0);
  const subtotal = Number(item.subtotal ?? quantity * sellPrice);
  const profit = Number(item.profit ?? quantity * (sellPrice - modalPrice));

  return {
    productId,
    productName,
    productCode,
    category,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    modalPrice: Number.isFinite(modalPrice) ? modalPrice : 0,
    sellPrice: Number.isFinite(sellPrice) ? sellPrice : 0,
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    profit: Number.isFinite(profit) ? profit : 0,
  };
};

const normalizeTransaction = (trx: SalesTransaction | Record<string, unknown>): SalesTransaction => {
  const itemsRaw = Array.isArray((trx as { items?: unknown[] }).items)
    ? ((trx as { items?: unknown[] }).items as unknown[])
    : [];

  const items = itemsRaw.map((item) => normalizeItem(item as Record<string, unknown>));

  return {
    id: String(trx.id ?? Date.now()),
    invoiceNumber: String(trx.invoiceNumber ?? 'INV'),
    date: String(trx.date ?? format(new Date(), 'yyyy-MM-dd')),
    items,
    subtotal: Number(trx.subtotal ?? 0),
    discount: Number(trx.discount ?? 0),
    discountPct: Number(trx.discountPct ?? 0),
    total: Number(trx.total ?? 0),
    profit: Number(trx.profit ?? 0),
    paymentMethod: (trx.paymentMethod === 'non_tunai' ? 'non_tunai' : 'cash') as PaymentMethod,
    customerName: trx.customerName ? String(trx.customerName) : undefined,
    customerPhone: trx.customerPhone ? String(trx.customerPhone) : undefined,
    nomorPolisi: trx.nomorPolisi ? String(trx.nomorPolisi) : undefined,
    uangBayar: trx.uangBayar ? Number(trx.uangBayar) : undefined,
    notes: trx.notes ? String(trx.notes) : undefined,
    createdBy: String(trx.createdBy ?? 'unknown'),
    createdAt: String(trx.createdAt ?? new Date().toISOString()),
  };
};

const SalesManager: React.FC = () => {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [productSearch, setProductSearch] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nomorPolisi, setNomorPolisi] = useState('');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [uangBayar, setUangBayar] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const user = getCurrentUser();

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    return 'Terjadi kesalahan';
  };

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      const safe = (data as unknown[]).map((trx) => normalizeTransaction(trx as Record<string, unknown>));
      safe.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(safe);
    } catch {
      setTransactions([]);
    }
  };

  const saveTransactionToBackend = async (transaction: SalesTransaction) => {
    await addTransactionAPI(transaction);
    await loadTransactions();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus transaksi ini?')) return;

    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      for (const item of tx.items) {
        try {
          await updateProductStock(item.productId, item.quantity);
        } catch {
          console.warn(`Gagal restore stok: ${item.productName}`);
        }
      }
    }
    await deleteTransactionAPI(id);
    await loadTransactions();
    await loadProducts();
    window.dispatchEvent(new Event('appDataChanged'));
  };

  useEffect(() => {
    void loadTransactions();
    void loadProducts();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesDate =
        (!dateFrom || transaction.date >= dateFrom) &&
        (!dateTo || transaction.date <= dateTo);
      const matchesSearch =
        !searchTerm ||
        transaction.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.customerName?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDate && matchesSearch;
    });
  }, [transactions, searchTerm, dateFrom, dateTo]);

  // Seluruh produk tetap ditampilkan; yang stoknya habis atau tidak aktif
  // hanya ditandai dan tidak bisa ditambahkan, agar pengguna tahu produknya ada.
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    const match = products.filter((product) => {
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.code.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q)
      );
    });
    // Produk siap jual didahulukan, yang bermasalah diletakkan di bawah.
    const usable = (p: Product) => p.stock > 0 && p.isAvailable !== false;
    return [...match.filter(usable), ...match.filter((p) => !usable(p))];
  }, [products, productSearch]);

  const usableProductCount = useMemo(
    () => filteredProducts.filter((p) => p.stock > 0 && p.isAvailable !== false).length,
    [filteredProducts]
  );

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const pct = Math.min(100, Math.max(0, discountPct));
    const discount = Math.round(subtotal * pct / 100);
    const total = subtotal - discount;
    const profit = cart.reduce((sum, item) => sum + item.profit, 0);

    return { subtotal, discount, total, profit };
  }, [cart, discountPct]);

  const summary = useMemo(() => {
    const totalSales = filteredTransactions.reduce((sum, trx) => sum + trx.total, 0);
    const totalProfit = filteredTransactions.reduce((sum, trx) => sum + trx.profit, 0);

    return {
      count: filteredTransactions.length,
      sales: totalSales,
      profit: totalProfit,
    };
  }, [filteredTransactions]);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time =
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');

    return `INV${year}${month}${day}${time}`;
  };

  const handleSaveTransaction = () => {
    if (cart.length === 0) {
      alert('Keranjang masih kosong');
      return;
    }
    const phoneError = getPhoneError(customerPhone);
    if (phoneError) {
      alert(phoneError);
      return;
    }
    const plateError = getPlateError(nomorPolisi);
    if (plateError) {
      alert(plateError);
      return;
    }
    if (paymentMethod === 'cash') {
      const bayar = parseFloat(uangBayar.replace(/\./g, '')) || 0;
      const cashError = getCashError(bayar, totals.total);
      if (cashError) {
        alert(`${cashError}. Total: ${formatCurrency(totals.total)}, Dibayar: ${formatCurrency(bayar)}`);
        return;
      }
    }
    setShowConfirm(true);
  };

  const resetForm = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNomorPolisi('');
    setDiscountPct(0);
    setUangBayar('');
    setPaymentMethod('cash');
    setNotes('');
    setProductSearch('');
    setIsSaving(false);
    setShowModal(false);
    setShowConfirm(false);
  };

  const findProduct = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  const addToCart = (productId: string, qty: number) => {
    const product = findProduct(productId);
    if (!product) {
      alert('Produk tidak ditemukan');
      return;
    }

    const addQty = Number(qty);
    if (!Number.isFinite(addQty) || addQty <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }

    const existingItem = cart.find((item) => item.productId === productId);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const finalQty = currentQty + addQty;

    if (finalQty > product.stock) {
      alert('Stok tidak mencukupi');
      return;
    }

    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);

      if (index >= 0) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          category: product.category || updated[index].category || 'Unknown',
          quantity: finalQty,
          subtotal: finalQty * product.sellPrice,
          profit: finalQty * (product.sellPrice - product.modalPrice),
        };
        return updated;
      }

      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        category: product.category || 'Unknown',
        quantity: addQty,
        modalPrice: product.modalPrice,
        sellPrice: product.sellPrice,
        subtotal: addQty * product.sellPrice,
        profit: addQty * (product.sellPrice - product.modalPrice),
      };

      return [...prev, newItem];
    });
  };

  const addQuickOne = (productId: string) => {
    addToCart(productId, 1);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const product = findProduct(productId);
    if (!product) return;

    const qty = Number(newQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (qty > product.stock) {
      alert('Stok tidak mencukupi');
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              category: product.category || item.category || 'Unknown',
              quantity: qty,
              subtotal: qty * item.sellPrice,
              profit: qty * (item.sellPrice - item.modalPrice),
            }
          : item
      )
    );
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);

    try {
      for (const item of cart) {
        const product = findProduct(item.productId);
        if (!product) {
          throw new Error(`Produk ${item.productName} tidak ditemukan`);
        }

        if (item.quantity > product.stock) {
          throw new Error(`Stok ${item.productName} tidak mencukupi`);
        }
      }

      for (const item of cart) {
        await updateProductStock(item.productId, -item.quantity);
      }

      const transaction: SalesTransaction = {
        id: String(Date.now()),
        invoiceNumber: generateInvoiceNumber(),
        date: format(new Date(), 'yyyy-MM-dd'),
        items: cart.map((item) => ({
          ...item,
          category: item.category || 'Unknown',
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountPct,
        total: totals.total,
        profit: totals.profit,
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        nomorPolisi: nomorPolisi || undefined,
        notes: notes || undefined,
        uangBayar: paymentMethod === 'cash' ? (parseFloat(uangBayar.replace(/\./g, '')) || 0) : 0,
        createdBy: user?.username || 'unknown',
        createdAt: new Date().toISOString(),
      };

      saveTransactionToBackend(transaction);
      await loadProducts();
      resetForm();
      alert('Transaksi berhasil disimpan');
    } catch (err: unknown) {
      alert(getErrorMessage(err));
      setIsSaving(false);
    }
  };

  const openJasaCat = () => {
    try {
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'jasaCat' }));
    } catch {
      alert('Buka menu Jasa Cat dari sidebar.');
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Penjualan</h1>
          <p className="mt-1 text-gray-600">Kelola transaksi penjualan harian</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-white transition hover:bg-green-700"
          >
            <Plus className="h-5 w-5" />
            <span>Transaksi Baru</span>
          </button>

          <button
            type="button"
            onClick={openJasaCat}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-white transition hover:bg-purple-700"
          >
            <Package className="h-5 w-5" />
            <span>Jasa Service</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Transaksi</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{summary.count}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Omzet</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {formatCurrency(summary.sales)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Keuntungan</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(summary.profit)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <span className="text-gray-400 text-sm font-medium">—</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition whitespace-nowrap"
            >
              Semua
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Receipt className="h-5 w-5" />
            <span>Daftar Transaksi</span>
          </h3>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">Belum ada transaksi</h3>
            <p className="text-gray-600">Mulai dengan membuat transaksi pertama</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 sticky top-0">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 whitespace-nowrap">No. HP</th>
                  <th className="px-4 py-3 whitespace-nowrap">No. Polisi</th>
                  <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 whitespace-nowrap">Produk</th>
                  <th className="px-4 py-3 whitespace-nowrap">Diskon</th>
                  <th className="px-4 py-3 whitespace-nowrap">Harga Modal</th>
                  <th className="px-4 py-3 whitespace-nowrap">Harga Jual</th>
                  <th className="px-4 py-3 whitespace-nowrap">Keuntungan</th>
                  <th className="px-4 py-3 whitespace-nowrap">Pembayaran</th>
                  <th className="px-4 py-3 whitespace-nowrap">Uang Bayar</th>
                  <th className="px-4 py-3 whitespace-nowrap">Kembalian</th>
                  <th className="px-4 py-3 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((transaction) => {
                  const kembalian = transaction.paymentMethod === 'cash'
                    ? Math.max(0, (transaction.uangBayar ?? 0) - transaction.total)
                    : 0;
                  return (
                    <tr key={transaction.id} className="border-t hover:bg-gray-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">{formatTanggalID(transaction.date, transaction.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {transaction.customerPhone || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {transaction.nomorPolisi
                          ? <span className="font-medium text-gray-800"> {transaction.nomorPolisi}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{transaction.customerName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {transaction.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-700">{item.quantity}× {item.productName}</span>
                              <span
                                className="rounded-full px-1.5 py-0.5 text-white text-xs font-medium"
                                style={{ backgroundColor: getCategoryHex((item as Record<string, unknown>).category as string || 'Unknown') }}
                              >
                                {(item as Record<string, unknown>).category as string || 'Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(transaction.discountPct ?? 0) > 0
                          ? `${transaction.discountPct}%`
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {formatCurrency(transaction.items.reduce((sum, item) => sum + item.modalPrice * item.quantity, 0))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                        {formatCurrency(transaction.total)}
                      </td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${transaction.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(transaction.profit)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          transaction.paymentMethod === 'cash'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {transaction.paymentMethod === 'cash' ? 'Tunai' : 'Non Tunai'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {transaction.paymentMethod === 'cash' && (transaction.uangBayar ?? 0) > 0
                          ? formatCurrency(transaction.uangBayar ?? 0)
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {transaction.paymentMethod === 'cash' && kembalian > 0
                          ? <span className="text-green-600">{formatCurrency(kembalian)}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => { void handleDeleteTransaction(transaction.id); }}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 transition"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={resetForm} title="Transaksi Baru" size="xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Pilih Produk</h4>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Cari produk cepat..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Produk tidak ditemukan</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((item) => item.productId === product.id);
                    const habis = product.stock <= 0;
                    const nonaktif = product.isAvailable === false;
                    const terpakai = !habis && !nonaktif;
                    return (
                      <div key={product.id} className={`p-3 ${terpakai ? '' : 'bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${terpakai ? 'text-gray-900' : 'text-gray-400'}`}>
                                {product.name}
                              </p>
                              {!terpakai && (
                                <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                  {nonaktif ? 'tidak aktif' : 'stok habis'}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${terpakai ? 'text-gray-500' : 'text-gray-400'}`}>
                              Kategori: {product.category || 'Unknown'}
                            </p>
                            <p className={`text-xs ${terpakai ? 'text-gray-500' : 'text-gray-400'}`}>
                              Stok: {product.stock} • {formatCurrency(product.sellPrice)}
                            </p>
                            {inCart && (
                              <p className="mt-1 text-xs text-blue-600">
                                Di keranjang: {inCart.quantity}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => addQuickOne(product.id)}
                            disabled={!terpakai}
                            title={terpakai ? undefined : nonaktif ? 'Produk tidak aktif' : 'Stok habis'}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                              terpakai
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'cursor-not-allowed bg-gray-200 text-gray-400'
                            }`}
                          >
                            <Plus className="h-4 w-4" />
                            Tambah
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {filteredProducts.length > 0 && usableProductCount < filteredProducts.length && (
              <p className="mt-1 text-xs text-gray-400">
                {usableProductCount} dari {filteredProducts.length} produk siap dijual; sisanya stok habis atau tidak aktif.
              </p>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 p-3">
                <h5 className="font-medium text-gray-900">Keranjang</h5>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">Keranjang masih kosong</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.productId} className="border-b border-gray-100 p-3 last:border-b-0">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="block font-medium text-gray-900">{item.productName}</span>
                          <span className="text-xs text-gray-500">
                            {item.category || 'Unknown'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-600 transition hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartQuantity(item.productId, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none"
                            min="1"
                          />

                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
                          >
                            <Plus className="h-3 w-3" />
                          </button>

                          <span className="text-sm text-gray-600">
                            x {formatCurrency(item.sellPrice)}
                          </span>
                        </div>

                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="space-y-2 rounded-xl bg-gray-50 p-4">
                <div className="flex justify-between">
                  <span>Item:</span>
                  <span>{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diskon{discountPct > 0 ? ` (${discountPct}%)` : ''}:</span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-2 text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Keuntungan:</span>
                  <span>+{formatCurrency(totals.profit)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Informasi Customer & Pembayaran</h4>

            {/* Nomor Handphone — WAJIB, URUTAN PERTAMA */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nomor Handphone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))}
                maxLength={PHONE_MAX_LENGTH}
                className={`w-full rounded-xl border px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-100 ${
                  getPhoneError(customerPhone)
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Wajib diisi (contoh: 08123456789) "
                required
              />
              {getPhoneError(customerPhone) && (
                <p className="mt-1 text-xs text-red-500">{getPhoneError(customerPhone)}</p>
              )}
            </div>

            {/* Nomor Polisi — URUTAN KEDUA */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nomor Polisi
              </label>
              <input
                type="text"
                value={nomorPolisi}
                onChange={(e) => setNomorPolisi(sanitizePlate(e.target.value))}
                maxLength={PLATE_MAX_INPUT}
                className={`w-full rounded-xl border px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-blue-100 ${
                  getPlateError(nomorPolisi)
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Opsional (contoh: B 1234 XY)"
              />
              {getPlateError(nomorPolisi) && (
                <p className="mt-1 text-xs text-red-500">{getPlateError(nomorPolisi)}</p>
              )}
            </div>

            {/* Nama Customer — URUTAN KETIGA */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <User className="mr-1 inline h-4 w-4" />
                Nama Customer <span className="text-gray-400 text-xs font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Opsional (contoh: Udin)"
              />
            </div>

            {/* Diskon */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Diskon
              </label>
              <div className="flex items-center justify-end gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <input
                  type="text"
                  inputMode="numeric"
                  value={discountPct === 0 ? '' : discountPct}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    const num = Math.min(100, Math.max(0, parseInt(digits, 10) || 0));
                    setDiscountPct(num);
                  }}
                  className="bg-transparent outline-none border-none p-0"
                  style={{ width: `${Math.max((discountPct === 0 ? '0' : String(discountPct)).length, 1)}ch` }}
                  placeholder="0"
                />
                <span className="text-gray-500 font-medium shrink-0">%</span>
              </div>
              {discountPct > 0 && totals.subtotal > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Potongan: {formatCurrency(totals.discount)}
                </p>
              )}
            </div>

            {/* Metode Pembayaran */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <CreditCard className="mr-1 inline h-4 w-4" />
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod);
                  setUangBayar('');
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="cash">Tunai</option>
                <option value="non_tunai">Non Tunai</option>
              </select>
            </div>

            {/* Uang Bayar + Kembalian — hanya saat Tunai */}
            {paymentMethod === 'cash' && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Uang Dibayar (Rp) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center justify-end gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <span className="text-sm font-medium text-gray-500 shrink-0">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={uangBayar}
                      onChange={(e) => {
                        const capped = clampCash(e.target.value, totals.total);
                        setUangBayar(capped ? Number(capped).toLocaleString('id-ID') : '');
                      }}
                      className="bg-transparent outline-none border-none p-0"
                      style={{ width: `${Math.max((uangBayar || '0').length, 1)}ch` }}
                      placeholder="0"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Maksimal {formatCurrency(cashLimitFor(totals.total))}
                  </p>
                </div>

                {/* Kembalian / Kurang */}
                {(() => {
                  const bayar = parseFloat(uangBayar.replace(/\./g, '')) || 0;
                  const kembalian = bayar - totals.total;
                  if (bayar === 0) return null;
                  return kembalian >= 0 ? (
                    <div className="rounded-lg bg-green-100 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">💰 Kembalian</span>
                      <span className="text-lg font-bold text-green-700">{formatCurrency(kembalian)}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-red-100 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800">⚠️ Kurang</span>
                      <span className="text-lg font-bold text-red-700">{formatCurrency(Math.abs(kembalian))}</span>
                    </div>
                  );
                })()}

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total yang harus dibayar:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            )}


          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-gray-700 transition hover:bg-gray-200"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSaveTransaction}
            disabled={isSaving}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </div>
      </Modal>

      {/* Modal Konfirmasi Transaksi */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Konfirmasi Transaksi" size="xl">
        <div className="space-y-5">

          {/* Info Customer */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Info Customer</h4>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700">No. Handphone : <span className="font-medium text-gray-900">{customerPhone}</span></span>
              {customerName && (
                <span className="text-gray-700">Nama Customer : <span className="font-medium text-gray-900">{customerName}</span></span>
              )}
              {nomorPolisi && (
                <span className="text-gray-700">No. Polisi : <span className="font-medium text-gray-900"> {nomorPolisi}</span></span>
              )}
            </div>
          </div>

          {/* Detail Produk */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Detail Produk</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Nama Produk</th>
                  <th className="px-4 py-2 text-center">Jumlah Produk</th>
                  <th className="px-4 py-2 text-right">Harga Produk</th>
                  <th className="px-4 py-2 text-right">Subtotal Harga Produk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900">{item.productName}</p>

                    </td>
                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.sellPrice)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ringkasan Pembayaran */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
            <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">Pembayaran</h4>
            <div className="flex justify-between">
              <span className="text-gray-500">Metode</span>
              <span className="font-medium">{paymentMethod === 'cash' ? 'Tunai' : 'Non Tunai'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal Harga Produk</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Diskon ({discountPct}%)</span>
                <span className="text-red-500">-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-base">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
            {paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uang Dibayar</span>
                  <span>{formatCurrency(parseFloat(uangBayar.replace(/\./g, '')) || 0)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Kembalian</span>
                  <span>{formatCurrency(Math.max(0, (parseFloat(uangBayar.replace(/\./g, '')) || 0) - totals.total))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="rounded-xl bg-gray-100 px-5 py-2.5 text-gray-700 transition hover:bg-gray-200"
          >
            ← Kembali
          </button>
          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm('Apakah Anda yakin ingin melakukan transaksi ini?');
              if (!confirmed) return;
              void handleConfirmSave();
            }}
            disabled={isSaving}
            className="rounded-xl bg-green-600 px-5 py-2.5 text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Menyimpan...' : '✓ Konfirmasi'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default SalesManager;