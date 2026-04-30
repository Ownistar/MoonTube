import React, { useEffect, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Video, CATEGORIES } from '../types';
import VideoCard from '../components/video/VideoCard';
import { User, Film, BarChart3, Settings, Edit2, Trash2, X, Check, Save, TrendingUp, Users, PlayCircle, AlertTriangle, Zap, DollarSign, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export default function Profile() {
  const { user, profile, signOut } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'analytics' | 'earnings'>('videos');
  
  // Edit Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Studio Edit States
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    const fetchMyVideos = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'videos'),
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Video[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyVideos();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || !editName) return;
    setSaveLoading(true);
    try {
      // 1. Update Firebase Auth Profile (ensures new comments/posts are correct)
      await updateProfile(user, {
        displayName: editName,
        photoURL: editPhoto
      });

      // 2. Update primary user document in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName,
        photoURL: editPhoto
      });

      // 3. Propagate to owned videos (Denormalized)
      const vQuery = query(collection(db, 'videos'), where('ownerId', '==', user.uid));
      const vSnaps = await getDocs(vQuery);
      
      const MAX_BATCH_SIZE = 500;
      let batch = writeBatch(db);
      let count = 0;

      for (const vDoc of vSnaps.docs) {
        batch.update(doc(db, 'videos', vDoc.id), {
          ownerName: editName,
          ownerPhoto: editPhoto
        });
        count++;
        if (count >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      // 4. Propagate to user comments (Denormalized)
      const cQuery = query(collection(db, 'comments'), where('userId', '==', user.uid));
      const cSnaps = await getDocs(cQuery);

      for (const cDoc of cSnaps.docs) {
        batch.update(doc(db, 'comments', cDoc.id), {
          userName: editName,
          userPhoto: editPhoto
        });
        count++;
        if (count >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setIsEditingProfile(false);
      window.location.reload();
    } catch (err) {
      console.error('Identity sync failed:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateVideo = async () => {
    if (!editingVideo) return;
    setUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'videos', editingVideo.id), {
        title: editTitle,
        description: editDesc,
        category: editCat
      });
      setVideos(videos.map(v => v.id === editingVideo.id ? { ...v, title: editTitle, description: editDesc, category: editCat } : v));
      setEditingVideo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdateLoading(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteVideo = async (videoId: string) => {
    if (deletingId !== videoId) {
      setDeletingId(videoId);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      setVideos(videos.filter(v => v.id !== videoId));
      setDeletingId(null);
      setEditingVideo(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `videos/${videoId}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#121212] p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tighter">Edit Identity</h2>
                <button onClick={() => setIsEditingProfile(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Display Name</label>
                  <input 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black p-4 text-sm focus:border-purple-500 transition-colors focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Avatar URL</label>
                  <input 
                    value={editPhoto} 
                    onChange={e => setEditPhoto(e.target.value)} 
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black p-4 text-sm focus:border-purple-500 transition-colors focus:outline-none"
                  />
                </div>
                <button 
                  onClick={handleSaveProfile}
                  disabled={saveLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-4 font-bold hover:bg-purple-700 disabled:opacity-50 transition-all mpp-glow shadow-lg shadow-purple-500/20 active:scale-95"
                >
                  {saveLoading ? 'Saving...' : 'Sync Profile'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Studio Edit Modal */}
      <AnimatePresence>
        {editingVideo && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl rounded-3xl border border-neutral-800 bg-[#121212] p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tighter text-purple-500">Studio: Edit Clip</h2>
                <button onClick={() => setEditingVideo(null)} className="text-white/40 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                   <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Title</label>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-800 bg-black p-4 text-sm focus:border-purple-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Category</label>
                        <select value={editCat} onChange={e => setEditCat(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-800 bg-black p-4 text-sm focus:border-purple-500 focus:outline-none appearance-none">
                           {CATEGORIES.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Description</label>
                      <textarea rows={6} value={editDesc} onChange={e => setEditDesc(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-800 bg-black p-4 text-sm focus:border-purple-500 focus:outline-none resize-none" />
                   </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleUpdateVideo}
                    disabled={updateLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-bold hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {updateLoading ? 'Saving...' : 'Update'}
                  </button>
                  <button 
                    onClick={() => handleDeleteVideo(editingVideo!.id)}
                    onMouseLeave={() => setDeletingId(null)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl px-8 font-bold transition-all duration-300",
                      deletingId === editingVideo.id 
                        ? "bg-red-600 text-white animate-pulse" 
                        : "border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    )}
                  >
                    {deletingId === editingVideo.id ? (
                      <><AlertTriangle className="h-4 w-4" /> Final Confirm</>
                    ) : (
                      <><Trash2 className="h-4 w-4" /> Delete</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative mb-12 overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 p-8 md:p-12 shadow-2xl">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 translate-y-[-50%] rounded-full bg-purple-600/10 blur-[100px]" />
        
        <div className="relative flex flex-col items-center gap-8 md:flex-row">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full ring-4 ring-neutral-800 shadow-2xl">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-4xl text-purple-500">
                <User className="h-12 w-12" />
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center gap-3 md:justify-start">
              <h1 className="text-4xl font-black tracking-tighter uppercase">{profile?.displayName || 'User'}</h1>
              {profile?.mppJoinedAt && <div className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg mpp-glow">MOON PARTNER</div>}
            </div>
            <p className="mt-2 text-neutral-500 font-medium tracking-tight">System Node Established: {profile?.mppJoinedAt ? formatDate(profile.mppJoinedAt) : 'Active'}</p>
            
            <div className="mt-6 flex flex-wrap justify-center gap-4 md:justify-start">
              <div className="rounded-2xl border border-neutral-800 bg-black/40 px-6 py-3 text-center min-w-[100px]">
                <p className="text-xl font-black text-purple-500">{videos.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Clips</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-black/40 px-6 py-3 text-center min-w-[100px]">
                <p className="text-xl font-black text-purple-500 font-mono">{profile?.totalViews || 0}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Impact</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-black/40 px-6 py-3 text-center min-w-[100px]">
                <p className="text-xl font-black text-purple-500 font-mono">{profile?.subscriberCount || 0}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Followers</p>
              </div>
              <button 
                onClick={() => {
                  setEditName(profile?.displayName || '');
                  setEditPhoto(profile?.photoURL || '');
                  setIsEditingProfile(true);
                }}
                className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-white/5 px-6 py-3 text-sm font-bold hover:bg-neutral-800 transition-all transform active:scale-95"
              >
                <Settings className="h-4 w-4" /> Configure
              </button>
              <Link 
                to={`/channel/${user.uid}`}
                className="flex items-center gap-2 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-6 py-3 text-sm font-bold text-purple-400 hover:bg-purple-500 hover:text-white transition-all transform active:scale-95 shadow-lg"
              >
                <User className="h-4 w-4" /> View Channel
              </Link>
              <button 
                onClick={() => signOut()}
                className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-sm font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all transform active:scale-95 shadow-lg"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 flex border-b border-neutral-800">
        <button 
          onClick={() => setActiveTab('videos')}
          className={cn(
            "flex items-center gap-2 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all",
            activeTab === 'videos' ? "border-b-2 border-purple-500 text-purple-500" : "text-neutral-500 hover:text-white"
          )}
        >
          <Film className="h-4 w-4" /> Vault
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={cn(
            "flex items-center gap-2 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all",
            activeTab === 'analytics' ? "border-b-2 border-purple-500 text-purple-500" : "text-neutral-500 hover:text-white"
          )}
        >
          <BarChart3 className="h-4 w-4" /> Analytics
        </button>
        {profile?.mppJoinedAt && (
          <button 
            onClick={() => setActiveTab('earnings')}
            className={cn(
              "flex items-center gap-2 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'earnings' ? "border-b-2 border-purple-500 text-purple-500" : "text-neutral-500 hover:text-white"
            )}
          >
            <DollarSign className="h-4 w-4" /> Earnings
          </button>
        )}
      </div>

      {activeTab === 'videos' ? (
        loading ? (
          <div className="text-center py-12 text-neutral-500 animate-pulse font-mono">SCANNING LUNAR VAULT...</div>
        ) : videos.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/50">
            <p className="text-neutral-500 font-bold uppercase tracking-widest">No transmissions found.</p>
            <Link to="/upload" className="mt-4 rounded-full bg-purple-600 px-8 py-3 text-sm font-black text-white mpp-glow hover:bg-purple-700 transition-all">
              START UPLOAD
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Standard Videos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-black uppercase tracking-tight">Main Transmissions</h3>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos.map((video) => (
                  <div key={video.id} className="relative group">
                    <VideoCard video={video} />
                    <button 
                      onClick={() => {
                        setEditingVideo(video);
                        setEditTitle(video.title);
                        setEditDesc(video.description || '');
                        setEditCat(video.category);
                      }}
                      className="absolute top-2 left-2 bg-black/80 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-600 text-white shadow-xl"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : activeTab === 'analytics' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Analytics Cards */}
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center gap-3 text-purple-500 mb-4">
                 <TrendingUp className="h-5 w-5" />
                 <span className="text-xs font-black uppercase tracking-widest">Growth Velocity</span>
              </div>
              <p className="text-4xl font-black">+12.4%</p>
              <p className="text-[10px] text-neutral-500 mt-2">Increased reach vs last lunar cycle</p>
           </motion.div>
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center gap-3 text-purple-500 mb-4">
                 <Users className="h-5 w-5" />
                 <span className="text-xs font-black uppercase tracking-widest">Active Audience</span>
              </div>
              <p className="text-4xl font-black">{profile?.totalViews || 0}</p>
              <p className="text-[10px] text-neutral-500 mt-2">Total unique planetary views</p>
           </motion.div>


           <div className="md:col-span-3 p-12 rounded-3xl border border-neutral-800 bg-neutral-900/30 flex flex-col items-center justify-center text-center">
              <PlayCircle className="h-12 w-12 text-purple-500 mb-4 opacity-50" />
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Advanced Analytics Module Pending</h3>
              <p className="text-sm text-neutral-500 max-w-md">Deep engagement metrics and planetary heatmaps are currently in calibration. Check back after your next 10,000 views.</p>
           </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-600/10 text-purple-500">
            <DollarSign className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Lunar Revenue Stream</h2>
          <p className="text-neutral-500 mb-8 max-w-lg mx-auto font-medium">Your planetary impact is generating economic value. Monitor your balances and request payouts through the central command station.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
            <div className="p-6 rounded-2xl bg-black/40 border border-neutral-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-left mb-1">Current Balance</p>
              <p className="text-2xl sm:text-3xl font-black text-white text-left">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(profile?.earningsBalance || 0)}</p>
            </div>
            <div className="p-6 rounded-2xl bg-black/40 border border-neutral-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-left mb-1">Lifetime RPM</p>
              <p className="text-3xl font-black text-white text-left">$0.50</p>
            </div>
          </div>

          <Link 
            to="/mpp" 
            className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-10 py-4 font-black uppercase tracking-widest text-white shadow-xl mpp-glow hover:bg-purple-500 transition-all active:scale-95"
          >
            Open Earnings Command <TrendingUp className="h-5 w-5" />
          </Link>
        </div>
      )}
    </div>
  );
}

