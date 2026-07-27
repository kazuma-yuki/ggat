import { User, StoredUser } from '../types';
import { setCurrentUser, clearCurrentUser, getCurrentUser as storageGetCurrentUser } from './storage';
import {
  getMe,
  getUsersFromBackend, addUserToBackend,
  updateUserInBackend, deleteUserFromBackend,
} from '../service/api';

// ── Auth ──────────────────────────────────────────────────────────────
// Validasi username/password & OTP kini sepenuhnya di server
// (lihat src/service/api.ts: loginRequest / verifyLoginOtp / forgotPassword*).
// File ini hanya menyimpan sesi user yang sudah lolos verifikasi OTP.

export const loginAfterOtp = (user: User): User => {
  const cleanUser: User = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    ...(user.email ? { email: user.email } : {}),
  };
  setCurrentUser(cleanUser);
  return cleanUser;
};

export const saveSessionToken = (token: string): void => {
  try { localStorage.setItem('sessionToken', token); } catch { /* ignore */ }
};

export const logout = (): void => {
  clearCurrentUser();
  try { localStorage.removeItem('sessionToken'); } catch { /* ignore */ }
};

export const getCurrentUser = (): User | null => storageGetCurrentUser();

// Validasi sesi ke server. Role/identitas diambil dari /me (bukan localStorage),
// sehingga mengubah localStorage tidak bisa menaikkan hak akses.
export const validateSession = async (): Promise<User | null> => {
  let token: string | null = null;
  try { token = localStorage.getItem('sessionToken'); } catch { token = null; }
  if (!token) { logout(); return null; }
  try {
    const u = await getMe();
    const clean: User = {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      ...(u.email ? { email: u.email } : {}),
    };
    setCurrentUser(clean);
    return clean;
  } catch {
    // Token tidak valid / kedaluwarsa → paksa logout.
    logout();
    return null;
  }
};

// ── User Management ───────────────────────────────────────────────────
const ensureDefaultUsers = async (): Promise<StoredUser[]> => {
  let users = await getUsersFromBackend();
  if (users.length === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' as const, email: 'ggat.kasir1@yopmail.com', createdAt: now },
      { username: 'staff', password: 'staff123', name: 'Staff Bengkel', role: 'staff' as const, email: 'ggat.kasir1@yopmail.com', createdAt: now },
    ];
    for (const d of defaults) { await addUserToBackend(d); }
    users = await getUsersFromBackend();
  }
  return users;
};

export const getUsers = async (): Promise<StoredUser[]> => ensureDefaultUsers();

export const addUser = async (data: Omit<StoredUser, 'id' | 'createdAt'>): Promise<StoredUser> => {
  return addUserToBackend({ ...data, createdAt: new Date().toISOString() });
};

export const updateUser = async (id: string, data: Partial<Omit<StoredUser, 'id' | 'createdAt'>>): Promise<StoredUser | null> => {
  return updateUserInBackend(id, data);
};

export const deleteUser = async (id: string): Promise<boolean> => {
  await deleteUserFromBackend(id);
  return true;
};

export const isUsernameTaken = async (username: string, excludeId?: string): Promise<boolean> => {
  const users = await getUsersFromBackend();
  return users.some(u => u.username === username && u.id !== excludeId);
};