import { User, StoredUser } from '../types';
import { setCurrentUser, clearCurrentUser, getCurrentUser as storageGetCurrentUser } from './storage';
import { sendOtpEmail } from './emailService';
import {
  getUsersFromBackend, addUserToBackend,
  updateUserInBackend, deleteUserFromBackend,
} from '../service/api';

// OTP in-memory
const otpStore = new Map<string, { otp: string; expires: number }>();

// ── Auth ──────────────────────────────────────────────────────────────
export const verifyCredentials = async (username: string, password: string): Promise<StoredUser | null> => {
  const users = await ensureDefaultUsers();
  return users.find(u => u.username === username && u.password === password) ?? null;
};

export const loginAfterOtp = (user: StoredUser): User => {
  const userWithoutPassword: User = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    ...(user.email ? { email: user.email } : {}),
  };
  setCurrentUser(userWithoutPassword);
  return userWithoutPassword;
};

export const logout = (): void => { clearCurrentUser(); };
export const getCurrentUser = (): User | null => storageGetCurrentUser();

// ── OTP ───────────────────────────────────────────────────────────────
export const generateAndSendOtp = async (user: StoredUser): Promise<{ success: boolean; error?: string }> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(user.username, { otp, expires: Date.now() + 5 * 60 * 1000 });
  return sendOtpEmail(user.email, user.name, otp);
};

export const verifyOtp = (username: string, otp: string): boolean => {
  const entry = otpStore.get(username);
  if (!entry) return false;
  if (Date.now() > entry.expires) { otpStore.delete(username); return false; }
  if (entry.otp !== otp.trim()) return false;
  otpStore.delete(username);
  return true;
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