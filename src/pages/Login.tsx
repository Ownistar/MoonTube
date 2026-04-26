import React, { useState } from 'react';
import { Moon, Chrome, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-4 text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center w-full max-w-md"
      >
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-[#050505] shadow-[0_0_50px_rgba(255,255,255,0.1)] transform rotate-3 hover:rotate-0 transition-transform">
          <Moon className="h-10 w-10 fill-current" />
        </div>
        
        <h1 className="mb-1 font-sans text-4xl font-black tracking-tighter uppercase">MoonTube</h1>
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.3em] text-white/40">
          The creator economy, evolved
        </p>

        {/* Mode Selector */}
        <div className="mb-8 flex w-full gap-2 rounded-2xl bg-white/5 p-1">
          <button
            onClick={() => setMode('login')}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all",
              mode === 'login' ? "bg-white text-black" : "text-white/40 hover:text-white"
            )}
          >
            <LogIn className="h-4 w-4" /> Log In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all",
              mode === 'signup' ? "bg-white text-black" : "text-white/40 hover:text-white"
            )}
          >
            <UserPlus className="h-4 w-4" /> Register
          </button>
        </div>

        <div className="flex flex-col gap-6 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 10 : -10 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {mode === 'login' ? 'Welcome Back' : 'Join the Revolution'}
              </h2>
              <p className="text-sm text-white/60 mb-8 px-4">
                {mode === 'login' 
                  ? 'Sign in to access your dashboard, library, and subscriptions.' 
                  : 'Start your journey as a MoonTube creator. Earn $0.50 RPM from view one.'}
              </p>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={signIn}
            className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-8 py-5 font-black text-xs uppercase tracking-[0.2em] text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <Chrome className="h-4 w-4" />
            {mode === 'login' ? 'Sign in with Google' : 'Create Account with Google'}
            <div className="absolute inset-0 rounded-2xl border border-white/5 group-hover:border-white/20 transition-colors" />
          </button>
          
          <div className="mt-8 grid grid-cols-3 gap-6 text-center border-t border-white/5 pt-8">
            <div>
              <p className="text-lg font-bold">$0.50</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Fixed RPM</p>
            </div>
            <div>
              <p className="text-lg font-bold">Inst</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Ad Revenue</p>
            </div>
            <div>
              <p className="text-lg font-bold">100%</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Ownership</p>
            </div>
          </div>
        </div>
      </motion.div>
      
      <div className="fixed bottom-8 text-[9px] font-black text-white/10 uppercase tracking-[0.5em] transition-opacity hover:opacity-100">
        Engineered for the elite
      </div>
    </div>
  );
}
