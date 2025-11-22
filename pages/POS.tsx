import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  CreditCard, 
  Printer,
  X
} from 'lucide-react';
import { db } from '../services/db';
import { Product, CartItem, PaymentMethod, User } from '../types';

interface POSProps {
  currentUser: User;
}

const POS: React.FC<POSProps> = ({ currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [showReceipt, setShowReceipt] = useState<string | null>(null); // Sale ID

  useEffect(() => {
    setProducts(db.products.getAll());
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.barcode.includes(searchQuery);
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        // Check stock limit
        const product = products.find(p => p.id === id);
        if (product && newQty > product.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const tax = subtotal * 0.165; // 16.5% VAT (Malawi standard example)
    return { subtotal, tax, total: subtotal + tax };
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
  };

  const processPayment = () => {
    const sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      subtotal: cartTotals.subtotal,
      tax: cartTotals.tax,
      total: cartTotals.total,
      paymentMethod
    };

    // Save Sale
    db.sales.add(sale);

    // Update Inventory
    cart.forEach(item => {
      db.products.reduceStock(item.id, item.quantity);
    });

    // Reset
    setProducts(db.products.getAll()); // Refresh stock display
    setCart([]);
    setIsCheckingOut(false);
    setShowReceipt(sale.id);
  };

  return (
    <div className="flex h-full">
      {/* Left Side: Products */}
      <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <input 
                type="text" 
                placeholder="Scan barcode or search product..." 
                className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-sky-600 text-white' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                onClick={() => addToCart(product)}
                className={`bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-sky-500 hover:shadow-lg hover:shadow-sky-900/20 transition-all group ${product.stock === 0 ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="h-32 bg-slate-800 rounded-lg mb-3 flex items-center justify-center text-slate-600 group-hover:text-sky-500 transition-colors">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <ShoppingCart size={32} />
                  )}
                </div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-white text-sm line-clamp-2">{product.name}</h3>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-sky-400 font-bold">K{product.price.toLocaleString()}</span>
                  <span className={`text-xs px-2 py-1 rounded ${product.stock > product.lowStockThreshold ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                    {product.stock} Left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Cart */}
      <div className="w-96 bg-slate-900 flex flex-col border-l border-slate-800 shadow-xl z-10">
        <div className="p-4 border-b border-slate-800 bg-slate-900 z-10">
          <h2 className="font-bold text-white text-lg flex items-center gap-2">
            <ShoppingCart className="text-sky-500" />
            Current Order
          </h2>
          <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString()}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <ShoppingCart size={48} className="opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-slate-800/50 rounded-lg p-3 flex gap-3 border border-slate-700">
                <div className="flex-1">
                  <h4 className="text-white font-medium text-sm">{item.name}</h4>
                  <p className="text-sky-400 text-sm font-bold mt-1">K{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                  <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-400 hover:text-white">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-400 hover:text-white">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Subtotal</span>
              <span>K{cartTotals.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Tax (16.5%)</span>
              <span>K{cartTotals.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-xl pt-2 border-t border-slate-800">
              <span>Total</span>
              <span className="text-sky-500">K{cartTotals.total.toLocaleString()}</span>
            </div>
          </div>
          
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2 transition-all"
          >
            Pay Now
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {isCheckingOut && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Select Payment Method</h2>
              <button onClick={() => setIsCheckingOut(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {Object.values(PaymentMethod).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                    paymentMethod === method 
                      ? 'bg-sky-600/20 border-sky-500 text-sky-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  <CreditCard size={24} />
                  <span className="text-sm font-medium text-center">{method}</span>
                </button>
              ))}
            </div>

            <div className="mb-6 p-4 bg-slate-950 rounded-lg border border-slate-800 text-center">
              <p className="text-slate-400 text-sm mb-1">Total Amount Due</p>
              <p className="text-2xl font-bold text-white">K{cartTotals.total.toLocaleString()}</p>
            </div>

            <button 
              onClick={processPayment}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              Confirm Payment
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-[380px] p-6 rounded-lg shadow-2xl text-slate-900">
            <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
              <h1 className="font-bold text-xl uppercase tracking-widest mb-1">Kante Liquor</h1>
              <p className="text-xs text-slate-500">Lilongwe, Malawi</p>
              <p className="text-xs text-slate-500">+265 999 123 456</p>
            </div>

            <div className="mb-4 text-xs text-slate-600 space-y-1">
              <p>Date: {new Date().toLocaleString()}</p>
              <p>Receipt #: {showReceipt}</p>
              <p>Cashier: {currentUser.name}</p>
            </div>

            <table className="w-full text-xs mb-4">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {db.sales.getAll().find(s => s.id === showReceipt)?.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-xs border-t border-slate-300 pt-2 mb-6">
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>MWK {db.sales.getAll().find(s => s.id === showReceipt)?.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment</span>
                <span>{db.sales.getAll().find(s => s.id === showReceipt)?.paymentMethod}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.print()} 
                className="w-full bg-slate-900 text-white py-2 rounded flex items-center justify-center gap-2 text-sm"
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button 
                onClick={() => setShowReceipt(null)} 
                className="w-full bg-slate-100 text-slate-600 py-2 rounded text-sm hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;