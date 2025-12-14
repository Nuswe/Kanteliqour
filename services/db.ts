import { 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    updateDoc, 
    addDoc, 
    deleteDoc,
    increment,
    query,
    orderBy,
    limit,
    getDoc
  } from 'firebase/firestore';
  import { dbInstance } from './firebase';
  import { Product, ProductCategory, User, UserRole, Sale, Customer, Expense, Supplier, StoreSettings, ActivityLog } from '../types';
  
  // Mock Data for fallback if DB is empty or fails
  const INITIAL_PRODUCTS: Product[] = [
    { id: '1', name: 'Jack Daniels 750ml', category: ProductCategory.SPIRITS, price: 45000, costPrice: 35000, stock: 24, barcode: '1001', lowStockThreshold: 5 },
    { id: '2', name: 'Smirnoff Vodka 750ml', category: ProductCategory.SPIRITS, price: 18000, costPrice: 12000, stock: 12, barcode: '1002', lowStockThreshold: 5 },
    { id: '3', name: 'Carlsberg Green', category: ProductCategory.BEER, price: 1500, costPrice: 1000, stock: 150, barcode: '1003', lowStockThreshold: 48 },
    { id: '4', name: 'Red Wine 750ml', category: ProductCategory.WINES, price: 8500, costPrice: 5000, stock: 5, barcode: '1004', lowStockThreshold: 10, expiryDate: new Date(Date.now() + 86400000 * 15).toISOString() }, // Expiring soon
    { id: '5', name: 'Coke 300ml', category: ProductCategory.SOFT_DRINKS, price: 500, costPrice: 300, stock: 0, barcode: '1005', lowStockThreshold: 24 }, // Out of stock
  ];

  const INITIAL_EXPENSES: Expense[] = [
    { id: '1', date: new Date().toISOString(), category: 'Utilities', description: 'Electricity Bill', amount: 15000, recordedBy: 'Admin' },
    { id: '2', date: new Date(Date.now() - 86400000 * 5).toISOString(), category: 'Rent', description: 'Shop Rent - Partial', amount: 50000, recordedBy: 'Admin' }
  ];

  const INITIAL_SUPPLIERS: Supplier[] = [
    { id: '1', name: 'Castel Malawi', contactPerson: 'John Doe', phone: '+265 999 000 000', email: 'orders@castel.mw' },
    { id: '2', name: 'Peoples Trading', contactPerson: 'Jane Smith', phone: '+265 888 111 222', email: 'sales@ptc.mw' }
  ];

  const DEFAULT_SETTINGS: StoreSettings = {
    shopName: 'Kante Liquor',
    addressLine1: 'Plot 123, Area 10',
    addressLine2: 'Lilongwe, Malawi',
    phone: '+265 999 123 456',
    tinNumber: '12345678',
    taxRate: 16.5,
    receiptFooter: 'Thank you for shopping with us! No returns on alcohol.'
  };
  
  // --- CACHE LAYER ---
  let productCache: Product[] | null = null;
  let supplierCache: Supplier[] | null = null;
  let settingsCache: StoreSettings | null = null;
  
  // Helper to map Firestore docs to our types
  const mapDoc = <T>(doc: any): T => ({ id: doc.id, ...doc.data() } as T);

  // Helper to remove undefined values
  const cleanData = (data: any) => {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        cleaned[key] = data[key];
      }
    });
    return cleaned;
  };
  
  export const db = {
    settings: {
        get: async (): Promise<StoreSettings> => {
            if (settingsCache) return settingsCache;
            try {
                const docRef = doc(dbInstance, 'settings', 'general');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    settingsCache = docSnap.data() as StoreSettings;
                    return settingsCache;
                }
                return DEFAULT_SETTINGS;
            } catch (e) {
                console.error("Error fetching settings:", e);
                return DEFAULT_SETTINGS;
            }
        },
        save: async (settings: StoreSettings) => {
            await setDoc(doc(dbInstance, 'settings', 'general'), cleanData(settings));
            settingsCache = settings;
        }
    },
    products: {
      getAll: async (): Promise<Product[]> => {
        if (productCache) return productCache;
        try {
          const snapshot = await getDocs(collection(dbInstance, 'products'));
          const products = snapshot.docs.map(d => mapDoc<Product>(d));
          if (products.length === 0) {
             productCache = INITIAL_PRODUCTS;
             return INITIAL_PRODUCTS;
          }
          productCache = products;
          return products;
        } catch (e) {
          console.error("Error fetching products:", e);
          return productCache || INITIAL_PRODUCTS;
        }
      },
      add: async (product: Product) => {
        await setDoc(doc(dbInstance, 'products', product.id), cleanData(product));
        productCache = null;
      },
      update: async (product: Product) => {
        await updateDoc(doc(dbInstance, 'products', product.id), cleanData(product));
        productCache = null;
      },
      delete: async (id: string) => {
        await deleteDoc(doc(dbInstance, 'products', id));
        productCache = null;
      },
      reduceStock: async (id: string, qty: number) => {
        const productRef = doc(dbInstance, 'products', id);
        await updateDoc(productRef, { stock: increment(-qty) });
        productCache = null;
      }
    },
    sales: {
      getAll: async (): Promise<Sale[]> => {
        try {
            const q = query(collection(dbInstance, 'sales'), orderBy('date', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => mapDoc<Sale>(d));
        } catch (e) {
            return [];
        }
      },
      add: async (sale: Sale) => {
        await setDoc(doc(dbInstance, 'sales', sale.id), cleanData(sale));
      }
    },
    expenses: {
      getAll: async (): Promise<Expense[]> => {
        try {
            const q = query(collection(dbInstance, 'expenses'), orderBy('date', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => mapDoc<Expense>(d));
        } catch (e) {
            return INITIAL_EXPENSES;
        }
      },
      add: async (expense: Expense) => {
        await setDoc(doc(dbInstance, 'expenses', expense.id), cleanData(expense));
      }
    },
    users: {
      getUserProfile: async (uid: string, email: string): Promise<User> => {
        try {
            const userDocRef = doc(dbInstance, 'users', uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                return mapDoc<User>(userDoc);
            } else {
                const role = email.toLowerCase().includes('admin') ? UserRole.ADMIN : UserRole.CASHIER;
                const newUser: User = {
                    id: uid,
                    name: email.split('@')[0],
                    username: email,
                    role: role
                };
                await setDoc(userDocRef, newUser);
                return newUser;
            }
        } catch (e) {
            return {
                id: uid,
                name: email.split('@')[0],
                username: email,
                role: UserRole.CASHIER
            };
        }
      },
      getAll: async (): Promise<User[]> => {
         try {
            const snapshot = await getDocs(collection(dbInstance, 'users'));
            const users = snapshot.docs.map(d => mapDoc<User>(d));
            
            // Mock users if empty for UI testing
            if(users.length === 0) {
                 return [
                    { id: '1', name: 'Admin User', role: UserRole.ADMIN, username: 'admin@kante.com' },
                    { id: '2', name: 'Jane Manager', role: UserRole.MANAGER, username: 'manager@kante.com' },
                ];
            }
            return users;
         } catch(e) { return []; }
      },
      add: async (user: User) => {
          await setDoc(doc(dbInstance, 'users', user.id), cleanData(user));
      },
      delete: async (id: string) => {
          await deleteDoc(doc(dbInstance, 'users', id));
      }
    },
    customers: {
      getAll: async (): Promise<Customer[]> => {
        try {
            const snapshot = await getDocs(collection(dbInstance, 'customers'));
            return snapshot.docs.map(d => mapDoc<Customer>(d));
        } catch (e) { return []; }
      },
      add: async (customer: Customer) => {
        await addDoc(collection(dbInstance, 'customers'), cleanData(customer));
      }
    },
    suppliers: {
        getAll: async (): Promise<Supplier[]> => {
            if (supplierCache) return supplierCache;
            try {
                const snapshot = await getDocs(collection(dbInstance, 'suppliers'));
                const suppliers = snapshot.docs.map(d => mapDoc<Supplier>(d));
                supplierCache = suppliers;
                return suppliers;
            } catch (e) {
                return INITIAL_SUPPLIERS;
            }
        },
        add: async (supplier: Supplier) => {
            await setDoc(doc(dbInstance, 'suppliers', supplier.id), cleanData(supplier));
            supplierCache = null;
        }
    },
    logs: {
        getAll: async (): Promise<ActivityLog[]> => {
            try {
                const q = query(collection(dbInstance, 'activity_logs'), orderBy('timestamp', 'desc'), limit(100));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => mapDoc<ActivityLog>(d));
            } catch (e) { return []; }
        },
        add: async (log: Omit<ActivityLog, 'id'>) => {
            const id = Date.now().toString();
            await setDoc(doc(dbInstance, 'activity_logs', id), { ...log, id });
        }
    }
  };