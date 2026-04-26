import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Users } from 'lucide-react';

interface SubscribedCreator {
  uid: string;
  displayName: string;
  photoURL: string;
  subscriberCount: number;
}

export default function Subscriptions() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<SubscribedCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'subscriptions'), where('subscriberId', '==', user.uid));
        const subSnap = await getDocs(q);
        
        const creators: SubscribedCreator[] = [];
        for (const subDoc of subSnap.docs) {
          const creatorId = subDoc.data().creatorId;
          const creatorDoc = await getDoc(doc(db, 'users', creatorId));
          if (creatorDoc.exists()) {
            const data = creatorDoc.data();
            creators.push({
              uid: creatorId,
              displayName: data.displayName || 'Unknown Astronaut',
              photoURL: data.photoURL || '',
              subscriberCount: data.subscriberCount || 0
            });
          }
        }
        setChannels(creators);
      } catch (err) {
        console.error('Error fetching subscriptions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user]);

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="animate-pulse font-mono text-purple-500 tracking-[0.5em] uppercase text-xs">Synchronizing Orbitals...</div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-12">
        <div className="h-12 w-12 bg-purple-600/20 rounded-2xl flex items-center justify-center">
          <Users className="h-6 w-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Your Subscriptions</h1>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Channels you are currently following</p>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-neutral-800 rounded-3xl">
          <p className="text-neutral-500 uppercase tracking-widest text-xs font-bold mb-4">No active planetary signals found</p>
          <Link to="/" className="text-purple-500 text-xs font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4 pointer-events-auto">Return to Home</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {channels.map((channel, i) => (
            <motion.div
              key={channel.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative flex items-center gap-5 p-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60 transition-all shadow-xl"
            >
              <div className="h-16 w-16 rounded-full overflow-hidden ring-4 ring-neutral-800 flex-shrink-0">
                {channel.photoURL ? (
                  <img 
                    src={channel.photoURL} 
                    alt={channel.displayName} 
                    className="h-full w-full object-cover transition-transform group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full bg-neutral-800 flex items-center justify-center">
                    <User className="h-8 w-8 text-neutral-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black uppercase tracking-tight text-lg truncate">{channel.displayName}</h3>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                  {channel.subscriberCount.toLocaleString()} Subscribers
                </p>
              </div>
              <Link 
                to={`/channel/${channel.uid}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 rounded-3xl"
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
