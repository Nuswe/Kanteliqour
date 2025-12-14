import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Users, 
  Database, 
  Save, 
  Loader2, 
  Download, 
  ShieldAlert, 
  Plus,
  Trash2,
  Receipt,
  Activity
} from 'lucide-react';
import { db } from '../services/db';
import { StoreSettings, User, UserRole, ActivityLog } from '../types';
import { DataTable, Column } from '../components/DataTable';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'team' | 'data' | 'activity'>('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data States
  const [settings, setSettings] = useState<StoreSettings>({
    shopName: '',
    addressLine1: '',
    addressLine2: '',
    phone: '',
    tinNumber: '',
    taxRate: 16.5,
    receiptFooter: ''
  });
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Add User Form
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: UserRole.CASHIER });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedSettings, fetchedUsers] = await Promise.all([
        db.settings.get(),
        db.users.getAll()
      ]);
      setSettings(fetchedSettings);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
      const fetchedLogs = await db.logs.getAll();
      setLogs(fetchedLogs);
  };

  useEffect(() => {
      if (activeTab === 'activity') {
          loadLogs();
      }
  }, [activeTab]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await db.settings.save(settings);
      alert("Settings saved successfully!");
    } catch (e) {
      alert("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = async () => {
      // Note: In a real app, this would trigger a Firebase Auth create function via Cloud Functions
      // Here we just add the doc to Firestore for UI demonstration
      if (!newUser.name || !newUser.email) return;
      
      const user: User = {
          id: Date.now().toString(), // Mock ID
          name: newUser.name,
          username: newUser.email,
          role: newUser.role
      };

      await db.users.add(user);
      await loadData();
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', role: UserRole.CASHIER });
  };

  const handleDeleteUser = async (id: string) => {
      if (window.confirm("Are you sure you want to remove this user?")) {
          await db.users.delete(id);
          await loadData();
      }
  };

  const handleExportData = async (type: 'sales' | 'inventory') => {
      try {
          let data = [];
          let filename = '';
          
          if (type === 'sales') {
              data = await db.sales.getAll();
              filename = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
          } else {
              data = await db.products.getAll();
              filename = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
          }

          if (data.length === 0) {
              alert("No data to export.");
              return;
          }

          // Convert JSON to CSV
          const headers = Object.keys(data[0]);
          const csvContent = [
              headers.join(','),
              ...data.map(row => headers.map(fieldName => {
                  let val = (row as any)[fieldName];
                  // Handle arrays or objects (like items in sale)
                  if (typeof val === 'object') val = JSON.stringify(val).replace(/,/g, ';'); 
                  return JSON.stringify(val);
              }).join(','))
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error("Export failed", e);
          alert("Export failed.");
      }
  };

  // User Table Columns
  const userColumns: Column<User>[] = [
      { header: "Name", accessorKey: "name", sortable: true, render: (u) => <span className="font-bold text-white whitespace-nowrap">{u.name}</span> },
      { header: "Email", accessorKey: "username" },
      { 
          header: "Role", 
          accessorKey: "role",
          render: (u) => (
              <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                  u.role === UserRole.ADMIN ? 'bg-purple-500/20 text-purple-400' :
                  u.role === UserRole.MANAGER ? 'bg-blue-500/20 text-blue-400' :
                  'bg-emerald-500/20 text-emerald-400'
              }`}>
                  {u.role}
              </span>
          )
      },
      {
          header: "Actions",
          render: (u) => (
              <button 
                onClick={() => handleDeleteUser(u.id)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Remove User"
              >
                  <Trash2 size={16} />
              </button>
          )
      }
  ];

  // Activity Log Columns
  const logColumns: Column<ActivityLog>[] = [
      { 
          header: "Timestamp", 
          accessorKey: "timestamp", 
          sortable: true,
          render: (log) => <span className="text-slate-400 text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</span>
      },
      { 
          header: "User", 
          accessorKey: "userName",
          render: (log) => <span className="font-medium text-white">{log.userName}</span>
      },
      { 
          header: "Action", 
          accessorKey: "action",
          render: (log) => (
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  log.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                  log.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                  log.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-blue-500/20 text-blue-400'
              }`}>
                  {log.action}
              </span>
          )
      },
      { header: "Details", accessorKey: "details", className: "text-xs text-slate-300" }
  ];

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={40}/></div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-950">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">System Settings</h1>
        <p className="text-slate-400">Manage store details, users, and data.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
           <div className="bg-slate-900 rounded-xl border border-slate-800 p-2 flex flex-row lg:flex-col overflow-x-auto gap-1">
              <button 
                onClick={() => setActiveTab('general')}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'general' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Store size={18} /> General
              </button>
              <button 
                onClick={() => setActiveTab('team')}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'team' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Users size={18} /> Team Members
              </button>
              <button 
                onClick={() => setActiveTab('data')}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'data' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Database size={18} /> Data Management
              </button>
              <button 
                onClick={() => setActiveTab('activity')}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'activity' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Activity size={18} /> Activity Log
              </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Store size={20} className="text-sky-500" />
                            Store Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Shop Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.shopName}
                                    onChange={(e) => setSettings({...settings, shopName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.phone}
                                    onChange={(e) => setSettings({...settings, phone: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Address Line 1</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.addressLine1}
                                    onChange={(e) => setSettings({...settings, addressLine1: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Address Line 2 (City, Country)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.addressLine2}
                                    onChange={(e) => setSettings({...settings, addressLine2: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Receipt size={20} className="text-emerald-500" />
                            Financial & Receipt
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tax / VAT Rate (%)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.taxRate}
                                    onChange={(e) => setSettings({...settings, taxRate: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Tax ID / TIN Number</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.tinNumber}
                                    onChange={(e) => setSettings({...settings, tinNumber: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-1">Receipt Footer Message</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                                    value={settings.receiptFooter}
                                    onChange={(e) => setSettings({...settings, receiptFooter: e.target.value})}
                                />
                                <p className="text-xs text-slate-500 mt-1">Appears at the bottom of printed receipts.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-sky-900/20 flex items-center gap-2 transition-all disabled:opacity-50 w-full sm:w-auto justify-center"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />}
                            Save Changes
                        </button>
                    </div>
                </div>
            )}

            {/* TEAM TAB */}
            {activeTab === 'team' && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Users size={20} className="text-blue-500" />
                                    Staff Management
                                </h2>
                                <p className="text-slate-400 text-sm">Manage access and roles for your employees.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddUserOpen(true)}
                                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 w-full sm:w-auto justify-center"
                            >
                                <Plus size={16} /> Add User
                            </button>
                        </div>
                        
                        <DataTable columns={userColumns} data={users} />
                    </div>
                </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === 'activity' && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Activity size={20} className="text-amber-500" />
                                Audit Log
                            </h2>
                            <p className="text-slate-400 text-sm">Track significant system events and user actions.</p>
                        </div>
                        
                        <DataTable columns={logColumns} data={logs} />
                    </div>
                </div>
            )}

            {/* DATA TAB */}
            {activeTab === 'data' && (
                 <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Download size={20} className="text-emerald-500" />
                            Data Export
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">Download your system data in CSV format for external analysis (Excel, Sheets).</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={() => handleExportData('sales')}
                                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-sky-500 transition-colors group"
                            >
                                <div className="text-left">
                                    <h3 className="font-bold text-white group-hover:text-sky-400">Sales History</h3>
                                    <p className="text-xs text-slate-500">All recorded transactions</p>
                                </div>
                                <Download size={20} className="text-slate-400 group-hover:text-sky-500" />
                            </button>

                            <button 
                                onClick={() => handleExportData('inventory')}
                                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-emerald-500 transition-colors group"
                            >
                                <div className="text-left">
                                    <h3 className="font-bold text-white group-hover:text-emerald-400">Inventory Data</h3>
                                    <p className="text-xs text-slate-500">Current stock and prices</p>
                                </div>
                                <Download size={20} className="text-slate-400 group-hover:text-emerald-500" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-6">
                         <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <ShieldAlert size={20} className="text-red-500" />
                            Danger Zone
                        </h2>
                        <p className="text-slate-400 text-sm mb-4">Actions here cannot be undone.</p>
                        <button className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg text-sm font-bold border border-red-600/50 transition-all w-full sm:w-auto">
                            Clear Local Cache
                        </button>
                    </div>
                 </div>
            )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-xl border border-slate-800 p-6 shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-4">Add Team Member</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-sm text-slate-400">Full Name</label>
                          <input 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" 
                            value={newUser.name}
                            onChange={e => setNewUser({...newUser, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-sm text-slate-400">Email (Username)</label>
                          <input 
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" 
                            value={newUser.email}
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-sm text-slate-400">Role</label>
                          <select 
                             className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                             value={newUser.role}
                             onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                          >
                              <option value={UserRole.CASHIER}>Cashier</option>
                              <option value={UserRole.MANAGER}>Manager</option>
                              <option value={UserRole.ADMIN}>Admin</option>
                          </select>
                      </div>
                      <div className="flex gap-2 justify-end mt-4">
                          <button onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                          <button onClick={handleAddUser} className="bg-sky-600 px-4 py-2 rounded text-white font-bold">Add User</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;