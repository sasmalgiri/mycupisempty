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

  // Route definitions
  const studentRoutes = ['/dashboard', '/subjects', '/progress', '/achievements', '/assessment', '/settings', '/flashcards'];
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

    // VARK assessment check (only for students on student routes)
    if (isStudent && isStudentRoute && !request.nextUrl.pathname.startsWith('/assessment')) {
      const { data: learningStyle } = await supabase
        .from('learning_styles')
        .select('dominant_style')
        .eq('user_id', user.id)
        .single();

      // Redirect to assessment if not completed (no dominant_style set)
      if (!learningStyle?.dominant_style) {
        const skipAssessment = process.env.NEXT_PUBLIC_SKIP_ASSESSMENT === 'true';
        if (!skipAssessment) {
          return NextResponse.redirect(new URL('/assessment', request.url));
        }
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
