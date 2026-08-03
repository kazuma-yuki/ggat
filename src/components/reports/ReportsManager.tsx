// src/components/reports/ReportsManager.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Calendar,
  TrendingUp,
  Banknote,
  Package,
  BarChart3,
  ShoppingBag,
  PieChart as PieChartIcon,
} from 'lucide-react';

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

import StatsCard from '../common/StatsCard';
import { formatCurrency } from '../../utils/analytics';
import { getCategoryHex, getServiceColor } from '../../utils/categoryColors';
import { getServiceTypes } from '../../service/api';
import {
  getProducts,
  getTransactions,
  getJasaCatJobs,
  type JasaCatJob,
} from '../../utils/storage';
import {
  format,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import type { Product, Transaction } from '../../types';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

type ReportTransactionItem = {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  modalPrice: number;
  sellPrice: number;
  subtotal: number;
  profit: number;
  productCategory?: string;
  category?: string;
};

type SalesTransaction = Transaction & {
  items: ReportTransactionItem[];
};

type ReportDataPoint = {
  period: string;
  revenue: number;
  profit: number;
  transactions: number;
  sortKey: number;
};

type CategoryDataPoint = {
  name: string;
  value: number;
  quantity: number;
};

type JasaTypeBreakdown = {
  count: number;
  revenue: number;
  cost: number;
  profit: number;
};

type JasaSummary = {
  revenue: number;
  cost: number;
  profit: number;
  byType: Record<string, JasaTypeBreakdown>;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatTanggalID = (dateStr: unknown, timeStr?: unknown): string => {
  const raw = toStringValue(dateStr);
  if (!raw) return '-';
  const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
  if (isNaN(d.getTime())) return raw;
  const tanggal = `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
  if (timeStr) {
    const t = new Date(toStringValue(timeStr));
    if (!isNaN(t.getTime())) {
      const jam = String(t.getHours()).padStart(2, '0');
      const menit = String(t.getMinutes()).padStart(2, '0');
      return `${tanggal} : jam ${jam}:${menit}`;
    }
  }
  return tanggal;
};

const safeParseDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = toStringValue(value).trim();
  if (!raw) return null;
  const parsed = parseISO(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getJasaDate = (job: JasaCatJob): Date | null => {
  const raw = job.date ?? job.tanggal ?? job.createdAt ?? job.created_at ?? null;
  return safeParseDate(raw);
};

const getJasaCustomer = (job: JasaCatJob): string =>
  toStringValue(job.customer) || toStringValue(job.customerName) || toStringValue(job.namaCustomer) || '-';

const getJasaMotorType = (job: JasaCatJob): string =>
  toStringValue(job.motorType) || toStringValue(job.jenisMotor) || 'Unknown';

const getJasaRevenue = (job: JasaCatJob): number =>
  toNumber(job.selling ?? job.sellingPrice ?? job.selling_price ?? job.hargaJual ?? job.price ?? job.total);

const getJasaCost = (job: JasaCatJob): number => {
  const explicitCost = toNumber(job.totalCost ?? job.total_biaya ?? job.biayaTotal ?? job.cost ?? job.biaya);
  if (explicitCost > 0) return explicitCost;
  const jobRecord = job as Record<string, unknown>;
  const bt = toNumber(jobRecord.paintCostUsed ?? jobRecord.biayaCat) +
             toNumber(jobRecord.laborCost ?? jobRecord.biayaTenaga) +
             toNumber(jobRecord.otherCost ?? jobRecord.biayaLain);
  if (bt > 0) return bt;
  const revenue = getJasaRevenue(job);
  const profit = toNumber(job.profit);
  if (revenue > 0 && profit > 0) { const c = revenue - profit; if (c > 0) return c; }
  return 0;
};

const getJasaProfit = (job: JasaCatJob): number => {
  const explicit = job.profit;
  if (typeof explicit === 'number' || typeof explicit === 'string') {
    const p = toNumber(explicit);
    if (Number.isFinite(p)) return p;
  }
  return getJasaRevenue(job) - getJasaCost(job);
};

const getPeriodInfo = (date: Date, period: ReportPeriod) => {
  if (period === 'weekly') {
    const s = startOfWeek(date, { weekStartsOn: 1 });
    const e = endOfWeek(date, { weekStartsOn: 1 });
    return { label: `${format(s, 'dd/MM')} - ${format(e, 'dd/MM')}`, sortKey: s.getTime() };
  }
  if (period === 'monthly') {
    const s = startOfMonth(date);
    return { label: format(date, 'MMM yyyy'), sortKey: s.getTime() };
  }
  return { label: format(date, 'dd/MM/yyyy'), sortKey: date.getTime() };
};

const buildPeriodSlots = (
  grouped: Map<string, { revenue: number; profit: number; transactions: number; sortKey: number }>,
  period: ReportPeriod, start: Date, end: Date
): ReportDataPoint[] => {
  const slots: ReportDataPoint[] = [];
  if (period === 'daily') {
    eachDayOfInterval({ start, end }).forEach((day) => {
      const label = format(day, 'dd/MM/yyyy');
      const ex = grouped.get(label);
      slots.push({ period: format(day, 'dd/MM'), revenue: ex?.revenue ?? 0, profit: ex?.profit ?? 0, transactions: ex?.transactions ?? 0, sortKey: day.getTime() });
    });
  } else if (period === 'weekly') {
    eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).forEach((ws) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const label = `${format(ws, 'dd/MM')} - ${format(we, 'dd/MM')}`;
      const ex = grouped.get(label);
      slots.push({ period: label, revenue: ex?.revenue ?? 0, profit: ex?.profit ?? 0, transactions: ex?.transactions ?? 0, sortKey: ws.getTime() });
    });
  } else {
    eachMonthOfInterval({ start, end }).forEach((ms) => {
      const label = format(ms, 'MMM yyyy');
      const ex = grouped.get(label);
      slots.push({ period: label, revenue: ex?.revenue ?? 0, profit: ex?.profit ?? 0, transactions: ex?.transactions ?? 0, sortKey: ms.getTime() });
    });
  }
  return slots;
};

const resolveProductForItem = (productMap: Map<string, Product>, item: ReportTransactionItem): Product | null => {
  const direct = productMap.get(String(item.productId || '').trim());
  if (direct) return direct;
  for (const p of productMap.values()) {
    if ((item.productCode && p.code === item.productCode) || (item.productName && p.name === item.productName)) return p;
  }
  return null;
};

const getItemCategory = (item: ReportTransactionItem, product: Product | null): string => {
  const r = item as Record<string, unknown>;
  return product?.category || toStringValue(item.productCategory) || toStringValue(item.category) ||
    toStringValue(r.category) || toStringValue(r.productCategory) || 'Unknown';
};

interface ReportsManagerProps {
  type: 'produk' | 'jasa';
}

const ReportsManager: React.FC<ReportsManagerProps> = ({ type }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [jasaJobs, setJasaJobs] = useState<JasaCatJob[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Array<{ name: string; color?: string }>>([]);

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  const reloadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setProducts(await getProducts());
      const txData = await getTransactions() as SalesTransaction[];
      setTransactions([...txData].sort((a, b) => {
        const da = safeParseDate(a.createdAt ?? a.date)?.getTime() ?? 0;
        const db = safeParseDate(b.createdAt ?? b.date)?.getTime() ?? 0;
        return db - da;
      }));
      setJasaJobs(await getJasaCatJobs());
      try { setServiceTypes(await getServiceTypes()); } catch { /**/ }
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    void reloadData();
    const h1 = () => void reloadData();
    const h2 = () => { if (document.visibilityState === 'visible') void reloadData(); };
    window.addEventListener('storage', h1);
    window.addEventListener('focus', h1);
    window.addEventListener('appDataChanged', h1);
    document.addEventListener('visibilitychange', h2);
    return () => {
      window.removeEventListener('storage', h1);
      window.removeEventListener('focus', h1);
      window.removeEventListener('appDataChanged', h1);
      document.removeEventListener('visibilitychange', h2);
    };
  }, [reloadData]);

  const start = useMemo(() => startOfDay(safeParseDate(startDate) ?? new Date()), [startDate]);
  const end = useMemo(() => endOfDay(safeParseDate(endDate) ?? new Date()), [endDate]);
  const productMap = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);

  const filteredTransactions = useMemo(() =>
    transactions.filter((tx) => {
      const d = safeParseDate(tx.date) ?? safeParseDate(tx.createdAt);
      return d ? isWithinInterval(d, { start, end }) : false;
    }), [transactions, start, end]);

  const filteredJasaJobs = useMemo(() =>
    jasaJobs.filter((job) => {
      const d = getJasaDate(job);
      return d ? isWithinInterval(d, { start, end }) : false;
    }), [jasaJobs, start, end]);

  // ── Produk chart data ──
  const produkReportData = useMemo<ReportDataPoint[]>(() => {
    const grouped = new Map<string, { revenue: number; profit: number; transactions: number; sortKey: number }>();
    filteredTransactions.forEach((tx) => {
      const d = safeParseDate(tx.date) ?? safeParseDate(tx.createdAt);
      if (!d) return;
      const info = getPeriodInfo(d, reportPeriod);
      const cur = grouped.get(info.label) ?? { revenue: 0, profit: 0, transactions: 0, sortKey: info.sortKey };
      cur.revenue += tx.total || 0; cur.profit += tx.profit || 0; cur.transactions += 1;
      cur.sortKey = Math.min(cur.sortKey, info.sortKey);
      grouped.set(info.label, cur);
    });
    return buildPeriodSlots(grouped, reportPeriod, start, end);
  }, [filteredTransactions, reportPeriod, start, end]);

  // ── Jasa chart data ──
  const jasaReportData = useMemo<ReportDataPoint[]>(() => {
    const grouped = new Map<string, { revenue: number; profit: number; transactions: number; sortKey: number }>();
    filteredJasaJobs.forEach((job) => {
      const d = getJasaDate(job);
      if (!d) return;
      const info = getPeriodInfo(d, reportPeriod);
      const cur = grouped.get(info.label) ?? { revenue: 0, profit: 0, transactions: 0, sortKey: info.sortKey };
      cur.revenue += getJasaRevenue(job); cur.profit += getJasaProfit(job); cur.transactions += 1;
      cur.sortKey = Math.min(cur.sortKey, info.sortKey);
      grouped.set(info.label, cur);
    });
    return buildPeriodSlots(grouped, reportPeriod, start, end);
  }, [filteredJasaJobs, reportPeriod, start, end]);

  // ── Jasa summary ──
  const jasaSummary = useMemo<JasaSummary>(() =>
    filteredJasaJobs.reduce<JasaSummary>((acc, job) => {
      const revenue = getJasaRevenue(job), cost = getJasaCost(job), profit = getJasaProfit(job);
      const type = getJasaMotorType(job);
      acc.revenue += revenue; acc.cost += cost; acc.profit += profit;
      if (!acc.byType[type]) acc.byType[type] = { count: 0, revenue: 0, cost: 0, profit: 0 };
      acc.byType[type].count += 1; acc.byType[type].revenue += revenue;
      acc.byType[type].cost += cost; acc.byType[type].profit += profit;
      return acc;
    }, { revenue: 0, cost: 0, profit: 0, byType: {} }),
  [filteredJasaJobs]);

  // ── Produk category pie ──
  const produkCategoryData = useMemo<CategoryDataPoint[]>(() => {
    const stats = new Map<string, { revenue: number; quantity: number }>();
    filteredTransactions.forEach((tx) => {
      (tx.items || []).forEach((item) => {
        const product = resolveProductForItem(productMap, item);
        const cat = getItemCategory(item, product);
        const cur = stats.get(cat) ?? { revenue: 0, quantity: 0 };
        cur.revenue += item.subtotal || 0; cur.quantity += item.quantity || 0;
        stats.set(cat, cur);
      });
    });
    return Array.from(stats.entries()).map(([name, s]) => ({ name, value: s.revenue, quantity: s.quantity }));
  }, [filteredTransactions, productMap]);

  // ── Jasa category pie ──
  const jasaCategoryData = useMemo<CategoryDataPoint[]>(() => {
    const stats = new Map<string, { revenue: number; quantity: number }>();
    filteredJasaJobs.forEach((job) => {
      const jr = job as Record<string, unknown>;
      const itemsArr = Array.isArray(jr.items) ? jr.items as Record<string, unknown>[] : null;
      if (itemsArr && itemsArr.length > 0) {
        // Format baru — tiap item punya serviceTypeName & sellingPrice sendiri
        itemsArr.forEach((item) => {
          const sType = String(item.serviceType ?? 'cat');
          const key = sType === 'oli' ? 'Ganti Oli' : String(item.serviceTypeName ?? 'Service Cat');
          const cur = stats.get(key) ?? { revenue: 0, quantity: 0 };
          cur.revenue += toNumber(item.sellingPrice ?? 0);
          cur.quantity += 1;
          stats.set(key, cur);
        });
      } else {
        // Format lama — single service per job
        const key = String(jr.serviceType ?? 'cat') === 'oli' ? 'Ganti Oli' : String(jr.serviceTypeName ?? 'Service Cat');
        const cur = stats.get(key) ?? { revenue: 0, quantity: 0 };
        cur.revenue += getJasaRevenue(job); cur.quantity += 1;
        stats.set(key, cur);
      }
    });
    return Array.from(stats.entries()).map(([name, s]) => ({ name, value: s.revenue, quantity: s.quantity }));
  }, [filteredJasaJobs]);

  // ── Produk totals ──
  const totalSalesRevenue = useMemo(() => filteredTransactions.reduce((s, tx) => s + (tx.total || 0), 0), [filteredTransactions]);
  const totalSalesProfit = useMemo(() => filteredTransactions.reduce((s, tx) => s + (tx.profit || 0), 0), [filteredTransactions]);
  const totalSalesModal = useMemo(() =>
    filteredTransactions.reduce((s, tx) => s + (tx.items || []).reduce((is, i) => is + i.modalPrice * i.quantity, 0), 0),
  [filteredTransactions]);
  const totalSalesCount = filteredTransactions.length;

  const salesProfitMargin = totalSalesRevenue > 0 ? (totalSalesProfit / totalSalesRevenue) * 100 : 0;
  const avgSalesTransaction = totalSalesCount > 0 ? totalSalesRevenue / totalSalesCount : 0;

  const yAxisFormatter = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(v);

  // ── Export Excel helpers ──
  const toCSV = (headers: string[], rows: (string | number)[][]): string => {
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  };

  const downloadCSV = (filename: string, csvContent: string) => {
    const bom = '\uFEFF';
    // "sep=," memberi tahu Excel bahwa pemisah kolom adalah koma (agar rapi
    // di semua lokal Windows, termasuk yang default-nya titik koma).
    const content = bom + 'sep=,\r\n' + csvContent;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportProdukExcel = () => {
    const headers = ['Tanggal','No. HP','No. Polisi','Customer','Produk','Diskon (%)','Harga Modal','Harga Jual','Keuntungan','Pembayaran','Uang Bayar','Kembalian'];
    const rows = filteredTransactions.flatMap((tx) => {
      const txRec = tx as unknown as Record<string, unknown>;
      const uangBayar = toNumber(txRec.uangBayar ?? 0);
      const kembalian = tx.paymentMethod === 'cash' ? Math.max(0, uangBayar - tx.total) : 0;
      const discountPct = toNumber(txRec.discountPct ?? 0);
      const modal = (tx.items || []).reduce((s, i) => s + i.modalPrice * i.quantity, 0);
      const produkStr = (tx.items || []).map((i) => `${i.quantity}x ${i.productName}`).join('; ');
      return [[
        formatTanggalID(tx.date, tx.createdAt),
        tx.customerPhone || '-',
        tx.nomorPolisi || '-',
        tx.customerName || '-',
        produkStr,
        discountPct,
        modal,
        tx.total,
        tx.profit || 0,
        tx.paymentMethod === 'cash' ? 'Tunai' : 'Non Tunai',
        tx.paymentMethod === 'cash' ? uangBayar : '-',
        tx.paymentMethod === 'cash' ? kembalian : '-',
      ] as (string | number)[]];
    });
    downloadCSV(`Laporan_Produk_${startDate}_${endDate}.csv`, toCSV(headers, rows));
  };

  const exportJasaExcel = () => {
    const headers = ['Tanggal','No. HP','No. Polisi','Customer','Jenis Motor','Service','Diskon','Harga Modal','Harga Jual','Keuntungan','Pembayaran','Uang Bayar','Kembalian'];
    const MOTOR_LBL: Record<string, string> = { bebek: 'Bebek', matic: 'Matic', sport: 'Sport' };
    const CAT_LABELS_LOC: Record<string, string> = { merah: 'Cat Merah', hitam: 'Cat Hitam', kuning: 'Cat Kuning', biru: 'Cat Biru' };
    const rows = filteredJasaJobs.map((job) => {
      const jr = job as Record<string, unknown>;
      const pm = String(jr.paymentMethod ?? 'cash');
      const itemsArr = Array.isArray(jr.items) ? jr.items as Record<string, unknown>[] : null;
      const motorStr = itemsArr
        ? [...new Set(itemsArr.map((i) => MOTOR_LBL[String(i.motorType ?? '')] ?? String(i.motorType ?? '-')))].join('; ')
        : getJasaMotorType(job);
      const serviceStr = itemsArr
        ? itemsArr.map((i) => {
            const sName = String(i.serviceTypeName ?? 'Service Cat');
            const cat = i.catColor ? (CAT_LABELS_LOC[String(i.catColor)] ?? '') : '';
            const oli = String(i.oliProductName ?? '');
            return [sName, cat, oli].filter(Boolean).join(' ');
          }).join('; ')
        : (() => {
            const sType = String(jr.serviceType ?? 'cat');
            const sName = sType === 'oli' ? 'Ganti Oli' : String(jr.serviceTypeName ?? 'Service Cat');
            const cat = jr.catColor ? (CAT_LABELS_LOC[String(jr.catColor)] ?? '') : '';
            const oli = String(jr.oliProductName ?? '');
            return [sName, cat, oli].filter(Boolean).join(' ');
          })();
      const diskonStr = itemsArr
        ? itemsArr.filter((i) => toNumber(i.discount ?? 0) > 0).map((i) => `${String(i.serviceTypeName)}: ${String(i.discount)}%`).join('; ')
        : toNumber(jr.discount ?? 0) > 0 ? `${String(jr.discount)}%` : '-';
      const uangBayar = toNumber(jr.uangBayar ?? 0);
      const kembalian = toNumber(jr.kembalian ?? 0);
      return [
        formatTanggalID(job.date ?? (jr.tanggal as string), job.createdAt ?? (jr.created_at as string)),
        String(jr.noHandphone ?? '') || '-',
        String(jr.nomorPolisi ?? '') || '-',
        getJasaCustomer(job),
        motorStr,
        serviceStr,
        diskonStr,
        getJasaCost(job),
        getJasaRevenue(job),
        getJasaProfit(job),
        pm === 'cash' ? 'Tunai' : 'Non Tunai',
        pm === 'cash' ? uangBayar : '-',
        pm === 'cash' ? kembalian : '-',
      ] as (string | number)[];
    });
    downloadCSV(`Laporan_Jasa_Service_${startDate}_${endDate}.csv`, toCSV(headers, rows));
  };


  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {type === 'produk' ? 'Laporan Keuangan Produk' : 'Laporan Keuangan Jasa Service'}
          </h1>
          <p className="mt-1 text-gray-600">
            {type === 'produk'
              ? 'Analisis performa penjualan dan keuntungan produk'
              : 'Analisis performa penjualan dan keuntungan jasa service'}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => type === 'produk' ? exportProdukExcel() : exportJasaExcel()}
            className="inline-flex items-center gap-2 rounded-xl border border-green-600 bg-white px-4 py-2 text-green-700 transition hover:bg-green-50"
          >
            <span>⬇</span><span>Download Excel</span>
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700">
            <FileText className="h-5 w-5" /><span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Periode Laporan</label>
            <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
          </div>
          {[{ label: 'Tanggal Mulai', val: startDate, set: setStartDate }, { label: 'Tanggal Selesai', val: endDate, set: setEndDate }].map(({ label, val, set }) => (
            <div key={label} className="relative">
              <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
              <Calendar className="absolute left-3 top-[2.6rem] h-4 w-4 text-gray-400" />
              <input type="date" value={val} onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pl-10 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          ))}
        </div>
        {isLoading && <p className="mt-3 text-sm text-gray-500">Memuat data...</p>}
      </div>

      {/* ══════════ TAB PRODUK ══════════ */}
      {type === 'produk' && (
        <>
          {/* Stats khusus produk */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Omzet Produk" value={totalSalesRevenue} icon={TrendingUp} color="blue" format="currency" subtitle={`${totalSalesCount} transaksi`} />
            <StatsCard title="Total Keuntungan Produk" value={totalSalesProfit} icon={Banknote} color="green" format="currency" subtitle={`Margin ${salesProfitMargin.toFixed(1)}%`} />
            <StatsCard title="Rata-rata Transaksi Produk" value={avgSalesTransaction} icon={BarChart3} color="yellow" format="currency" />
            <StatsCard title="Total Modal Produk" value={totalSalesModal} icon={Package} color="purple" format="currency" />
          </div>

          {/* Charts produk */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-w-0 overflow-hidden">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Omzet produk vs Keuntungan Produk</h3>
              </div>
              {produkReportData.length === 0
                ? <div className="py-10 text-center text-gray-500">Tidak ada data untuk periode yang dipilih</div>
                : <div style={{ minWidth: 0 }}><ResponsiveContainer width="100%" height={300}>
                    <LineChart data={produkReportData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={produkReportData.length > 10 ? Math.ceil(produkReportData.length / 10) - 1 : 0}  />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFormatter} />
                      <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n === 'Omzet' ? 'Omzet' : 'Keuntungan']} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Omzet" />
                      <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Keuntungan" />
                    </LineChart>
                  </ResponsiveContainer></div>
              }
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Penjualan per Kategori Produk</h3>
              </div>
              {produkCategoryData.length > 0
                ? <div className="flex flex-col gap-4 xl:flex-row">
                    <div className="xl:w-1/2" style={{ overflow: "hidden" }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPieChart>
                          <Pie data={produkCategoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={4} dataKey="value">
                            {produkCategoryData.map((entry, i) => <Cell key={`c-${i}`} fill={getCategoryHex(entry.name)} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="xl:w-1/2 space-y-2">
                      {produkCategoryData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getCategoryHex(item.name) }} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-600">{formatCurrency(item.value)} • {item.quantity} item</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                : <div className="py-10 text-center text-gray-500">Tidak ada data untuk periode yang dipilih</div>
              }
            </div>
          </div>

          {/* Tabel transaksi produk */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Penjualan Produk</h3>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <div className="text-sm text-blue-800">Total Omzet Produk</div>
                <div className="mt-1 text-xl font-bold text-blue-600">{formatCurrency(totalSalesRevenue)}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-sm text-gray-600">Total Modal Produk</div>
                <div className="mt-1 text-xl font-bold text-gray-700">{formatCurrency(totalSalesModal)}</div>
              </div>
              <div className="rounded-xl bg-green-50 p-4 text-center">
                <div className="text-sm text-green-800">Total Keuntungan Produk</div>
                <div className="mt-1 text-xl font-bold text-green-600">{formatCurrency(totalSalesProfit)}</div>
              </div>
            </div>

            <h4 className="mb-2 font-medium text-gray-900">Daftar Transaksi Produk</h4>
            {filteredTransactions.length === 0
              ? <div className="py-8 text-center text-gray-500">Belum ada transaksi produk di periode ini.</div>
              : <div className="max-h-80 overflow-auto rounded-xl border print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-left print:static">
                      <tr>
                        {['Tanggal','No. HP','No. Polisi','Customer','Produk','Diskon','Harga Modal','Harga Jual','Keuntungan','Pembayaran','Uang Bayar','Kembalian'].map((h) => (
                          <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx, idx) => {
                        const txRec = tx as unknown as Record<string, unknown>;
                        const subtotal = (tx.items || []).reduce((s, i) => s + i.modalPrice * i.quantity, 0);
                        const uangBayar = toNumber(txRec.uangBayar ?? 0);
                        const kembalian = tx.paymentMethod === 'cash' ? Math.max(0, uangBayar - tx.total) : 0;
                        const discountPct = toNumber(txRec.discountPct ?? 0);
                        return (
                          <tr key={tx.id ?? idx} className="border-t hover:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{formatTanggalID(tx.date, tx.createdAt)}</td>
                            <td className="p-2 whitespace-nowrap text-gray-600">{tx.customerPhone || '-'}</td>
                            <td className="p-2 whitespace-nowrap text-gray-600">{tx.nomorPolisi || '-'}</td>
                            <td className="p-2">{tx.customerName || '-'}</td>
                            <td className="p-2">
                              <div className="space-y-0.5">
                                {(tx.items || []).map((item, i) => {
                                  const ri = item as unknown as ReportTransactionItem;
                                  return (
                                    <div key={i} className="flex items-center gap-1.5 text-xs">
                                      <span className="text-gray-700">{item.quantity}× {item.productName}</span>
                                      <span className="rounded-full px-1.5 py-0.5 text-white text-xs font-medium"
                                        style={{ backgroundColor: getCategoryHex(ri.category || ri.productCategory || 'Unknown') }}>
                                        {ri.category || ri.productCategory || 'Unknown'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-2 whitespace-nowrap text-gray-600">{discountPct > 0 ? `${discountPct}%` : '-'}</td>
                            <td className="p-2 whitespace-nowrap">{formatCurrency(subtotal)}</td>
                            <td className="p-2 whitespace-nowrap font-semibold text-gray-900">{formatCurrency(tx.total)}</td>
                            <td className={`p-2 whitespace-nowrap font-medium ${tx.profit < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(tx.profit)}</td>
                            <td className="p-2 whitespace-nowrap">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tx.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {tx.paymentMethod === 'cash' ? 'Tunai' : 'Non Tunai'}
                              </span>
                            </td>
                            <td className="p-2 whitespace-nowrap text-gray-700">
                              {tx.paymentMethod === 'cash' && uangBayar > 0 ? formatCurrency(uangBayar) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-2 whitespace-nowrap font-medium">
                              {tx.paymentMethod === 'cash' && kembalian > 0 ? <span className="text-green-600">{formatCurrency(kembalian)}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* Ringkasan produk */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Ringkasan Keuangan Produk</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-blue-50 p-4 text-center"><p className="text-2xl font-bold text-blue-600">{formatCurrency(totalSalesRevenue)}</p><p className="mt-1 text-sm text-blue-800">Total Omzet Produk</p></div>
              <div className="rounded-xl bg-green-50 p-4 text-center"><p className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesProfit)}</p><p className="mt-1 text-sm text-green-800">Total Keuntungan Produk</p></div>
              <div className="rounded-xl bg-yellow-50 p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{salesProfitMargin.toFixed(1)}%</p><p className="mt-1 text-sm text-yellow-800">Margin Keuntungan Produk</p></div>
              <div className="rounded-xl bg-purple-50 p-4 text-center"><p className="text-2xl font-bold text-purple-600">{totalSalesCount}</p><p className="mt-1 text-sm text-purple-800">Total Transaksi Produk</p></div>
            </div>
            <div className="mt-6 rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-600"><strong>Periode:</strong> {format(start, 'dd MMM yyyy')} - {format(end, 'dd MMM yyyy')}</p>
              <p className="mt-2 text-sm text-gray-600"><strong>Rata-rata per transaksi Produk:</strong> {formatCurrency(avgSalesTransaction)}</p>
            </div>
          </div>
        </>
      )}

      {/* ══════════ TAB JASA ══════════ */}
      {type === 'jasa' && (
        <>
          {/* Stats khusus jasa */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Omzet Jasa Service" value={jasaSummary.revenue} icon={TrendingUp} color="blue" format="currency" subtitle={`${filteredJasaJobs.length} transaksi`} />
            <StatsCard title="Total Keuntungan Jasa Service" value={jasaSummary.profit} icon={Banknote} color="green" format="currency" subtitle={jasaSummary.revenue > 0 ? `Margin ${((jasaSummary.profit / jasaSummary.revenue) * 100).toFixed(1)}%` : 'Margin 0%'} />
            <StatsCard title="Rata-rata Transaksi Jasa Service" value={filteredJasaJobs.length > 0 ? jasaSummary.revenue / filteredJasaJobs.length : 0} icon={BarChart3} color="yellow" format="currency" />
            <StatsCard title="Total Modal Jasa Service" value={jasaSummary.cost} icon={Package} color="purple" format="currency" />
          </div>

          {/* Charts jasa */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-w-0 overflow-hidden">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Omzet jasa service vs Keuntungan Jasa service</h3>
              </div>
              {jasaReportData.length === 0
                ? <div className="py-10 text-center text-gray-500">Tidak ada data untuk periode yang dipilih</div>
                : <div style={{ minWidth: 0 }}><ResponsiveContainer width="100%" height={300}>
                    <LineChart data={jasaReportData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={jasaReportData.length > 10 ? Math.ceil(jasaReportData.length / 10) - 1 : 0}  />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFormatter} />
                      <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n === 'Omzet' ? 'Omzet' : 'Keuntungan']} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Omzet" />
                      <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Keuntungan" />
                    </LineChart>
                  </ResponsiveContainer></div>
              }
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900"> Penjualan Jasa per Jenis Service</h3>
              </div>
              {jasaCategoryData.length > 0
                ? <div className="flex flex-col gap-4 xl:flex-row">
                    <div className="xl:w-1/2" style={{ overflow: "hidden" }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPieChart>
                          <Pie data={jasaCategoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={4} dataKey="value">
                            {jasaCategoryData.map((entry, i) => <Cell key={`c-${i}`} fill={getServiceColor(entry.name, serviceTypes)} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="xl:w-1/2 space-y-2">
                      {jasaCategoryData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getServiceColor(item.name, serviceTypes) }} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-600">{formatCurrency(item.value)} • {item.quantity} item</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                : <div className="py-10 text-center text-gray-500">Tidak ada data untuk periode yang dipilih</div>
              }
            </div>
          </div>

          {/* Tabel transaksi jasa */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Jasa Service Motor</h3>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <div className="text-sm text-blue-800">Total Omzet Jasa Service</div>
                <div className="mt-1 text-xl font-bold text-blue-600">{formatCurrency(jasaSummary.revenue)}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-sm text-gray-600">Total Modal Jasa Service</div>
                <div className="mt-1 text-xl font-bold text-gray-700">{formatCurrency(jasaSummary.cost)}</div>
              </div>
              <div className="rounded-xl bg-green-50 p-4 text-center">
                <div className="text-sm text-green-800">Total Keuntungan Jasa Service</div>
                <div className="mt-1 text-xl font-bold text-green-600">{formatCurrency(jasaSummary.profit)}</div>
              </div>
            </div>

            <h4 className="mb-2 font-medium text-gray-900">Daftar Transaksi Jasa Service</h4>
            {filteredJasaJobs.length === 0
              ? <div className="text-sm text-gray-500">Belum ada transaksi jasa service di periode ini.</div>
              : <div className="max-h-80 overflow-auto rounded-xl border print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-left print:static">
                      <tr>
                        {['Tanggal','No. HP','No. Polisi','Customer','Jenis Motor','Service','Diskon','Harga Modal','Harga Jual','Keuntungan','Pembayaran','Uang Bayar','Kembalian'].map((h) => (
                          <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJasaJobs.map((job, idx) => {
                        const jr = job as Record<string, unknown>;
                        const CAT_LABELS: Record<string, string> = { merah: 'Cat Merah', hitam: 'Cat Hitam', kuning: 'Cat Kuning', biru: 'Cat Biru' };
                        const itemsArr = Array.isArray(jr.items) ? jr.items as Record<string, unknown>[] : null;
                        const pm = String(jr.paymentMethod ?? 'cash');
                        const totalModal = getJasaCost(job);
                        const hargaJual = getJasaRevenue(job);
                        const keuntungan = getJasaProfit(job);
                        const uangBayarVal = toNumber(jr.uangBayar ?? 0);
                        const kembalianVal = toNumber(jr.kembalian ?? 0);
                        return (
                          <tr key={toStringValue(job.id ?? job.jobId ?? idx)} className="border-t hover:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{formatTanggalID(job.date ?? job.tanggal, job.createdAt ?? job.created_at)}</td>
                            <td className="p-2 whitespace-nowrap text-gray-600">{String(jr.noHandphone ?? '') || '-'}</td>
                            <td className="p-2 whitespace-nowrap text-gray-600">{String(jr.nomorPolisi ?? '') || '-'}</td>
                            <td className="p-2">{getJasaCustomer(job)}</td>
                            {/* Kolom Jenis Motor — dari items atau field lama */}
                            <td className="p-2 whitespace-nowrap text-gray-700">
                              {itemsArr
                                ? [...new Set(itemsArr.map((i) => String(i.motorType ?? '-')))].map((mt, i) => {
                                    const labels: Record<string, string> = { bebek: 'Bebek', matic: 'Matic', sport: 'Sport' };
                                    return <div key={i} className="text-xs">{labels[mt] ?? mt}</div>;
                                  })
                                : getJasaMotorType(job)
                              }
                            </td>
                            {/* Kolom Service — support format baru (items[]) dan lama */}
                            <td className="p-2">
                              {itemsArr ? (
                                <div className="space-y-0.5">
                                  {itemsArr.map((item, i) => {
                                    const sType = String(item.serviceType ?? 'cat');
                                    const sName = String(item.serviceTypeName ?? 'Service Cat');
                                    const catColorLabel = item.catColor ? (CAT_LABELS[String(item.catColor)] ?? String(item.catColor)) : '';
                                    const oliName = String(item.oliProductName ?? '');
                                    const svcColor = getServiceColor(sType === 'oli' ? 'Ganti Oli' : sName, serviceTypes);
                                    return (
                                      <div key={i} className="flex items-center gap-1 text-xs flex-wrap">
                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-white" style={{ backgroundColor: svcColor }}>
                                          {sName}
                                        </span>
                                        {catColorLabel && <span className="text-gray-500">{catColorLabel}</span>}
                                        {oliName && <span className="text-gray-500">{oliName}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                // Format lama — single service
                                (() => {
                                  const svcType = String(jr.serviceType ?? 'cat');
                                  const catColorKey = String(jr.catColor ?? '');
                                  const catColorLabel = catColorKey ? (CAT_LABELS[catColorKey] ?? catColorKey) : '';
                                  const oliName = String(jr.oliProductName ?? '');
                                  const serviceLabel = svcType === 'oli'
                                    ? (oliName ? `Ganti Oli - ${oliName}` : 'Ganti Oli')
                                    : (catColorLabel ? `${String(jr.serviceTypeName ?? 'Service Cat')} (${catColorLabel})` : String(jr.serviceTypeName ?? 'Service Cat'));
                                  const svcColor = getServiceColor(svcType === 'oli' ? 'Ganti Oli' : String(jr.serviceTypeName ?? 'Service Cat'), serviceTypes);
                                  return (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: svcColor }}>
                                      {serviceLabel}
                                    </span>
                                  );
                                })()
                              )}
                            </td>
                            {/* Diskon */}
                            <td className="p-2 whitespace-nowrap text-gray-600">
                              {itemsArr
                                ? itemsArr.some((i) => toNumber(i.discount) > 0)
                                  ? <>{itemsArr.filter((i) => toNumber(i.discount) > 0).map((i, k) => <div key={k} className="text-xs">{String(i.serviceTypeName)}: {String(i.discount)}%</div>)}</>
                                  : <span className="text-gray-300">-</span>
                                : (toNumber(jr.discount ?? 0) > 0 ? `${String(jr.discount)}%` : '-')
                              }
                            </td>
                            <td className="p-2 whitespace-nowrap">{formatCurrency(totalModal)}</td>
                            <td className="p-2 whitespace-nowrap">{formatCurrency(hargaJual)}</td>
                            <td className={`p-2 whitespace-nowrap font-medium ${keuntungan < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(keuntungan)}</td>
                            <td className="p-2 whitespace-nowrap">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pm === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {pm === 'cash' ? 'Tunai' : 'Non Tunai'}
                              </span>
                            </td>
                            <td className="p-2 whitespace-nowrap text-gray-700">
                              {pm === 'cash' && uangBayarVal > 0 ? formatCurrency(uangBayarVal) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-2 whitespace-nowrap font-medium">
                              {pm === 'cash' && kembalianVal > 0 ? <span className="text-green-600">{formatCurrency(kembalianVal)}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* Ringkasan jasa */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Ringkasan Keuangan Jasa Service</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-blue-50 p-4 text-center"><p className="text-2xl font-bold text-blue-600">{formatCurrency(jasaSummary.revenue)}</p><p className="mt-1 text-sm text-blue-800">Total Omzet Jasa Service</p></div>
              <div className="rounded-xl bg-green-50 p-4 text-center"><p className="text-2xl font-bold text-green-600">{formatCurrency(jasaSummary.profit)}</p><p className="mt-1 text-sm text-green-800">Total Keuntungan Jasa Service</p></div>
              <div className="rounded-xl bg-yellow-50 p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{jasaSummary.revenue > 0 ? ((jasaSummary.profit / jasaSummary.revenue) * 100).toFixed(1) : '0.0'}%</p><p className="mt-1 text-sm text-yellow-800">Margin Keuntungan Jasa Service</p></div>
              <div className="rounded-xl bg-purple-50 p-4 text-center"><p className="text-2xl font-bold text-purple-600">{filteredJasaJobs.length}</p><p className="mt-1 text-sm text-purple-800">Total Transaksi Jasa Service</p></div>
            </div>
            <div className="mt-6 rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-600"><strong>Periode:</strong> {format(start, 'dd MMM yyyy')} - {format(end, 'dd MMM yyyy')}</p>
              <p className="mt-2 text-sm text-gray-600"><strong>Rata-rata per transaksi Jasa Service:</strong> {formatCurrency(filteredJasaJobs.length > 0 ? jasaSummary.revenue / filteredJasaJobs.length : 0)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsManager;
