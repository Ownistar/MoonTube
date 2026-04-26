import React from 'react';
import { Link } from 'react-router-dom';
import { Video } from '../../types';
import { formatViews } from '../../lib/utils';
import { motion } from 'motion/react';

interface VideoCardProps {
  video: Video;
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`;
  const watchUrl = video.isShort ? `/shorts/${video.id}` : `/watch/${video.id}`;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative"
    >
      <Link to={watchUrl} className="block">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 transition-all group-hover:border-purple-500/50 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]">
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-purple-600 p-3 rounded-full mpp-glow shadow-xl">
               <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white rounded-md">
            {video.category}
          </div>
        </div>
      </Link>
      
      <div className="mt-3 flex gap-3">
        <Link to={`/channel/${video.ownerId}`} className="shrink-0">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-800 border border-neutral-700 transition-transform hover:scale-110">
            {video.ownerPhoto ? (
              <img src={video.ownerPhoto} alt={video.ownerName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-neutral-500">
                {video.ownerName?.charAt(0) || 'M'}
              </div>
            )}
          </div>
        </Link>
        <div className="flex flex-col text-sm min-w-0">
          <Link to={watchUrl} className="block">
            <h3 className="line-clamp-2 font-semibold text-neutral-100 leading-snug hover:text-purple-400 transition-colors">
              {video.title}
            </h3>
          </Link>
          <Link to={`/channel/${video.ownerId}`} className="mt-1 text-neutral-400 text-xs hover:text-purple-400 transition-colors truncate">
            {video.ownerName || 'Creator'}
          </Link>
          <p className="mt-0.5 text-[11px] text-neutral-500 font-medium">
            {formatViews(video.views)} views • Moon Partner
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
