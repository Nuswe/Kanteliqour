import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  PieChart as PieChartIcon,
  Calendar,
  Sparkles,
  Loader2,
  ArrowUpRight,
  Table2,
  Plus,
  ArrowDownRight,
  Wallet,
  X,
  Save,
  Printer,
  AlertTriangle,
  Package,
  Phone
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { db } from '../services/db';
import { Sale, Product, Expense, Supplier } from '../types';
import { DataTable, Column } from '../components/DataTable';

type Period = 'this_month' | 'last_month' | 'last_30_days' | 'all_time';
type ReportView = 'financials' | 'inventory_health';

const Reports: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  
  // Filter State
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('this_month');
  const [currentView, setCurrentView] = useState<ReportView>('financials');

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    category: 'Utilities',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0
  });

  const loadData = async () => {
    try {
      const [fetchedSales, fetchedProducts, fetchedExpenses, fetchedSuppliers] = await Promise.all([
        db.sales.getAll(),
        db.products.getAll(),
        db.expenses.getAll(),
        db.suppliers.getAll()
      ]);
      setSales(fetchedSales);
      setProducts(fetchedProducts);
      setExpenses(fetchedExpenses);
      setSuppliers(fetchedSuppliers);
    } catch (error) {
      console.error("Error loading report data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add Expense
  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount || newExpense.amount <= 0) {
      alert("Please fill in all fields correctly.");
      return;
    }
    
    const expense: Expense = {
      id: Date.now().toString(),
      date: new Date(newExpense.date!).toISOString(),
      category: newExpense.category!,
      description: newExpense.description,
      amount: Number(newExpense.amount),
      recordedBy: 'Admin' // Should replace with actual current user
    };

    await db.expenses.add(expense);
    await loadData(); // Refresh
    setIsExpenseModalOpen(false);
    setNewExpense({ category: 'Utilities', date: new Date().toISOString().split('T')[0], description: '', amount: 0 });
  };

  // Filter logic
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (selectedPeriod) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_30_days':
        start.setDate(now.getDate() - 30);
        break;
      case 'all_time':
        start = new Date(0); // Beginning of epoch
        break;
    }
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    return { start, end };
  }, [selectedPeriod]);

  // Process Data for P&L
  const pnlData = useMemo(() => {
    const filteredSales = sales.filter(s => {
        const d = new Date(s.date);
        return d >= dateRange.start && d <= dateRange.end;
    });

    const filteredExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= dateRange.start && d <= dateRange.end;
    });

    // 1. Revenue
    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);

    // 2. Cost of Goods Sold (COGS)
    // Fallback map if costPrice missing in sale items
    const productCostMap = new Map(products.map(p => [p.id, p.costPrice]));
    
    const cogs = filteredSales.reduce((sum, sale) => {
        const saleCost = sale.items.reduce((isum, item) => {
            const cost = item.costPrice ?? (productCostMap.get(item.productId) || 0);
            return isum + (cost * item.quantity);
        }, 0);
        return sum + saleCost;
    }, 0);

    // 3. Gross Profit
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // 4. Expenses
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 5. Net Profit
    const netProfit = grossProfit - totalExpenses;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
        revenue,
        cogs,
        grossProfit,
        grossMargin,
        totalExpenses,
        netProfit,
        netMargin,
        filteredSales,
        filteredExpenses
    };
  }, [sales, expenses, products, dateRange]);

  // Low Stock Data
  const lowStockData = useMemo(() => {
    return products.filter(p => p.stock <= p.lowStockThreshold);
  }, [products]);

  // Chart Data (Grouped by Date for the selected period)
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string, revenue: number, expenses: number, net: number }>();
    
    pnlData.filteredSales.forEach(s => {
        const k = s.date.split('T')[0];
        if(!map.has(k)) map.set(k, { date: k, revenue: 0, expenses: 0, net: 0 });
        const entry = map.get(k)!;
        entry.revenue += s.total;
    });

    pnlData.filteredExpenses.forEach(e => {
        const k = e.date.split('T')[0];
        if(!map.has(k)) map.set(k, { date: k, revenue: 0, expenses: 0, net: 0 });
        const entry = map.get(k)!;
        entry.expenses += e.amount;
    });

    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date));
  }, [pnlData]);

  const handleGenerateInsights = async () => {
    if (chartData.length === 0) {
        setAiInsight("Not enough data to generate insights.");
        return;
    }
    
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const summary = {
          period: selectedPeriod,
          revenue: pnlData.revenue,
          cogs: pnlData.cogs,
          grossProfit: pnlData.grossProfit,
          expenses: pnlData.totalExpenses,
          netProfit: pnlData.netProfit
      };

      const prompt = `
        You are a financial CFO for a Liquor Store. 
        Analyze this Profit & Loss Statement for the period: ${selectedPeriod}.
        
        Financials: ${JSON.stringify(summary)}
        
        Please provide:
        1. Analysis of the Net Profit Margin (${pnlData.netMargin.toFixed(1)}%). Is it healthy?
        2. Comments on the Cost of Goods Sold ratio.
        3. 3 specific ways to reduce operating expenses or improve margins.
        
        Keep it professional and concise.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAiInsight(response.text);
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiInsight("Failed to generate insights. Please ensure your API Key is configured correctly.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Daily Breakdown Columns
  const dailyColumns: Column<any>[] = [
    {
        header: "Date",
        accessorKey: "date",
        sortable: true,
        render: (row) => (
            <div className="flex items-center gap-2 whitespace-nowrap">
                <Calendar size={14} className="text-slate-500" />
                <span>{new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
        )
    },
    {
        header: "Revenue",
        accessorKey: "revenue",
        render: (row) => <span className="text-sky-400">K{row.revenue.toLocaleString()}</span>
    },
    {
        header: "Op. Expenses",
        accessorKey: "expenses",
        render: (row) => <span className="text-red-400">K{row.expenses.toLocaleString()}</span>
    },
    {
        header: "Net Balance",
        accessorKey: "net",
        render: (row) => {
            const net = row.revenue - row.expenses; // Simplified for chart table
            return <span className={net >= 0 ? 'text-emerald-400' : 'text-red-500'}>K{net.toLocaleString()}</span>
        }
    }
  ];

  // Low Stock Columns
  const lowStockColumns: Column<Product>[] = [
    {
        header: "Product Name",
        accessorKey: "name",
        sortable: true,
        render: (p) => (
            <div className="flex items-center gap-3 min-w-[180px]">
                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-500">
                    {p.image ? <img src={p.image} className="w-full h-full object-cover rounded" alt=""/> : <Package size={16} />}
                </div>
                <span className="font-medium text-white line-clamp-1">{p.name}</span>
            </div>
        )
    },
    {
        header: "Current Stock",
        accessorKey: "stock",
        sortable: true,
        render: (p) => (
            <span className={`font-bold whitespace-nowrap ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                {p.stock} Units
            </span>
        )
    },
    {
        header: "Low Threshold",
        accessorKey: "lowStockThreshold",
        sortable: true,
        render: (p) => <span className="text-slate-400 whitespace-nowrap">{p.lowStockThreshold} Units</span>
    },
    {
        header: "Supplier Information",
        render: (p) => {
            const supplier = suppliers.find(s => s.id === p.supplierId);
            if (!supplier) return <span className="text-slate-600 italic whitespace-nowrap">Not Assigned</span>;
            return (
                <div className="flex flex-col text-xs min-w-[140px]">
                    <span className="text-slate-300 font-medium">{supplier.name}</span>
                    {supplier.contactPerson && <span className="text-slate-500">Attn: {supplier.contactPerson}</span>}
                    <div className="flex items-center gap-1 text-sky-500 mt-0.5">
                        <Phone size={10} />
                        <span>{supplier.phone}</span>
                    </div>
                </div>
            )
        }
    }
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-sky-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-950">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pnl-statement, #pnl-statement * {
            visibility: visible;
          }
          #pnl-statement {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
            z-index: 9999;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-6 lg:mb-8 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Reports & Analytics</h1>
          <p className="text-slate-400">Financial insights and inventory health tracking.</p>
        </div>
        
        <div className="flex flex-col items-start lg:items-end gap-4 w-full lg:w-auto">
            {/* View Toggle */}
            <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex w-full lg:w-auto">
                <button 
                    onClick={() => setCurrentView('financials')}
                    className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${currentView === 'financials' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    <DollarSign size={16} />
                    Financials
                </button>
                <button 
                    onClick={() => setCurrentView('inventory_health')}
                    className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${currentView === 'inventory_health' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    <AlertTriangle size={16} />
                    Inventory Health
                </button>
            </div>

            {/* Period Filter (Only visible for Financials) */}
            {currentView === 'financials' && (
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto">
                        {(['this_month', 'last_month', 'last_30_days', 'all_time'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setSelectedPeriod(p)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${
                                    selectedPeriod === p ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {p.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-red-900/20 transition-all text-sm font-bold w-full sm:w-auto"
                    >
                        <Plus size={16} />
                        Expense
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* FINANCIALS VIEW */}
      {currentView === 'financials' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6 mb-8 no-print">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Revenue</p>
                <h3 className="text-2xl font-bold text-white">K{pnlData.revenue.toLocaleString()}</h3>
                <div className="flex items-center gap-1 text-sky-500 text-xs mt-2">
                    <TrendingUp size={14} />
                    <span>Sales Income</span>
                </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Cost of Goods</p>
                    <h3 className="text-2xl font-bold text-slate-300">K{pnlData.cogs.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-2">
                        <ArrowDownRight size={14} />
                        <span>Product Costs</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Expenses</p>
                <h3 className="text-2xl font-bold text-red-400">K{pnlData.totalExpenses.toLocaleString()}</h3>
                <div className="flex items-center gap-1 text-red-500 text-xs mt-2">
                    <Wallet size={14} />
                    <span>Operating Costs</span>
                </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Net Profit</p>
                    <h3 className={`text-2xl font-bold ${pnlData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        K{pnlData.netProfit.toLocaleString()}
                    </h3>
                    <div className={`flex items-center gap-1 text-xs mt-2 font-bold ${pnlData.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    <DollarSign size={14} />
                    <span>Margin: {pnlData.netMargin.toFixed(1)}%</span>
                    </div>
                </div>
                <div className={`absolute right-0 top-0 h-full w-16 bg-gradient-to-l to-transparent ${pnlData.netProfit >= 0 ? 'from-emerald-500/10' : 'from-red-500/10'}`}></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Profit & Loss Statement Card */}
                <div id="pnl-statement" className="lg:col-span-2 bg-white text-slate-900 rounded-xl shadow-xl overflow-hidden flex flex-col">
                    <div className="bg-slate-100 p-6 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Profit & Loss Statement</h2>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                Period: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2 no-print">
                            <button 
                                onClick={() => window.print()} 
                                className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                                title="Print Statement"
                            >
                                <Printer size={20} />
                            </button>
                            <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                                <Table2 size={20} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8 flex-1 font-mono text-sm overflow-x-auto">
                        {/* Revenue Section */}
                        <div className="mb-6 min-w-[300px]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-700 text-lg">Revenue</span>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-600">Total Sales Revenue</span>
                                <span className="font-bold">K{pnlData.revenue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 border-b border-slate-300 pb-2 mb-2">
                                <span>Cost of Goods Sold (COGS)</span>
                                <span>(K{pnlData.cogs.toLocaleString()})</span>
                            </div>
                            <div className="flex justify-between items-center text-base bg-emerald-50 p-2 rounded border border-emerald-100">
                                <span className="font-bold text-emerald-900">GROSS PROFIT</span>
                                <div className="text-right">
                                    <span className="font-bold text-emerald-700 block">K{pnlData.grossProfit.toLocaleString()}</span>
                                    <span className="text-[10px] text-emerald-600 font-bold block">Margin: {pnlData.grossMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Expenses Section */}
                        <div className="mb-6 min-w-[300px]">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Operating Expenses</h4>
                            <div className="space-y-2 mb-4 pl-2">
                                {pnlData.filteredExpenses.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No expenses recorded for this period.</p>
                                ) : (
                                    // Group expenses by category for cleaner P&L
                                    Object.entries(pnlData.filteredExpenses.reduce((acc, curr) => {
                                        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
                                        return acc;
                                    }, {} as Record<string, number>)).map(([cat, amt]) => (
                                        <div key={cat} className="flex justify-between items-center text-slate-600 border-b border-dashed border-slate-200 pb-1">
                                            <span>{cat}</span>
                                            <span>K{amt.toLocaleString()}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-300 pt-2 font-bold text-slate-700">
                                <span>Total Operating Expenses</span>
                                <span>(K{pnlData.totalExpenses.toLocaleString()})</span>
                            </div>
                        </div>

                        {/* Net Profit Section */}
                        <div className="border-t-4 border-double border-slate-800 pt-4 mt-4 min-w-[300px]">
                            <div className="flex justify-between items-center text-xl">
                                <span className="font-extrabold uppercase">Net Profit / (Loss)</span>
                                <div className="text-right">
                                    <span className={`font-extrabold block ${pnlData.netProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                                        K{pnlData.netProfit.toLocaleString()}
                                    </span>
                                    <span className={`text-xs font-bold block ${pnlData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        Net Margin: {pnlData.netMargin.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-8 text-[10px] text-slate-400 text-center uppercase tracking-widest">
                            Generated by Kante Liquor Manager • {new Date().toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* AI Analysis Side Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-full no-print">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles size={20} className="text-purple-500" />
                        CFO Insights
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">
                        AI analysis of your P&L Statement.
                        </p>
                    </div>
                    
                    <div className="flex-1 bg-slate-950/50 rounded-lg border border-slate-800 p-4 mb-4 overflow-y-auto custom-scrollbar min-h-[200px]">
                        {aiInsight ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="whitespace-pre-line text-slate-300 text-sm leading-relaxed">
                                {aiInsight}
                            </div>
                        </div>
                        ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                            <Sparkles size={32} className="mb-3 opacity-20" />
                            <p className="text-sm">Generate an AI report to analyze your margins and expenses.</p>
                        </div>
                        )}
                    </div>

                    <button 
                        onClick={handleGenerateInsights}
                        disabled={isAnalyzing}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                            <>
                            <Loader2 size={18} className="animate-spin" />
                            Analyzing...
                            </>
                        ) : (
                            <>
                            <Sparkles size={18} />
                            Analyze P&L
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Chart (Revenue vs Expenses) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 no-print">
                <h3 className="text-lg font-bold text-white mb-6">Income vs Expenses Trend</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={val => new Date(val).getDate().toString()} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={val => `${val/1000}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                            <Legend />
                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0ea5e9" fill="url(#gradRev)" strokeWidth={2} />
                            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="url(#gradExp)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* Daily List */}
            <div className="mb-8 no-print">
                <h3 className="text-lg font-bold text-white mb-4">Financial Breakdown</h3>
                <DataTable columns={dailyColumns} data={chartData} itemsPerPage={5} />
            </div>
        </div>
      )}

      {/* INVENTORY HEALTH VIEW */}
      {currentView === 'inventory_health' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-6 rounded-xl flex items-start gap-4">
                  <div className="p-3 bg-amber-500/20 rounded-lg text-amber-500">
                      <AlertTriangle size={24} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-white">Low Stock Alerts</h2>
                      <p className="text-slate-400 mt-1">
                          Found <span className="text-white font-bold">{lowStockData.length}</span> products currently below their reorder threshold. 
                          Please contact suppliers to restock immediately.
                      </p>
                  </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <DataTable columns={lowStockColumns} data={lowStockData} />
              </div>
          </div>
      )}
      
      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-slate-900 w-full max-w-md rounded-xl border border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">Record Expense</h2>
                    <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                        <input 
                            type="text"
                            placeholder="e.g. Shop Rent, Electricity, Transport"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                            value={newExpense.description}
                            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                value={newExpense.category}
                                onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                            >
                                <option>Rent</option>
                                <option>Utilities</option>
                                <option>Salaries</option>
                                <option>Maintenance</option>
                                <option>Transport</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Amount</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                value={newExpense.amount}
                                onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                        <input 
                            type="date"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                            value={newExpense.date}
                            onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                        />
                    </div>
                    <button 
                        onClick={handleAddExpense}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-lg mt-4 flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Save Expense
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Reports;