import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { History as HistoryIcon, Trash2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Video } from '../types';
import VideoCard from '../components/video/VideoCard';

export default function History() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const history = JSON.parse(localStorage.getItem(`history_${user.uid}`) || '[]');
        const videoPromises = history.map(async (item: { id: string }) => {
          const videoDoc = await getDoc(doc(db, 'videos', item.id));
          if (videoDoc.exists()) {
            return { id: videoDoc.id, ...videoDoc.data() } as Video;
          }
          return null;
        });
        
        const results = await Promise.all(videoPromises);
        setVideos(results.filter((v): v is Video => v !== null));
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const clearHistory = () => {
    if (!user) return;
    localStorage.setItem(`history_${user.uid}`, '[]');
    setVideos([]);
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-white/50 font-black uppercase tracking-widest text-xs">Initializing data stream...</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 mpp-glow">
            <HistoryIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Viewing History</h2>
            <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Recent planetary transmissions</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2 text-left hidden xs:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Economical Storage Active</p>
            <p className="text-[9px] text-purple-300/40">History is tracked locally.</p>
          </div>
          <button 
            onClick={clearHistory}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors hover:bg-red-500/20 hover:text-red-500 ml-auto sm:ml-0"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/2 backdrop-blur-xl">
          <HistoryIcon className="mb-4 h-12 w-12 text-white/10" />
          <p className="text-sm font-bold uppercase tracking-widest text-white/20 px-4 text-center">No recent activity discovered in your local memory</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id + Math.random()} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
