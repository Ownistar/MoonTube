import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Watch from './pages/Watch';
import Upload from './pages/Upload';
import MPPDashboard from './pages/MPPDashboard';
import Profile from './pages/Profile';
import Subscriptions from './pages/Subscriptions';
import WatchLater from './pages/WatchLater';
import History from './pages/History';
import LikedVideos from './pages/LikedVideos';
import Admin from './pages/Admin';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Login from './pages/Login';
import MobileNav from './components/layout/MobileNav';

function AppContent() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const now = Date.now();

    // Frequency cap for social bar: 1 hour
    const SOCIAL_BAR_KEY = 'adsterra_socialbar_last_shown';
    const lastSocialBar = localStorage.getItem(SOCIAL_BAR_KEY);
    const oneHour = 60 * 60 * 1000;

    if (!lastSocialBar || (now - parseInt(lastSocialBar)) > oneHour) {
      const script = document.createElement('script');
      script.src = 'https://accedelid.com/36/1a/16/361a16fb9e188d3cf6b5b36adb3d1fe1.js';
      script.async = true;
      document.head.appendChild(script);
      localStorage.setItem(SOCIAL_BAR_KEY, now.toString());
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] text-white">
        <div className="animate-pulse font-sans text-2xl tracking-widest uppercase">MoonTube</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#050505] text-white">
      <Navbar />
      <div className="flex flex-1 overflow-hidden pb-16 md:pb-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/watch/:videoId" element={<Watch />} />
            
            {/* Protected Routes - Redirect to Home if not logged in (Nav and Modals handle Login) */}
            <Route path="/upload" element={user ? <Upload /> : <Login />} />
            <Route path="/mpp" element={user ? <MPPDashboard /> : <Login />} />
            <Route path="/subscriptions" element={user ? <Subscriptions /> : <Login />} />
            <Route path="/watch-later" element={user ? <WatchLater /> : <Login />} />
            <Route path="/history" element={user ? <History /> : <Login />} />
            <Route path="/liked" element={user ? <LikedVideos /> : <Login />} />
            <Route path="/admin" element={user ? <Admin /> : <Login />} />
            <Route path="/profile" element={user ? <Profile /> : <Login />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
