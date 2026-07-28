const BASE_URL = import.meta.env.VITE_API_URL;

type APIError = { detail?: string };

const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
  // Lampirkan sessionToken supaya server bisa memvalidasi otorisasi (bukan localStorage).
  let authHeader: Record<string, string> = {};
  try {
    const t = localStorage.getItem("sessionToken");
    if (t) authHeader = { Authorization: `Bearer ${t}` };
  } catch { /* ignore */ }
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error = data as APIError;
    throw new Error(error?.detail || "Terjadi kesalahan pada server");
  }
  return data as T;
};

// =====================
// TYPES
// =====================
export type Product = {
  id: string; code: string; name: string; category: string;
  modalPrice: number; sellPrice: number; stock: number;
  minStock: number; unit: string; isAvailable: boolean;
};
export type ProductInput = Omit<Product, "id">;

export type CategoryEntry = { name: string; color: string };

export type StoredUser = {
  id: string; username: string; password: string;
  name: string; role: "admin" | "staff"; email: string; createdAt: string;
};

// =====================
// PRODUCTS
// =====================
export const getProducts = () => fetchJSON<Product[]>(`${BASE_URL}/products`);
export const addProduct = (data: ProductInput) =>
  fetchJSON<Product>(`${BASE_URL}/products`, { method: "POST", body: JSON.stringify(data) });
export const updateProduct = (id: string, data: ProductInput) =>
  fetchJSON<Product>(`${BASE_URL}/products/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteProduct = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/products/${id}`, { method: "DELETE" });
export const updateProductStock = (id: string, quantity: number) =>
  fetchJSON<Product>(`${BASE_URL}/products/stock/${id}?quantity=${quantity}`, { method: "PUT" });
export const updateProductAvailability = (id: string, isAvailable: boolean) =>
  fetchJSON<Product>(`${BASE_URL}/products/availability/${id}`, {
    method: "PUT", body: JSON.stringify({ isAvailable }),
  });

// =====================
// TRANSACTIONS
// =====================
export const getTransactions = () => fetchJSON<unknown[]>(`${BASE_URL}/transactions`);
export const addTransaction = (data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/transactions`, { method: "POST", body: JSON.stringify(data) });
export const deleteTransaction = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/transactions/${id}`, { method: "DELETE" });

// =====================
// STOCK MOVEMENTS
// =====================
export const getStockMovements = () => fetchJSON<unknown[]>(`${BASE_URL}/stock-movements`);
export const addStockMovement = (data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/stock-movements`, { method: "POST", body: JSON.stringify(data) });
export const deleteMovementsByTransaction = (transactionId: string) =>
  fetchJSON<void>(`${BASE_URL}/stock-movements/transaction/${transactionId}`, { method: "DELETE" });

// =====================
// JASA CAT JOBS
// =====================
export const getJasaCatJobs = () => fetchJSON<unknown[]>(`${BASE_URL}/jasa-cat-jobs`);
export const addJasaCatJob = (data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/jasa-cat-jobs`, { method: "POST", body: JSON.stringify(data) });
export const updateJasaCatJob = (id: string, data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/jasa-cat-jobs/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteJasaCatJob = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/jasa-cat-jobs/${id}`, { method: "DELETE" });

// =====================
// SERVICE TYPES
// =====================
export type ServiceTypeData = {
  id: string; name: string; color: string;
  prices: { bebek: number; matic: number; sport: number };
  modal: { bebek: number; matic: number; sport: number };
};
export const getServiceTypes = () => fetchJSON<ServiceTypeData[]>(`${BASE_URL}/service-types`);
export const addServiceType = (data: Omit<ServiceTypeData, 'id'> & { id?: string }) =>
  fetchJSON<ServiceTypeData>(`${BASE_URL}/service-types`, { method: 'POST', body: JSON.stringify(data) });
export const updateServiceType = (id: string, data: Partial<ServiceTypeData>) =>
  fetchJSON<ServiceTypeData>(`${BASE_URL}/service-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteServiceType = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/service-types/${id}`, { method: 'DELETE' });

// =====================
// CATEGORIES
// =====================
export const getCategories = () => fetchJSON<CategoryEntry[]>(`${BASE_URL}/categories`);
export const addCategory = (data: CategoryEntry) =>
  fetchJSON<CategoryEntry>(`${BASE_URL}/categories`, { method: "POST", body: JSON.stringify(data) });
export const updateCategory = (name: string, data: CategoryEntry) =>
  fetchJSON<CategoryEntry>(`${BASE_URL}/categories/${encodeURIComponent(name)}`, {
    method: "PUT", body: JSON.stringify(data),
  });
export const deleteCategory = (name: string) =>
  fetchJSON<void>(`${BASE_URL}/categories/${encodeURIComponent(name)}`, { method: "DELETE" });

// =====================
// AUTH (login + OTP di server)
// =====================
export type LoginResponse = { token: string; username: string; email: string };
export type AuthUser = {
  id: string; username: string; name: string; role: "admin" | "staff"; email: string;
};
export type VerifyOtpResponse = { sessionToken: string; user: AuthUser };

// Langkah 1 login: kirim username+password, server balikin token + email tersamar.
export const loginRequest = (username: string, password: string) =>
  fetchJSON<LoginResponse>(`${BASE_URL}/login`, {
    method: "POST", body: JSON.stringify({ username, password }),
  });
// Langkah 2 login: verifikasi OTP di server.
export const verifyLoginOtp = (token: string, otp: string) =>
  fetchJSON<VerifyOtpResponse>(`${BASE_URL}/verify-otp`, {
    method: "POST", body: JSON.stringify({ token, otp }),
  });
export const resendLoginOtp = (token: string) =>
  fetchJSON<{ success: boolean }>(`${BASE_URL}/resend-otp`, {
    method: "POST", body: JSON.stringify({ token }),
  });

// Sumber kebenaran identitas & role user yang sedang login (validasi sessionToken).
export const getMe = () => fetchJSON<AuthUser>(`${BASE_URL}/me`);

// =====================
// RIWAYAT AKTIVITAS (admin)
// =====================
export type ActivityLog = {
  id: string;
  userId: string;
  username: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityId: string;
  entityName: string;
  description: string;
  createdAt: string;
};
export const getActivityLogs = () => fetchJSON<ActivityLog[]>(`${BASE_URL}/activity-logs`);

// Lupa sandi (semua di server)
export const forgotPasswordRequest = (username: string) =>
  fetchJSON<{ token: string; email: string }>(`${BASE_URL}/forgot-password`, {
    method: "POST", body: JSON.stringify({ username }),
  });
export const forgotPasswordResend = (token: string) =>
  fetchJSON<{ success: boolean }>(`${BASE_URL}/forgot-password/resend`, {
    method: "POST", body: JSON.stringify({ token }),
  });
export const forgotPasswordVerify = (token: string, otp: string) =>
  fetchJSON<{ resetToken: string }>(`${BASE_URL}/forgot-password/verify`, {
    method: "POST", body: JSON.stringify({ token, otp }),
  });
export const forgotPasswordReset = (resetToken: string, newPassword: string) =>
  fetchJSON<{ success: boolean }>(`${BASE_URL}/forgot-password/reset`, {
    method: "POST", body: JSON.stringify({ resetToken, newPassword }),
  });

// =====================
// USERS
// =====================
export const getUsersFromBackend = () => fetchJSON<StoredUser[]>(`${BASE_URL}/users`);
export const addUserToBackend = (data: Omit<StoredUser, "id">) =>
  fetchJSON<StoredUser>(`${BASE_URL}/users`, { method: "POST", body: JSON.stringify(data) });
export const updateUserInBackend = (id: string, data: Partial<StoredUser>) =>
  fetchJSON<StoredUser>(`${BASE_URL}/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteUserFromBackend = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/users/${id}`, { method: "DELETE" });
