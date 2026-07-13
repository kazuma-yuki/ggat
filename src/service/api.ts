const BASE_URL = import.meta.env.VITE_API_URL;

type APIError = { detail?: string };

const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
// PAINT BATCHES
// =====================
export const getPaintBatches = () => fetchJSON<unknown[]>(`${BASE_URL}/paint-batches`);
export const addPaintBatch = (data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/paint-batches`, { method: "POST", body: JSON.stringify(data) });
export const updatePaintBatch = (id: string, data: unknown) =>
  fetchJSON<unknown>(`${BASE_URL}/paint-batches/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deletePaintBatch = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/paint-batches/${id}`, { method: "DELETE" });

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
// USERS
// =====================
export const getUsersFromBackend = () => fetchJSON<StoredUser[]>(`${BASE_URL}/users`);
export const addUserToBackend = (data: Omit<StoredUser, "id">) =>
  fetchJSON<StoredUser>(`${BASE_URL}/users`, { method: "POST", body: JSON.stringify(data) });
export const updateUserInBackend = (id: string, data: Partial<StoredUser>) =>
  fetchJSON<StoredUser>(`${BASE_URL}/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteUserFromBackend = (id: string) =>
  fetchJSON<void>(`${BASE_URL}/users/${id}`, { method: "DELETE" });
