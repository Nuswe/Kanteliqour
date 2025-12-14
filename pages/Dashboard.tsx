import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  PackageX, 
  AlertTriangle,
  CreditCard,
  Activity,
  Loader2,
  Lock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { db } from '../services/db';
import { Product, Sale, User, UserRole } from '../types';

interface DashboardProps {
    currentUser: User;
}

const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        <p className={`text-xs mt-2 ${color}`}>{subtitle}</p>
      </div>
      <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('500', '900/30')}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check permissions
  const canViewFinancials = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      // Create a timeout to prevent infinite loading if DB hangs
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data load timed out')), 5000)
      );

      try {
        // Race between the fetch and the timeout
        const [fetchedSales, fetchedProducts] = await Promise.race([
          Promise.all([db.sales.getAll(), db.products.getAll()]),
          timeoutPromise
        ]) as [Sale[], Product[]];

        if (isMounted) {
          setSales(fetchedSales);
          setProducts(fetchedProducts);
        }
      } catch (error) {
        console.error("Dashboard data load failed or timed out:", error);
        // db.ts handles fallback data, but if even that fails, we just stop loading
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, []);

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalTransactions = sales.length;
    const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;
    
    // Calculate daily sales for chart (Simple grouping)
    const salesMap = new Map<string, number>();
    // Initialize last 7 days
    for(let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        salesMap.set(d.toISOString().split('T')[0], 0);
    }

    sales.forEach(s => {
        const dateKey = s.date.split('T')[0];
        if (salesMap.has(dateKey)) {
            salesMap.set(dateKey, (salesMap.get(dateKey) || 0) + s.total);
        }
    });

    const salesData = Array.from(salesMap.entries())
        .map(([date, total]) => ({
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            date, // for sorting
            total
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      totalTransactions,
      lowStockCount,
      outOfStockCount,
      salesData
    };
  }, [sales, products]);

  if (isLoading) {
    return (
        <div className="flex h-full items-center justify-center flex-col gap-4">
            <Loader2 className="animate-spin h-10 w-10 text-sky-500" />
            <p className="text-slate-500 text-sm">Loading dashboard data...</p>
        </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">
            Welcome back, <span className="text-sky-400 font-bold">{currentUser.name}</span>.
        </p>
      </div>

      {/* Stats Grid - RESTRICTED FOR CASHIERS */}
      {canViewFinancials ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <StatCard 
            title="Total Revenue" 
            value={`MWK ${stats.totalRevenue.toLocaleString()}`} 
            subtitle="Lifetime Sales"
            icon={DollarSign}
            color="text-emerald-500"
            />
            <StatCard 
            title="Total Transactions" 
            value={stats.totalTransactions} 
            subtitle="Recorded Sales"
            icon={CreditCard}
            color="text-blue-500"
            />
            <StatCard 
            title="Low Stock Items" 
            value={stats.lowStockCount} 
            subtitle="Requires attention"
            icon={AlertTriangle}
            color="text-amber-500"
            />
            <StatCard 
            title="Out of Stock" 
            value={stats.outOfStockCount} 
            subtitle="Restock immediately"
            icon={PackageX}
            color="text-red-500"
            />
        </div>
      ) : (
        <div className="mb-8 p-6 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4">
            <div className="p-4 bg-sky-900/20 rounded-full text-sky-500">
                <CreditCard size={32} />
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">POS Terminal Active</h3>
                <p className="text-slate-400">You are logged in as a Cashier. Go to POS to process sales.</p>
            </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {canViewFinancials ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sky-500" />
                Weekly Sales Overview
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `K${value/1000}k`} />
                    <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#f8fafc' }}
                    cursor={{ fill: '#334155', opacity: 0.4 }}
                    />
                    <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>
        ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-slate-800 p-4 rounded-full mb-4">
                    <Lock size={32} className="text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Financial Charts Locked</h3>
                <p className="text-slate-400 text-sm max-w-xs">Financial performance data is restricted to Managers and Administrators.</p>
            </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            {sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-sky-900/20 text-sky-500 flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Sale #{sale.id.slice(-8)}</p>
                    <p className="text-xs text-slate-500">{new Date(sale.date).toLocaleString()} by {sale.cashierName}</p>
                  </div>
                </div>
                {canViewFinancials && (
                    <span className="text-emerald-500 font-semibold">+{sale.total.toLocaleString()} MWK</span>
                )}
              </div>
            ))}
            {sales.length === 0 && (
              <p className="text-center text-slate-500 py-8">No sales recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;