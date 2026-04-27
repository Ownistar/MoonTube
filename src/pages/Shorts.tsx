import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, MessageSquare, ThumbsUp, ThumbsDown, Maximize2, X, Play, Pause, Volume2, VolumeX, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import CommentSection from '../components/video/CommentSection';
import YouTube, { YouTubePlayer, YouTubeProps } from 'react-youtube';
import AdBanner from '../components/ads/AdBanner';

interface ShortPlayerProps {
  videoId: string;
  opts: any;
  isActive: boolean;
  isMuted: boolean;
  onStateChange: (event: any) => void;
  onActivePlayerReady: (player: YouTubePlayer) => void;
}

const ShortPlayer = ({ videoId, opts, isActive, isMuted, onStateChange, onActivePlayerReady }: ShortPlayerProps) => {
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (playerRef.current) {
      if (isActive) {
        playerRef.current.playVideo();
        onActivePlayerReady(playerRef.current);
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isActive, onActivePlayerReady]);

  useEffect(() => {
    if (playerRef.current) {
      if (isMuted) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  }, [isMuted]);

  const onReady = (event: any) => {
    playerRef.current = event.target;
    if (isMuted) event.target.mute();
    else event.target.unMute();
    
    if (isActive) {
      event.target.playVideo();
      onActivePlayerReady(event.target);
    } else {
      event.target.pauseVideo();
    }
  };

  return (
    <YouTube
      videoId={videoId}
      opts={opts}
      onReady={onReady}
      onStateChange={(e) => {
        if (isActive) onStateChange(e);
      }}
      className="w-full h-full"
      style={{ transform: 'scale(1.15)' }}
      containerClassName="w-full h-full"
    />
  );
};

export default function Shorts() {
  const { user } = useAuth();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [likeLoading, setLikeLoading] = useState(false);
  const [dislikeLoading, setDislikeLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewChecked, setViewChecked] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleActivePlayerReady = useCallback((player: YouTubePlayer) => {
    playerRef.current = player;
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    
    try {
      const state = playerRef.current.getPlayerState();
      if (state === 1) { // Playing
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Player toggle error:", err);
    }
  }, []);

  // Construct display items: inject an ad after every 4 shorts
  const displayItems = React.useMemo(() => {
    const items: (Video | { type: 'ad'; id: string })[] = [];
    shorts.forEach((short, idx) => {
      items.push(short);
      if ((idx + 1) % 4 === 0) {
        items.push({ type: 'ad', id: `ad-${idx}` });
      }
    });
    return items;
  }, [shorts]);

  const currentItem = displayItems[currentIndex];
  const isAdCurrent = currentItem && 'type' in currentItem && currentItem.type === 'ad';

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

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (event.data === 1) setIsPlaying(true);
    else if (event.data === 2) setIsPlaying(false);
    else if (event.data === 0) event.target.playVideo(); // Loop
  };

  const handleNativeScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    if (height === 0) return;
    const newIndex = Math.round(scrollTop / height);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < displayItems.length) {
      setCurrentIndex(newIndex);
    }
  };

  // Load interaction state from Firestore
  useEffect(() => {
    const fetchInteractions = async () => {
      const activeItem = displayItems[currentIndex];
      if (!activeItem || 'type' in activeItem || !user) return;

      try {
        const likeId = `${activeItem.id}_${user.uid}`;
        const likeDoc = await getDoc(doc(db, 'userLikes', likeId));
        setIsLiked(likeDoc.exists());

        const dislikeId = `${activeItem.id}_${user.uid}`;
        const dislikeDoc = await getDoc(doc(db, 'userDislikes', dislikeId));
        setIsDisliked(dislikeDoc.exists());

        const subId = `${activeItem.ownerId}_${user.uid}`;
        const subSnap = await getDoc(doc(db, 'subscriptions', subId));
        setIsSubscribed(subSnap.exists());
      } catch (err) {
        console.error('Error fetching interactions:', err);
      }
    };

    fetchInteractions();
  }, [currentIndex, displayItems, user]);

  // View counting logic
  useEffect(() => {
    const currentItem = displayItems[currentIndex];
    if (!user || !currentItem || 'type' in currentItem || viewChecked || !isPlaying) return;

    const timer = setTimeout(async () => {
      try {
        const videoId = currentItem.id;
        const viewId = `${videoId}_${user.uid}`;
        const viewRef = doc(db, 'videoViews', viewId);
        
        const viewSnap = await getDoc(viewRef);
        if (!viewSnap.exists()) {
          const batch = writeBatch(db);
          batch.set(viewRef, {
            userId: user.uid,
            videoId: videoId,
            createdAt: serverTimestamp()
          });
          batch.update(doc(db, 'videos', videoId), {
            views: increment(1)
          });
          
          batch.update(doc(db, 'users', currentItem.ownerId), {
            totalViews: increment(1)
          });

          await batch.commit();
        }
        setViewChecked(true);
      } catch (err) {
        console.error('Error recording view:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, currentIndex, displayItems, viewChecked, isPlaying]);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const item = displayItems[currentIndex];
    if (!user || !item || 'type' in item) return;
    setSubLoading(true);
    const creatorId = item.ownerId;
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
    const item = displayItems[currentIndex];
    if (!user || !item || 'type' in item || likeLoading) return;

    setLikeLoading(true);
    const oldIsLiked = isLiked;
    const oldIsDisliked = isDisliked;
    
    // Find index in original shorts array for local update
    const shortsIdx = shorts.findIndex(s => s.id === item.id);
    if (shortsIdx === -1) return;

    const newShorts = [...shorts];
    const video = { ...item };
    
    try {
      const batch = writeBatch(db);
      const videoId = item.id;
      const likeId = `${videoId}_${user.uid}`;
      const likeRef = doc(db, 'userLikes', likeId);
      const dislikeId = `${videoId}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (oldIsLiked) {
        // Unlike
        video.likes = Math.max(0, (video.likes || 0) - 1);
        batch.update(doc(db, 'videos', videoId), {
          likes: increment(-1)
        });
        batch.delete(likeRef);
        setIsLiked(false);
      } else {
        // Like
        video.likes = (video.likes || 0) + 1;
        if (oldIsDisliked) {
          video.dislikes = Math.max(0, (video.dislikes || 0) - 1);
          batch.update(doc(db, 'videos', videoId), {
            dislikes: increment(-1)
          });
          batch.delete(dislikeRef);
          setIsDisliked(false);
        }
        batch.update(doc(db, 'videos', videoId), {
          likes: increment(1)
        });
        batch.set(likeRef, {
          userId: user.uid,
          videoId: videoId,
          createdAt: serverTimestamp()
        });
        setIsLiked(true);
      }
      
      newShorts[shortsIdx] = video;
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
    const item = displayItems[currentIndex];
    if (!user || !item || 'type' in item || dislikeLoading) return;

    setDislikeLoading(true);
    const oldIsLiked = isLiked;
    const oldIsDisliked = isDisliked;
    
    // Find index in original shorts array for local update
    const shortsIdx = shorts.findIndex(s => s.id === item.id);
    if (shortsIdx === -1) return;

    const newShorts = [...shorts];
    const video = { ...item };

    try {
      const batch = writeBatch(db);
      const videoId = item.id;
      const likeId = `${videoId}_${user.uid}`;
      const dislikeId = `${videoId}_${user.uid}`;
      const dislikeRef = doc(db, 'userDislikes', dislikeId);

      if (oldIsDisliked) {
        // Remove dislike
        video.dislikes = Math.max(0, (video.dislikes || 0) - 1);
        batch.update(doc(db, 'videos', videoId), {
          dislikes: increment(-1)
        });
        batch.delete(dislikeRef);
        setIsDisliked(false);
      } else {
        // Dislike
        video.dislikes = (video.dislikes || 0) + 1;
        if (oldIsLiked) {
          video.likes = Math.max(0, (video.likes || 0) - 1);
          batch.update(doc(db, 'videos', videoId), {
            likes: increment(-1)
          });
          batch.delete(doc(db, 'userLikes', likeId));
          setIsLiked(false);
        }
        batch.update(doc(db, 'videos', videoId), {
          dislikes: increment(1)
        });
        batch.set(dislikeRef, {
          userId: user.uid,
          videoId: videoId,
          createdAt: serverTimestamp()
        });
        setIsDisliked(true);
      }
      
      newShorts[shortsIdx] = video;
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

  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const children = containerRef.current.children;
    if (index >= 0 && index < children.length) {
      children[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < displayItems.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  }, [currentIndex, displayItems.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  }, [currentIndex, scrollToIndex]);

  const toggleMute = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (playerRef.current) {
      if (newMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        // Use a slight timeout to ensure unMute has registered before calling play
        setTimeout(() => {
          playerRef.current?.playVideo();
        }, 50);
      }
    }
  }, [isMuted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, toggleMute, togglePlayPause]);

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
      controls: 1,
      modestbranding: 1,
      loop: 1,
      iv_load_policy: 3,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin,
      playsinline: 1,
      mute: 1,
    },
  };

  return (
    <>
      {/* Desktop Sidebar Ad - Next to Left Sidebar - Move outside scroll container */}
      <div className="hidden xl:flex fixed left-64 top-1/2 -translate-y-1/2 z-40 flex-col items-center pointer-events-none">
        <div className="bg-neutral-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] pointer-events-auto">
           <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-8 [writing-mode:vertical-lr] rotate-180">Transmission Sponsor</p>
           <div className="relative w-[60px] h-[468px] flex items-center justify-center">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center w-[468px] h-[60px]">
                <AdBanner />
             </div>
           </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        onScroll={handleNativeScroll}
        className="h-[calc(100dvh-80px)] w-full overflow-y-scroll snap-y snap-mandatory bg-black -m-4 md:-m-6 lg:-m-8 scrollbar-none"
      >
        {displayItems.map((item, index) => {
        const isActive = index === currentIndex;
        const isAd = 'type' in item && item.type === 'ad';

        return (
          <div 
            key={item.id}
            className="relative h-full w-full snap-start flex items-center justify-center shrink-0"
          >
            <div className="relative aspect-[9/16] h-full max-h-[850px] w-auto bg-[#050505] md:rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10">
                {isAd ? (
                  <div className="absolute inset-0 z-0 bg-neutral-950 flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-black to-black">
                    <div className="mb-6 p-4 bg-purple-500/10 rounded-full border border-purple-500/20 animate-pulse">
                      <Zap className="h-8 w-8 text-purple-500" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2 italic">Sponsored Feed</h2>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-10 max-w-[200px] leading-relaxed">High-frequency signal from our lunar partners</p>
                    
                    <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 w-full max-w-[95%] flex flex-col items-center shadow-inner">
                      <div className="scale-[0.5] sm:scale-75 md:scale-100 origin-center">
                        <AdBanner />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Main Video Area */}
                    <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
                      {Math.abs(index - currentIndex) <= 1 && (
                        <ShortPlayer
                          videoId={(item as Video).youtubeId}
                          opts={opts}
                          isActive={isActive}
                          isMuted={isMuted}
                          onStateChange={onStateChange}
                          onActivePlayerReady={handleActivePlayerReady}
                        />
                      )}
                    </div>

                    {/* Metadata Overlay - Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none z-30">
                      <h3 className="text-sm md:text-base font-bold text-white mb-2 line-clamp-2 pr-12 drop-shadow-lg">{(item as Video).title}</h3>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 border border-white/20 rounded-full bg-neutral-900 overflow-hidden shadow-lg">
                           {(item as Video).ownerPhoto ? (
                             <img src={(item as Video).ownerPhoto} className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full flex items-center justify-center text-xs font-bold text-neutral-500 uppercase">M</div>
                           )}
                        </div>
                        <Link 
                          to={`/channel/${(item as Video).ownerId}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold text-white tracking-wide hover:text-purple-400 transition-colors pointer-events-auto drop-shadow-md"
                        >
                          @{(item as Video).ownerName || 'Explorer'}
                        </Link>
                        
                        {user?.uid !== (item as Video).ownerId && isActive && (
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

                    {/* Side Actions */}
                    {isActive && (
                      <div className="absolute right-2 md:right-4 bottom-24 flex flex-col items-center gap-5 z-40 pointer-events-auto">
                        <div className="flex flex-col items-center gap-1">
                          <motion.button 
                            whileTap={{ scale: 0.8 }}
                            onClick={togglePlayPause}
                            className="p-3 rounded-full transition-all shadow-2xl backdrop-blur-md bg-neutral-900/60 border border-white/10 hover:bg-neutral-800"
                          >
                            {isPlaying ? (
                              <Pause className="h-5 w-5 text-white/80" />
                            ) : (
                              <Play className="h-5 w-5 text-white/80 fill-current" />
                            )}
                          </motion.button>
                          <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">
                            {isPlaying ? 'Pause' : 'Play'}
                          </span>
                        </div>

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
                          <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">{(item as Video).likes || 0}</span>
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
                          <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">Dislike</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                          <motion.button 
                            whileTap={{ scale: 0.8 }}
                            onClick={toggleMute}
                            className="p-3 rounded-full transition-all shadow-2xl backdrop-blur-md bg-neutral-900/60 border border-white/10 hover:bg-neutral-800"
                          >
                            {isMuted ? (
                              <VolumeX className="h-5 w-5 text-white/80" />
                            ) : (
                              <Volume2 className="h-5 w-5 text-white/80" />
                            )}
                          </motion.button>
                          <span className="text-[10px] font-black text-white uppercase drop-shadow-lg tracking-tighter">
                            {isMuted ? 'Muted' : 'Volume'}
                          </span>
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
                    )}

                    {/* Comments Modal */}
                    <AnimatePresence>
                      {showComments && isActive && (
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
                            <CommentSection videoId={item.id} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
            </div>
          </div>
        );
      })}

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
          disabled={currentIndex === displayItems.length - 1}
          className="p-4 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-full hover:bg-purple-600 disabled:opacity-20 transition-all mpp-glow text-white shadow-2xl group"
        >
          <ChevronDown className="h-6 w-6 group-hover:scale-125 transition-transform" />
        </button>
      </div>
    </div>
    </>
  );
}
