import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { formatCurrency } from '../lib/utils';
import { DollarSign, ArrowUpRight, Clock, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function MPPDashboard() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paypalEmail, setPaypalEmail] = useState(profile?.paypalEmail || user?.email || '');
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user]);

  const handleRequestPayout = async () => {
    if (!profile || profile.earningsBalance < 30) {
      setMessage('Minimum payout is $30.00');
      return;
    }

    if (!paypalEmail) {
      setMessage('Please enter a PayPal email.');
      return;
    }

    setRequesting(true);
    try {
      const amount = profile.earningsBalance;
      
      // Create transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user!.uid,
        amount,
        status: 'pending',
        paypalEmail,
        createdAt: new Date().toISOString()
      });

      // Deduct from balance
      await updateDoc(doc(db, 'users', user!.uid), {
        earningsBalance: increment(-amount)
      });

      setMessage('Payout requested successfully. Lunar clearance takes 24 hours.');
      // Refresh balance or redirect
    } catch (err) {
      console.error(err);
      setMessage('Satellite comms failure. Try again later.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-purple-500">Creator Moon Station</h1>
          <p className="text-white/40">Real-time earnings tracking with fixed $0.50 RPM</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#8B5CF6] text-white shadow-[0_0_40px_rgba(139,92,246,0.3)]">
          <DollarSign className="h-8 w-8" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Earnings Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">Lunar Balance</p>
          <h2 className="mt-2 text-6xl font-bold tracking-tighter text-white">
            {formatCurrency(profile?.earningsBalance || 0)}
          </h2>
          <p className="mt-4 text-sm text-white/40">
            Total Views: <span className="text-white">{profile?.totalViews || 0}</span>
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2 block">PayPal Recipient</label>
              <input
                type="email"
                placeholder="PayPal Email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black py-4 px-4 text-sm outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleRequestPayout}
              disabled={requesting || (profile?.earningsBalance || 0) < 30}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#8B5CF6] py-4 font-bold text-white hover:bg-[#7C3AED] disabled:opacity-30 disabled:hover:bg-[#8B5CF6] mpp-glow shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all"
            >
              <ShoppingCart className="h-5 w-5" />
              {requesting ? 'Processing...' : 'Request Payout'}
            </button>
            {message && <p className={cn("text-center text-xs font-medium", message.includes('success') ? 'text-green-500' : 'text-purple-400')}>{message}</p>}
            <div className="flex flex-col gap-1 items-center">
              <p className="text-center text-[10px] text-white/20">Minimum withdrawal: $30.00 USD</p>
              <p className="max-w-[280px] text-center text-[10px] leading-relaxed text-white/20">
                PayPal transaction fees are borne by the recipient and will be deducted from the payout amount.
              </p>
              <p className="max-w-[280px] text-center text-[10px] leading-relaxed text-white/20">
                Payment Term: Net-45 (Processed within 45 days of month-end).
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Column */}
        <div className="flex flex-col gap-6">
          <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="flex items-center gap-2 font-bold">
              <Clock className="h-4 w-4 text-white/40" /> Recent Payouts
            </h3>
            <div className="mt-4 space-y-4">
              {transactions.length === 0 ? (
                <p className="text-sm text-white/20">No transactions recorded in this quadrant.</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{formatCurrency(tx.amount)}</p>
                      <p className="text-[10px] text-white/40">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase">
                      {tx.status === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      )}
                      {tx.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="rounded-3xl border border-white/10 bg-[#FFD700]/5 p-6">
             <div className="flex items-center gap-3">
                <ArrowUpRight className="h-6 w-6 text-yellow-500" />
                <p className="text-sm font-medium leading-tight">
                  <span className="text-white">New:</span> Payout limits reduced to $30.00 USD. Start earning from your lunar transmissions today.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
