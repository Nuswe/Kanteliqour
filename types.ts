
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
}

export enum PaymentMethod {
  CASH = 'Cash',
  AIRTEL_MONEY = 'Airtel Money',
  TNM_MPAMBA = 'TNM Mpamba',
  BANK_TRANSFER = 'Bank Transfer',
}

export enum ProductCategory {
  SPIRITS = 'Spirits',
  WINES = 'Wines',
  BEER = 'Beer',
  SOFT_DRINKS = 'Soft Drinks',
  CIGARETTES = 'Cigarettes',
  SNACKS = 'Snacks',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  costPrice: number;
  stock: number;
  barcode: string;
  image?: string;
  lowStockThreshold: number;
  expiryDate?: string;
  supplierId?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  costPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  date: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  recordedBy: string;
}

export interface StoreSettings {
  shopName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  tinNumber: string;
  taxRate: number;
  receiptFooter: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

export interface AppState {
  currentUser: User | null;
}