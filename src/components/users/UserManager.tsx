// src/components/users/UserManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Shield,
  Mail,
  User as UserIcon,
  Lock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  isUsernameTaken,
  getCurrentUser,
} from '../../utils/auth';
import type { StoredUser } from '../../types';

type FormData = {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'staff';
  email: string;
};

const EMPTY_FORM: FormData = { username: '', password: '', name: '', role: 'staff', email: '' };

const UserManager: React.FC = () => {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<StoredUser | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StoredUser | null>(null);

  const reload = async () => setUsers(await getUsers());

  useEffect(() => { void reload(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const validate = async (): Promise<boolean> => {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = 'Nama wajib diisi';
    if (!form.username.trim()) e.username = 'Username wajib diisi';
    else if (await isUsernameTaken(form.username.trim(), editTarget?.id))
      e.username = 'Username sudah dipakai';
    if (!editTarget && !form.password.trim()) e.password = 'Password wajib diisi';
    if (form.password && form.password.length < 6) e.password = 'Password minimal 6 karakter';
    if (!form.email.trim()) e.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Format email tidak valid';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (u: StoredUser) => {
    setEditTarget(u);
    setForm({ username: u.username, password: '', name: u.name, role: u.role, email: u.email });
    setErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!await validate()) return;
    if (editTarget) {
      const payload: Parameters<typeof updateUser>[1] = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        email: form.email.trim(),
      };
      if (form.password) payload.password = form.password;
      await updateUser(editTarget.id, payload);
      showToast('Pengguna berhasil diperbarui');
    } else {
      await addUser({
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        email: form.email.trim(),
      });
      showToast('Pengguna berhasil ditambahkan');
    }
    setShowModal(false);
    await reload();
  };

  const handleDelete = (u: StoredUser) => {
    if (u.id === currentUser?.id) {
      showToast('Tidak bisa menghapus akun yang sedang digunakan', 'error');
      return;
    }
    setDeleteConfirm(u);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteUser(deleteConfirm.id);
    setDeleteConfirm(null);
    showToast('Pengguna berhasil dihapus');
    await reload();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-white shadow-lg transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="mt-1 text-gray-600">Kelola akses pengguna sistem bengkel</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      {/* Info OTP */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Verifikasi OTP via Email</p>
          <p className="text-xs text-blue-700 mt-0.5">Kode OTP akan dikirim ke email  saat login.</p>
        </div>
      </div>

      {/* User list */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {['Nama', 'Username', 'Email', 'Role', 'Dibuat', 'Aksi'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-blue-500 font-medium">• Anda</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                  }`}>
                    <Shield className="h-3 w-3" />
                    {u.role === 'admin' ? 'Admin' : 'Staff'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser?.id}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada pengguna</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* Nama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pengguna</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })); }}
                    placeholder="Nama pengguna"
                    className={`w-full rounded-xl border pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                  />
                </div>
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono"></span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setErrors(er => ({ ...er, username: undefined })); }}
                    placeholder="username"
                    className={`w-full rounded-xl border pl-8 pr-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${errors.username ? 'border-red-400' : 'border-gray-300'}`}
                  />
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })); }}
                    placeholder="email@domain.com"
                    className={`w-full rounded-xl border pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                <p className="mt-1 text-xs text-gray-500">Digunakan untuk menerima kode OTP saat login</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editTarget && <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(er => ({ ...er, password: undefined })); }}
                    placeholder={editTarget ? '••••••' : 'Minimal 6 karakter'}
                    className={`w-full rounded-xl border pl-10 pr-10 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['admin', 'staff'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                        form.role === r
                          ? r === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {r === 'admin' ? 'Admin' : 'Staff'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={handleSave} className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                {editTarget ? 'Simpan Perubahan' : 'Tambah Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Hapus Pengguna?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Akun <strong>{deleteConfirm.name}</strong> ({deleteConfirm.username}) akan dihapus permanen dan tidak bisa dikembalikan.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={confirmDelete} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
