import React, { useEffect, useMemo, useState } from 'react';
import {
  addJasaCatJob,
  deleteJasaCatJob,
  getJasaCatJobs,
  type JasaCatJob,
} from '../../utils/storage';
import { getProducts, updateProductStock, type Product, getServiceTypes, addServiceType, updateServiceType, deleteServiceType, getCategories } from '../../service/api';
import { Plus, Trash2, Settings, X, ChevronDown, ChevronUp, Pencil, Check, Calendar, ShoppingCart, Search } from 'lucide-react';
import { getServiceColor, getAllUsedColors } from '../../utils/categoryColors';
import { sanitizePhone, getPhoneError, PHONE_MAX_LENGTH } from '../../utils/phone';
import { clampCash, getCashError, cashLimitFor } from '../../utils/limits';
import { sanitizePlate, getPlateError, PLATE_MAX_INPUT } from '../../utils/plate';
import Modal from '../common/Modal';

// ── Searchable dropdown inline ──────────────────────────────────────────────
interface SelectOption { value: string; label: string; disabled?: boolean; note?: string; }
interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dark?: boolean;
}
function SearchableSelect({ options, value, onChange, placeholder = '-- Pilih --', dark = false }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [hlIdx, setHlIdx] = React.useState(0);
  const wrapRef  = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef  = React.useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = search.trim() ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  React.useEffect(() => {
    const el = listRef.current?.children[hlIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [hlIdx]);
  function open() { setIsOpen(true); setSearch(''); setHlIdx(0); setTimeout(() => inputRef.current?.focus(), 0); }
  function close() { setIsOpen(false); setSearch(''); }
  function select(opt: SelectOption) { if (opt.disabled) return; onChange(opt.value); close(); }
  /** Lompat ke opsi berikutnya yang masih bisa dipilih. */
  function nextSelectable(from: number, dir: 1 | -1) {
    for (let i = from; i >= 0 && i < filtered.length; i += dir) {
      if (!filtered[i].disabled) return i;
    }
    return from;
  }
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHlIdx((i) => nextSelectable(Math.min(i + 1, filtered.length - 1), 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHlIdx((i) => nextSelectable(Math.max(i - 1, 0), -1)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (filtered[hlIdx]) select(filtered[hlIdx]); }
    else if (e.key === 'Escape')    { close(); }
  }
  function hl(label: string, q: string) {
    if (!q.trim()) return <span>{label}</span>;
    const i = label.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return <span>{label}</span>;
    return <span>{label.slice(0, i)}<mark className={`${dark ? 'bg-teal-500/30 text-teal-300' : 'bg-yellow-200 text-inherit'} rounded-sm px-px`}>{label.slice(i, i + q.length)}</mark>{label.slice(i + q.length)}</span>;
  }
  return (
    <div ref={wrapRef} className="relative w-full">
      <button type="button" onClick={() => isOpen ? close() : open()}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition ${
          dark
            ? `bg-slate-800 ${isOpen ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-700 hover:border-slate-500'}`
            : `bg-white ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`
        }`}
        aria-haspopup="listbox" aria-expanded={isOpen}>
        <span className={`flex-1 truncate ${selected ? (dark ? 'text-slate-100' : 'text-gray-800') : (dark ? 'text-slate-500' : 'text-gray-400')}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span role="button" onClick={(e) => { e.stopPropagation(); onChange(''); close(); }}
              className={`${dark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'} text-xs px-1`}>✕</span>
          )}
          <span className={`${dark ? 'text-slate-500' : 'text-gray-400'} text-sm transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>
      {isOpen && (
        <div className={`absolute left-0 right-0 top-full z-50 mt-0 rounded-b-xl border border-t-0 shadow-lg overflow-hidden ${
          dark ? 'bg-slate-800 border-teal-500' : 'bg-white border-blue-500'
        }`}>
          <div className={`flex items-center gap-2 border-b px-3 py-2 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
            <svg className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input ref={inputRef} type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setHlIdx(0); }}
              onKeyDown={handleKey} placeholder="Cari nama produk..."
              className={`flex-1 text-sm outline-none bg-transparent ${dark ? 'text-slate-200 placeholder-slate-500' : 'placeholder-gray-400'}`} />
            {search && <button type="button" onClick={() => { setSearch(''); setHlIdx(0); inputRef.current?.focus(); }} className={`${dark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'} text-xs`}>✕</button>}
          </div>
          <ul ref={listRef} role="listbox" className="max-h-[22rem] overflow-y-auto overscroll-contain py-1 text-sm">
            {filtered.length === 0
              ? <li className={`px-4 py-3 text-center text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Produk tidak ditemukan</li>
              : filtered.map((opt, idx) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value} aria-disabled={opt.disabled}
                  onClick={() => select(opt)} onMouseEnter={() => { if (!opt.disabled) setHlIdx(idx); }}
                  className={`flex items-center justify-between px-4 py-2 transition-colors ${
                    opt.disabled
                      ? `cursor-not-allowed ${dark ? 'text-slate-600' : 'text-gray-400'}`
                      : `cursor-pointer ${dark
                          ? opt.value === value ? 'bg-teal-500/20 text-teal-300 font-medium' : idx === hlIdx ? 'bg-slate-700 text-slate-200' : 'text-slate-300 hover:bg-slate-700'
                          : opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : idx === hlIdx ? 'bg-gray-50 text-gray-800' : 'text-gray-700 hover:bg-gray-50'}`
                  }`}>
                  <span className={`flex-1 truncate ${opt.disabled ? 'line-through' : ''}`}>{hl(opt.label, search)}</span>
                  {opt.disabled && opt.note && (
                    <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>{opt.note}</span>
                  )}
                  {opt.value === value && <span className={`ml-2 text-xs font-bold ${dark ? 'text-teal-400' : 'text-blue-500'}`}>✓</span>}
                </li>
              ))
            }
          </ul>
          {filtered.length > 0 && <div className={`border-t px-3 py-1.5 text-right text-xs ${dark ? 'border-slate-700 text-slate-500' : 'border-gray-100 text-gray-400'}`}>{filtered.length} produk</div>}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────


// =====================
// TYPES
// =====================

type MotorTypeId = 'bebek' | 'matic' | 'sport';
type CatColor = 'merah' | 'hitam' | 'kuning' | 'biru';

type CustomServiceType = {
  id: string;
  name: string;
  color: string;
  prices: Record<MotorTypeId, number>;
  modal: Record<MotorTypeId, number>;
  linkedCategory?: string; // kategori produk yang terhubung (opsional)
};

// Item di keranjang service
type CartItem = {
  cartId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  serviceType: 'cat' | 'oli' | 'custom';
  serviceColor?: string;
  motorType: MotorTypeId;
  catColor?: CatColor;
  oliProductId?: string;
  oliProductName?: string;
  discount: number;
  sellingPrice: number;     // setelah diskon
  basePrice: number;        // sebelum diskon
  modalPrice: number;
  profit: number;
};

const MOTOR_LABELS: Record<MotorTypeId, string> = {
  bebek: 'Bebek',
  matic: 'Matic',
  sport: 'Sport',
};

const CAT_COLOR_LABELS: Record<CatColor, string> = {
  merah: 'Cat Merah',
  hitam: 'Cat Hitam',
  kuning: 'Cat Kuning',
  biru: 'Cat Biru',
};

const DEFAULT_SERVICES: CustomServiceType[] = [
  {
    id: 'cat',
    name: 'Service Cat',
    color: '#14B8A6',
    prices: { bebek: 650000, matic: 700000, sport: 1200000 },
    modal: { bebek: 0, matic: 0, sport: 0 },
  },
  {
    id: 'oli',
    name: 'Ganti Oli',
    color: '#F97316',
    prices: { bebek: 0, matic: 0, sport: 0 },
    modal: { bebek: 0, matic: 0, sport: 0 },
  },
];

// Form untuk satu item service yang akan ditambahkan ke cart
type ServiceItemForm = {
  serviceTypeId: string;
  motorType: MotorTypeId;
  selectedOliId: string; // id produk oli dari inventory (dropdown)
  selectedLinkedProductId: string; // id produk dari linkedCategory
  discount: string;
};

// Form info customer & pembayaran (level transaksi)
type TransactionForm = {
  date: string;
  customer: string;
  nomorPolisi: string;
  noHandphone: string;
  paymentMethod: 'cash' | 'non_tunai';
  uangBayar: string;
  notes: string;
};

type SummaryState = {
  revenue: number;
  cost: number;
  profit: number;
};

type NewServiceForm = {
  name: string;
  color: string;
  prices: Record<MotorTypeId, string>;
  modal: Record<MotorTypeId, string>;
  linkedCategory: string;
};

type EditServiceForm = {
  id: string;
  name: string;
  color: string;
  prices: Record<MotorTypeId, string>;
  modal: Record<MotorTypeId, string>;
  linkedCategory: string;
};

// =====================
// HELPERS
// =====================

const todayString = (): string => new Date().toISOString().slice(0, 10);
const formatRp = (value: number): string => `Rp${Math.round(value || 0).toLocaleString('id-ID')}`;
const formatRupiah = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
};
const parseRupiah = (value: string): number => Number(value.replace(/\./g, '')) || 0;

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const formatTanggalID = (dateStr: unknown, timeStr?: unknown): string => {
  const raw = typeof dateStr === 'string' ? dateStr : '';
  if (!raw) return '-';
  const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
  if (isNaN(d.getTime())) return raw;
  const tanggal = `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
  if (timeStr) {
    const t = new Date(typeof timeStr === 'string' ? timeStr : String(timeStr));
    if (!isNaN(t.getTime())) {
      const jam = String(t.getHours()).padStart(2, '0');
      const menit = String(t.getMinutes()).padStart(2, '0');
      return `${tanggal} : jam ${jam}:${menit}`;
    }
  }
  return tanggal;
};

const emptyNewServiceForm = (): NewServiceForm => ({
  name: '',
  color: '#14B8A6',
  prices: { bebek: '', matic: '', sport: '' },
  modal: { bebek: '', matic: '', sport: '' },
  linkedCategory: '',
});

const emptyTransactionForm = (): TransactionForm => ({
  date: todayString(),
  customer: '',
  nomorPolisi: '',
  noHandphone: '',
  paymentMethod: 'cash',
  uangBayar: '',
  notes: '',
});

const emptyServiceItemForm = (serviceTypes: CustomServiceType[]): ServiceItemForm => ({
  serviceTypeId: serviceTypes[0]?.id ?? 'cat',
  motorType: 'bebek',
  selectedOliId: '',
  selectedLinkedProductId: '',
  discount: '',
});

// =====================
// COMPONENT
// =====================

export default function JasaCatManager() {
  const [jobs, setJobs] = useState<JasaCatJob[]>([]);
  const [txForm, setTxForm] = useState<TransactionForm>(emptyTransactionForm());
  const [svcForm, setSvcForm] = useState<ServiceItemForm>({ serviceTypeId: 'cat', motorType: 'bebek', selectedOliId: '', selectedLinkedProductId: '', discount: '' });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dateFrom, setDateFrom] = useState(todayString());
  const [dateTo, setDateTo] = useState(todayString());
  const [searchCustomer, setSearchCustomer] = useState('');
  const [oliProducts, setOliProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [serviceTypes, setServiceTypes] = useState<CustomServiceType[]>(DEFAULT_SERVICES);
  const [showServiceManager, setShowServiceManager] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState<NewServiceForm>(emptyNewServiceForm());
  const [newServiceError, setNewServiceError] = useState('');
  const [editServiceForm, setEditServiceForm] = useState<EditServiceForm | null>(null);
  const [editServiceError, setEditServiceError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [categoryList, setCategoryList] = useState<string[]>([]);

  const loadJobs = async () => { setJobs(await getJasaCatJobs()); };

  const loadServiceTypes = async () => {
    try {
      const data = await getServiceTypes();
      if (data.length > 0) setServiceTypes(data as CustomServiceType[]);
    } catch { /* noop */ }
  };

  const loadOliProducts = async () => {
    try {
      const all = await getProducts();
      setAllProducts(all);
      const oli = all.filter((p) => p.category.toLowerCase().includes('oli') && p.isAvailable !== false);
      setOliProducts(oli);
    } catch {
      setOliProducts([]);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategoryList(cats.map((c: { name: string }) => c.name));
    } catch { /* noop */ }
  };

  useEffect(() => {
    loadJobs();
    void loadOliProducts();
    void loadServiceTypes();
    void loadCategories();
    const refresh = () => loadJobs();
    window.addEventListener('storage', refresh);
    window.addEventListener('appDataChanged', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('appDataChanged', refresh);
    };
  }, []);

  const setTxField = <K extends keyof TransactionForm>(key: K, value: TransactionForm[K]) =>
    setTxForm((prev) => ({ ...prev, [key]: value }));

  const setSvcField = <K extends keyof ServiceItemForm>(key: K, value: ServiceItemForm[K]) =>
    setSvcForm((prev) => ({ ...prev, [key]: value }));

  // ── Derived dari svcForm ──
  const selectedService = useMemo(
    () => serviceTypes.find((s) => s.id === svcForm.serviceTypeId) ?? serviceTypes[0],
    [serviceTypes, svcForm.serviceTypeId]
  );
  const isOliService = selectedService?.id === 'oli';
  const isCatService = selectedService?.id === 'cat'; // hanya untuk penamaan jenis pada data
  // Service Cat kini diperlakukan sama seperti jenis service lainnya: bila
  // dihubungkan ke sebuah kategori inventori, produknya dipilih dari daftar.
  const isLinkedService = !isOliService && !!selectedService?.linkedCategory;

  // Seluruh produk pada kategori terkait, termasuk yang stoknya habis maupun
  // tidak aktif. Perbandingan nama kategori diabaikan huruf besar/kecilnya agar
  // selisih penulisan seperti "Spare Part" dan "spare part" tetap cocok.
  const linkedCategoryProducts = useMemo(() => {
    const cat = selectedService?.linkedCategory?.trim().toLowerCase();
    if (!cat) return [];
    return allProducts.filter((p: Product) => (p.category ?? '').trim().toLowerCase() === cat);
  }, [selectedService, allProducts]);

  /** Produk yang benar-benar dapat dipakai: aktif dan stoknya masih ada. */
  const isProductUsable = (p: Product) => p.isAvailable !== false && (p.stock ?? 0) > 0;

  // Produk dari linkedCategory yang siap dipilih (dipakai untuk validasi & harga)
  const linkedProducts = useMemo(
    () => linkedCategoryProducts.filter(isProductUsable),
    [linkedCategoryProducts]
  );

  const selectedLinkedProduct = useMemo(() =>
    linkedProducts.find((p: Product) => String(p.id) === String(svcForm.selectedLinkedProductId)) ?? null,
  [linkedProducts, svcForm.selectedLinkedProductId]);

  const selectedOliProduct = useMemo(() => {
    const found = oliProducts.find((p) => String(p.id) === String(svcForm.selectedOliId)) ?? null;
    return found;
  }, [oliProducts, svcForm.selectedOliId]);

  // Nama oli diambil dari produk yang dipilih
  const selectedOliName = selectedOliProduct?.name ?? '';

  const autoSellingPrice = useMemo(() => {
    const servicePrice = selectedService?.prices[svcForm.motorType] ?? 0;
    const oliProductPrice = (isOliService && selectedOliProduct) ? (selectedOliProduct.sellPrice ?? 0) : 0;
    const linkedProductPrice = (isLinkedService && selectedLinkedProduct) ? (selectedLinkedProduct.sellPrice ?? 0) : 0;
    return servicePrice + oliProductPrice + linkedProductPrice;
  }, [selectedService, svcForm.motorType, isOliService, selectedOliProduct, isLinkedService, selectedLinkedProduct]);

  const autoModal = useMemo(() => {
    const serviceModal = selectedService?.modal[svcForm.motorType] ?? 0;
    const oliProductModal = (isOliService && selectedOliProduct) ? (selectedOliProduct.modalPrice ?? 0) : 0;
    const linkedProductModal = (isLinkedService && selectedLinkedProduct) ? (selectedLinkedProduct.modalPrice ?? 0) : 0;
    return serviceModal + oliProductModal + linkedProductModal;
  }, [selectedService, svcForm.motorType, isOliService, selectedOliProduct, isLinkedService, selectedLinkedProduct]);

  const discountPct = Math.min(100, Math.max(0, Number(svcForm.discount) || 0));
  const finalSellingPrice = Math.round(autoSellingPrice * (1 - discountPct / 100));

  // ── Cart totals ──
  const cartTotal = useMemo(() => cart.reduce((s, item) => s + item.sellingPrice, 0), [cart]);
  const cartModal = useMemo(() => cart.reduce((s, item) => s + item.modalPrice, 0), [cart]);
  const cartProfit = useMemo(() => cart.reduce((s, item) => s + item.profit, 0), [cart]);

  const uangBayarNum = txForm.paymentMethod === 'cash' ? parseRupiah(txForm.uangBayar) : 0;
  const kembalian = txForm.paymentMethod === 'cash' ? Math.max(0, uangBayarNum - cartTotal) : 0;

  // ── Tambah service ke cart ──
  const handleAddToCart = () => {
    if (isOliService && !selectedOliProduct) { alert('Pilih produk oli terlebih dahulu!'); return; }
    if (isLinkedService && !selectedLinkedProduct) { alert(`Pilih produk ${selectedService?.linkedCategory} terlebih dahulu!`); return; }
    if (autoSellingPrice === 0 && !isOliService && !isLinkedService) { alert('Harga jual untuk jenis motor ini belum diatur. Silakan atur di Kelola Jenis Service.'); return; }
    const profit = finalSellingPrice - autoModal;
    const item: CartItem = {
      cartId: `cart_${Date.now()}_${Math.random()}`,
      serviceTypeId: svcForm.serviceTypeId,
      serviceTypeName: selectedService?.name ?? svcForm.serviceTypeId,
      serviceType: isOliService ? 'oli' : isCatService ? 'cat' : 'custom',
      serviceColor: selectedService?.color,
      motorType: svcForm.motorType,
      oliProductId: isOliService ? svcForm.selectedOliId || undefined : isLinkedService ? svcForm.selectedLinkedProductId || undefined : undefined,
      oliProductName: isOliService ? selectedOliName : isLinkedService && selectedLinkedProduct ? selectedLinkedProduct.name : undefined,
      discount: discountPct,
      sellingPrice: finalSellingPrice,
      basePrice: autoSellingPrice,
      modalPrice: autoModal,
      profit,
    };
    setCart((prev) => [...prev, item]);
    setSvcForm((prev) => ({ ...prev, serviceTypeId: serviceTypes[0]?.id ?? 'cat', selectedOliId: '', selectedLinkedProductId: '', discount: '' }));
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  // ── Submit ke konfirmasi ──
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cart.length === 0) { alert('Tambahkan minimal 1 service ke keranjang!'); return; }
    const phoneError = getPhoneError(txForm.noHandphone);
    if (phoneError) { alert(phoneError); return; }
    const plateError = getPlateError(txForm.nomorPolisi);
    if (plateError) { alert(plateError); return; }
    if (txForm.paymentMethod === 'cash') {
      const cashError = getCashError(uangBayarNum, cartTotal);
      if (cashError) {
        alert(`${cashError}. Total: ${formatRp(cartTotal)}, Dibayar: ${formatRp(uangBayarNum)}`);
        return;
      }
    }
    setShowConfirm(true);
  };

  // ── Simpan transaksi (SATU job untuk semua cart items) ──
  const handleConfirmSave = async () => {
    // Kurangi stok produk terkait (oli & linkedCategory) untuk semua item di cart
    for (const item of cart) {
      // Oli: kurangi stok produk oli
      if (item.serviceType === 'oli' && item.oliProductId) {
        try { await updateProductStock(item.oliProductId, -1); }
        catch { alert(`Gagal mengurangi stok oli: ${item.oliProductName}`); return; }
      }
      // linkedCategory (custom service seperti Lampu, dll): kurangi stok produk terkait
      if (item.serviceType === 'custom' && item.oliProductId) {
        try { await updateProductStock(item.oliProductId, -1); }
        catch { alert(`Gagal mengurangi stok produk: ${item.oliProductName}`); return; }
      }
    }

    // Simpan SATU job dengan semua items di dalamnya
    await addJasaCatJob({
      date: txForm.date,
      customer: txForm.customer.trim(),
      nomorPolisi: txForm.nomorPolisi.trim().toUpperCase(),
      noHandphone: txForm.noHandphone.trim(),
      notes: txForm.notes.trim(),
      paymentMethod: txForm.paymentMethod,
      uangBayar: uangBayarNum,
      kembalian,
      // Ringkasan total
      sellingPrice: cartTotal,
      totalCost: cartModal,
      profit: cartProfit,
      // Items detail (array)
      items: cart.map((item) => ({
        cartId: item.cartId,
        serviceTypeId: item.serviceTypeId,
        serviceTypeName: item.serviceTypeName,
        serviceType: item.serviceType,
        serviceColor: item.serviceColor,
        motorType: item.motorType,
        catColor: item.catColor,
        oliProductId: item.oliProductId,
        oliProductName: item.oliProductName,
        discount: item.discount,
        sellingPrice: item.sellingPrice,
        basePrice: item.basePrice,
        modalPrice: item.modalPrice,
        profit: item.profit,
      })),
    } as unknown as JasaCatJob);

    await loadJobs();
    void loadOliProducts();
    setTxForm(emptyTransactionForm());
    setSvcForm(emptyServiceItemForm(serviceTypes));
    setCart([]);
    setShowConfirm(false);
    window.dispatchEvent(new Event('appDataChanged'));
  };

  const removeJob = async (id: string) => {
    if (!window.confirm('Hapus transaksi ini? Stok produk terkait akan dikembalikan.')) return;

    // Cari job yang akan dihapus untuk kembalikan stok
    const jobToDelete = jobs.find((j) => String(j.id) === String(id));
    if (jobToDelete) {
      const jr = jobToDelete as Record<string, unknown>;
      const itemsArr = Array.isArray(jr.items) ? jr.items as Record<string, unknown>[] : null;
      if (itemsArr) {
        for (const item of itemsArr) {
          const svcType = String(item.serviceType ?? '');
          const productId = String(item.oliProductId ?? '');
          // Kembalikan stok oli dan linkedCategory (custom)
          if ((svcType === 'oli' || svcType === 'custom') && productId) {
            try { await updateProductStock(productId, +1); }
            catch { console.warn('Gagal kembalikan stok produk:', item.oliProductName); }
          }
        }
      }
    }

    await deleteJasaCatJob(id);
    await loadJobs();
    window.dispatchEvent(new Event('appDataChanged'));
  };

  const filteredJobs = useMemo(() => {
    const q = searchCustomer.trim().toLowerCase();
    return jobs.filter((job) => {
      const jobDate = String(job.date ?? '').slice(0, 10);
      const matchFrom = !dateFrom || jobDate >= dateFrom;
      const matchTo = !dateTo || jobDate <= dateTo;
      const matchCustomer = !q || String(job.customer ?? '').toLowerCase().includes(q);
      return matchFrom && matchTo && matchCustomer;
    });
  }, [jobs, dateFrom, dateTo, searchCustomer]);

  const summary = useMemo<SummaryState>(() =>
    filteredJobs.reduce((acc, job) => {
      acc.revenue += Number(job.sellingPrice ?? 0);
      acc.cost += Number(job.totalCost ?? 0);
      acc.profit += Number(job.profit ?? 0);
      return acc;
    }, { revenue: 0, cost: 0, profit: 0 }),
  [filteredJobs]);

  // ── Kelola Service Types ──
  const handleAddService = async () => {
    setNewServiceError('');
    if (!newServiceForm.name.trim()) { setNewServiceError('Nama service wajib diisi'); return; }
    if (serviceTypes.some((s) => s.name.toLowerCase() === newServiceForm.name.trim().toLowerCase())) {
      setNewServiceError('Nama service sudah ada'); return;
    }
    const globalUsed = getAllUsedColors(undefined, 'service');
    if (globalUsed.includes(newServiceForm.color.toLowerCase())) {
      setNewServiceError('Warna sudah digunakan, gunakan warna lain'); return;
    }
    const newService: CustomServiceType = {
      id: `custom_${Date.now()}`,
      name: newServiceForm.name.trim(),
      color: newServiceForm.color,
      prices: {
        bebek: parseRupiah(newServiceForm.prices.bebek),
        matic: parseRupiah(newServiceForm.prices.matic),
        sport: parseRupiah(newServiceForm.prices.sport),
      },
      modal: {
        bebek: parseRupiah(newServiceForm.modal.bebek),
        matic: parseRupiah(newServiceForm.modal.matic),
        sport: parseRupiah(newServiceForm.modal.sport),
      },
      linkedCategory: newServiceForm.linkedCategory || undefined,
    };
    try {
      await addServiceType(newService);
      await loadServiceTypes();
    } catch { setNewServiceError('Gagal menyimpan, coba lagi'); return; }
    setNewServiceForm(emptyNewServiceForm());
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Hapus jenis service ini?')) return;
    try {
      await deleteServiceType(id);
      await loadServiceTypes();
    } catch { /* noop */ }
    if (svcForm.serviceTypeId === id) {
      const fallback = serviceTypes.find((s) => s.id !== id);
      setSvcField('serviceTypeId', fallback?.id ?? '');
    }
  };

  const handleStartEdit = (svc: CustomServiceType) => {
    setEditServiceError('');
    setEditServiceForm({
      id: svc.id,
      name: svc.name,
      color: svc.color ?? '#14B8A6',
      prices: {
        bebek: svc.prices.bebek ? svc.prices.bebek.toLocaleString('id-ID') : '',
        matic: svc.prices.matic ? svc.prices.matic.toLocaleString('id-ID') : '',
        sport: svc.prices.sport ? svc.prices.sport.toLocaleString('id-ID') : '',
      },
      modal: {
        bebek: svc.modal.bebek ? svc.modal.bebek.toLocaleString('id-ID') : '',
        matic: svc.modal.matic ? svc.modal.matic.toLocaleString('id-ID') : '',
        sport: svc.modal.sport ? svc.modal.sport.toLocaleString('id-ID') : '',
      },
      linkedCategory: svc.linkedCategory ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editServiceForm) return;
    setEditServiceError('');
    if (!editServiceForm.name.trim()) { setEditServiceError('Nama service wajib diisi'); return; }
    if (serviceTypes.some((s) => s.id !== editServiceForm.id && s.name.toLowerCase() === editServiceForm.name.trim().toLowerCase())) {
      setEditServiceError('Nama service sudah ada'); return;
    }
    const updated = {
      name: editServiceForm.name.trim(),
      color: editServiceForm.color,
      prices: {
        bebek: parseRupiah(editServiceForm.prices.bebek),
        matic: parseRupiah(editServiceForm.prices.matic),
        sport: parseRupiah(editServiceForm.prices.sport),
      },
      modal: {
        bebek: parseRupiah(editServiceForm.modal.bebek),
        matic: parseRupiah(editServiceForm.modal.matic),
        sport: parseRupiah(editServiceForm.modal.sport),
      },
      linkedCategory: editServiceForm.linkedCategory || undefined,
    };
    try {
      await updateServiceType(editServiceForm.id, updated);
      await loadServiceTypes();
    } catch { setEditServiceError('Gagal menyimpan, coba lagi'); return; }
    setEditServiceForm(null);
    setEditServiceError('');
  };

  // =====================
  // RENDER
  // =====================

  // =====================
  // RENDER
  // =====================

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-1 rounded-full bg-teal-500" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Jasa Service Motor</h2>
            </div>
            <p className="text-sm text-slate-500 ml-4 pl-3">Kelola transaksi servis cat dan ganti oli</p>
          </div>
          <button
            type="button"
            onClick={() => setShowServiceManager((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm border ${
              showServiceManager
                ? 'bg-teal-600 text-white border-teal-600 shadow-teal-200'
                : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:text-teal-600'
            }`}
          >
            <Settings className="h-4 w-4" />
            Kelola Jenis Service
            {showServiceManager ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* ═══ PANEL KELOLA JENIS SERVICE ═══ */}
        {showServiceManager && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-semibold">Kelola Jenis Service</h3>
                <span className="rounded-full bg-teal-500/20 text-teal-300 text-xs font-medium px-2.5 py-0.5">{serviceTypes.length} service</span>
              </div>
              <button type="button" onClick={() => setShowServiceManager(false)} className="text-slate-400 hover:text-white transition rounded-lg p-1 hover:bg-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Service list */}
              <div className="grid grid-cols-1 gap-3">
                {serviceTypes.map((svc) => {
                  const isEditing = editServiceForm?.id === svc.id;
                  return (
                    <div key={svc.id} className={`rounded-xl border transition-all ${isEditing ? 'border-teal-400 shadow-md shadow-teal-50' : 'border-slate-200 hover:border-slate-300'} bg-white overflow-hidden`}>
                      {/* Service header row */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-3.5 w-3.5 rounded-full ring-2 ring-offset-1 ring-white shadow-sm" style={{ backgroundColor: getServiceColor(svc.name, serviceTypes) }} />
                          <span className="font-semibold text-slate-800">{svc.name}</span>
                          {svc.linkedCategory && (
                            <span className="text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5">🔗 {svc.linkedCategory}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={handleSaveEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 transition">
                                <Check className="h-3 w-3" /> Simpan
                              </button>
                              <button type="button" onClick={() => { setEditServiceForm(null); setEditServiceError(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => handleStartEdit(svc)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteService(svc.id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-red-500 hover:border-red-300 transition" title="Hapus">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price preview (when not editing) */}
                      {!isEditing && (
                        <div className="px-4 pb-3">
                          <div className="grid grid-cols-3 gap-2">
                            {(['bebek', 'matic', 'sport'] as MotorTypeId[]).map((mt) => (
                              <div key={mt} className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs">
                                <div className="font-semibold text-slate-600 uppercase tracking-wide text-[10px] mb-1">{MOTOR_LABELS[mt]}</div>
                                <div className="text-slate-800 font-medium">Jual: {formatRp(svc.prices[mt])}</div>
                                <div className="text-slate-500">Modal: {formatRp(svc.modal[mt])}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Edit form */}
                      {isEditing && editServiceForm && (
                        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Nama Service</label>
                              <input value={editServiceForm.name} onChange={(e) => setEditServiceForm((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Warna Label</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={editServiceForm.color} onChange={(e) => setEditServiceForm((prev) => prev ? { ...prev, color: e.target.value } : prev)}
                                  className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 p-0.5" />
                                <span className="text-xs font-mono text-slate-500 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">{editServiceForm.color}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              Terhubung dengan Kategori Produk <span className="text-slate-400 font-normal normal-case">(opsional)</span>
                            </label>
                            <select value={editServiceForm.linkedCategory}
                              onChange={(e) => setEditServiceForm((prev) => prev ? { ...prev, linkedCategory: e.target.value } : prev)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 bg-white transition">
                              <option value="">— Tidak terhubung —</option>
                              {categoryList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            {editServiceForm.linkedCategory && (
                              <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">
                                <span>✓</span> Terhubung dengan kategori <strong>{editServiceForm.linkedCategory}</strong> di inventori
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {(['bebek', 'matic', 'sport'] as MotorTypeId[]).map((motorType) => (
                              <div key={motorType} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{MOTOR_LABELS[motorType]}</p>
                                <div>
                                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Harga Jual (Rp)</label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                    <input type="text" inputMode="numeric" value={editServiceForm.prices[motorType]}
                                      onChange={(e) => setEditServiceForm((prev) => prev ? { ...prev, prices: { ...prev.prices, [motorType]: formatRupiah(e.target.value) } } : prev)}
                                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-2 text-xs outline-none focus:border-teal-400" placeholder="0" />
                                  </div>
                                </div>
                                <div>
                                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Modal (Rp)</label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                    <input type="text" inputMode="numeric" value={editServiceForm.modal[motorType]}
                                      onChange={(e) => setEditServiceForm((prev) => prev ? { ...prev, modal: { ...prev.modal, [motorType]: formatRupiah(e.target.value) } } : prev)}
                                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-2 text-xs outline-none focus:border-teal-400" placeholder="0" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {editServiceError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editServiceError}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tambah service baru */}
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 space-y-4 hover:border-teal-300 transition-colors">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-teal-500" />
                  <h4 className="font-semibold text-slate-700 text-sm">Tambah Jenis Service Baru</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Nama Service</label>
                    <input value={newServiceForm.name} onChange={(e) => setNewServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition" placeholder="Contoh: Salon Motor" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Warna Label</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newServiceForm.color} onChange={(e) => setNewServiceForm((prev) => ({ ...prev, color: e.target.value }))}
                        className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 p-0.5" />
                      <span className="text-xs font-mono text-slate-500 bg-white rounded-lg px-2 py-1 border border-slate-200">{newServiceForm.color}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Terhubung dengan Kategori Produk <span className="text-slate-400 font-normal normal-case">(opsional)</span>
                  </label>
                  <select value={newServiceForm.linkedCategory} onChange={(e) => setNewServiceForm((prev) => ({ ...prev, linkedCategory: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition">
                    <option value="">— Tidak terhubung —</option>
                    {categoryList.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {newServiceForm.linkedCategory && (
                    <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">
                      <span>✓</span> Service ini terhubung dengan kategori <strong>{newServiceForm.linkedCategory}</strong> di inventori
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['bebek', 'matic', 'sport'] as MotorTypeId[]).map((motorType) => (
                    <div key={motorType} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{MOTOR_LABELS[motorType]}</p>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">Harga Jual (Rp)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                          <input type="text" inputMode="numeric" value={newServiceForm.prices[motorType]}
                            onChange={(e) => setNewServiceForm((prev) => ({ ...prev, prices: { ...prev.prices, [motorType]: formatRupiah(e.target.value) } }))}
                            className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-2 text-xs outline-none focus:border-teal-400" placeholder="0" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">Modal (Rp)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                          <input type="text" inputMode="numeric" value={newServiceForm.modal[motorType]}
                            onChange={(e) => setNewServiceForm((prev) => ({ ...prev, modal: { ...prev.modal, [motorType]: formatRupiah(e.target.value) } }))}
                            className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-2 text-xs outline-none focus:border-teal-400" placeholder="0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {newServiceError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{newServiceError}</p>}
                <button type="button" onClick={handleAddService}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition shadow-sm">
                  <Plus className="h-4 w-4" /> Simpan Jenis Service
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SUMMARY CARDS ═══ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[40px]" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Omzet</p>
            <p className="text-2xl font-bold text-blue-600">{formatRp(summary.revenue)}</p>
            {(dateFrom || dateTo) && <p className="text-xs text-slate-400 mt-1">{filteredJobs.length} transaksi</p>}
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-[40px]" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Modal</p>
            <p className="text-2xl font-bold text-slate-800">{formatRp(summary.cost)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] ${summary.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`} />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Keuntungan</p>
            <p className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(summary.profit)}</p>
          </div>
        </div>

        {/* ═══ DATE FILTER ═══ */}
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama customer"
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 text-slate-700 transition"
              />
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Calendar className="h-4 w-4 text-teal-500" />
              Filter Tanggal
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 text-slate-700 transition" />
              <span className="text-slate-300 font-medium">—</span>
              <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 text-slate-700 transition" />
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition whitespace-nowrap">
                Semua
              </button>
            </div>
            {(dateFrom || dateTo) && (
              <span className="text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-3 py-1">
                {filteredJobs.length} dari {jobs.length} transaksi
              </span>
            )}
          </div>
        </div>

        {/* ═══ FORM TRANSAKSI — STEP LAYOUT ═══ */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Step indicator */}
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {['Info Customer', 'Tambah Service', 'Keranjang', 'Pembayaran'].map((label, idx) => (
              <React.Fragment key={idx}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  idx === 0 ? 'bg-teal-500 text-white shadow-sm' :
                  idx === 1 ? 'bg-teal-500 text-white shadow-sm' :
                  idx === 2 ? (cart.length > 0 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400') :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    idx === 0 ? 'bg-white text-teal-600' :
                    idx === 1 ? 'bg-white text-teal-600' :
                    idx === 2 ? (cart.length > 0 ? 'bg-white text-emerald-600' : 'bg-slate-200 text-slate-400') :
                    'bg-slate-200 text-slate-400'
                  }`}>{idx + 1}</span>
                  {label}
                  {idx === 2 && cart.length > 0 && <span className="rounded-full bg-white/30 px-1.5 text-[10px]">{cart.length}</span>}
                </div>
                {idx < 3 && <div className="w-6 h-px bg-slate-200 shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* ── Step 1: Info Customer ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
              <span className="h-7 w-7 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center">1</span>
              <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Info Customer</h5>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">No. Handphone <span className="text-red-500">*</span></label>
                  <input type="tel" inputMode="numeric" value={txForm.noHandphone} onChange={(e) => setTxField('noHandphone', sanitizePhone(e.target.value))}
                    maxLength={PHONE_MAX_LENGTH}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 transition ${
                      getPhoneError(txForm.noHandphone) ? 'border-red-200 focus:border-red-400 focus:ring-red-50 bg-red-50/30' : 'border-slate-200 focus:border-teal-400 focus:ring-teal-50'
                    }`}
                    placeholder="Wajib diisi (contoh: 08123456789)" />
                  {getPhoneError(txForm.noHandphone) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><span>⚠</span> {getPhoneError(txForm.noHandphone)}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Nomor Polisi</label>
                  <input value={txForm.nomorPolisi} onChange={(e) => setTxField('nomorPolisi', sanitizePlate(e.target.value))}
                    maxLength={PLATE_MAX_INPUT}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 transition font-mono tracking-wider uppercase ${
                      getPlateError(txForm.nomorPolisi)
                        ? 'border-red-200 focus:border-red-400 focus:ring-red-50 bg-red-50/30'
                        : 'border-slate-200 focus:border-teal-400 focus:ring-teal-50'
                    }`}
                    placeholder="Contoh: B 1234 XY" />
                  {getPlateError(txForm.nomorPolisi) && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><span>⚠</span> {getPlateError(txForm.nomorPolisi)}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Nama Customer <span className="text-slate-400 font-normal normal-case">(opsional)</span>
                  </label>
                  <input value={txForm.customer} onChange={(e) => setTxField('customer', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition"
                    placeholder="Opsional (contoh: Udin)" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 2: Tambah Service ── */}
          {/* Tanpa overflow-hidden: dropdown produk harus bisa menjulur keluar kartu.
              Sudut atas dibulatkan langsung di header agar tampilannya tetap sama. */}
          <div className="rounded-2xl border border-teal-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-teal-100 bg-teal-50/60 rounded-t-2xl">
              <span className="h-7 w-7 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center">2</span>
              <h5 className="text-sm font-bold text-teal-800 uppercase tracking-wide">Tambah Service</h5>
            </div>
            <div className="p-5 space-y-5">
              {/* Motor + Service type row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Jenis Motor</label>
                  <div className="flex gap-2">
                    {(['bebek', 'matic', 'sport'] as MotorTypeId[]).map((mt) => (
                      <button key={mt} type="button" onClick={() => setSvcField('motorType', mt)}
                        className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                          svcForm.motorType === mt
                            ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600'
                        }`}>
                        {MOTOR_LABELS[mt]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Jenis Service</label>
                  <select value={svcForm.serviceTypeId} onChange={(e) => setSvcField('serviceTypeId', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition">
                    {serviceTypes.map((svc) => (
                      <option key={svc.id} value={svc.id}>{svc.name}</option>
                    ))}
                  </select>
                </div>
              </div>


              {/* Pilih Produk Oli */}
              {isOliService && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Pilih Produk Oli <span className="text-red-500">*</span></label>
                  {oliProducts.length === 0 ? (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                      Tidak ada produk oli di inventory. Tambahkan produk dengan kategori mengandung kata "oli".
                    </div>
                  ) : (
                    <SearchableSelect
                      value={svcForm.selectedOliId}
                      onChange={(val) => setSvcField('selectedOliId', val)}
                      placeholder="-- Pilih produk oli --"
                      options={oliProducts.map((p) => {
                        const habis = (p.stock ?? 0) <= 0;
                        return {
                          value: String(p.id),
                          label: `${p.name}${p.stock !== undefined ? ` (Stok: ${p.stock})` : ''}`,
                          disabled: habis,
                          note: habis ? 'stok habis' : undefined,
                        };
                      })}
                    />
                  )}
                </div>
              )}

              {/* Pilih Produk Linked */}
              {isLinkedService && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Pilih Produk <span className="text-teal-600">{selectedService?.linkedCategory}</span> <span className="text-red-500">*</span>
                  </label>
                  {linkedCategoryProducts.length === 0 ? (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                      Tidak ada produk dengan kategori <strong>{selectedService?.linkedCategory}</strong> di inventori.
                    </div>
                  ) : (
                    <>
                    <SearchableSelect
                      value={svcForm.selectedLinkedProductId}
                      onChange={(val) => setSvcField('selectedLinkedProductId', val)}
                      placeholder={`-- Pilih produk ${selectedService?.linkedCategory ?? ''} --`}
                      options={linkedCategoryProducts.map((p) => {
                        const habis = (p.stock ?? 0) <= 0;
                        const nonaktif = p.isAvailable === false;
                        return {
                          value: String(p.id),
                          label: `${p.name}${p.stock !== undefined ? ` (Stok: ${p.stock})` : ''} — Rp${(p.sellPrice ?? 0).toLocaleString('id-ID')}`,
                          disabled: habis || nonaktif,
                          note: nonaktif ? 'tidak aktif' : habis ? 'stok habis' : undefined,
                        };
                      })}
                    />
                    {linkedProducts.length < linkedCategoryProducts.length && (
                      <p className="mt-1 text-xs text-slate-400">
                        {linkedProducts.length} dari {linkedCategoryProducts.length} produk dapat dipilih; sisanya stok habis atau tidak aktif.
                      </p>
                    )}
                    </>
                  )}
                  {selectedLinkedProduct && (
                    <p className="mt-1.5 text-xs text-teal-600 flex items-center gap-1">✓ Harga produk Rp{(selectedLinkedProduct.sellPrice ?? 0).toLocaleString('id-ID')} ditambahkan ke total</p>
                  )}
                </div>
              )}

              {/* Diskon + Harga Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Diskon</label>
                  <div className="flex items-center justify-end gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <input type="text" inputMode="numeric"
                      value={svcForm.discount === '' || svcForm.discount === '0' ? '' : svcForm.discount}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        const num = Math.min(100, Math.max(0, parseInt(digits, 10) || 0));
                        setSvcField('discount', num === 0 ? '' : String(num));
                      }}
                      className="bg-transparent outline-none border-none p-0"
                      style={{ width: `${Math.max((svcForm.discount || '0').length, 1)}ch` }}
                      placeholder="0" />
                    <span className="text-gray-500 font-medium shrink-0">%</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Harga Jual <span className="text-slate-400 font-normal normal-case">(otomatis)</span>
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="text-xs text-slate-400 mb-1 space-y-0.5">
                      {isOliService
                        ? selectedOliProduct
                          ? <>
                              <div>Jasa: {formatRp(selectedService?.prices[svcForm.motorType] ?? 0)}</div>
                              <div>Produk: {formatRp(selectedOliProduct.sellPrice ?? 0)}</div>
                            </>
                          : <span>Pilih produk oli</span>
                        : isLinkedService
                          ? selectedLinkedProduct
                            ? <>
                                <div>Jasa: {formatRp(selectedService?.prices[svcForm.motorType] ?? 0)}</div>
                                <div>Produk ({selectedService?.linkedCategory}): {formatRp(selectedLinkedProduct.sellPrice ?? 0)}</div>
                              </>
                            : <span>Pilih produk {selectedService?.linkedCategory}</span>
                          : <span>{MOTOR_LABELS[svcForm.motorType]}: {formatRp(autoSellingPrice)}</span>
                      }
                    </div>
                    {discountPct > 0 && <div className="text-xs text-slate-400 line-through">{formatRp(autoSellingPrice)}</div>}
                    <div className="text-xl font-bold text-emerald-600">{formatRp(finalSellingPrice)}</div>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleAddToCart}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 transition shadow-sm">
                <Plus className="h-4 w-4" /> Tambah ke Keranjang
              </button>
            </div>
          </div>

          {/* ── Step 3: Keranjang ── */}
          {cart.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-100 bg-emerald-50">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <ShoppingCart className="h-4 w-4 text-emerald-700" />
                  <h5 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Keranjang Service</h5>
                  <span className="rounded-full bg-emerald-500 text-white text-xs font-bold px-2 py-0.5">{cart.length}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-emerald-600 font-medium">Total</div>
                  <div className="text-lg font-bold text-emerald-700">{formatRp(cartTotal)}</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {cart.map((item, idx) => (
                  <div key={item.cartId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition group">
                    <span className="text-xs font-bold text-slate-300 w-4 shrink-0">{idx + 1}</span>
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.serviceColor ?? getServiceColor(item.serviceTypeName, serviceTypes) }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{item.serviceTypeName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">{MOTOR_LABELS[item.motorType]}</span>
                        {item.catColor && <span className="text-xs text-slate-500">{CAT_COLOR_LABELS[item.catColor]}</span>}
                        {item.oliProductName && <span className="text-xs text-slate-500">{item.oliProductName}</span>}
                        {item.discount > 0 && <span className="text-xs text-slate-500 font-semibold bg-slate-100 rounded-md px-1.5 py-0.5">-{item.discount}%</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {item.discount > 0 && <div className="text-xs text-slate-400 line-through">{formatRp(item.basePrice)}</div>}
                      <div className="font-bold text-slate-900">{formatRp(item.sellingPrice)}</div>
                    </div>
                    <button type="button" onClick={() => handleRemoveFromCart(item.cartId)}
                      className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Cart summary */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-center">
                    <div className="text-slate-500 mb-0.5">Total Modal</div>
                    <div className="font-bold text-slate-700">{formatRp(cartModal)}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-center">
                    <div className="text-slate-500 mb-0.5">Total Harga Jual</div>
                    <div className="font-bold text-emerald-600">{formatRp(cartTotal)}</div>
                  </div>
                  <div className={`rounded-lg border p-2.5 text-center ${cartProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-slate-500 mb-0.5">Estimasi Keuntungan</div>
                    <div className={`font-bold ${cartProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatRp(cartProfit)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Pembayaran ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
              <span className="h-7 w-7 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center justify-center">4</span>
              <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Pembayaran</h5>
            </div>
            <div className="p-5 space-y-4">
              {/* Payment method toggle */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Metode Pembayaran</label>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                  {(['cash', 'non_tunai'] as const).map((method) => (
                    <button key={method} type="button" onClick={() => setTxField('paymentMethod', method)}
                      className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                        txForm.paymentMethod === method
                          ? 'bg-white shadow-sm text-slate-900 border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {method === 'cash' ? 'Tunai' : 'Non Tunai'}
                    </button>
                  ))}
                </div>
              </div>

              {txForm.paymentMethod === 'cash' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3 w-1/2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Uang Dibayar (Rp) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center justify-end gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="text-sm font-medium text-gray-500 shrink-0">Rp</span>
                      <input type="text" inputMode="numeric" value={txForm.uangBayar}
                        onChange={(e) => { const d = clampCash(e.target.value, cartTotal); setTxField('uangBayar', d ? Number(d).toLocaleString('id-ID') : ''); }}
                        className="bg-transparent outline-none border-none p-0"
                        style={{ width: `${Math.max((txForm.uangBayar || '0').length, 1)}ch` }}
                        placeholder="0" />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Maksimal {formatRp(cashLimitFor(cartTotal))}</p>
                  </div>
                  {uangBayarNum > 0 && (
                    uangBayarNum >= cartTotal ? (
                      <div className="rounded-lg bg-green-100 px-3 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-800">💰 Kembalian</div>
                          <div className="text-xs text-green-600 mt-0.5">Total: {formatRp(cartTotal)}</div>
                        </div>
                        <span className="text-lg font-bold text-green-700">{formatRp(kembalian)}</span>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-red-100 px-3 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-red-800">⚠️ Kurang</div>
                          <div className="text-xs text-red-500 mt-0.5">Total: {formatRp(cartTotal)}</div>
                        </div>
                        <span className="text-lg font-bold text-red-700">{formatRp(Math.abs(uangBayarNum - cartTotal))}</span>
                      </div>
                    )
                  )}
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Total yang harus dibayar:</span>
                    <span className="font-semibold text-gray-900">{formatRp(cartTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="flex flex-wrap gap-3">
            <button type="submit"
              disabled={cart.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-white font-bold text-sm hover:bg-slate-800 transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
              Lanjut ke Konfirmasi →
            </button>
            {cart.length > 0 && (
              <button type="button" onClick={() => setCart([])}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-slate-600 font-medium text-sm hover:bg-slate-50 transition">
                Kosongkan Keranjang
              </button>
            )}
          </div>
        </form>

        {/* ═══ DAFTAR TRANSAKSI ═══ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Daftar Transaksi Service</h4>
            <span className="text-xs text-slate-400 bg-slate-50 rounded-full px-3 py-1 border border-slate-100">{filteredJobs.length} transaksi</span>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">No. HP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">No. Polisi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Jenis Motor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Diskon</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Harga Modal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Harga Jual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Keuntungan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Pembayaran</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Uang Bayar</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Kembalian</th>
                  <th className="px-4 py-3 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ShoppingCart className="h-8 w-8 opacity-30" />
                        <span className="text-sm">Belum ada transaksi service.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const jr = job as Record<string, unknown>;
                    const pm = String(jr.paymentMethod ?? 'cash');
                    const uangBayarVal = Number(jr.uangBayar ?? 0);
                    const kembalianVal = pm === 'cash' ? Math.max(0, uangBayarVal - Number(jr.sellingPrice ?? 0)) : 0;
                    const itemsArr = Array.isArray(jr.items) ? jr.items as CartItem[] : null;
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/60 transition group">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">{formatTanggalID(job.date, job.createdAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-mono">{String(jr.noHandphone ?? '') || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {job.nomorPolisi ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                               {String(job.nomorPolisi)}
                            </span>
                          ) : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{job.customer || <span className="text-slate-300 text-xs">-</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          {itemsArr ? (
                            <div className="space-y-0.5">
                              {[...new Set(itemsArr.map((i) => String(i.motorType ?? '')).filter(Boolean))].map((mt, idx) => (
                                <div key={idx}>{MOTOR_LABELS[mt as MotorTypeId] ?? mt}</div>
                              ))}
                            </div>
                          ) : (
                            MOTOR_LABELS[job.motorType as MotorTypeId] ?? job.motorType ?? '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {itemsArr ? (
                            <div className="space-y-1">
                              {itemsArr.map((item, idx) => {
                                const svcColor = getServiceColor(item.serviceType === 'oli' ? 'Ganti Oli' : item.serviceTypeName, serviceTypes);
                                const catColorLabel = item.catColor ? CAT_COLOR_LABELS[item.catColor] : '';
                                const oliName = item.oliProductName ?? '';
                                return (
                                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white whitespace-nowrap" style={{ backgroundColor: svcColor }}>
                                      {item.serviceTypeName}
                                    </span>
                                    {catColorLabel && <span className="text-slate-400 whitespace-nowrap">{catColorLabel}</span>}
                                    {oliName && <span className="text-slate-400 whitespace-nowrap">{oliName}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            (() => {
                              const svcType = String(jr.serviceType ?? 'cat');
                              const catColorKey = String(jr.catColor ?? '');
                              const catColorLabel = catColorKey ? (CAT_COLOR_LABELS[catColorKey as CatColor] ?? catColorKey) : '';
                              const oliName = String(jr.oliProductName ?? '');
                              const svcName = svcType === 'oli' ? 'Ganti Oli' : String(jr.serviceTypeName ?? 'Service Cat');
                              const svcColor = getServiceColor(svcName, serviceTypes);
                              return (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white whitespace-nowrap" style={{ backgroundColor: svcColor }}>
                                    {svcName}
                                  </span>
                                  {catColorLabel && <span className="text-slate-400 whitespace-nowrap">{catColorLabel}</span>}
                                  {oliName && <span className="text-slate-400 whitespace-nowrap">{oliName}</span>}
                                </div>
                              );
                            })()
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                          {itemsArr
                            ? itemsArr.some((i) => i.discount > 0)
                              ? <>{itemsArr.filter((i) => i.discount > 0).map((i, idx) => <div key={idx} className="text-slate-600 font-medium">{i.serviceTypeName}: {i.discount}%</div>)}</>
                              : <span className="text-slate-200">-</span>
                            : (Number(jr.discount ?? 0) > 0 ? <span className="text-slate-600 font-medium">{String(jr.discount)}%</span> : <span className="text-slate-200">-</span>)
                          }
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-slate-500">{formatRp(Number(jr.totalCost ?? 0))}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-slate-900">{formatRp(Number(jr.sellingPrice ?? 0))}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-right text-sm font-bold ${Number(jr.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatRp(Number(jr.profit ?? 0))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${pm === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                            {pm === 'cash' ? 'Tunai' : 'Non Tunai'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-slate-600">
                          {pm === 'cash' && uangBayarVal > 0 ? formatRp(uangBayarVal) : <span className="text-slate-200">-</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-semibold">
                          {pm === 'cash' && kembalianVal > 0 ? <span className="text-emerald-600">{formatRp(kembalianVal)}</span> : <span className="text-slate-200">-</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button type="button" onClick={() => void removeJob(job.id)}
                            className="text-slate-400 hover:text-red-500 transition">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ═══ MODAL KONFIRMASI ═══ */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Konfirmasi Transaksi" size="xl">
        <div className="space-y-4">
          {/* Info Customer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Info Customer</h4>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700">No. Handphone : <span className="font-medium text-slate-900">{txForm.noHandphone}</span></span>
              {txForm.customer && (
                <span className="text-slate-700">Nama Customer : <span className="font-medium text-slate-900">{txForm.customer}</span></span>
              )}
              {txForm.nomorPolisi && (
                <span className="text-slate-700">No. Polisi : <span className="font-medium text-slate-900"> {txForm.nomorPolisi}</span></span>
              )}
            </div>
          </div>

          {/* Detail Service */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detail Service ({cart.length} item)</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 text-left">Service</th>
                  <th className="px-4 py-2.5 text-center">Jenis Motor</th>
                  <th className="px-4 py-2.5 text-right">Diskon</th>
                  <th className="px-4 py-2.5 text-right">Harga Jual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cart.map((item) => (
                  <tr key={item.cartId}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900">{item.serviceTypeName}</p>
                      {item.catColor && <p className="text-xs text-slate-500">{CAT_COLOR_LABELS[item.catColor]}</p>}
                      {item.oliProductName && <p className="text-xs text-slate-500">{item.oliProductName}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs bg-slate-100 text-slate-700 rounded-md px-2 py-1 font-medium">{MOTOR_LABELS[item.motorType]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{item.discount > 0 ? <span className="text-slate-600 font-semibold">{item.discount}%</span> : '-'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatRp(item.sellingPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-bold text-slate-700 text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600 text-base">{formatRp(cartTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pembayaran */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">Pembayaran</h4>
            <div className="flex justify-between">
              <span className="text-slate-500">Metode</span>
              <span className="font-semibold">{txForm.paymentMethod === 'cash' ? 'Tunai' : 'Non Tunai'}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base">
              <span>Total</span>
              <span>{formatRp(cartTotal)}</span>
            </div>
            {txForm.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Uang Dibayar</span>
                  <span>{formatRp(uangBayarNum)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Kembalian</span>
                  <span>{formatRp(kembalian)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => setShowConfirm(false)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-slate-700 text-sm font-medium transition hover:bg-slate-50">
            ← Kembali
          </button>
          <button type="button"
            onClick={() => { if (window.confirm('Apakah Anda yakin ingin melakukan transaksi ini?')) void handleConfirmSave(); }}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-white text-sm font-bold transition hover:bg-slate-800">
            ✓ Konfirmasi
          </button>
        </div>
      </Modal>
    </div>
  );
}
