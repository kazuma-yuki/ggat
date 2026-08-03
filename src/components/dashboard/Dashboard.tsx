// src/components/dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Package,
  TrendingUp,
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import StatsCard from '../common/StatsCard';
import {
  getChartData,
  formatCurrency,
  normalizeAndFilterJobs,
} from '../../utils/analytics';
import { getTransactions, getJasaCatJobs, getProducts } from '../../utils/storage';
import { localISO } from '../../utils/datetime';
import { Product as ProductType, ChartData } from '../../types';
import { format } from 'date-fns';

declare global {
  interface WindowEventMap {
    appDataChanged: Event;
  }
}

type RecentActivity = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  createdAt: string;
  date?: string;
  total: number;
  profit: number;
  kind: 'produk' | 'jasa';
  items: Array<{
    quantity: number;
    productName: string;
  }>;
};

const safeNum = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const getActivityDate = (activity: RecentActivity): Date | null => {
  const raw = activity.createdAt || activity.date || '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [transactions, setTransactions] = useState<RecentActivity[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const loadData = async () => {
    setLoading(true);

    try {
      const productData = await getProducts();
      const transactionData = await getTransactions();
      const jasaRaw = await getJasaCatJobs();
      const jasaData = normalizeAndFilterJobs(jasaRaw as unknown[]);

      const salesActivities: RecentActivity[] = transactionData.map((tx) => {
        const rawItems = (tx as unknown as { items?: unknown[] }).items ?? [];

        return {
          id: tx.id,
          invoiceNumber:
            (tx as unknown as { invoiceNumber?: string }).invoiceNumber || `INV${tx.id}`,
          customerName:
            (tx as unknown as { customerName?: string }).customerName || 'Customer Umum',
          createdAt:
            (tx as unknown as { createdAt?: string; date?: string }).createdAt ||
            (tx as unknown as { date?: string }).date ||
            localISO(),
          date: (tx as unknown as { date?: string }).date,
          total: safeNum((tx as unknown as { total?: unknown }).total),
          profit: safeNum((tx as unknown as { profit?: unknown }).profit),
          kind: 'produk',
          items: Array.isArray(rawItems)
            ? rawItems.map((item) => {
                const itemObj = item as unknown as {
                  quantity?: unknown;
                  productName?: unknown;
                };

                return {
                  quantity: safeNum(itemObj.quantity),
                  productName: toStringValue(itemObj.productName) || 'Item',
                };
              })
            : [],
        };
      });

      const jasaActivities: RecentActivity[] = jasaData.map((job) => ({
        id: `jasa-${job.id}`,
        invoiceNumber: `JASA-${job.id}`,
        customerName: job.customer || 'Customer Jasa',
        createdAt: job.dateRaw || localISO(),
        date: job.dateRaw || undefined,
        total: job.selling,
        profit: job.profit,
        kind: 'jasa',
        items: [
          {
            quantity: 1,
            productName: `Jasa Cat ${job.motorType}`,
          },
        ],
      }));

      const combined = [...salesActivities, ...jasaActivities].sort((a, b) => {
        const da = getActivityDate(a)?.getTime() ?? 0;
        const db = getActivityDate(b)?.getTime() ?? 0;
        return db - da;
      });

      setProducts(productData);
      setTransactions(combined);
      setChartData(await getChartData(7));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const refresh = () => {
      loadData();
    };

    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('appDataChanged', refresh);

    const intervalId = window.setInterval(refresh, 10000);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('appDataChanged', refresh);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dipisah agar dua kondisi yang berbeda tidak tercampur:
  // stok habis (0) berarti tidak bisa dijual sama sekali, sedangkan stok rendah
  // masih bisa dijual tetapi perlu segera dipesan ulang.
  const outOfStockProducts = products.filter((product) => product.stock <= 0);
  const lowStockProducts = products.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock
  );
  // Gabungan keduanya, dipakai untuk daftar peringatan di bawah dashboard.
  const stockAlertProducts = [...outOfStockProducts, ...lowStockProducts];

  const today = new Date();
  const todayDate = format(today, 'yyyy-MM-dd');

  const todayTransactions = transactions.filter((tx) => {
    const d = getActivityDate(tx);
    return d ? format(d, 'yyyy-MM-dd') === todayDate : false;
  });

  // const last7DaysTransactions = transactions.filter((tx) => {
  //   const d = getActivityDate(tx);
  //   if (!d) return false;

  //   const now = new Date();
  //   const diffTime = now.getTime() - d.getTime();
  //   const diffDays = diffTime / (1000 * 60 * 60 * 24);

  //   return diffDays <= 7;
  // });

  const todayRevenue = todayTransactions.reduce((sum, tx) => sum + tx.total, 0);
  const todayProfit = todayTransactions.reduce((sum, tx) => sum + tx.profit, 0);

  const targetTodayRevenue = 1_000_000;
  const targetProgress = Math.min((todayRevenue / targetTodayRevenue) * 100, 100);

  const currentDate = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statsCards = [
    {
      label: 'Total Produk',
      value: products.length,
      icon: Package,
      color: 'blue' as const,
      format: 'number' as const,
      subtitle: 'Produk aktif',
    },
    {
      label: 'Stok Habis',
      value: outOfStockProducts.length,
      icon: AlertTriangle,
      color: 'red' as const,
      format: 'number' as const,
      subtitle: 'Tidak bisa dijual',
    },
    {
      label: 'Stok Rendah',
      value: lowStockProducts.length,
      icon: AlertTriangle,
      color: 'yellow' as const,
      format: 'number' as const,
      subtitle: 'Perlu restock',
    },
    {
      label: 'Omzet Hari Ini',
      value: todayRevenue,
      icon: TrendingUp,
      color: 'blue' as const,
      format: 'currency' as const,
      subtitle: 'Sales + jasa cat',
    },
    {
      label: 'Keuntungan Hari Ini',
      value: todayProfit,
      icon: BarChart3,
      color: 'green' as const,
      format: 'currency' as const,
      subtitle: 'Keuntungan harian',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-gray-600">Ringkasan aktivitas bengkel hari ini</p>
            <p className="mt-1 text-sm text-gray-500">{currentDate}</p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-green-800">
            <Calendar size={20} />
            <span className="font-medium">
              {targetProgress >= 100 ? 'Target tercapai' : 'Pantau penjualan harian'}
            </span>
          </div>
        </div>

        {loading && <p className="mt-3 text-sm text-gray-500">Memuat data...</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <StatsCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              icon={Icon}
              color={stat.color}
              format={stat.format}
              subtitle={stat.subtitle}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Tren Penjualan 7 Hari Terakhir</h3>
          </div>

          {chartData.length === 0 ? (
            <div className="py-8 text-center text-gray-500">Belum ada data penjualan</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'revenue' ? 'Omzet' : 'Keuntungan',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Progress Target Hari Ini</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Target omzet harian</span>
            <span className="font-medium text-gray-900">{formatCurrency(targetTodayRevenue)}</span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-3 rounded-full bg-blue-600" style={{ width: `${targetProgress}%` }} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Realisasi</span>
            <span className="font-medium text-blue-600">
              {formatCurrency(todayRevenue)} ({targetProgress.toFixed(1)}%)
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Profit hari ini</span>
            <span className="font-medium text-green-600">{formatCurrency(todayProfit)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Sisa menuju target</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(Math.max(targetTodayRevenue - todayRevenue, 0))}
            </span>
          </div>
        </div>
      </div>

      {stockAlertProducts.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Peringatan Persediaan</h3>
            <span className="text-sm text-red-700">
              {outOfStockProducts.length} habis &middot; {lowStockProducts.length} rendah
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stockAlertProducts.map((product) => {
              const habis = product.stock <= 0;
              return (
                <div
                  key={product.id}
                  className={`rounded-lg bg-white p-4 border-l-4 ${habis ? 'border-red-500' : 'border-yellow-400'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      habis ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {habis ? 'Habis' : 'Rendah'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Kode: {product.code}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-sm ${habis ? 'text-red-600' : 'text-yellow-700'}`}>
                      Stok: {product.stock} {product.unit}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      Min: {product.minStock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;