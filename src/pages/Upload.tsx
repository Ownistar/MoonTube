import { useState } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getYoutubeId, isShortUrl } from '../lib/utils';
import { CATEGORIES } from '../types';
import { Upload as UploadIcon, Link as LinkIcon, Check, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]); // Default to first actual category
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const youtubeId = getYoutubeId(youtubeUrl);
    const isShort = isShortUrl(youtubeUrl);
    
    if (!youtubeId) {
      setError('Invalid YouTube URL');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    try {
      if (!user) return;

      const videoData = {
        ownerId: user.uid,
        ownerName: user.displayName,
        ownerPhoto: user.photoURL,
        title,
        description,
        category,
        youtubeUrl,
        youtubeId,
        isShort,
        views: 0,
        createdAt: new Date().toISOString(),
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
      };

      await addDoc(collection(db, 'videos'), videoData);
      navigate('/');
    } catch (err) {
      console.error('Error uploading video:', err);
      setError('Failed to transmit data to lunar station.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 mpp-glow">
          <UploadIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Lunar Uplink</h2>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Launch your content into the lunar orbit</p>
        </div>
      </div>

      <motion.form 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit} 
        className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-10"
      >
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/40">
            YouTube URL
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 py-4 pl-12 pr-4 text-sm focus:border-white/20 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/40">
            Video Title
          </label>
          <input
            type="text"
            placeholder="A name for your moonbeam"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm focus:border-white/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/40">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm focus:border-white/20 focus:outline-none appearance-none cursor-pointer"
          >
            {CATEGORIES.slice(1).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/40">
            Description
          </label>
          <textarea
            placeholder="Tell your viewers more about this orbit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm focus:border-white/20 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 py-4 font-bold text-white transition-all hover:bg-purple-700 disabled:opacity-50 mpp-glow shadow-lg shadow-purple-500/20 active:scale-95"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          Initiate Lunar Transmission
        </button>
      </motion.form>
    </div>
  );
}
