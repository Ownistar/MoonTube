import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Video } from '../types';
import VideoCard from '../components/video/VideoCard';
import { User, Film, Check, Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export default function Channel() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [channelProfile, setChannelProfile] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'shorts'>('videos');

  useEffect(() => {
    const fetchChannel = async () => {
      if (!userId) return;
      try {
        // Fetch User Data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setChannelProfile(userDoc.data());
        }

        // Fetch Videos
        const q = query(
          collection(db, 'videos'),
          where('ownerId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Video[]);

        // Check Subscription
        if (currentUser) {
          const subId = `${userId}_${currentUser.uid}`;
          const subSnap = await getDoc(doc(db, 'subscriptions', subId));
          setIsSubscribed(subSnap.exists());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChannel();
  }, [userId, currentUser]);

  const handleSubscribe = async () => {
    if (!currentUser || !userId || currentUser.uid === userId) return;
    setSubLoading(true);
    try {
      const subId = `${userId}_${currentUser.uid}`;
      const subRef = doc(db, 'subscriptions', subId);
      
      if (isSubscribed) {
        const batch = writeBatch(db);
        batch.delete(subRef);
        batch.update(doc(db, 'users', userId), {
          subscriberCount: increment(-1)
        });
        await batch.commit();
        setIsSubscribed(false);
        setChannelProfile((prev: any) => ({ ...prev, subscriberCount: (prev.subscriberCount || 1) - 1 }));
      } else {
        const batch = writeBatch(db);
        batch.set(subRef, {
          creatorId: userId,
          subscriberId: currentUser.uid,
          createdAt: serverTimestamp()
        });
        batch.update(doc(db, 'users', userId), {
          subscriberCount: increment(1)
        });
        await batch.commit();
        setIsSubscribed(true);
        setChannelProfile((prev: any) => ({ ...prev, subscriberCount: (prev.subscriberCount || 0) + 1 }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subscriptions/${userId}_${currentUser.uid}`);
    } finally {
      setSubLoading(false);
    }
  };

  if (loading) return <div className="p-8 font-mono animate-pulse text-purple-500">SYNCHRONIZING WITH PLANETARY NODE...</div>;
  if (!channelProfile) return <div className="p-8">Channel offline. No signal found.</div>;

  const filteredVideos = activeTab === 'videos' ? videos.filter(v => !v.isShort) : videos.filter(v => v.isShort);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 p-8 md:p-12 shadow-2xl">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 translate-y-[-50%] rounded-full bg-purple-600/10 blur-[100px]" />
        
        <div className="relative flex flex-col items-center gap-8 md:flex-row">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full ring-4 ring-neutral-800 shadow-2xl">
            {channelProfile.photoURL ? (
              <img src={channelProfile.photoURL} alt={channelProfile.displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-4xl text-purple-500">
                <User className="h-12 w-12" />
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-3 md:justify-start">
                  <h1 className="text-4xl font-black tracking-tighter uppercase">{channelProfile.displayName}</h1>
                  {channelProfile.mppJoinedAt && <div className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg mpp-glow">MOON PARTNER</div>}
                </div>
                <p className="text-neutral-500 font-medium tracking-tight">@{channelProfile.displayName.toLowerCase().replace(/\s+/g, '')} • {channelProfile.subscriberCount || 0} Followers</p>
              </div>

              {currentUser && currentUser.uid !== userId && (
                 <button 
                   onClick={handleSubscribe}
                   disabled={subLoading}
                   className={cn(
                     "rounded-full px-12 py-3.5 text-sm font-black uppercase tracking-widest transition-all shadow-xl active:scale-95",
                     isSubscribed 
                       ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" 
                       : "bg-purple-600 text-white hover:bg-purple-700 mpp-glow"
                   )}
                 >
                   {subLoading ? '...' : isSubscribed ? <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Following</span> : 'Follow'}
                 </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 flex border-b border-neutral-800 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('videos')}
          className={cn(
            "flex items-center gap-2 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all shrink-0",
            activeTab === 'videos' ? "border-b-2 border-purple-500 text-purple-500" : "text-neutral-500 hover:text-white"
          )}
        >
          <Film className="h-4 w-4" /> Vault
        </button>
        <button 
          onClick={() => setActiveTab('shorts')}
          className={cn(
            "flex items-center gap-2 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all shrink-0",
            activeTab === 'shorts' ? "border-b-2 border-purple-500 text-purple-500" : "text-neutral-500 hover:text-white"
          )}
        >
          <Zap className="h-4 w-4 fill-current" /> Shorts
        </button>
      </div>

      {filteredVideos.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/50">
          <p className="text-neutral-500 font-bold uppercase tracking-widest">No transmissions in this category.</p>
        </div>
      ) : activeTab === 'shorts' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
           {filteredVideos.map(short => (
              <Link key={short.id} to="/shorts" className="group">
                <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 transition-all group-hover:border-purple-500/50 shadow-xl">
                  <img src={short.thumbnail} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                    <h4 className="text-xs font-bold text-white line-clamp-2">{short.title}</h4>
                    <p className="text-[10px] text-white/60 font-bold mt-1 uppercase tracking-wider">{short.views} views</p>
                  </div>
                </div>
              </Link>
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
