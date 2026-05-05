'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import UnstuckButton from '@/components/UnstuckButton';
import LegalDisclaimer from '@/components/LegalDisclaimer';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { flushSignals } from '@/lib/learner-engine';

interface NavItem { href: string; icon: string; label: string; }
interface NavGroup { label: string; items: NavItem[]; pinned?: boolean; }

const navGroups: NavGroup[] = [
  {
    label: 'Start here',
    pinned: true,
    items: [
      { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
      { href: '/daily-mix', icon: '🎯', label: 'Daily Mix' },
      { href: '/guru', icon: '🧙', label: 'AI Guru' },
    ],
  },
  {
    label: 'Learn',
    items: [
      { href: '/subjects', icon: '📚', label: 'Subjects' },
      { href: '/companions', icon: '🤝', label: 'Companions' },
      { href: '/flashcards', icon: '🃏', label: 'Flashcards' },
      { href: '/interleave', icon: '🧩', label: 'Mixed Practice' },
      { href: '/wonder', icon: '✨', label: 'Wonder' },
      { href: '/tricks', icon: '🪄', label: 'Tricks' },
      { href: '/blogs', icon: '📰', label: 'Blogs' },
      { href: '/magic-notes', icon: '🪄', label: 'Magic Notes' },
      { href: '/scan', icon: '📷', label: 'Scan Textbook' },
      { href: '/methods', icon: '📖', label: 'Methods' },
      { href: '/pedagogy', icon: '🧪', label: 'Learning Engine' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/me', icon: '🌟', label: 'My Development' },
      { href: '/habits', icon: '📏', label: 'Habits' },
      { href: '/reflect', icon: '🪞', label: 'Reflect' },
      { href: '/goals', icon: '🎯', label: 'Goals' },
      { href: '/progress', icon: '📊', label: 'Progress' },
    ],
  },
  {
    label: 'Play',
    items: [
      { href: '/arena', icon: '🎯', label: 'The Arena' },
      { href: '/league', icon: '💠', label: 'Weekly League' },
      { href: '/activities', icon: '🎮', label: 'Activities' },
      { href: '/challenges', icon: '🏆', label: 'Challenges' },
      { href: '/circles', icon: '🤝', label: 'Study Circles' },
      { href: '/live-quiz', icon: '📣', label: 'Live Quiz' },
      { href: '/achievements', icon: '⭐', label: 'Achievements' },
    ],
  },
  {
    label: 'Family',
    items: [
      { href: '/parent', icon: '👨‍👩‍👧', label: 'Parent View' },
      { href: '/style-discovery', icon: '🧬', label: 'My Style' },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Learn: true, Grow: false, Play: false, Family: false });
  const [userProfile, setUserProfile] = useState({
    name: '',
    class: 0,
    board: 'cbse',
    xp: 0,
    streak: 0,
  });

  // Flush learner signals on page unload — don't lose data
  useEffect(() => {
    const handleUnload = () => { flushSignals(); };
    window.addEventListener('beforeunload', handleUnload);
    // Also flush periodically (every 2 min)
    const interval = setInterval(() => { flushSignals(); }, 120000);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearInterval(interval);
      flushSignals();
    };
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile (current_class — the canonical column; profiles.class_level
      // never existed in any migration even though some legacy code referenced it).
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, current_class, board_code')
        .eq('id', user.id)
        .single() as any;

      // Fetch stats
      const { data: stats } = await supabase
        .from('user_stats')
        .select('total_xp, current_streak')
        .eq('user_id', user.id)
        .single() as any;

      setUserProfile({
        name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
        class: profile?.current_class || 0,
        board: profile?.board_code || 'cbse',
        xp: stats?.total_xp || 0,
        streak: stats?.current_streak || 0,
      });
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg">
              🧠
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-500 bg-clip-text text-transparent">
              MyCupIsEmpty
            </span>
          </Link>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {userProfile.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{userProfile.name}</p>
              <p className="text-sm text-gray-500">Class {userProfile.class} · {userProfile.board === 'wb_board' ? 'WBBSE' : userProfile.board?.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gradient-to-r from-warning-50 to-warning-100 px-3 py-2 rounded-lg text-center">
              <p className="text-warning-600 font-bold">⭐ {userProfile.xp.toLocaleString()}</p>
              <p className="text-xs text-warning-500">XP</p>
            </div>
            <div className="flex-1 bg-gradient-to-r from-error-50 to-error-100 px-3 py-2 rounded-lg text-center">
              <p className="text-error-600 font-bold">🔥 {userProfile.streak}</p>
              <p className="text-xs text-error-500">Streak</p>
            </div>
          </div>
        </div>

        {/* Navigation — grouped into pillars, 'Start here' pinned open */}
        <nav className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {navGroups.map((group) => {
            const open = openGroups[group.label] ?? (group.pinned || false);
            return (
              <div key={group.label} className="mb-2">
                <button
                  type="button"
                  onClick={() => !group.pinned && setOpenGroups((g) => ({ ...g, [group.label]: !open }))}
                  aria-label={group.label}
                  disabled={group.pinned}
                  className={`w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${group.pinned ? 'text-primary-700' : 'text-gray-400 hover:text-gray-700 cursor-pointer'}`}
                >
                  <span>{group.label}</span>
                  {!group.pinned && <span className="text-xs">{open ? '▼' : '▶'}</span>}
                </button>
                {open && group.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 bg-primary-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Language + Theme toggles (above bottom actions) */}
        <div className="absolute bottom-[124px] left-0 right-0 px-4 space-y-2 border-t border-gray-100 pt-3">
          <LocaleSwitcher compact />
          <ThemeToggle />
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <span className="text-xl">⚙️</span>
            <span>Settings</span>
          </Link>
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all">
            <span className="text-xl" aria-hidden="true">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 glass-effect border-b border-white/20">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-lg">
                🧠
              </div>
              <span className="font-bold text-gray-900">MyCupIsEmpty</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-warning-500">⭐ {userProfile.xp}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {children}

        {/* Unstuck floating button — appears on all student pages */}
        <UnstuckButton />

        {/* Legal footer — mandatory on every page */}
        <footer className="mt-16 border-t border-gray-200 bg-white/60 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-3">
            <LegalDisclaimer compact />
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <Link href="/about" className="hover:text-primary-600">About</Link>
              <Link href="/terms" className="hover:text-primary-600">Terms</Link>
              <Link href="/privacy" className="hover:text-primary-600">Privacy</Link>
              <span className="ml-auto">© {new Date().getFullYear()} MyCupIsEmpty</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
