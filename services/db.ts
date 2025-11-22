import { Product, ProductCategory, User, UserRole, Sale, Customer, Supplier } from '../types';

// Initial Seed Data
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Jack Daniels 750ml', category: ProductCategory.SPIRITS, price: 45000, costPrice: 35000, stock: 24, barcode: '1001', lowStockThreshold: 5 },
  { id: '2', name: 'Smirnoff Vodka 750ml', category: ProductCategory.SPIRITS, price: 18000, costPrice: 12000, stock: 12, barcode: '1002', lowStockThreshold: 5 },
  { id: '3', name: 'Carlsberg Green', category: ProductCategory.BEER, price: 1500, costPrice: 1000, stock: 150, barcode: '1003', lowStockThreshold: 48 },
  { id: '4', name: 'Castel Beer', category: ProductCategory.BEER, price: 1400, costPrice: 950, stock: 200, barcode: '1004', lowStockThreshold: 48 },
  { id: '5', name: 'Red Sweet Wine', category: ProductCategory.WINES, price: 8500, costPrice: 6000, stock: 30, barcode: '1005', lowStockThreshold: 6 },
  { id: '6', name: 'Coca Cola 300ml', category: ProductCategory.SOFT_DRINKS, price: 600, costPrice: 400, stock: 100, barcode: '1006', lowStockThreshold: 24 },
  { id: '7', name: 'Marlboro Gold', category: ProductCategory.CIGARETTES, price: 5000, costPrice: 3500, stock: 50, barcode: '1007', lowStockThreshold: 10 },
];

const INITIAL_USERS: User[] = [
  { id: '1', name: 'Admin User', role: UserRole.ADMIN, username: 'admin' },
  { id: '2', name: 'Jane Manager', role: UserRole.MANAGER, username: 'manager' },
  { id: '3', name: 'John Cashier', role: UserRole.CASHIER, username: 'cashier' },
];

// LocalStorage Keys
const KEYS = {
  PRODUCTS: 'kante_products',
  SALES: 'kante_sales',
  USERS: 'kante_users',
  CUSTOMERS: 'kante_customers',
  SUPPLIERS: 'kante_suppliers',
};

// Helper to safely parse JSON
const get = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return initial;
  }
};

const set = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// DB API
export const db = {
  products: {
    getAll: () => get<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS),
    save: (products: Product[]) => set(KEYS.PRODUCTS, products),
    add: (product: Product) => {
      const products = db.products.getAll();
      products.push(product);
      db.products.save(products);
    },
    update: (product: Product) => {
      const products = db.products.getAll();
      const index = products.findIndex(p => p.id === product.id);
      if (index !== -1) {
        products[index] = product;
        db.products.save(products);
      }
    },
    reduceStock: (id: string, qty: number) => {
      const products = db.products.getAll();
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        products[index].stock = Math.max(0, products[index].stock - qty);
        db.products.save(products);
      }
    }
  },
  sales: {
    getAll: () => get<Sale[]>(KEYS.SALES, []),
    add: (sale: Sale) => {
      const sales = db.sales.getAll();
      sales.push(sale);
      set(KEYS.SALES, sales);
    }
  },
  users: {
    getAll: () => get<User[]>(KEYS.USERS, INITIAL_USERS),
  },
  customers: {
    getAll: () => get<Customer[]>(KEYS.CUSTOMERS, []),
    add: (customer: Customer) => {
      const list = db.customers.getAll();
      list.push(customer);
      set(KEYS.CUSTOMERS, list);
    }
  }
};