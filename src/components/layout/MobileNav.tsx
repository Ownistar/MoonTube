import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, User, History, Video, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export default function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-neutral-800 bg-black/95 px-2 pb-safe backdrop-blur-md md:hidden">
      <div className="flex w-full items-center justify-around">
        <MobileNavLink to="/" icon={Home} label="Home" active={location.pathname === '/'} />
        <MobileNavLink to="/shorts" icon={Zap} label="Shorts" active={location.pathname === '/shorts'} />
        <MobileNavLink to="/explore" icon={Compass} label="Explore" active={location.pathname === '/explore'} />
        <MobileNavLink to="/upload" icon={Video} label="Import" active={location.pathname === '/upload'} />
        <MobileNavLink to="/profile" icon={User} label={user ? "Profile" : "Join"} active={location.pathname === '/profile'} />
      </div>
    </div>
  );
}

function MobileNavLink({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold uppercase tracking-widest transition-colors",
        active ? "text-purple-500" : "text-white/40"
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "scale-110" : "scale-100")} />
      <span>{label}</span>
    </Link>
  );
}
