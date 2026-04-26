import React from 'react';
import { Link } from 'react-router-dom';
import { Video } from '../../types';
import { formatViews } from '../../lib/utils';
import { motion } from 'motion/react';
import { Zap } from 'lucide-react';

interface ShortsShelfProps {
  shorts: Video[];
}

const ShortsShelf: React.FC<ShortsShelfProps> = ({ shorts }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Zap className="h-5 w-5 text-purple-500 fill-current" />
        <h2 className="text-lg font-black uppercase tracking-tight">Lunar Shorts</h2>
        <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded ml-2 animate-pulse uppercase">Alpha</span>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1">
        {shorts.map((short, index) => (
          <motion.div
            key={short.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex-none w-[180px] group"
          >
            <Link to="/shorts" className="block">
              <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 transition-all group-hover:border-purple-500/50 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                <img
                  src={short.thumbnail}
                  alt={short.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                
                {/* Meta Info */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                    {short.title}
                  </h3>
                  <p className="text-[10px] text-white/60 font-black uppercase tracking-wider mt-1">
                    {formatViews(short.views || 0)} views
                  </p>
                </div>
                
                {/* Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-purple-600 p-2.5 rounded-full mpp-glow shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ShortsShelf;
