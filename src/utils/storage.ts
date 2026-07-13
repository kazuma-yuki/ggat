// storage.ts — semua data sekarang dari backend, bukan localStorage
// localStorage hanya dipakai untuk: session user aktif (bengkel_user)

import { User, Product, Transaction, StockMovement } from '../types';
import * as api from '../service/api';

export type JasaCatJob = Record<string, unknown> & {
  id: string;
  date?: string; tanggal?: string; createdAt?: string;
  customer?: string; customerName?: string; namaCustomer?: string;
  motorType?: string; jenisMotor?: string;
  selling?: number; sellingPrice?: number; hargaJual?: number;
  cost?: number; totalCost?: number; biaya?: number;
  profit?: number; notes?: string; catatan?: string;
  deleted?: boolean;
};

export type PaintBatchItem = {
  id: string; name: string; cost: number; remainingUses: number;
};

export type CategoryEntry = { name: string; color: string };

// =====================
// SESSION USER (tetap localStorage)
// =====================
export const getCurrentUser = (): User | null => {
  try {
    const raw = localStorage.getItem('bengkel_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const setCurrentUser = (user: User): void => {
  localStorage.setItem('bengkel_user', JSON.stringify(user));
};
export const clearCurrentUser = (): void => {
  localStorage.removeItem('bengkel_user');
};

// =====================
// PRODUCTS
// =====================
export const getProducts = async (): Promise<Product[]> => {
  const data = await api.getProducts();
  return data.map(p => ({
    ...p, id: String(p.id),
    createdAt: '', updatedAt: '',
  })) as unknown as Product[];
};

export const saveProducts = async (): Promise<void> => {
  // tidak dipakai langsung — gunakan addProduct/updateProduct/deleteProduct
};

export const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  const result = await api.addProduct(product as api.ProductInput);
  return { ...result, id: String(result.id), createdAt: '', updatedAt: '' } as unknown as Product;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  const result = await api.updateProduct(id, updates as api.ProductInput);
  return { ...result, id: String(result.id), createdAt: '', updatedAt: '' } as unknown as Product;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  await api.deleteProduct(id);
  return true;
};

// =====================
// TRANSACTIONS
// =====================
export const getTransactions = async (): Promise<Transaction[]> => {
  const data = await api.getTransactions();
  return (data as Transaction[]).map(t => ({ ...t, id: String(t.id) }));
};

export const saveTransactions = async (): Promise<void> => {
  // tidak dipakai langsung
};

export const setTransactions = saveTransactions;

export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> => {
  const newTx: Transaction = {
    ...transaction,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  const result = await api.addTransaction(newTx) as Transaction;
  // update stok
  for (const item of (transaction.items || [])) {
    try {
      await api.updateProductStock(item.productId, -item.quantity);
      await api.addStockMovement({
        productId: item.productId,
        productName: item.productName,
        type: 'out',
        quantity: item.quantity,
        previousStock: 0,
        newStock: 0,
        reason: 'Penjualan',
        transactionId: String((result as Transaction).id || newTx.id),
        createdBy: transaction.createdBy || 'system',
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Gagal update stok:', e);
    }
  }
  return { ...newTx, id: String((result as Transaction).id || newTx.id) };
};

export const deleteTransaction = async (id: string): Promise<Transaction[]> => {
  try {
    // kembalikan stok — ambil data transaksi dulu
    const transactions = await getTransactions();
    const tx = transactions.find(t => String(t.id) === String(id));
    if (tx) {
      for (const item of (tx.items || [])) {
        try { await api.updateProductStock(item.productId, item.quantity); } catch { /* noop */ }
      }
      await api.deleteMovementsByTransaction(id);
    }
    await api.deleteTransaction(id);
    return transactions.filter(t => String(t.id) !== String(id));
  } catch (e) {
    console.error('Gagal hapus transaksi:', e);
    return [];
  }
};

export const updateProductStock = async (
  productId: string,
  quantityChange: number,
  type: 'in' | 'out' | 'adjustment',
  reason: string,
  transactionId?: string
): Promise<boolean> => {
  try {
    await api.updateProductStock(productId, quantityChange);
    const user = getCurrentUser();
    await api.addStockMovement({
      productId, type, quantity: Math.abs(quantityChange),
      previousStock: 0, newStock: 0, reason,
      transactionId, createdBy: user?.username || 'system',
      createdAt: new Date().toISOString(),
      productName: '',
    });
    return true;
  } catch { return false; }
};

// =====================
// STOCK MOVEMENTS
// =====================
export const getStockMovements = async (): Promise<StockMovement[]> => {
  const data = await api.getStockMovements();
  return (data as StockMovement[]).map(s => ({ ...s, id: String(s.id) }));
};

export const saveStockMovements = async (): Promise<void> => { /* noop */ };

export const addStockMovement = async (movement: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement> => {
  const newM = { ...movement, id: Date.now().toString(), createdAt: new Date().toISOString() };
  await api.addStockMovement(newM);
  return newM;
};

// =====================
// JASA CAT JOBS
// =====================
export const getJasaCatJobs = async (): Promise<JasaCatJob[]> => {
  const data = await api.getJasaCatJobs();
  return (data as JasaCatJob[]).map(j => {
    const { data: rawData, ...topLevel } = j as JasaCatJob & { data?: unknown };
    const richData = (typeof rawData === 'object' && rawData !== null) ? rawData as JasaCatJob : {};
    return {
      ...richData,   // field kaya dari raw body (sellingPrice, items, noHandphone, dll.)
      ...topLevel,   // field normalized backend menang (selling, cost, profit, date, dll.)
      id: String(j.id),
    };
  });
};

export const getJasaCatJobById = async (id: string): Promise<JasaCatJob | null> => {
  const jobs = await getJasaCatJobs();
  return jobs.find(j => String(j.id) === String(id)) || null;
};

export const saveJasaCatJobs = async (): Promise<void> => { /* noop */ };

export const addJasaCatJob = async (job: Partial<JasaCatJob>): Promise<JasaCatJob> => {
  const newJob = { ...job, id: job.id || Date.now().toString(), createdAt: new Date().toISOString() };
  const result = await api.addJasaCatJob(newJob) as JasaCatJob;
  return { ...newJob, id: String((result as JasaCatJob).id || newJob.id) } as JasaCatJob;
};

export const updateJasaCatJob = async (id: string, updates: Partial<JasaCatJob>): Promise<JasaCatJob | null> => {
  const jobs = await getJasaCatJobs();
  const existing = jobs.find(j => String(j.id) === String(id));
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await api.updateJasaCatJob(id, updated);
  return updated as JasaCatJob;
};

export const deleteJasaCatJob = async (id: string): Promise<boolean> => {
  await api.deleteJasaCatJob(id);
  return true;
};

export const clearJasaCatJobs = async (): Promise<void> => {
  const jobs = await getJasaCatJobs();
  for (const j of jobs) { try { await api.deleteJasaCatJob(String(j.id)); } catch { /* noop */ } }
};

// =====================
// PAINT BATCHES
// =====================
export const getPaintBatches = async (): Promise<PaintBatchItem[]> => {
  const data = await api.getPaintBatches();
  return (data as PaintBatchItem[]).map(p => ({ ...p, id: String(p.id) }));
};

export const savePaintBatches = async (): Promise<void> => { /* noop */ };

export const addPaintBatch = async (batch: Partial<PaintBatchItem>): Promise<PaintBatchItem> => {
  const newBatch = {
    name: batch.name || 'Batch Cat',
    cost: batch.cost || 0,
    remainingUses: batch.remainingUses ?? 4,
  };
  const result = await api.addPaintBatch(newBatch) as PaintBatchItem;
  return { ...newBatch, id: String(result.id) };
};

export const updatePaintBatch = async (id: string, updates: Partial<PaintBatchItem>): Promise<PaintBatchItem | null> => {
  const result = await api.updatePaintBatch(id, updates) as PaintBatchItem;
  return { ...result, id: String(result.id) };
};

export const deletePaintBatch = async (id: string): Promise<boolean> => {
  await api.deletePaintBatch(id);
  return true;
};

// =====================
// CATEGORIES
// =====================
export const getCategoryColors = async (): Promise<CategoryEntry[]> => {
  try {
    const data = await api.getCategories();
    if (data.length > 0) return data;
  } catch { /* noop */ }
  return [
    { name: 'Spare Part', color: '#F97316' },
    { name: 'Oli', color: '#EC4899' },
    { name: 'Ban', color: '#14B8A6' },
    { name: 'Velg', color: '#6366F1' },
  ];
};

export const saveCategoryColors = async (entries: CategoryEntry[]): Promise<void> => {
  const existing = await api.getCategories();
  const existingNames = existing.map(e => e.name);
  for (const entry of entries) {
    if (existingNames.includes(entry.name)) {
      await api.updateCategory(entry.name, entry);
    } else {
      await api.addCategory(entry);
    }
  }
};

export const getCategoryColorByName = async (name: string): Promise<string | undefined> => {
  const entries = await getCategoryColors();
  return entries.find(c => c.name === name)?.color;
};

export const getCategories = async (): Promise<string[]> => {
  const entries = await getCategoryColors();
  return entries.map(e => e.name);
};

export const saveCategories = async (): Promise<void> => { /* noop */ };

export const addCategory = async (name: string, color?: string): Promise<string[]> => {
  try { await api.addCategory({ name, color: color ?? '#14B8A6' }); } catch { /* noop */ }
  return getCategories();
};

export const editCategory = async (oldName: string, newName: string, newColor?: string): Promise<string[]> => {
  const entries = await getCategoryColors();
  const existing = entries.find(e => e.name === oldName);
  if (!existing) return getCategories();
  await api.updateCategory(oldName, { name: newName, color: newColor ?? existing.color });
  return getCategories();
};

export const deleteCategory = async (name: string): Promise<string[]> => {
  await api.deleteCategory(name);
  return getCategories();
};

// =====================
// EXPORT / IMPORT (tetap jalan dari backend data)
// =====================
export const exportData = async (): Promise<void> => {
  const [products, transactions, stockMovements, jasaCatJobs, paintBatches] = await Promise.all([
    getProducts(), getTransactions(), getStockMovements(), getJasaCatJobs(), getPaintBatches(),
  ]);
  const data = { products, transactions, stockMovements, jasaCatJobs, paintBatches, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bengkel-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const initializeDefaultData = async (): Promise<void> => {
  // default data dihandle backend saat pertama kali jalan
};