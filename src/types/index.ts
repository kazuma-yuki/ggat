export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff';
  email?: string;
}

export interface StoredUser extends User {
  password: string;
  email: string;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  modalPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  discountPct?: number;
  total: number;
  profit: number;
  paymentMethod: 'cash' | 'non_tunai';
  customerName?: string;
  customerPhone?: string;
  nomorPolisi?: string;
  uangBayar?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  modalPrice: number;
  sellPrice: number;
  subtotal: number;
  profit: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  transactionId?: string;
  createdBy: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  todayRevenue: number;
  todayProfit: number;
  monthlyRevenue: number;
  monthlyProfit: number;
}

export interface ChartData {
  date: string;
  revenue: number;
  profit: number;
  transactions: number;
}
