import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, History, Search, Filter, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { getActivityLogs, type ActivityLog } from '../../service/api';

const ENTITY_LABEL: Record<string, string> = {
  product: 'Produk',
  transaction: 'Transaksi Penjualan',
  jasa_service: 'Jasa Servis',
  service_type: 'Jenis Service',
  category: 'Kategori',
  user: 'Pengguna',
};

const ACTION_META: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  create: { label: 'Tambah', cls: 'bg-green-100 text-green-700', Icon: PlusCircle },
  update: { label: 'Edit', cls: 'bg-blue-100 text-blue-700', Icon: Pencil },
  delete: { label: 'Hapus', cls: 'bg-red-100 text-red-700', Icon: Trash2 },
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayYMD = () => ymd(new Date());
const daysAgoYMD = (n: number) => ymd(new Date(Date.now() - n * 86400000));

const formatWaktu = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta', // selalu tampil WIB, apa pun zona perangkat pengguna
  });
};

const ActivityLogManager: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState(todayYMD());
  const [toDate, setToDate] = useState(todayYMD());

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await getActivityLogs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat riwayat aktivitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (entityFilter !== 'all' && l.entity !== entityFilter) return false;
      const day = (l.createdAt || '').slice(0, 10); // YYYY-MM-DD
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      if (!q) return true;
      return (
        l.username.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.entityName.toLowerCase().includes(q) ||
        (ENTITY_LABEL[l.entity] ?? l.entity).toLowerCase().includes(q)
      );
    });
  }, [logs, search, actionFilter, entityFilter, fromDate, toDate]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Riwayat Aktivitas</h1>
            <p className="text-sm text-gray-500">Catatan siapa menambah, mengubah, atau menghapus data.</p>
          </div>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pengguna, keterangan, atau nama data..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua aksi</option>
            <option value="create">Tambah</option>
            <option value="update">Ubah</option>
            <option value="delete">Hapus</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua fitur</option>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">Periode</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => { setFromDate(daysAgoYMD(30)); setToDate(todayYMD()); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
          >
            Semua
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Waktu</th>
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Pengguna</th>
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Aksi</th>
                <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Fitur</th>
                <th className="text-left font-semibold px-4 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Belum ada aktivitas.</td></tr>
              ) : (
                filtered.map((l) => {
                  const meta = ACTION_META[l.action] ?? ACTION_META.update;
                  const Icon = meta.Icon;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatWaktu(l.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{l.username || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{ENTITY_LABEL[l.entity] ?? l.entity}</td>
                      <td className="px-4 py-3 text-gray-700">{l.description || l.entityName || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Menampilkan {filtered.length} dari {logs.length} aktivitas. Riwayat disimpan maksimal 1 bulan terakhir; data lebih lama otomatis dihapus.
      </p>
    </div>
  );
};

export default ActivityLogManager;
