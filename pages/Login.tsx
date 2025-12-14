import React, { useState, useEffect } from 'react';
import { Wine, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { authInstance } from '../services/firebase';
import { db } from '../services/db';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@kante.com'); 
  const [password, setPassword] = useState('admin123'); 
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fillCredentials = (type: 'admin' | 'cashier') => {
      if (type === 'admin') {
          setEmail('admin@kante.com');
          setPassword('admin123');
      } else {
          setEmail('cashier@kante.com');
          setPassword('cashier123');
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // --- DEMO MODE BYPASS ---
    // Allows logging in even if Firebase is not configured
    if (email === 'admin@kante.com' && password === 'admin123') {
        const demoUser = {
            id: 'demo-admin',
            name: 'System Admin (Demo)',
            role: UserRole.ADMIN,
            username: 'admin@kante.com'
        };
        setTimeout(() => {
            db.logs.add({
                userId: demoUser.id,
                userName: demoUser.name,
                action: 'Login',
                details: 'Successful demo login',
                timestamp: new Date().toISOString(),
                type: 'info'
            });
            onLogin(demoUser);
            setIsLoading(false);
        }, 800); 
        return;
    }

    if (email === 'cashier@kante.com' && password === 'cashier123') {
        const demoUser = {
            id: 'demo-cashier',
            name: 'John Cashier (Demo)',
            role: UserRole.CASHIER,
            username: 'cashier@kante.com'
        };
        setTimeout(() => {
            db.logs.add({
                userId: demoUser.id,
                userName: demoUser.name,
                action: 'Login',
                details: 'Successful demo login',
                timestamp: new Date().toISOString(),
                type: 'info'
            });
            onLogin(demoUser);
            setIsLoading(false);
        }, 800);
        return;
    }
    // ------------------------

    try {
        const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
        // Log successful login for authenticated users
        await db.logs.add({
            userId: userCredential.user.uid,
            userName: userCredential.user.email || 'Unknown User',
            action: 'Login',
            details: 'Successful authentication',
            timestamp: new Date().toISOString(),
            type: 'info'
        });
        // App.tsx onAuthStateChanged listener handles the actual state update
    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            setError('Invalid email or password.');
        } else if (err.code === 'auth/too-many-requests') {
            setError('Too many failed attempts. Try again later.');
        } else if (err.code === 'auth/api-key-not-valid' || err.code === 'auth/internal-error') { 
            setError('System not configured. Please use Demo Credentials.');
        } else {
            setError('Login failed. Please check your connection.');
        }
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden font-sans text-slate-100 selection:bg-sky-500/30">
       {/* Custom Animation Styles */}
       <style>{`
         @keyframes blob {
           0% { transform: translate(0px, 0px) scale(1); }
           33% { transform: translate(30px, -50px) scale(1.1); }
           66% { transform: translate(-20px, 20px) scale(0.9); }
           100% { transform: translate(0px, 0px) scale(1); }
         }
         .animate-blob {
           animation: blob 7s infinite;
         }
         .animation-delay-2000 {
           animation-delay: 2s;
         }
         .animation-delay-4000 {
           animation-delay: 4s;
         }
       `}</style>

       {/* Background Shapes */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-sky-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-20 w-96 h-96 bg-emerald-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
       </div>

       {/* Left Side - Visuals (Desktop) */}
       <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900/30 items-center justify-center overflow-hidden border-r border-slate-800/50 backdrop-blur-sm z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/80 z-0" />
          
          <div className={`absolute top-1/4 left-1/4 w-64 h-64 bg-sky-600/20 rounded-full blur-[80px] animate-pulse duration-[4s] ${mounted ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute bottom-1/3 right-1/3 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] animate-pulse duration-[5s] delay-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

          <div className="relative z-20 p-12 text-center max-w-lg">
            <div className="mb-8 flex justify-center">
               <div className="relative group">
                 <div className="absolute inset-0 bg-sky-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                 <div className="h-24 w-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center shadow-2xl border border-slate-700 relative z-10 group-hover:scale-105 transition-transform duration-300">
                    <Wine className="h-10 w-10 text-sky-500" />
                 </div>
               </div>
            </div>
            <h1 className="text-5xl font-bold mb-6 text-white tracking-tight">
              Kante Liquor
              <span className="text-sky-500">.</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Streamline your inventory, manage sales, and grow your business with the ultimate POS solution.
            </p>
          </div>
       </div>

       {/* Right Side - Form */}
       <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
         <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-md p-8 rounded-2xl border border-slate-800/50 shadow-2xl">
            <div className="mb-8 text-center lg:text-left">
              <div className="lg:hidden flex justify-center mb-6">
                <div className="h-16 w-16 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shadow-lg">
                   <Wine className="h-8 w-8 text-sky-500" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">System Login</h2>
              <p className="text-slate-400">Enter your credentials to access the terminal.</p>
            </div>

            {/* Demo Credentials Quick Fill */}
            <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 uppercase font-bold mb-3 flex items-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-500"/> Demo Credentials
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button"
                        onClick={() => fillCredentials('admin')}
                        className="text-xs bg-slate-800 hover:bg-sky-600/20 hover:text-sky-400 hover:border-sky-500/50 border border-slate-700 text-slate-300 p-2 rounded-lg transition-all"
                    >
                        <strong>Admin</strong>
                        <div className="opacity-50 font-mono mt-1">admin123</div>
                    </button>
                    <button 
                        type="button"
                        onClick={() => fillCredentials('cashier')}
                        className="text-xs bg-slate-800 hover:bg-sky-600/20 hover:text-sky-400 hover:border-sky-500/50 border border-slate-700 text-slate-300 p-2 rounded-lg transition-all"
                    >
                        <strong>Cashier</strong>
                        <div className="opacity-50 font-mono mt-1">cashier123</div>
                    </button>
                </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-500 group-focus-within:text-sky-400 transition-colors duration-300" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-300"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-sky-400 transition-colors duration-300" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px] shadow-red-400/50" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 transition-all duration-300 transform active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-sky-900/20 group"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                ) : (
                  <>
                    Sign In <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
              <p className="text-xs text-slate-500 mb-3">Using Demo Mode</p>
              <div className="text-xs text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800">
                  For production, configure <code className="text-sky-400">services/firebase.ts</code> with your own API keys.
              </div>
            </div>
         </div>
       </div>
    </div>
  );
};

export default Login;