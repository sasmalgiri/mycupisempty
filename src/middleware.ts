import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Route definitions. Keep this list in sync with folders under src/app/(dashboard)/
  // — any (dashboard) route missing here silently bypasses auth + onboarding gates.
  // /onboarding itself is included so unauthenticated users get redirected to /login
  // instead of landing on a broken page where /api/onboarding-prefill 401s.
  const studentRoutes = [
    '/dashboard', '/daily-mix', '/subjects', '/progress', '/achievements', '/assessment',
    '/settings', '/flashcards', '/guru', '/activities', '/challenges', '/methods',
    '/learning-dna', '/style-discovery', '/my-teams', '/lifecycle', '/pedagogy', '/me',
    '/habits', '/reflect', '/goals', '/parent', '/badges', '/path-discovery', '/live-quiz',
    '/companions', '/circles', '/onboarding', '/interleave', '/arena', '/wonder', '/tricks', '/blogs', '/league', '/magic-notes', '/scan', '/persona', '/courses', '/admin', '/mock-test',
  ];
  const teacherRoutes = ['/teacher'];
  const authRoutes = ['/login', '/signup'];

  const isStudentRoute = studentRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isTeacherRoute = request.nextUrl.pathname.startsWith('/teacher');
  const isAuthRoute = authRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isProtectedRoute = isStudentRoute || isTeacherRoute;

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Handle authenticated users
  if (user) {
    // Fetch user profile to get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || 'student';
    const isTeacher = userRole === 'teacher';
    const isStudent = userRole === 'student';

    // Redirect authenticated users from auth routes based on role
    if (isAuthRoute) {
      const redirectUrl = isTeacher ? '/teacher/dashboard' : '/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Role-based access control
    if (isTeacher && isStudentRoute) {
      // Teachers trying to access student routes -> redirect to teacher dashboard
      return NextResponse.redirect(new URL('/teacher/dashboard', request.url));
    }

    if (isStudent && isTeacherRoute) {
      // Students trying to access teacher routes -> redirect to student dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Onboarding gate (replaces the old VARK-quiz gate).
    // We never force a quiz — we observe behavior. But first-time students
    // should see the short onboarding so a character goal is chosen.
    // Students who have an `onboarded_at` can freely navigate the whole app.
    if (
      isStudent &&
      isStudentRoute &&
      !request.nextUrl.pathname.startsWith('/onboarding') &&
      !request.nextUrl.pathname.startsWith('/assessment')     // allow explicit visit
    ) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarded_at')
          .eq('id', user.id)
          .single();

        const skipOnboarding = process.env.NEXT_PUBLIC_SKIP_ASSESSMENT === 'true';
        if (!skipOnboarding && profile && !profile.onboarded_at) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }
      } catch {
        // If the check fails (e.g., transient DB error), don't block — degrade
        // to "let them navigate" rather than "trap them in a redirect loop".
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
