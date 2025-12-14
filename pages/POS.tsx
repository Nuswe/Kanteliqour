import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  CreditCard, 
  Printer,
  X,
  CheckCircle,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { db } from '../services/db';
import { Product, CartItem, PaymentMethod, User, Sale, StoreSettings } from '../types';

interface POSProps {
  currentUser: User;
}

const POS: React.FC<POSProps> = ({ currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  
  // Mobile View State
  const [showCartMobile, setShowCartMobile] = useState(false);

  // Fetch data on mount
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsData, settingsData] = await Promise.all([
        db.products.getAll(),
        db.settings.get()
      ]);
      setProducts(productsData);
      setStoreSettings(settingsData);
    } catch (error) {
      console.error("Failed to load POS data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    const taxRate = storeSettings?.taxRate ? storeSettings.taxRate / 100 : 0.165;
    const tax = subtotal * taxRate; 
    return { subtotal, tax, total: subtotal + tax };
  }, [cart, storeSettings]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
  };

  const processPayment = async () => {
    setIsCheckingOut(false); // Close modal immediately
    
    const sale: Sale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        costPrice: item.costPrice, // Store cost price for accurate profit calculation
        total: item.price * item.quantity
      })),
      subtotal: cartTotals.subtotal,
      tax: cartTotals.tax,
      total: cartTotals.total,
      paymentMethod
    };

    // Save Sale to Firebase
    await db.sales.add(sale);
    
    await db.logs.add({
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'Sale Completed',
        details: `Processed sale #${sale.id.slice(-6)} for K${sale.total.toLocaleString()}`,
        timestamp: new Date().toISOString(),
        type: 'success'
    });

    // Update Inventory in Firebase
    for (const item of cart) {
      await db.products.reduceStock(item.id, item.quantity);
    }

    // Refresh Local State
    await fetchData(); 
    setCart([]);
    setShowCartMobile(false);
    setReceiptSale(sale);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full relative overflow-hidden">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
            color: black;
            z-index: 9999;
          }
          .no-print {
            display: none;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>

      {/* Left Side: Products (Hidden on mobile if cart is showing) */}
      <div className={`flex-1 flex-col bg-slate-950 lg:border-r lg:border-slate-800 ${showCartMobile ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 lg:p-6 border-b border-slate-800 shrink-0">
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {isLoading ? (
             <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-sky-500" />
             </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className={`bg-slate-900 border border-slate-800 rounded-xl p-3 lg:p-4 cursor-pointer hover:border-sky-500 hover:shadow-lg hover:shadow-sky-900/20 transition-all group flex flex-col justify-between h-full ${product.stock === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="h-28 lg:h-32 bg-slate-800 rounded-lg mb-3 flex items-center justify-center text-slate-600 group-hover:text-sky-500 transition-colors overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <ShoppingCart size={32} />
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-white text-sm line-clamp-2">{product.name}</h3>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                        <span className="text-sky-400 font-bold">K{product.price.toLocaleString()}</span>
                        <span className={`text-[10px] lg:text-xs px-2 py-1 rounded ${product.stock > product.lowStockThreshold ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                        {product.stock} Left
                        </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart (Full width on mobile when toggled, fixed width on desktop) */}
      <div className={`
        bg-slate-900 flex-col border-l border-slate-800 shadow-xl z-20 
        lg:w-96 lg:flex lg:relative 
        ${showCartMobile ? 'flex absolute inset-0 w-full' : 'hidden'}
      `}>
        <div className="p-4 border-b border-slate-800 bg-slate-900 z-10 flex items-center gap-2">
          {showCartMobile && (
            <button onClick={() => setShowCartMobile(false)} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white">
                <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              <ShoppingCart className="text-sky-500" />
              Current Order
            </h2>
            <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString()}</p>
          </div>
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
                  <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 mt-2">
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
              <span>Tax ({storeSettings?.taxRate || 16.5}%)</span>
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

      {/* Mobile Floating Cart Summary Bar */}
      {!showCartMobile && cart.length > 0 && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur border-t border-slate-800 z-30">
              <button 
                onClick={() => setShowCartMobile(true)}
                className="w-full bg-sky-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between font-bold"
              >
                  <div className="flex items-center gap-2">
                      <div className="bg-sky-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                          {cart.reduce((a,c) => a+c.quantity, 0)}
                      </div>
                      <span>View Cart</span>
                  </div>
                  <span>K{cartTotals.total.toLocaleString()}</span>
              </button>
          </div>
      )}

      {/* Payment Modal */}
      {isCheckingOut && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      {/* Printable Receipt Modal */}
      {receiptSale && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 print:bg-white print:p-0">
          <div className="bg-white w-[380px] shadow-2xl text-black overflow-hidden print:w-full print:shadow-none print:max-w-none print:h-auto">
            
            {/* Printable Content */}
            <div id="printable-receipt" className="p-4 bg-white text-black font-mono text-xs leading-tight max-w-[380px] mx-auto print:max-w-full">
              {/* Header */}
              <div className="text-center mb-3">
                <div className="flex justify-center mb-2 print:hidden">
                    {/* Only show checkmark on screen */}
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                        <CheckCircle size={24} />
                    </div>
                </div>
                <h1 className="text-2xl font-extrabold uppercase tracking-wider mb-1">
                  {storeSettings?.shopName || 'Kante Liquor'}
                </h1>
                <p className="text-[11px] font-bold uppercase">
                  {storeSettings?.addressLine1 || 'Plot 123, Area 10'}
                </p>
                <p className="text-[11px] font-bold uppercase">
                  {storeSettings?.addressLine2 || 'Lilongwe, Malawi'}
                </p>
                <p className="text-[11px] font-bold mt-1">
                  Tel: {storeSettings?.phone || '+265 999 123 456'}
                </p>
                <p className="text-[11px] font-bold">
                  TIN: {storeSettings?.tinNumber || '12345678'}
                </p>
                <hr className="border-t-2 border-dotted border-black my-2" />
              </div>

              {/* Meta Data */}
              <div className="mb-3 border-b-2 border-dotted border-black pb-2 text-[11px] font-bold uppercase flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(receiptSale.date).toLocaleDateString()} {new Date(receiptSale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span>{receiptSale.id.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{receiptSale.cashierName.split(' ')[0]}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-3 border-b-2 border-dotted border-black pb-2">
                <table className="w-full text-[11px] font-bold">
                  <thead>
                    <tr className="uppercase border-b border-black border-dotted">
                      <th className="pb-1 text-left w-[40%]">Item</th>
                      <th className="pb-1 text-center w-[15%]">Qty</th>
                      <th className="pb-1 text-right w-[20%]">Price</th>
                      <th className="pb-1 text-right w-[25%]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="leading-none">
                    {receiptSale.items.map((item, i) => (
                      <tr key={i} className="align-top">
                        <td className="pt-2 pr-1">{item.name}</td>
                        <td className="pt-2 text-center">{item.quantity}</td>
                        <td className="pt-2 text-right">{item.price.toLocaleString()}</td>
                        <td className="pt-2 text-right">{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-[11px] font-bold mb-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{receiptSale.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT ({storeSettings?.taxRate || 16.5}%):</span>
                  <span>{receiptSale.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base border-t-2 border-black border-dotted pt-2 mt-1">
                  <span className="font-extrabold">TOTAL:</span>
                  <span className="font-extrabold">MWK {receiptSale.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 text-[11px]">
                  <span>Paid via:</span>
                  <span className="uppercase">{receiptSale.paymentMethod}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[10px] font-bold uppercase space-y-1">
                <p>*** Thank You ***</p>
                <p>{storeSettings?.receiptFooter || 'No Returns on Alcohol'}</p>

                {/* QR Code */}
                <div className="flex justify-center my-3">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                      JSON.stringify({
                        id: receiptSale.id,
                        total: receiptSale.total,
                        date: receiptSale.date,
                        business: storeSettings?.shopName || "Kante Liquor"
                      })
                    )}`}
                    alt="Receipt QR"
                    className="h-24 w-24 mix-blend-multiply"
                  />
                </div>
                
                {/* Barcode Simulation */}
                <div className="mt-2 pt-2">
                   <div className="h-8 flex items-center justify-center overflow-hidden opacity-80">
                     <span className="text-2xl tracking-[3px] scale-y-150 font-bold font-serif">||| | |||| || |||</span>
                   </div>
                   <p className="mt-1">{receiptSale.id}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons (Hidden on Print) */}
            <div className="no-print bg-slate-100 p-4 border-t border-slate-200 flex flex-col gap-2">
              <button 
                onClick={() => window.print()} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors"
              >
                <Printer size={18} /> Print Receipt
              </button>
              <button 
                onClick={() => setReceiptSale(null)} 
                className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;