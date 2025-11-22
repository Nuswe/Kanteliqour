import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  PackageX, 
  AlertTriangle,
  CreditCard,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { db } from '../services/db';

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

const Dashboard: React.FC = () => {
  const sales = db.sales.getAll();
  const products = db.products.getAll();

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalTransactions = sales.length;
    const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;
    
    // Calculate daily sales for chart
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const salesData = last7Days.map(date => {
      const daySales = sales.filter(s => s.date.startsWith(date));
      return {
        name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        total: daySales.reduce((acc, s) => acc + s.total, 0)
      };
    });

    return {
      totalRevenue,
      totalTransactions,
      lowStockCount,
      outOfStockCount,
      salesData
    };
  }, [sales, products]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome back to Kante Liquor Manager.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Revenue" 
          value={`MWK ${stats.totalRevenue.toLocaleString()}`} 
          subtitle="+12.5% from last month"
          icon={DollarSign}
          color="text-emerald-500"
        />
        <StatCard 
          title="Total Transactions" 
          value={stats.totalTransactions} 
          subtitle="+5% from yesterday"
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            {sales.slice(-5).reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-sky-900/20 text-sky-500 flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">New Sale #{sale.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{new Date(sale.date).toLocaleString()} by {sale.cashierName}</p>
                  </div>
                </div>
                <span className="text-emerald-500 font-semibold">+{sale.total.toLocaleString()} MWK</span>
              </div>
            ))}
            {sales.length === 0 && (
              <p className="text-center text-slate-500 py-8">No recent activity recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;