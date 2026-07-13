// src/utils/analytics.ts
import { Transaction, Product, DashboardStats, ChartData } from '../types';
import { getTransactions, getProducts, getJasaCatJobs } from './storage';
import { format, subDays, isSameDay, isSameMonth, parseISO } from 'date-fns';

type UnknownRecord = Record<string, unknown>;

type SaleItemLike = {
  productId?: unknown;
  productCode?: unknown;
  productName?: unknown;
  quantity?: unknown;
  subtotal?: unknown;
  profit?: unknown;
};

type NormalizedJasaJob = {
  id: string;
  dateRaw: string | null;
  customer: string;
  motorType: string;
  selling: number;
  cost: number;
  profit: number;
  deleted: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const parseLooseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const raw = value.trim();
  if (!raw) return 0;

  const compact = raw.replace(/\s+/g, '');

  // Format Indonesia: 200.000 / 1.250.000,50
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) {
    const converted = compact.replace(/\./g, '').replace(/,/g, '.');
    const parsed = Number(converted);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Format US-style: 1,000 / 1,250,000.50
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) {
    const converted = compact.replace(/,/g, '');
    const parsed = Number(converted);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const direct = Number(compact);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const cleaned = compact.replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(/,/g, '.')
    : cleaned.replace(/,/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeNum = (value: unknown): number => {
  return Math.round(parseLooseNumber(value) + Number.EPSILON);
};

const toDisplayCode = (value: unknown): string => {
  const raw = toStringValue(value).trim();
  if (!raw) return 'UNKNOWN';

  const cleaned = raw
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned ? cleaned.toUpperCase() : 'UNKNOWN';
};

const parseDateTolerant = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = toStringValue(value);
  if (!raw) return null;

  try {
    const parsed = parseISO(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  } catch {
    // ignore
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getFirstValue = (record: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
};

const getTransactionItems = (transaction: Transaction): SaleItemLike[] => {
  const rawItems = (transaction as unknown as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter(isRecord)
    .map((item) => item as unknown as SaleItemLike);
};

/**
 * Normalize Jasa Cat jobs:
 * - standardize field names
 * - ignore deleted / zero-selling jobs
 */
export const normalizeAndFilterJobs = (jobsRaw: unknown[] = []): NormalizedJasaJob[] => {
  return jobsRaw
    .filter(isRecord)
    .map((job) => {
      const selling = safeNum(
        getFirstValue(job, [
          'selling',
          'sellingPrice',
          'selling_price',
          'hargaJual',
          'harga_jual',
          'price',
          'amount',
          'total',
          'revenue',
          'totalRevenue',
        ])
      );

      const cost = safeNum(
        getFirstValue(job, [
          'totalCost',
          'total_biaya',
          'biayaTotal',
          'biaya_total',
          'cost',
          'biaya',
          'modal',
          'hargaModal',
          'expense',
          'totalExpense',
        ])
      );

      const profitValue = getFirstValue(job, ['profit']);
      const profit =
        typeof profitValue === 'number' || typeof profitValue === 'string'
          ? safeNum(profitValue)
          : selling - cost;

      const deleted = Boolean(
        getFirstValue(job, ['deleted', 'isDeleted', '_deleted', 'removed'])
      );

      const dateRaw = toStringValue(
        getFirstValue(job, ['date', 'tanggal', 'createdAt', 'created_at', 'waktu'])
      );

      const customer =
        toStringValue(getFirstValue(job, ['customer', 'customerName', 'pelanggan'])) || '';

      const motorType =
        toStringValue(getFirstValue(job, ['motorType', 'jenisMotor', 'type'])) || 'Unknown';

      const id =
        toStringValue(getFirstValue(job, ['id', 'jobId'])) ||
        `${dateRaw || 'no-date'}-${customer || 'no-customer'}-${motorType}`;

      return {
        id,
        dateRaw: dateRaw || null,
        customer,
        motorType,
        selling,
        cost,
        profit,
        deleted,
      };
    })
    .filter((job) => !job.deleted && job.selling > 0);
};

const getTransactionDate = (t: Transaction): Date | null => {
  const tx = t as unknown as { date?: unknown; createdAt?: unknown };
  return parseDateTolerant(tx.date) ?? parseDateTolerant(tx.createdAt) ?? null;
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const products = await getProducts();
  const transactions = await getTransactions();
  const jobs = normalizeAndFilterJobs(await getJasaCatJobs() as unknown[]);

  const today = new Date();

  let todayRevenue = 0;
  let todayProfit = 0;
  let monthlyRevenue = 0;
  let monthlyProfit = 0;

  transactions.forEach((t: Transaction) => {
    const d = getTransactionDate(t);
    const total = safeNum(t.total);
    const profit = safeNum(t.profit);

    if (d && isSameDay(d, today)) {
      todayRevenue += total;
      todayProfit += profit;
    }

    if (d && isSameMonth(d, today)) {
      monthlyRevenue += total;
      monthlyProfit += profit;
    }
  });

  jobs.forEach((job) => {
    const d = parseDateTolerant(job.dateRaw);
    if (!d) return;

    if (isSameDay(d, today)) {
      todayRevenue += job.selling;
      todayProfit += job.profit;
    }

    if (isSameMonth(d, today)) {
      monthlyRevenue += job.selling;
      monthlyProfit += job.profit;
    }
  });

  return {
    totalProducts: products.length,
    lowStockProducts: products.filter((p) => p.stock <= p.minStock).length,
    todayRevenue,
    todayProfit,
    monthlyRevenue,
    monthlyProfit,
  };
};

export const getChartData = async (days: number = 7): Promise<ChartData[]> => {
  const transactions = await getTransactions();
  const jobs = normalizeAndFilterJobs(await getJasaCatJobs() as unknown[]);

  const chartData: ChartData[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');

    const dayTransactions = transactions.filter((t) => {
      const d = getTransactionDate(t);
      return d ? format(d, 'yyyy-MM-dd') === dateStr : false;
    });

    const txRevenue = dayTransactions.reduce((sum, t) => sum + safeNum(t.total), 0);
    const txProfit = dayTransactions.reduce((sum, t) => sum + safeNum(t.profit), 0);

    const dayJobs = jobs.filter((job) => {
      const d = parseDateTolerant(job.dateRaw);
      return d ? format(d, 'yyyy-MM-dd') === dateStr : false;
    });

    const jobRevenue = dayJobs.reduce((sum, job) => sum + job.selling, 0);
    const jobProfit = dayJobs.reduce((sum, job) => sum + job.profit, 0);

    chartData.push({
      date: format(date, 'dd/MM'),
      revenue: txRevenue + jobRevenue,
      profit: txProfit + jobProfit,
      transactions: dayTransactions.length + dayJobs.length,
    });
  }

  return chartData;
};

export const getTopSellingProducts = async (
  limit: number = 5
): Promise<Array<{
  product: Product;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
}>> => {
  const transactions = await getTransactions();
  const products = await getProducts();
  const jobs = normalizeAndFilterJobs(await getJasaCatJobs() as unknown[]);

  const sevenDaysAgo = subDays(new Date(), 6);

  type Stat = {
    totalSold: number;
    totalRevenue: number;
    totalProfit: number;
    label: string;
    code: string;
    sourceType: 'product' | 'service';
  };

  const productStats = new Map<string, Stat>();

  const recentTransactions = transactions.filter((t) => {
    const d = getTransactionDate(t);
    return d ? d >= sevenDaysAgo : false;
  });

  recentTransactions.forEach((transaction) => {
    const items = getTransactionItems(transaction);

    items.forEach((item) => {
      const productId = toStringValue(item.productId);
      const productCode = toStringValue(item.productCode);
      const productName = toStringValue(item.productName);

      const matchedProduct =
        products.find((p) => p.id === productId || p.code === productCode) || null;

      const label =
        productName ||
        productCode ||
        productId ||
        matchedProduct?.name ||
        'Unknown Product';

      const code =
        productName
          ? toDisplayCode(productName)
          : productCode
            ? toDisplayCode(productCode)
            : productId
              ? toDisplayCode(productId)
              : matchedProduct?.code
                ? toDisplayCode(matchedProduct.code)
                : 'UNKNOWN';

      const key = productId || productCode || productName || label || 'unknown-item';

      const stats = productStats.get(key) ?? {
        totalSold: 0,
        totalRevenue: 0,
        totalProfit: 0,
        label,
        code,
        sourceType: 'product',
      };

      stats.totalSold += safeNum(item.quantity);
      stats.totalRevenue += safeNum(item.subtotal);
      stats.totalProfit += safeNum(item.profit);
      stats.label = label;
      stats.code = code;
      stats.sourceType = 'product';

      productStats.set(key, stats);
    });
  });

  const recentJobs = jobs.filter((job) => {
    const d = parseDateTolerant(job.dateRaw);
    return d ? d >= sevenDaysAgo : false;
  });

  recentJobs.forEach((job) => {
    const key = `jasa-${job.motorType}`;
    const label = `Jasa Cat - ${job.motorType}`;
    const code = toDisplayCode(key);

    const stats = productStats.get(key) ?? {
      totalSold: 0,
      totalRevenue: 0,
      totalProfit: 0,
      label,
      code,
      sourceType: 'service',
    };

    stats.totalSold += 1;
    stats.totalRevenue += job.selling;
    stats.totalProfit += job.profit;
    stats.label = label;
    stats.code = code;
    stats.sourceType = 'service';

    productStats.set(key, stats);
  });

  return Array.from(productStats.entries())
    .map(([key, stats]) => {
      const matchedProduct =
        products.find((p) => p.id === key || p.code === stats.code || p.name === stats.label) ||
        null;

      const now = new Date().toISOString();

      const baseProduct: Product = matchedProduct
        ? {
            ...matchedProduct,
            name: stats.label,
            code: stats.code,
          }
        : {
            id: key,
            code: stats.code,
            name: stats.label,
            category: stats.sourceType === 'service' ? 'Jasa' : 'Produk',
            modalPrice: 0,
            sellPrice: stats.totalSold > 0 ? Math.round(stats.totalRevenue / stats.totalSold) : 0,
            stock: 0,
            minStock: 0,
            unit: stats.sourceType === 'service' ? 'Service' : 'Pcs',
            isAvailable: true,
            createdAt: now,
            updatedAt: now,
          };

      return {
        product: baseProduct,
        totalSold: stats.totalSold,
        totalRevenue: stats.totalRevenue,
        totalProfit: stats.totalProfit,
      };
    })
    .sort((a, b) => {
      if (b.totalSold !== a.totalSold) return b.totalSold - a.totalSold;
      return b.totalRevenue - a.totalRevenue;
    })
    .slice(0, limit);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};