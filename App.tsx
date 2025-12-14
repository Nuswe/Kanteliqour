import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { authInstance } from './services/firebase';
import { db } from './services/db';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { User, UserRole } from './types';
import { Loader2, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Production Auth Listener
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      try {
        if (firebaseUser && firebaseUser.email) {
          // Fetch the full user profile (Role, Name) from Firestore
          const userProfile = await db.users.getUserProfile(firebaseUser.uid, firebaseUser.email);
          setCurrentUser(userProfile);
        } else {
          // Only clear user if we are NOT in demo mode (mock users have ids starting with 'demo-')
          // This prevents the auth listener from wiping out a manual demo login
          setCurrentUser(prev => prev?.id.startsWith('demo-') ? prev : null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await authInstance.signOut();
      setCurrentUser(null);
      setCurrentView('dashboard');
    } catch (error) {
      console.error("Logout failed", error);
      // Force logout for demo users
      setCurrentUser(null);
      setCurrentView('dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-sky-500 gap-4">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="text-slate-400 font-medium">Initializing Kante Liquor...</p>
      </div>
    );
  }

  if (!currentUser) {
    // PASS THE SETTER FUNCTION so Login can update the App state
    return <Login onLogin={(user) => setCurrentUser(user)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard currentUser={currentUser} />;
      case 'pos':
        return <POS currentUser={currentUser} />;
      case 'inventory':
        return <Inventory currentUser={currentUser} />;
      case 'reports':
        // Gatekeep Reports
        if (currentUser.role === UserRole.CASHIER) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <ShieldAlert size={64} className="mb-4 text-red-500" />
                    <h2 className="text-xl font-bold text-white">Access Denied</h2>
                    <p>You do not have permission to view financial reports.</p>
                </div>
            );
        }
        return <Reports />;
      case 'customers':
        return (
          <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <div className="p-6 rounded-full bg-slate-900 mb-4"><span className="text-4xl">👥</span></div>
            <h2 className="text-xl font-bold text-white mb-2">Customer Management</h2>
            <p>Customer database and loyalty programs would appear here.</p>
          </div>
        );
      case 'settings':
         // Gatekeep Settings
         if (currentUser.role === UserRole.CASHIER) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <ShieldAlert size={64} className="mb-4 text-red-500" />
                    <h2 className="text-xl font-bold text-white">Access Denied</h2>
                    <p>System settings are restricted to Administrators.</p>
                </div>
            );
        }
        return <Settings />;
      default:
        return <Dashboard currentUser={currentUser} />;
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