import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Video, CATEGORIES } from '../types';
import VideoCard from '../components/video/VideoCard';
import { Play, Search } from 'lucide-react';
import AdUnit from '../components/ads/AdUnit';
import { cn } from '../lib/utils';

import { useSearchParams, useNavigate } from 'react-router-dom';
import NativeAd from '../components/ads/NativeAd';

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('search');

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        let q;
        if (searchQuery) {
          // If searching, we fetch latest videos and filter client-side for better matching
          q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(100));
          setActiveCategory('All'); // Reset category view when searching
        } else if (activeCategory === 'All') {
          q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(40));
        } else {
          q = query(collection(db, 'videos'), where('category', '==', activeCategory), limit(40));
        }
        
        const snapshot = await getDocs(q);
        let videoData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as object)
        })) as Video[];

        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          videoData = videoData.filter(v => 
            v.title.toLowerCase().includes(lowerQuery) || 
            v.description?.toLowerCase().includes(lowerQuery) ||
            v.category.toLowerCase().includes(lowerQuery)
          );
        }

        setVideos(videoData);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [activeCategory, searchQuery]);

  return (
    <div className="max-w-[2000px] mx-auto">
      {/* Category Selection */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              if (searchQuery) {
                navigate('/');
              }
            }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
              activeCategory === cat && !searchQuery
                ? "bg-purple-600 text-white mpp-glow" 
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white shadow-xl shadow-black/20"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
          {searchQuery ? <Search className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">
            {searchQuery ? `Signal Match: ${searchQuery}` : (activeCategory === 'All' ? 'Celestial Feed' : activeCategory)}
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
            {searchQuery ? `Scanning lunar database for "${searchQuery}"` : 'Trending across the lunar surface'}
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-xl bg-neutral-800" />
              <div className="mt-3 flex gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full rounded bg-neutral-800" />
                  <div className="h-3 w-2/3 rounded bg-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/50">
          <p className="text-neutral-500 font-medium">No content in this orbit yet.</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 mb-12">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
          <NativeAd />
        </div>
      )}

      {/* Ad Unit */}
      <div className="mt-12 flex justify-center">
        <AdUnit type="banner" />
      </div>
    </div>
  );
}
