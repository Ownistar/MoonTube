import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Video, Bell, User, LogOut, Moon } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <nav className="z-50 flex h-14 items-center justify-between border-b border-neutral-800 bg-black/95 backdrop-blur-md px-4 sticky top-0">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-[#8B5CF6] w-9 h-9 rounded-full flex items-center justify-center mpp-glow transition-transform group-hover:scale-110">
            <Moon className="h-5 w-5 text-white fill-current" />
          </div>
          <span className="hidden font-sans text-xl font-black tracking-tighter md:block">
            MoonTube
          </span>
        </Link>
      </div>

      <div className="flex flex-1 max-w-2xl px-4 mx-auto">
        <form onSubmit={handleSearch} className="flex h-10 w-full overflow-hidden rounded-full border border-neutral-700 bg-[#121212] focus-within:border-purple-500/50 transition-colors">
          <input
            type="text"
            placeholder="Search or paste YouTube URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-neutral-600"
          />
          <button type="submit" className="flex items-center justify-center border-l border-neutral-800 px-4 hover:bg-white/5">
            <Search className="h-5 w-5 opacity-40" />
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <Link to="/upload" title="Upload" className="bg-[#8B5CF6] px-5 py-2 rounded-full text-xs font-bold text-white mpp-glow hidden md:flex items-center gap-2 hover:bg-[#7C3AED] transition-colors">
          <Video className="h-4 w-4" /> IMPORT
        </Link>
        
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="rounded-full p-2 hover:bg-neutral-800 transition-colors relative"
          >
            <Bell className={cn("h-5 w-5", unreadCount > 0 ? "text-purple-500" : "opacity-60")} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 flex-col rounded-2xl border border-white/10 bg-[#0F0F0F] p-1 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="border-b border-white/10 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Inbound Signals</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Lunar quiet. No transmissions.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) navigate(n.link);
                      }}
                      className={cn(
                        "group flex cursor-pointer flex-col p-4 transition-colors hover:bg-white/5 border-b border-white/5 last:border-0",
                        !n.read && "bg-purple-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase tracking-tight">{n.title}</span>
                        {!n.read && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />}
                      </div>
                      <p className="mt-1 text-xs text-white/60 line-clamp-2">{n.message}</p>
                      <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-neutral-600">
                        {n.createdAt && formatDistanceToNow(new Date(n.createdAt))} ago
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {user ? (
          <div className="group relative">
            <button className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 focus:outline-none">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <User className="h-5 w-5 opacity-60" />
              )}
            </button>
            
            <div className="absolute right-0 top-full mt-2 hidden w-48 flex-col rounded-xl border border-white/10 bg-[#0F0F0F] p-1 shadow-2xl group-focus-within:flex group-hover:flex">
              <div className="border-b border-white/10 p-3">
                <p className="text-sm font-medium">{profile?.displayName || user?.displayName}</p>
                <p className="truncate text-xs text-white/40">{user?.email}</p>
              </div>
              <Link to="/profile" className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-white/5">
                <User className="h-4 w-4" /> My Profile
              </Link>
              <Link to="/mpp" className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-white/5">
                <Moon className="h-4 w-4" /> MPP Dashboard
              </Link>
              <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-red-400 hover:bg-white/5">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link 
              to="/profile" 
              className="hidden lg:block px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link 
              to="/profile" 
              className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-white/90 transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Join Now
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
