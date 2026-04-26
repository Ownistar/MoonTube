import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Video } from '../types';
import VideoCard from '../components/video/VideoCard';
import { ThumbsUp } from 'lucide-react';
import { motion } from 'motion/react';

export default function LikedVideos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLiked = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const storedLikes = JSON.parse(localStorage.getItem(`likes_${user.uid}`) || '{}');
        const videoIds = Object.keys(storedLikes);
        
        const videoPromises = videoIds.map(async (videoId) => {
          const videoDoc = await getDoc(doc(db, 'videos', videoId));
          if (videoDoc.exists()) {
            return { id: videoDoc.id, ...videoDoc.data() } as Video;
          }
          return null;
        });

        const results = await Promise.all(videoPromises);
        setVideos(results.filter((v): v is Video => v !== null));
      } catch (err) {
        console.error('Error fetching liked videos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiked();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 mpp-glow">
            <ThumbsUp className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Liked Signals</h2>
            <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Endorsed planetary transmissions</p>
          </div>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Economical Storage Active</p>
          <p className="text-[9px] text-purple-300/40">Likes are tracked locally to save cloud space.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-xl bg-neutral-800" />
              <div className="mt-3 h-4 w-full rounded bg-neutral-800" />
              <div className="mt-2 h-3 w-2/3 rounded bg-neutral-800" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/50">
          <p className="text-neutral-500 font-bold uppercase tracking-widest">No liked signals yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <motion.div 
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <VideoCard video={video} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
