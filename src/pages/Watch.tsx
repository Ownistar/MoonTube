import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, query, limit, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Video } from '../types';
import { formatViews, formatCurrency, cn } from '../lib/utils';
import { Share, ThumbsUp, ThumbsDown, Bookmark, MoreHorizontal, Moon, Check, Clock } from 'lucide-react';
import VideoCard from '../components/video/VideoCard';
import CommentSection from '../components/video/CommentSection';
import AdUnit from '../components/ads/AdUnit';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

const RPM = 0.50;
const EARNINGS_PER_VIEW = RPM / 1000;

export default function Watch() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [dislikeLoading, setDislikeLoading] = useState(false);
  const [viewChecked, setViewChecked] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Load interaction state from Firestore
  useEffect(() => {
    const fetchInteractions = async () => {
      if (videoId && user) {
        // Load Like state
        const likeId = `${videoId}_${user.uid}`;
        try {
          const likeDoc = await getDoc(doc(db, 'userLikes', likeId));
          setIsLiked(likeDoc.exists());
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `userLikes/${likeId}`);
        }

        // Load Dislike state
        const dislikeId = `${videoId}_${user.uid}`;
        try {
          const dislikeDoc = await getDoc(doc(db, 'userDislikes', dislikeId));
          setIsDisliked(dislikeDoc.exists());
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `userDislikes/${dislikeId}`);
        }

        // Save to history (Firestore)
        try {
          const historyId = `${videoId}_${user.uid}`;
          await setDoc(doc(db, 'userHistory', historyId), {
            userId: user.uid,
            videoId,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'userHistory');
        }
      } else if (!user) {
        setIsLiked(false);
        setIsDisliked(false);
      }
    };
    fetchInteractions();
  }, [videoId, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // Optional: show user-friendly message
  };

  useEffect(() => {
    if (shareSuccess) {
      const timer = setTimeout(() => setShareSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [shareSuccess]);

  useEffect(() => {
    setViewChecked(false);
  }, [videoId]);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!videoId) return;
      try {
        const videoDoc = await getDoc(doc(db, 'videos', videoId));
        if (videoDoc.exists()) {
          const data = videoDoc.data() as Video;
          setVideo({ id: videoDoc.id, ...data });

          // Check subscription status
          if (user && data.ownerId) {
            const subId = `${data.ownerId}_${user.uid}`;
            try {
              const subSnap = await getDoc(doc(db, 'subscriptions', subId));
              setIsSubscribed(subSnap.exists());
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `subscriptions/${subId}`);
            }
          }

          // Check Watch Later
          if (user && videoId) {
            const watchLaterId = `${videoId}_${user.uid}`;
            try {
              const wlSnap = await getDoc(doc(db, 'watchLater', watchLaterId));
              setIsSaved(wlSnap.exists());
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `watchLater/${watchLaterId}`);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching video:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchRelated = async () => {
      try {
        const q = query(collection(db, 'videos'), limit(10));
        const snapshot = await getDocs(q);
        setRelatedVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Video[]);
      } catch (err) {
        console.log(err);
      }
    };

    fetchVideo();
    fetchRelated();
  }, [videoId, user]);

  useEffect(() => {
    if (!user || !video || !videoId || viewChecked) return;

    // Don't count views for the video owner to prevent self-faking
    if (video.ownerId === user.uid) {
      setViewChecked(true);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const viewId = `${videoId}_${user.uid}`;
        const viewRef = doc(db, 'videoViews', viewId);
        
        // Check if user already viewed this video
        const viewSnap = await getDoc(viewRef);
        if (!viewSnap.exists()) {
          const batch = writeBatch(db);
          
          batch.set(viewRef, {
            userId: user.uid,
            videoId,
            createdAt: serverTimestamp()
          });

          batch.update(doc(db, 'videos', videoId), {
            views: increment(1)
          });
          
          batch.update(doc(db, 'users', video.ownerId), {
            totalViews: increment(1),
            earningsBalance: increment(EARNINGS_PER_VIEW)
          });
          
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `videoViews/${videoId}_${user.uid}`);
      }
      setViewChecked(true);
    }, 15000); // 15 seconds delay to count a view

    return () => clearTimeout(timer);
  }, [user, video, videoId, viewChecked]);

  const handleSubscribe = async () => {
    if (!user || !video || video.ownerId === user.uid) return;
    setSubLoading(true);
    try {
      const subId = `${video.ownerId}_${user.uid}`;
      const subRef = doc(db, 'subscriptions', subId);
      
      if (isSubscribed) {
        const batch = writeBatch(db);
        batch.delete(subRef);
        batch.update(doc(db, 'users', video.ownerId), {
          subscriberCount: increment(-1)
        });
        await batch.commit();
        setIsSubscribed(false);
      } else {
        const batch = writeBatch(db);
        batch.set(subRef, {
          creatorId: video.ownerId,
          subscriberId: user.uid,
          createdAt: serverTimestamp()
        });
        batch.update(doc(db, 'users', video.ownerId), {
          subscriberCount: increment(1)
        });
        await batch.commit();
        setIsSubscribed(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subscriptions/${video.ownerId}_${user.uid}`);
    } finally {
      setSubLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user || !video || !videoId) return;
    setLikeLoading(true);
    try {
      const batch = writeBatch(db);
      const likeId = `${videoId}_${user.uid}`;
      const likeRef = doc(db, 'userLikes', likeId);
      const dislikeId = `${videoId}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (isLiked) {
        batch.update(doc(db, 'videos', videoId), {
          likes: increment(-1)
        });
        batch.delete(likeRef);
        await batch.commit();
        
        setIsLiked(false);
        setVideo(prev => prev ? { ...prev, likes: (prev.likes || 1) - 1 } : null);
      } else {
        // Remove dislike if it exists
        if (isDisliked) {
          batch.update(doc(db, 'videos', videoId), {
            dislikes: increment(-1)
          });
          batch.delete(dislikeRef);
          setIsDisliked(false);
          setVideo(prev => prev ? { ...prev, dislikes: (prev.dislikes || 1) - 1 } : null);
        }

        batch.update(doc(db, 'videos', videoId), {
          likes: increment(1)
        });
        batch.set(likeRef, {
          userId: user.uid,
          videoId,
          createdAt: serverTimestamp()
        });
        await batch.commit();
        
        setIsLiked(true);
        setVideo(prev => prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `videos/${videoId}`);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDislike = async () => {
    if (!user || !video || !videoId) return;
    setDislikeLoading(true);
    try {
      const batch = writeBatch(db);
      const likeId = `${videoId}_${user.uid}`;
      const likeRef = doc(db, 'userLikes', likeId);
      const dislikeId = `${videoId}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (isDisliked) {
        batch.update(doc(db, 'videos', videoId), {
          dislikes: increment(-1)
        });
        batch.delete(dislikeRef);
        await batch.commit();

        setIsDisliked(false);
        setVideo(prev => prev ? { ...prev, dislikes: (prev.dislikes || 1) - 1 } : null);
      } else {
        // Remove like if it exists
        if (isLiked) {
          batch.update(doc(db, 'videos', videoId), {
            likes: increment(-1)
          });
          batch.delete(likeRef);
          setIsLiked(false);
          setVideo(prev => prev ? { ...prev, likes: (prev.likes || 1) - 1 } : null);
        }

        batch.update(doc(db, 'videos', videoId), {
          dislikes: increment(1)
        });
        batch.set(dislikeRef, {
          userId: user.uid,
          videoId,
          createdAt: serverTimestamp()
        });
        await batch.commit();

        setIsDisliked(true);
        setVideo(prev => prev ? { ...prev, dislikes: (prev.dislikes || 0) + 1 } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `videos/${videoId}`);
    } finally {
      setDislikeLoading(false);
    }
  };

  const handleSaveToLater = async () => {
    if (!user || !video || !videoId) return;
    setSaveLoading(true);
    try {
      const watchLaterId = `${videoId}_${user.uid}`;
      const wlRef = doc(db, 'watchLater', watchLaterId);
      
      if (isSaved) {
        await deleteDoc(wlRef);
        setIsSaved(false);
      } else {
        await setDoc(wlRef, {
          videoId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        setIsSaved(true);
      }
      setShowMenu(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `watchLater/${videoId}_${user.uid}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/watch/${videoId}`;
    
    try {
      // Try Web Share API first
      if (navigator.share) {
        await navigator.share({
          title: video?.title,
          text: video?.description,
          url: url
        });
        return;
      }
    } catch (err) {
      console.warn('Navigator share failed, trying clipboard:', err);
    }

    // Fallback: Try Clipboard API
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareSuccess(true);
        return;
      }
    } catch (clipErr) {
      console.error('Clipboard write failed:', clipErr);
    }

    // Last Resort Fallback: Manual copy support
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setShareSuccess(true);
      } else {
        alert(`Failed to auto-copy. Please copy manually: ${url}`);
      }
    } catch (execErr) {
      console.error('execCommand copy failed:', execErr);
      alert(`Please copy this link: ${url}`);
    }
    document.body.removeChild(input);
  };

  if (loading) return <div className="p-8 font-mono animate-pulse text-purple-500">ESTABLISHING ORBITAL UPLINK...</div>;
  if (!video) return <div className="p-8">Lunar static. Video not found.</div>;

  return (
    <div className="mx-auto flex flex-col gap-6 lg:flex-row lg:px-4">
      <div className="flex-1">
        {/* Video Player */}
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black border border-neutral-800 shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          ></iframe>
        </div>

        {/* Video Info */}
        <div className="mt-6">
          <h1 className="text-xl font-black uppercase tracking-tighter md:text-3xl">{video.title}</h1>
          
          <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-neutral-800 bg-neutral-900 shadow-xl">
                {video.ownerPhoto ? (
                  <img src={video.ownerPhoto} alt={video.ownerName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-purple-500">M</div>
                )}
              </div>
              <div>
                <p className="font-black uppercase tracking-tight text-lg">{video.ownerName || 'Unknown Astronaut'}</p>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Moon Partner • Instant Access</p>
              </div>
              {user && video.ownerId !== user.uid && (
                <button 
                  onClick={handleSubscribe}
                  disabled={subLoading}
                  className={cn(
                    "ml-4 rounded-full px-8 py-3 text-sm font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-lg",
                    isSubscribed 
                      ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" 
                      : "bg-purple-600 text-white hover:bg-purple-700 mpp-glow"
                  )}
                >
                  {isSubscribed ? <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Locked</span> : 'Subscribe'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 relative">
              <AnimatePresence>
                {shareSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: -40, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-50"
                  >
                    Link Encrypted & Copied
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center overflow-hidden rounded-full border border-neutral-800 bg-neutral-900/50 shadow-xl">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLike}
                  disabled={likeLoading || !user}
                  className={cn(
                    "flex items-center gap-2 border-r border-neutral-800 px-6 py-2.5 transition-colors relative",
                    isLiked ? "text-purple-500 bg-purple-500/10" : "text-white/60 hover:text-white hover:bg-neutral-800"
                  )}
                >
                  <ThumbsUp className={cn("h-4 w-4 transition-transform", isLiked && "fill-current scale-110")} /> 
                  <span className="text-xs font-bold font-mono">{formatViews(video.likes || 0)}</span>
                  {isLiked && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                      className="absolute inset-0 bg-purple-500/20 rounded-full"
                    />
                  )}
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDislike}
                  disabled={dislikeLoading || !user}
                  className={cn(
                    "px-6 py-2.5 transition-colors relative",
                    isDisliked ? "text-red-500 bg-red-500/10" : "text-white/60 hover:text-white hover:bg-neutral-800"
                  )}
                >
                  <ThumbsDown className={cn("h-4 w-4 transition-transform", isDisliked && "fill-current scale-110")} />
                  {isDisliked && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                      className="absolute inset-0 bg-red-500/20 rounded-full"
                    />
                  )}
                </motion.button>
              </div>
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-6 py-2.5 hover:bg-neutral-800 transition-all text-white/60 hover:text-white shadow-xl"
              >
                <Share className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-widest">Relay</span>
              </button>
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition-all text-white/60 hover:text-white shadow-xl",
                    showMenu && "bg-neutral-800 text-white border-purple-500/50"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-56 overflow-hidden rounded-2xl border border-neutral-800 bg-[#0F0F0F] p-1 shadow-2xl z-50"
                    >
                      <button 
                        onClick={handleSaveToLater}
                        disabled={saveLoading || !user}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <Clock className={cn("h-4 w-4", isSaved ? "text-purple-500 fill-current" : "text-white/40")} />
                        {isSaved ? 'In Signal Cache' : 'Queue to Watch'}
                      </button>
                      <button className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-red-500/60 hover:text-red-500">
                        <Bookmark className="h-4 w-4" /> Report Signal
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 text-sm shadow-inner overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Moon className="h-24 w-24" />
            </div>
            <div className="flex items-center gap-4 font-black uppercase tracking-widest text-[10px] text-neutral-500 mb-4">
              <span className="text-purple-500 font-mono text-xs">{formatViews(video.views)} Views</span>
              <span>•</span>
              <span>Decoded Dec 2023</span>
            </div>
            <p className="whitespace-pre-wrap text-white/80 leading-relaxed font-medium tracking-tight">
              {video.description || "No signal metadata provided for this planetary transmission."}
            </p>
          </div>

          <div className="mt-8 flex justify-center">
             <AdUnit type="banner" />
          </div>

          <CommentSection videoId={videoId || ''} />
        </div>
        
        {/* Monetization Highlight */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-8 flex items-center justify-between rounded-3xl border border-purple-500/20 bg-purple-500/5 p-8 mpp-glow shadow-2xl relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 translate-y-[-50%] rounded-full bg-purple-600/10 blur-[100px]" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="bg-purple-600 p-4 rounded-2xl text-white font-black text-sm shadow-xl mpp-glow">MPP</div>
            <div>
              <p className="font-black text-purple-400 uppercase tracking-tighter text-xl">Moon Partner Program</p>
              <p className="text-xs text-purple-500/60 font-bold uppercase tracking-widest mt-1">Creator earns {formatCurrency(EARNINGS_PER_VIEW)} per unique view.</p>
            </div>
          </div>
          <Link to="/mpp" className="relative z-10 rounded-full bg-purple-600 px-8 py-3 text-xs font-black text-white hover:bg-purple-700 transition-all shadow-xl mpp-glow active:scale-95 uppercase tracking-widest">
            Partner Portal
          </Link>
        </motion.div>
      </div>

      <div className="flex w-full flex-col gap-6 lg:w-96">
        {/* Ad Placeholder */}
        <div className="flex h-64 items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/30 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent animate-pulse" />
          <p className="text-[10px] uppercase tracking-[0.6em] text-neutral-600 leading-relaxed font-black relative z-10">Marketing Satellite Uplink<br/>[Scanning for Signal]</p>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="h-1 w-4 bg-purple-500 rounded-full" />
           <h3 className="font-black text-neutral-500 uppercase tracking-[0.2em] text-[10px]">Next in Orbit</h3>
        </div>
        
        <div className="space-y-4">
          {relatedVideos.filter(v => v.id !== videoId).map(v => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
