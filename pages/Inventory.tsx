import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertCircle,
  Save,
  X,
  Calendar
} from 'lucide-react';
import { db } from '../services/db';
import { Product, ProductCategory } from '../types';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setProducts(db.products.getAll());
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenModal = (product?: Product) => {
    setErrors({}); // Reset errors
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: ProductCategory.SPIRITS,
        price: 0,
        costPrice: 0,
        stock: 0,
        barcode: '',
        lowStockThreshold: 5,
        expiryDate: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    
    // Required Fields
    if (!formData.name?.trim()) newErrors.name = "Product name is required";
    if (!formData.barcode?.trim()) newErrors.barcode = "Barcode is required";

    // Numeric Validation
    const stock = formData.stock ?? 0;
    const cost = formData.costPrice ?? 0;
    const price = formData.price ?? 0;
    const threshold = formData.lowStockThreshold ?? 0;

    if (stock < 0) newErrors.stock = "Stock cannot be negative";
    if (threshold < 0) newErrors.lowStockThreshold = "Threshold cannot be negative";
    if (cost < 0) newErrors.costPrice = "Cost price cannot be negative";
    if (price < 0) newErrors.price = "Selling price cannot be negative";
    
    // Business Logic: Price > Cost
    if (price <= cost) {
      newErrors.price = "Price must be greater than Cost Price";
    }

    // Expiry Date Validation
    if (formData.expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(formData.expiryDate);
      if (expiry <= today) {
        newErrors.expiryDate = "Expiry date must be in the future";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingProduct) {
      db.products.update({ ...editingProduct, ...formData } as Product);
    } else {
      db.products.add({
        ...formData,
        id: Date.now().toString(),
      } as Product);
    }
    setProducts(db.products.getAll());
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
          <p className="text-slate-400">Track stock, pricing, and product details.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-sky-900/20"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Categories</option>
            {Object.values(ProductCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Cost Price</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{product.barcode}</span>
                      {product.expiryDate && (
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
                          <Calendar size={10} />
                          {new Date(product.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${product.stock <= product.lowStockThreshold ? 'text-red-500' : 'text-emerald-500'}`}>
                        {product.stock}
                      </span>
                      {product.stock <= product.lowStockThreshold && (
                        <AlertCircle size={14} className="text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">K{product.costPrice.toLocaleString()}</td>
                  <td className="px-6 py-4 text-white font-medium">K{product.price.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="p-2 hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 rounded transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-xl border border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Product Name</label>
                <input 
                  type="text" 
                  className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.name ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as ProductCategory})}
                  >
                    {Object.values(ProductCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Barcode</label>
                  <input 
                    type="text" 
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.barcode ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                    value={formData.barcode || ''}
                    onChange={e => setFormData({...formData, barcode: e.target.value})}
                  />
                   {errors.barcode && <p className="text-red-500 text-xs mt-1">{errors.barcode}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Cost Price</label>
                  <input 
                    type="number" 
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.costPrice ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                    value={formData.costPrice}
                    onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})}
                  />
                  {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Selling Price</label>
                  <input 
                    type="number" 
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.price ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Stock Quantity</label>
                  <input 
                    type="number"
                    min="0"
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.stock ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                    value={formData.stock}
                    onChange={e => {
                      const val = e.target.value;
                      const num = val === '' ? 0 : parseInt(val);
                      setFormData({...formData, stock: num < 0 ? 0 : num});
                    }}
                  />
                  {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Low Stock Alert At</label>
                  <input 
                    type="number" 
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.lowStockThreshold ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                    value={formData.lowStockThreshold}
                    onChange={e => setFormData({...formData, lowStockThreshold: Number(e.target.value)})}
                  />
                  {errors.lowStockThreshold && <p className="text-red-500 text-xs mt-1">{errors.lowStockThreshold}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Expiry Date (Optional)</label>
                <input 
                  type="date"
                  className={`w-full bg-slate-950 border rounded-lg px-4 py-2 text-white focus:outline-none ${errors.expiryDate ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}`}
                  value={formData.expiryDate || ''}
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                />
                {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg shadow-sky-900/20 transition-all flex items-center gap-2"
              >
                <Save size={18} />
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;