import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertCircle,
  Save,
  X,
  Calendar,
  Upload,
  Image as ImageIcon,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Phone,
  Eye,
  ArrowUpDown,
  MinusCircle,
  PlusCircle
} from 'lucide-react';
import { db } from '../services/db';
import { Product, ProductCategory, Supplier, User, UserRole } from '../types';
import { DataTable, Column } from '../components/DataTable';

interface InventoryProps {
    currentUser: User;
}

const Inventory: React.FC<InventoryProps> = ({ currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Quick Adjust Stock State
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Delete State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // View State
  const [viewMode, setViewMode] = useState<'all' | 'expiry' | 'low_stock'>('all');

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Permissions
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedSuppliers] = await Promise.all([
        db.products.getAll(),
        db.suppliers.getAll()
      ]);
      setProducts(fetchedProducts);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error("Failed to fetch inventory data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived State for Analysis
  const analysis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const withExpiry = products.filter(p => p.expiryDate);
    
    const expired = withExpiry.filter(p => {
      const d = new Date(p.expiryDate!);
      return d < today;
    });

    const expiringSoon = withExpiry.filter(p => {
      const d = new Date(p.expiryDate!);
      const diffTime = d.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });

    const lowStock = products.filter(p => p.stock <= p.lowStockThreshold);

    return {
      allWithExpiry: withExpiry,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      lowStockCount: lowStock.length
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let data = products;
    
    // Filter based on active view
    if (viewMode === 'expiry') {
      data = data.filter(p => p.expiryDate);
    } else if (viewMode === 'low_stock') {
      data = data.filter(p => p.stock <= p.lowStockThreshold);
    }

    return data.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
      return matchesSearch && matchesCat;
    }).sort((a, b) => {
      // Default sort logic per view
      if (viewMode === 'expiry') {
        return new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime();
      }
      if (viewMode === 'low_stock') {
        return a.stock - b.stock; // Ascending stock for urgency
      }
      return 0; // Default DataTable sort
    });
  }, [products, search, categoryFilter, viewMode]);

  const handleOpenModal = (product?: Product) => {
    if (!canEdit && !product) return; 

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
        expiryDate: '',
        image: '',
        supplierId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenAdjust = (product: Product) => {
      if (!canEdit) return;
      setAdjustProduct(product);
      setAdjustQty(product.stock);
  };

  const handleSaveAdjust = async () => {
      if (!adjustProduct) return;
      setIsAdjusting(true);
      try {
          await db.products.update({
              ...adjustProduct,
              stock: adjustQty < 0 ? 0 : adjustQty
          });
          
          await db.logs.add({
              userId: currentUser.id,
              userName: currentUser.name,
              action: 'Stock Adjustment',
              details: `Adjusted stock for ${adjustProduct.name} from ${adjustProduct.stock} to ${adjustQty}`,
              timestamp: new Date().toISOString(),
              type: 'warning'
          });

          await fetchData();
          setAdjustProduct(null);
      } catch (e) {
          console.error("Failed to adjust stock", e);
          alert("Failed to update stock level.");
      } finally {
          setIsAdjusting(false);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size too large. Please select an image under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;

    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) newErrors.name = "Product name is required";
    if (!formData.barcode?.trim()) newErrors.barcode = "Barcode is required";

    const stock = formData.stock ?? 0;
    const cost = formData.costPrice ?? 0;
    const price = formData.price ?? 0;
    const threshold = formData.lowStockThreshold ?? 0;

    if (stock < 0) newErrors.stock = "Stock cannot be negative";
    if (threshold < 0) newErrors.lowStockThreshold = "Threshold cannot be negative";
    if (cost < 0) newErrors.costPrice = "Cost price cannot be negative";
    if (price < 0) newErrors.price = "Selling price cannot be negative";
    
    if (price <= cost) {
      newErrors.price = "Price must be greater than Cost Price";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
        if (editingProduct) {
            await db.products.update({ ...editingProduct, ...formData } as Product);
            await db.logs.add({
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'Product Updated',
                details: `Updated product: ${formData.name}`,
                timestamp: new Date().toISOString(),
                type: 'info'
            });
        } else {
            await db.products.add({
                ...formData,
                id: Date.now().toString(),
            } as Product);
            await db.logs.add({
                userId: currentUser.id,
                userName: currentUser.name,
                action: 'Product Added',
                details: `Added new product: ${formData.name}`,
                timestamp: new Date().toISOString(),
                type: 'success'
            });
        }
        await fetchData();
        setIsModalOpen(false);
    } catch (e) {
        console.error(e);
        alert("Failed to save product");
    }
    setIsSaving(false);
  };

  const confirmDelete = async () => {
    if (!canEdit || !productToDelete) return;
    setIsDeleting(true);
    try {
        await db.products.delete(productToDelete.id);
        
        await db.logs.add({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'Product Deleted',
            details: `Deleted product: ${productToDelete.name}`,
            timestamp: new Date().toISOString(),
            type: 'danger'
        });

        await fetchData();
        setProductToDelete(null);
    } catch (e) {
        console.error("Error deleting product:", e);
        alert("Failed to delete product");
    } finally {
        setIsDeleting(false);
    }
  };

  // Helper to render product name cell
  const renderProductCell = (product: Product) => (
    <div className="flex items-center gap-3 min-w-[180px]">
      <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 flex-shrink-0 group-hover:border-sky-500 transition-colors">
        {product.image ? (
          <img src={product.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={18} className="text-slate-600 group-hover:text-sky-500" />
        )}
      </div>
      <div>
        <div className="font-medium text-white group-hover:text-sky-400 transition-colors line-clamp-1">{product.name}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{product.barcode}</span>
        </div>
      </div>
    </div>
  );

  // Standard Columns
  const standardColumns: Column<Product>[] = [
    {
      header: "Product Name",
      accessorKey: "name",
      sortable: true,
      render: renderProductCell
    },
    {
      header: "Category",
      accessorKey: "category",
      sortable: true,
      render: (product) => (
        <span className="px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
          {product.category}
        </span>
      )
    },
    {
      header: "Stock",
      accessorKey: "stock",
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-2">
          <span className={`font-medium ${product.stock <= product.lowStockThreshold ? 'text-red-500' : 'text-emerald-500'}`}>
            {product.stock}
          </span>
          {product.stock <= product.lowStockThreshold && (
            <AlertCircle size={14} className="text-red-500 animate-pulse" />
          )}
        </div>
      )
    },
    {
      header: "Cost",
      accessorKey: "costPrice",
      sortable: true,
      // Hide Cost Price for Cashiers? Usually yes.
      render: (p) => canEdit ? <span className="text-slate-400 whitespace-nowrap">K{p.costPrice.toLocaleString()}</span> : <span className="text-slate-600">---</span>
    },
    {
      header: "Price",
      accessorKey: "price",
      sortable: true,
      render: (p) => <span className="text-white font-medium whitespace-nowrap">K{p.price.toLocaleString()}</span>
    },
    {
      header: "Actions",
      className: "text-right",
      render: (product) => (
        <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
          {canEdit ? (
             <>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenAdjust(product); }}
                    className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded transition-colors"
                    title="Quick Stock Adjust"
                >
                    <ArrowUpDown size={16} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                    className="p-2 hover:bg-sky-500/10 text-slate-400 hover:text-sky-500 rounded transition-colors"
                    title="Edit Product"
                >
                    <Edit size={16} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setProductToDelete(product); }}
                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Delete Product"
                >
                    <Trash2 size={16} />
                </button>
             </>
          ) : (
            <span className="text-xs text-slate-600 italic px-2">Read Only</span>
          )}
        </div>
      )
    }
  ];

  // Expiry View Columns
  const expiryColumns: Column<Product>[] = [
    {
      header: "Product",
      accessorKey: "name",
      sortable: true,
      render: renderProductCell
    },
    {
      header: "Stock Batch",
      accessorKey: "stock",
      render: (p) => (
        <span className="font-mono text-slate-300 whitespace-nowrap">{p.stock} Units</span>
      )
    },
    {
        header: "Expiry Date",
        accessorKey: "expiryDate",
        sortable: true,
        render: (p) => (
            <div className="flex items-center gap-2 text-slate-300 whitespace-nowrap">
                <Calendar size={14} className="text-slate-500" />
                {new Date(p.expiryDate!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
        )
    },
    {
        header: "Status",
        accessorKey: "expiryDate", // Technically sorting by date effectively sorts by status
        render: (p) => {
            const today = new Date();
            today.setHours(0,0,0,0);
            const expiry = new Date(p.expiryDate!);
            const diffTime = expiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return (
                    <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full w-fit whitespace-nowrap">
                        <AlertCircle size={14} />
                        <span className="text-xs font-bold">EXPIRED</span>
                    </div>
                )
            }
            if (diffDays <= 30) {
                return (
                    <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full w-fit whitespace-nowrap">
                        <Clock size={14} />
                        <span className="text-xs font-bold">{diffDays} Days Left</span>
                    </div>
                )
            }
            return (
                <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit whitespace-nowrap">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-medium">OK</span>
                </div>
            )
        }
    },
    {
        header: "Actions",
        className: "text-right",
        render: (product) => (
          <div className="flex items-center justify-end gap-2">
            {canEdit ? (
                <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenAdjust(product); }}
                        className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded transition-colors"
                        title="Quick Stock Adjust"
                    >
                        <ArrowUpDown size={16} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                        className="text-xs bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors whitespace-nowrap"
                        >
                        Edit Batch
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setProductToDelete(product); }}
                        className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Delete Product"
                    >
                        <Trash2 size={16} />
                    </button>
                </>
            ) : (
                <span className="text-xs text-slate-600">---</span>
            )}
          </div>
        )
    }
  ];

  // Low Stock View Columns
  const lowStockColumns: Column<Product>[] = [
    {
      header: "Product",
      accessorKey: "name",
      sortable: true,
      render: renderProductCell
    },
    {
      header: "Stock Status",
      accessorKey: "stock",
      sortable: true,
      render: (p) => (
         <div className="flex flex-col whitespace-nowrap">
            <span className="font-bold text-red-500 text-lg">{p.stock} Units</span>
            <span className="text-xs text-slate-500">Threshold: {p.lowStockThreshold}</span>
         </div>
      )
    },
    {
        header: "Supplier Details",
        render: (p) => {
            const supplier = suppliers.find(s => s.id === p.supplierId);
            if (!supplier) return (
                <div className="flex items-center gap-2 text-slate-600 italic text-xs whitespace-nowrap">
                    <AlertTriangle size={12} />
                    <span>No Supplier</span>
                </div>
            );
            return (
                <div className="text-xs space-y-1 min-w-[140px]">
                    <p className="text-sky-400 font-medium flex items-center gap-2">
                        <Truck size={12} />
                        {supplier.name}
                    </p>
                    <p className="text-slate-400">{supplier.contactPerson}</p>
                    <p className="text-slate-500 flex items-center gap-1">
                        <Phone size={10} />
                        {supplier.phone}
                    </p>
                </div>
            )
        }
    },
    {
        header: "Actions",
        className: "text-right",
        render: (product) => (
          <div className="flex items-center justify-end gap-2">
            {canEdit && (
                <>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenAdjust(product); }}
                    className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded transition-colors"
                    title="Quick Stock Adjust"
                >
                    <ArrowUpDown size={16} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                    className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded shadow-lg shadow-sky-900/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                    <Edit size={12} />
                    Full Edit
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setProductToDelete(product); }}
                    className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Delete Product"
                >
                    <Trash2 size={16} />
                </button>
                </>
            )}
          </div>
        )
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-slate-400 text-sm lg:text-base">Track stock, pricing, and expiry dates.</p>
        </div>
        {canEdit && (
            <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-sky-900/20 w-full sm:w-auto justify-center"
            >
            <Plus size={18} />
            Add Product
            </button>
        )}
      </div>

      {/* View Tabs */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-max mb-4 lg:mb-6">
            <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'all' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            >
            All Products
            </button>
            <button
            onClick={() => setViewMode('expiry')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'expiry' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            >
            Expiry Check
            {(analysis.expiredCount > 0 || analysis.expiringSoonCount > 0) && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {analysis.expiredCount + analysis.expiringSoonCount}
                </span>
            )}
            </button>
            <button
            onClick={() => setViewMode('low_stock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'low_stock' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            >
            Low Stock
            {analysis.lowStockCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {analysis.lowStockCount}
                </span>
            )}
            </button>
        </div>
      </div>

      {/* Expiry Summary Cards (Only in Expiry View) */}
      {viewMode === 'expiry' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-in fade-in slide-in-from-top-2">
             <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-red-900/50 flex items-center justify-center text-red-400">
                    <AlertCircle size={20} />
                </div>
                <div>
                    <p className="text-xs text-red-400 font-medium uppercase">Expired Items</p>
                    <p className="text-xl font-bold text-white">{analysis.expiredCount}</p>
                </div>
             </div>
             <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-900/50 flex items-center justify-center text-amber-400">
                    <Clock size={20} />
                </div>
                <div>
                    <p className="text-xs text-amber-400 font-medium uppercase">Expiring Soon</p>
                    <p className="text-xl font-bold text-white">{analysis.expiringSoonCount}</p>
                </div>
             </div>
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <Calendar size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">Total With Dates</p>
                    <p className="text-xl font-bold text-white">{analysis.allWithExpiry.length}</p>
                </div>
             </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder={viewMode === 'expiry' ? "Search batch or product..." : "Search products..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-800 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-sky-500 cursor-pointer w-full lg:w-auto"
          >
            <option value="All">All Categories</option>
            {Object.values(ProductCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <DataTable 
          columns={
             viewMode === 'expiry' ? expiryColumns : 
             viewMode === 'low_stock' ? lowStockColumns : 
             standardColumns
          } 
          data={filteredProducts} 
          isLoading={isLoading}
          itemsPerPage={8}
        />
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Image Upload Section */}
              <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Product Image</label>
                 <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-24 w-24 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden relative group shrink-0">
                      {formData.image ? (
                        <>
                          <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                          <button 
                            onClick={() => setFormData({...formData, image: undefined})}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          >
                            <X size={20} />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="text-slate-700" size={32} />
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors text-sm font-medium w-full justify-center sm:w-auto">
                        <Upload size={16} />
                        Choose Image
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload}
                        />
                      </label>
                      <p className="text-xs text-slate-500 mt-2 text-center sm:text-left">Max size 2MB. Formats: JPG, PNG, WebP</p>
                    </div>
                 </div>
              </div>

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

              {/* Supplier Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Supplier</label>
                <select
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
                  value={formData.supplierId || ''}
                  onChange={e => setFormData({...formData, supplierId: e.target.value})}
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
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

            <div className="p-6 border-t border-slate-800 flex justify-end gap-4 shrink-0">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg shadow-sky-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Adjust Stock Modal */}
      {adjustProduct && canEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 w-full max-w-sm rounded-xl border border-slate-800 shadow-2xl p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">Adjust Stock</h2>
                        <p className="text-slate-400 text-sm mt-1">{adjustProduct.name}</p>
                    </div>
                    <button onClick={() => setAdjustProduct(null)} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <button 
                            onClick={() => setAdjustQty(q => Math.max(0, q - 1))}
                            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                            <MinusCircle size={32} />
                        </button>
                        <div className="w-24 text-center">
                            <input 
                                type="number" 
                                value={adjustQty}
                                onChange={(e) => setAdjustQty(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-transparent text-4xl font-bold text-center text-white focus:outline-none"
                            />
                            <p className="text-xs text-slate-500 uppercase font-bold mt-1">Units</p>
                        </div>
                        <button 
                            onClick={() => setAdjustQty(q => q + 1)}
                            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                            <PlusCircle size={32} />
                        </button>
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                        Previous: {adjustProduct.stock}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setAdjustProduct(null)}
                        className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveAdjust}
                        disabled={isAdjusting}
                        className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        {isAdjusting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && canEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-xl border border-slate-800 shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Product?</h2>
            <p className="text-slate-400 mb-6">
              Are you sure you want to remove this item from your inventory?
              <br/>
              <span className="text-white font-bold text-lg block mt-2">{productToDelete.name}</span>
              <span className="text-xs text-slate-500 block mt-1">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setProductToDelete(null)}
                className="px-6 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
              >
                 {isDeleting ? <Loader2 className="animate-spin" size={18} /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;