import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, User, History, DollarSign, CloudMoon, Clock, ThumbsUp, Users, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const sidebarItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Compass, label: 'Explore', path: '/explore' },
  { icon: Users, label: 'Subscriptions', path: '/subscriptions' },
  { icon: DollarSign, label: 'Earnings', path: '/mpp' },
];

const libraryItems = [
  { icon: User, label: 'Your Channel', path: '/profile' },
  { icon: History, label: 'History', path: '/history' },
  { icon: Clock, label: 'Watch Later', path: '/watch-later' },
  { icon: ThumbsUp, label: 'Liked Videos', path: '/liked' },
];

export default function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useAuth();

  return (
    <aside className="hidden w-60 flex-col border-r border-neutral-800 bg-black p-2 md:flex">
      <div className="flex flex-col gap-1">
        {sidebarItems.map((item) => (
          <SidebarLink
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            active={location.pathname === item.path}
          />
        ))}
        {isAdmin && (
          <SidebarLink 
            icon={Shield}
            label="System Command"
            path="/admin"
            active={location.pathname === '/admin'}
          />
        )}
      </div>

      <div className="my-4 h-[px] w-full border-t border-neutral-800" />

      <div className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        You
      </div>
      <div className="flex flex-col gap-1">
        {libraryItems.map((item) => (
          <SidebarLink
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            active={location.pathname === item.path}
          />
        ))}
      </div>
      
      <div className="mt-auto px-4 py-4 text-[10px] text-white/20">
        <p>&copy; 2026 MoonTube LLC</p>
        <p>RPM: $0.50 Guaranteed</p>
      </div>
    </aside>
  );
}

const SidebarLink: React.FC<{ icon: any, label: string, path: string, active: boolean }> = ({ icon: Icon, label, path, active }) => {
  return (
    <Link
      to={path}
      className={cn(
        "flex items-center gap-5 rounded-xl px-3 py-2 text-sm transition-colors",
        active 
          ? "bg-neutral-800 font-medium" 
          : "hover:bg-neutral-900 opacity-60 hover:opacity-100"
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "opacity-100" : "opacity-70")} />
      <span>{label}</span>
    </Link>
  );
}
