import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import { User } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session storage for persistent login during reload
    const storedUser = localStorage.getItem('kante_session_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('kante_session_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kante_session_user');
    setCurrentView('dashboard');
  };

  if (isLoading) return null;

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'pos':
        return <POS currentUser={currentUser} />;
      case 'inventory':
        return <Inventory />;
      // In a real app, these would be separate components
      case 'reports':
        return (
          <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <div className="p-6 rounded-full bg-slate-900 mb-4"><span className="text-4xl">📊</span></div>
            <h2 className="text-xl font-bold text-white mb-2">Reports Module</h2>
            <p>Detailed financial reporting would appear here.</p>
          </div>
        );
      case 'customers':
        return (
          <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <div className="p-6 rounded-full bg-slate-900 mb-4"><span className="text-4xl">👥</span></div>
            <h2 className="text-xl font-bold text-white mb-2">Customer Management</h2>
            <p>Customer database and loyalty programs would appear here.</p>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <div className="p-6 rounded-full bg-slate-900 mb-4"><span className="text-4xl">⚙️</span></div>
            <h2 className="text-xl font-bold text-white mb-2">System Settings</h2>
            <p>Configuration for taxes, users, and backups would appear here.</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout 
      currentUser={currentUser} 
      currentView={currentView} 
      onChangeView={setCurrentView}
      onLogout={handleLogout}
    >
      {renderView()}
    </Layout>
  );
};

export default App;