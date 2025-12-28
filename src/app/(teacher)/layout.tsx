'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

const navItems = [
  { href: '/teacher/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/teacher/classrooms', icon: '🏫', label: 'Classrooms' },
  { href: '/teacher/students', icon: '👨‍🎓', label: 'Students' },
  { href: '/teacher/assignments', icon: '📝', label: 'Assignments' },
  { href: '/teacher/analytics', icon: '📊', label: 'Analytics' },
  { href: '/teacher/reports', icon: '📋', label: 'Reports' },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState({
    name: 'Loading...',
    email: '',
    school: '',
  });
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClassrooms: 0,
  });

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, school_name')
          .eq('id', user.id)
          .single();

        if (profile) {
          setTeacherProfile({
            name: profile.full_name || 'Teacher',
            email: profile.email || '',
            school: profile.school_name || '',
          });
        }

        // Fetch stats
        const { count: classroomCount } = await supabase
          .from('classrooms')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id);

        const { data: enrollments } = await supabase
          .from('classroom_enrollments')
          .select('student_id, classroom_id')
          .in('classroom_id',
            (await supabase.from('classrooms').select('id').eq('teacher_id', user.id)).data?.map(c => c.id) || []
          )
          .eq('status', 'active');

        setStats({
          totalClassrooms: classroomCount || 0,
          totalStudents: new Set(enrollments?.map(e => e.student_id)).size || 0,
        });
      }
    };

    fetchTeacherProfile();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
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
          <Link href="/teacher/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-lg">
              👨‍🏫
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                MyCupIsEmpty
              </span>
              <p className="text-xs text-gray-500">Teacher Portal</p>
            </div>
          </Link>
        </div>

        {/* Teacher Info */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {teacherProfile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{teacherProfile.name}</p>
              <p className="text-sm text-gray-500 truncate">{teacherProfile.school || 'Teacher'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 rounded-lg text-center">
              <p className="text-blue-600 font-bold">{stats.totalClassrooms}</p>
              <p className="text-xs text-blue-500">Classes</p>
            </div>
            <div className="flex-1 bg-gradient-to-r from-indigo-50 to-indigo-100 px-3 py-2 rounded-lg text-center">
              <p className="text-indigo-600 font-bold">{stats.totalStudents}</p>
              <p className="text-xs text-indigo-500">Students</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          {navItems.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/teacher/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
          <Link
            href="/teacher/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <span className="text-xl">⚙️</span>
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <span className="text-xl" aria-hidden="true">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/teacher/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-lg">
                👨‍🏫
              </div>
              <span className="font-bold text-gray-900">Teacher Portal</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {teacherProfile.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
