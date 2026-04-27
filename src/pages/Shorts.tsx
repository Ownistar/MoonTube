import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ThumbsUp, ThumbsDown, Volume2, VolumeX, Share2, MoreVertical, Loader2, Play, User, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import YouTube, { YouTubePlayer } from 'react-youtube';
import CommentSection from '../components/video/CommentSection';

// --- CONFIG ---
const BUFFER_SIZE = 3; // Keep max 3 iframes in DOM

interface ReelPlayerProps {
  videoId: string;
  isActive: boolean;
  isAudioUnlocked: boolean;
  onReady: (player: YouTubePlayer) => void;
}

const ReelPlayer = React.memo(({ videoId, isActive, isAudioUnlocked, onReady }: ReelPlayerProps) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  const opts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      loop: 1,
      playsinline: 1,
      enablejsapi: 1,
      origin: window.location.origin,
      widget_referrer: window.location.href,
    },
  }), [videoId]); // Add videoId to dependencies to force fresh options on change

  // Command wrapper to safely execute player commands
  const safeExec = useCallback((cmd: (p: YouTubePlayer) => void) => {
    if (!playerRef.current) return;
    try {
      cmd(playerRef.current);
    } catch (e) {
      console.warn("YouTube Command failed (Handled):", e);
    }
  }, []);

  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (player) {
        safeExec((p) => {
          p.stopVideo?.();
          p.destroy?.();
        });
        playerRef.current = null;
      }
    };
  }, [safeExec]);

  useEffect(() => {
    if (isReady) {
      safeExec((p) => {
        if (isActive) {
          if (isAudioUnlocked) p.unMute?.();
          else p.mute?.();
          p.playVideo?.();
        } else {
          p.pauseVideo?.();
        }
      });
    }
  }, [isActive, isAudioUnlocked, isReady, safeExec]);

  // Fallback: If it takes too long to ready up, increment errorCount to trigger a re-mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady && isActive) {
        setErrorCount(prev => prev + 1);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isReady, isActive]);

  return (
    <div key={`${videoId}_${errorCount}`} className="w-full h-full bg-black flex items-center justify-center">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={(e) => {
          playerRef.current = e.target;
          setIsReady(true);
          onReady(e.target);
        }}
        onError={() => {
          console.error("YouTube Player Error - Attempting Recovery");
          setTimeout(() => setErrorCount(prev => prev + 1), 1000);
        }}
        className="w-full h-full"
        containerClassName="w-full h-full"
      />
    </div>
  );
});

interface ShortCardProps {
  video: Video;
  index: number;
  currentIndex: number;
  isAudioUnlocked: boolean;
  onLike: (v: Video) => void;
  onComments: () => void;
  isLiked: boolean;
}

const ShortCard = React.memo(({ video, index, currentIndex, isAudioUnlocked, onLike, onComments, isLiked }: ShortCardProps) => {
  const isActive = index === currentIndex;
  const isBuffered = Math.abs(index - currentIndex) <= Math.floor(BUFFER_SIZE / 2);
  const activePlayer = useRef<YouTubePlayer | null>(null);

  return (
    <div className="h-full w-full snap-start shrink-0 flex items-center justify-center relative">
      <div className="relative h-full aspect-[9/16] bg-zinc-900 overflow-hidden md:rounded-2xl shadow-2xl">
        {isBuffered ? (
          <ReelPlayer 
            videoId={video.youtubeId}
            isActive={isActive}
            isAudioUnlocked={isAudioUnlocked}
            onReady={(p) => { activePlayer.current = p; }}
          />
        ) : (
          <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg)` }} />
        )}

        {/* OVERLAYS */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 via-transparent to-transparent">
          <div className="pointer-events-auto max-w-[80%] mb-12">
            <p className="text-sm font-bold text-white drop-shadow-lg mb-2">{video.ownerName}</p>
            <p className="text-xs text-white/90 drop-shadow-md line-clamp-2">{video.title}</p>
          </div>

          <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 pointer-events-auto">
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onLike(video); }}
                className={cn(
                  "p-3 rounded-full backdrop-blur-xl border border-white/10 transition-all active:scale-125",
                  isLiked ? "bg-white text-black" : "bg-white/10 text-white"
                )}
              >
                <ThumbsUp className={cn("h-6 w-6", isLiked && "fill-black")} />
              </button>
              <span className="text-[10px] font-bold text-white">{video.likes || 0}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onComments(); }}
                className="p-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 text-white"
              >
                <MessageSquare className="h-6 w-6" />
              </button>
              <span className="text-[10px] font-bold text-white">{video.commentCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Shorts() {
  const { user } = useAuth();
  const { videoId: routeVideoId } = useParams();
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [interactions, setInteractions] = useState<Record<string, { liked: boolean }>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  // Suppress specific WebSocket/HMR errors that are benign in this environment
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message?.includes('WebSocket') || e.message?.includes('HMR')) {
        e.preventDefault();
        return false;
      }
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (e.reason?.message?.includes('WebSocket')) {
        e.preventDefault();
      }
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Global Session Unlock for Sound
  useEffect(() => {
    const handleGlobalClick = () => {
      if (!isAudioUnlocked) setIsAudioUnlocked(true);
    };
    window.addEventListener('click', handleGlobalClick, { once: true });
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isAudioUnlocked]);

  const scrollToVideo = useCallback((index: number) => {
    if (!containerRef.current || index < 0 || index >= videos.length) return;
    const clientHeight = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * clientHeight,
      behavior: 'smooth'
    });
  }, [videos.length]);

  useEffect(() => {
    const fetchShorts = async () => {
      try {
        const q = query(
          collection(db, 'videos'),
          where('isShort', '==', true),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
        const snap = await getDocs(q);
        let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Video));

        if (routeVideoId) {
          const idx = list.findIndex(v => v.id === routeVideoId);
          if (idx !== -1) {
            const [v] = list.splice(idx, 1);
            list = [v, ...list];
          }
        }
        setVideos(list);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchShorts();
  }, [routeVideoId]);

  // Intersection Observer to detect active video
  useEffect(() => {
    if (!containerRef.current || videos.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          setCurrentIndex(index);
          setShowComments(false);
        }
      });
    }, {
      root: containerRef.current,
      threshold: 0.7, // Must be 70% visible to trigger
    });

    const children = containerRef.current.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName === 'DIV' && children[i].hasAttribute('data-index')) {
        observer.observe(children[i]);
      }
    }

    return () => observer.disconnect();
  }, [videos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToVideo(currentIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToVideo(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scrollToVideo]);

  const toggleLike = async (v: Video) => {
    if (!user) return;
    const isLiked = interactions[v.id]?.liked || false;
    setInteractions(prev => ({ ...prev, [v.id]: { liked: !isLiked } }));
    try {
      const batch = writeBatch(db);
      const lRef = doc(db, 'userLikes', `${v.id}_${user.uid}`);
      if (isLiked) {
        batch.delete(lRef);
        batch.update(doc(db, 'videos', v.id), { likes: increment(-1) });
      } else {
        batch.set(lRef, { userId: user.uid, videoId: v.id, createdAt: serverTimestamp() });
        batch.update(doc(db, 'videos', v.id), { likes: increment(1) });
      }
      await batch.commit();
    } catch (e) {}
  };

  if (loading) return (
    <div className="h-screen w-full bg-black flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-white/10 animate-spin" />
    </div>
  );

  return (
    <div className="relative h-[calc(100vh-80px)] w-full bg-black overflow-hidden select-none">
      {/* Desktop Navigation Arrows */}
      <div className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col gap-4 z-50">
        <button 
          onClick={() => scrollToVideo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="p-3 bg-white/10 backdrop-blur-3xl rounded-full border border-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <button 
          onClick={() => scrollToVideo(currentIndex + 1)}
          disabled={currentIndex === videos.length - 1}
          className="p-3 bg-white/10 backdrop-blur-3xl rounded-full border border-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>

      {/* Global Mute Control button in bottom corner for easy access */}
      <button 
        onClick={() => setIsAudioUnlocked(!isAudioUnlocked)}
        className="absolute left-6 bottom-6 z-50 p-4 bg-white/10 backdrop-blur-3xl rounded-full border border-white/10 text-white hover:bg-white/20 transition-all shadow-2xl"
      >
        {isAudioUnlocked ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6 text-red-500 animate-pulse" />}
      </button>

      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
      >
        {videos.map((v, i) => (
          <div key={v.id} data-index={i} className="h-full w-full snap-start shrink-0">
            <ShortCard 
              video={v}
              index={i}
              currentIndex={currentIndex}
              isAudioUnlocked={isAudioUnlocked}
              onLike={toggleLike}
              onComments={() => setShowComments(true)}
              isLiked={interactions[v.id]?.liked || false}
            />
          </div>
        ))}
      </div>

      {/* COMMENTS DRAWER - Moved outside to prevent re-renders inside cards */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-50 h-[70dvh] bg-zinc-950 border-t border-white/10 rounded-t-3xl flex flex-col overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <span className="text-xs font-bold text-white uppercase tracking-widest">Comments</span>
              <button onClick={() => setShowComments(false)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {videos[currentIndex] && <CommentSection videoId={videos[currentIndex].id} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

