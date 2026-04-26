import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, MessageSquare, ThumbsUp, ThumbsDown, Maximize2, X, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import CommentSection from '../components/video/CommentSection';
import YouTube, { YouTubePlayer, YouTubeProps } from 'react-youtube';

export default function Shorts() {
  const { user } = useAuth();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [dislikeLoading, setDislikeLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewChecked, setViewChecked] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const currentShort = shorts[currentIndex];

  const { videoId } = useParams();

  useEffect(() => {
    const fetchShorts = async () => {
      try {
        let fetchedShorts: Video[] = [];
        
        // If a specific videoId is provided, fetch it first
        if (videoId) {
          const videoRef = doc(db, 'videos', videoId);
          const videoSnap = await getDoc(videoRef);
          if (videoSnap.exists()) {
            fetchedShorts.push({ id: videoSnap.id, ...videoSnap.data() } as Video);
          }
        }

        const q = query(
          collection(db, 'videos'),
          where('isShort', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const others = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Video))
          .filter(v => v.id !== videoId);
          
        setShorts([...fetchedShorts, ...others]);
      } catch (err) {
        console.error('Error fetching shorts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShorts();
  }, [videoId]);

  useEffect(() => {
    // Reset state for new video
    setViewChecked(false);
    setShowComments(false);
  }, [currentIndex]);

  useEffect(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    event.target.playVideo();
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    // 1: Playing, 2: Paused
    if (event.data === 1) {
      setIsPlaying(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    } else if (event.data === 0) { // Ended
      event.target.playVideo(); // Loop
    }
  };

  // Load interaction state from Firestore
  useEffect(() => {
    const fetchInteractions = async () => {
      const currentShort = shorts[currentIndex];
      if (!currentShort || !user) return;

      try {
        const likeId = `${currentShort.id}_${user.uid}`;
        const likeDoc = await getDoc(doc(db, 'userLikes', likeId));
        setIsLiked(likeDoc.exists());

        const dislikeId = `${currentShort.id}_${user.uid}`;
        const dislikeDoc = await getDoc(doc(db, 'userDislikes', dislikeId));
        setIsDisliked(dislikeDoc.exists());

        const subId = `${currentShort.ownerId}_${user.uid}`;
        const subSnap = await getDoc(doc(db, 'subscriptions', subId));
        setIsSubscribed(subSnap.exists());
      } catch (err) {
        console.error('Error fetching interactions:', err);
      }
    };

    fetchInteractions();
  }, [currentIndex, shorts, user]);

  // View counting logic
  useEffect(() => {
    const currentShort = shorts[currentIndex];
    if (!user || !currentShort || viewChecked || !isPlaying) return;

    const timer = setTimeout(async () => {
      try {
        const viewId = `${currentShort.id}_${user.uid}`;
        const viewRef = doc(db, 'videoViews', viewId);
        
        const viewSnap = await getDoc(viewRef);
        if (!viewSnap.exists()) {
          const batch = writeBatch(db);
          batch.set(viewRef, {
            userId: user.uid,
            videoId: currentShort.id,
            createdAt: serverTimestamp()
          });
          batch.update(doc(db, 'videos', currentShort.id), {
            views: increment(1)
          });
          await batch.commit();
        }
        setViewChecked(true);
      } catch (err) {
        console.error('Error recording view:', err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [user, currentIndex, shorts, viewChecked, isPlaying]);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !shorts[currentIndex]) return;
    setSubLoading(true);
    const creatorId = shorts[currentIndex].ownerId;
    const subId = `${creatorId}_${user.uid}`;

    try {
      if (isSubscribed) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'subscriptions', subId));
        batch.update(doc(db, 'users', creatorId), {
          subscriberCount: increment(-1)
        });
        await batch.commit();
        setIsSubscribed(false);
      } else {
        const batch = writeBatch(db);
        batch.set(doc(db, 'subscriptions', subId), {
          subscriberId: user.uid,
          creatorId,
          createdAt: serverTimestamp()
        });
        batch.update(doc(db, 'users', creatorId), {
          subscriberCount: increment(1)
        });
        await batch.commit();
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentShort = shorts[currentIndex];
    if (!user || !currentShort || likeLoading) return;

    setLikeLoading(true);
    const oldIsLiked = isLiked;
    const oldIsDisliked = isDisliked;
    
    // Update local video state for immediate UI feedback
    const newShorts = [...shorts];
    const video = { ...currentShort };
    
    try {
      const batch = writeBatch(db);
      const likeId = `${currentShort.id}_${user.uid}`;
      const likeRef = doc(db, 'userLikes', likeId);
      const dislikeId = `${currentShort.id}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (oldIsLiked) {
        // Unlike
        video.likes = Math.max(0, (video.likes || 0) - 1);
        batch.update(doc(db, 'videos', currentShort.id), {
          likes: increment(-1)
        });
        batch.delete(likeRef);
        setIsLiked(false);
      } else {
        // Like
        video.likes = (video.likes || 0) + 1;
        if (oldIsDisliked) {
          video.dislikes = Math.max(0, (video.dislikes || 0) - 1);
          batch.update(doc(db, 'videos', currentShort.id), {
            dislikes: increment(-1)
          });
          batch.delete(dislikeRef);
          setIsDisliked(false);
        }
        batch.update(doc(db, 'videos', currentShort.id), {
          likes: increment(1)
        });
        batch.set(likeRef, {
          userId: user.uid,
          videoId: currentShort.id,
          createdAt: serverTimestamp()
        });
        setIsLiked(true);
      }
      
      newShorts[currentIndex] = video;
      setShorts(newShorts);
      await batch.commit();
    } catch (err) {
      console.error(err);
      // Rollback on error
      setIsLiked(oldIsLiked);
      setIsDisliked(oldIsDisliked);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDislike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentShort = shorts[currentIndex];
    if (!user || !currentShort || dislikeLoading) return;

    setDislikeLoading(true);
    const oldIsLiked = isLiked;
    const oldIsDisliked = isDisliked;
    
    // Update local video state
    const newShorts = [...shorts];
    const video = { ...currentShort };

    try {
      const batch = writeBatch(db);
      const likeId = `${currentShort.id}_${user.uid}`;
      const dislikeId = `${currentShort.id}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (oldIsDisliked) {
        // Remove dislike
        video.dislikes = Math.max(0, (video.dislikes || 0) - 1);
        batch.update(doc(db, 'videos', currentShort.id), {
          dislikes: increment(-1)
        });
        batch.delete(dislikeRef);
        setIsDisliked(false);
      } else {
        // Dislike
        video.dislikes = (video.dislikes || 0) + 1;
        if (oldIsLiked) {
          video.likes = Math.max(0, (video.likes || 0) - 1);
          batch.update(doc(db, 'videos', currentShort.id), {
            likes: increment(-1)
          });
          batch.delete(doc(db, 'userLikes', likeId));
          setIsLiked(false);
        }
        batch.update(doc(db, 'videos', currentShort.id), {
          dislikes: increment(1)
        });
        batch.set(dislikeRef, {
          userId: user.uid,
          videoId: currentShort.id,
          createdAt: serverTimestamp()
        });
        setIsDisliked(true);
      }
      
      newShorts[currentIndex] = video;
      setShorts(newShorts);
      await batch.commit();
    } catch (err) {
      console.error(err);
      setIsLiked(oldIsLiked);
      setIsDisliked(oldIsDisliked);
    } finally {
      setDislikeLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') handlePrev();
      if (e.key === 'ArrowDown') handleNext();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shorts.length, isPlaying]);

  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowComments(false);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowComments(false);
      setIsPlaying(true);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-purple-500 font-mono animate-pulse">ESTABLISHING SHORT-WAVE UPLINK...</div>;
  
  if (shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="p-6 bg-purple-500/10 rounded-full text-purple-500 mpp-glow">
          <Maximize2 className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-white">No Shorts in Orbit</h2>
          <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest mt-2">Upload a vertical video using a /shorts/ YouTube link</p>
        </div>
      </div>
    );
  }

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      loop: 1,
      playlist: currentShort?.youtubeId,
      iv_load_policy: 3,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin,
      playsinline: 1,
    },
  };

  return (
    <div className="relative h-[calc(100vh-80px)] w-full flex items-center justify-center overflow-hidden bg-black -m-4 md:-m-6 lg:-m-8">
      <AnimatePresence mode="wait">
        <motion.div
           key={currentShort.id}
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 1.02 }}
           transition={{ duration: 0.2 }}
           className="relative aspect-[9/16] h-full max-h-[850px] w-auto bg-[#050505] md:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10"
        >
          {/* Main Video Area */}
          <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
            <YouTube
              videoId={currentShort.youtubeId}
              opts={opts}
              onReady={onPlayerReady}
              onStateChange={onStateChange}
              className="w-full h-full"
              style={{ transform: 'scale(1.15)' }}
              containerClassName="w-full h-full"
            />
          </div>

          {/* Metadata Overlay - Bottom */}
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none z-30">
            <h3 className="text-sm md:text-base font-bold text-white mb-2 line-clamp-2 pr-12 drop-shadow-lg">{currentShort.title}</h3>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 border border-white/20 rounded-full bg-neutral-900 overflow-hidden shadow-lg">
                 {currentShort.ownerPhoto ? (
                   <img src={currentShort.ownerPhoto} className="h-full w-full object-cover" />
                 ) : (
                   <div className="h-full w-full flex items-center justify-center text-xs font-bold text-neutral-500 uppercase">M</div>
                 )}
              </div>
              <Link to={`/channel/${currentShort.ownerId}`} className="text-xs font-bold text-white tracking-wide hover:text-purple-400 transition-colors pointer-events-auto drop-shadow-md">
                @{currentShort.ownerName || 'Explorer'}
              </Link>
              
              {user?.uid !== currentShort.ownerId && (
                <button 
                  disabled={subLoading}
                  className={cn(
                    "ml-2 text-[10px] font-black uppercase px-4 py-2 rounded-full hover:scale-105 active:scale-95 pointer-events-auto transition-all",
                    isSubscribed 
                      ? "bg-white/10 text-white/50 border border-white/10" 
                      : "bg-purple-600 text-white shadow-lg"
                  )}
                  onClick={handleSubscribe}
                >
                  {subLoading ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>
          </div>

          {/* Side Actions - Ensure pointer-events-auto */}
          <div className="absolute right-2 md:right-4 bottom-24 flex flex-col items-center gap-5 z-40 pointer-events-auto">
            <div className="flex flex-col items-center gap-1">
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={handleLike}
                disabled={likeLoading}
                className={cn(
                  "p-3 rounded-full transition-all shadow-2xl backdrop-blur-md",
                  isLiked 
                    ? "bg-purple-600 scale-110 shadow-purple-500/50" 
                    : "bg-neutral-900/60 border border-white/10 hover:bg-neutral-800"
                )}
              >
                <ThumbsUp 
                  className={cn(
                    "h-5 w-5 transition-transform", 
                    isLiked ? "text-white fill-current scale-110" : "text-white/80"
                  )} 
                />
              </motion.button>
              <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">{currentShort.likes || 0}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={handleDislike}
                disabled={dislikeLoading}
                className={cn(
                  "p-3 rounded-full transition-all shadow-2xl backdrop-blur-md",
                  isDisliked 
                    ? "bg-red-600 scale-110 shadow-red-500/50" 
                    : "bg-neutral-900/60 border border-white/10 hover:bg-neutral-800"
                )}
              >
                <ThumbsDown 
                  className={cn(
                    "h-5 w-5 transition-transform", 
                    isDisliked ? "text-white fill-current scale-110" : "text-white/80"
                  )} 
                />
              </motion.button>
              <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">Skip</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
                className={cn(
                  "p-3 rounded-full transition-all shadow-2xl backdrop-blur-md",
                  showComments 
                    ? "bg-purple-600 border-purple-500/50"
                    : "bg-neutral-900/60 border border-white/10 hover:bg-neutral-800"
                )}
              >
                <MessageSquare className="h-5 w-5 text-white/80" />
              </motion.button>
              <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">Chat</span>
            </div>
          </div>

          {/* Comments Modal */}
          <AnimatePresence>
            {showComments && (
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute inset-x-0 bottom-0 top-1/3 z-50 bg-[#0F0F0F] rounded-t-3xl border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
                  <h3 className="font-black uppercase tracking-widest text-sm">Transmissions</h3>
                  <button 
                    onClick={() => setShowComments(false)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <CommentSection videoId={currentShort.id} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      <div className="hidden lg:flex fixed right-10 top-1/2 -translate-y-1/2 flex-col gap-6 z-50">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-4 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-full hover:bg-purple-600 disabled:opacity-20 transition-all mpp-glow text-white shadow-2xl group"
        >
          <ChevronUp className="h-6 w-6 group-hover:scale-125 transition-transform" />
        </button>
        <button 
          onClick={handleNext}
          disabled={currentIndex === shorts.length - 1}
          className="p-4 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-full hover:bg-purple-600 disabled:opacity-20 transition-all mpp-glow text-white shadow-2xl group"
        >
          <ChevronDown className="h-6 w-6 group-hover:scale-125 transition-transform" />
        </button>
      </div>
    </div>
  );
}
