'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    currentClass: '6',
    role: 'student',
    board: 'cbse',
    parentEmail: '',
    parentConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // All Class 1-12 students are minors (ages 6-18) under DPDPA 2023
  const isMinor = formData.role === 'student';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // DPDPA 2023 compliance: require parental consent for minor students
    if (isMinor && !formData.parentConsent) {
      setError('Parental/guardian consent is required for students under 18 as per DPDPA 2023');
      setLoading(false);
      return;
    }

    if (isMinor && !formData.parentEmail) {
      setError('Parent/guardian email is required for students under 18');
      setLoading(false);
      return;
    }

    if (isMinor && formData.parentEmail === formData.email) {
      setError('Parent/guardian email must be different from student email');
      setLoading(false);
      return;
    }

    try {
      const supabase = createBrowserClient();
      
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            current_class: parseInt(formData.currentClass),
            role: formData.role,
            parent_email: isMinor ? formData.parentEmail : undefined,
            parent_consent_given: isMinor ? true : undefined,
            parent_consent_date: isMinor ? new Date().toISOString() : undefined,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Update profile with class_level, role, and board (trigger only sets name/email)
        await (supabase as any)
          .from('profiles')
          .update({
            class_level: parseInt(formData.currentClass),
            role: formData.role,
            board_code: formData.board,
          })
          .eq('id', data.user.id);

        // Redirect to assessment page
        router.push('/assessment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-primary-500/30">
              🧠
            </div>
            <span className="font-bold text-2xl gradient-text">MyCupIsEmpty</span>
          </Link>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Create Your Account 🎉</h1>
          <p className="text-gray-500 text-center mb-8">Start your personalized learning journey</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Your full name"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="currentClass" className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  id="currentClass"
                  name="currentClass"
                  value={formData.currentClass}
                  onChange={handleChange}
                  className="input-field"
                  title="Select your class"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      Class {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  I am a
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="input-field"
                  title="Select your role"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="board" className="block text-sm font-medium text-gray-700 mb-2">
                Education Board
              </label>
              <select
                id="board"
                name="board"
                value={formData.board}
                onChange={handleChange}
                className="input-field"
                title="Select your education board"
              >
                <option value="cbse">CBSE</option>
                <option value="icse">ICSE</option>
                <option value="wb_board">West Bengal Board (WBBSE)</option>
                <option value="up_board">UP Board</option>
                <option value="mp_board">MP Board</option>
                <option value="bihar_board">Bihar Board</option>
                <option value="mh_board">Maharashtra Board</option>
                <option value="tn_board">Tamil Nadu Board</option>
                <option value="ka_board">Karnataka Board</option>
                <option value="rj_board">Rajasthan Board</option>
                <option value="nios">NIOS</option>
              </select>
            </div>

            {/* Parental Consent Section — DPDPA 2023 compliance */}
            {isMinor && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-lg mt-0.5" aria-hidden="true">&#9888;</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Parental Consent Required</p>
                    <p className="text-xs text-amber-600 mt-1">
                      As per India&apos;s Digital Personal Data Protection Act (DPDPA) 2023,
                      verifiable parental consent is required for users under 18 years of age.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Parent/Guardian Email
                  </label>
                  <input
                    type="email"
                    id="parentEmail"
                    name="parentEmail"
                    value={formData.parentEmail}
                    onChange={handleChange}
                    placeholder="parent@example.com"
                    className="input-field"
                    autoComplete="email"
                    required={isMinor}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A consent verification email will be sent to this address.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="parentConsent"
                    checked={formData.parentConsent}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    required={isMinor}
                  />
                  <span className="text-sm text-gray-700">
                    I am the parent/legal guardian of this student and I consent to the collection
                    and processing of my child&apos;s personal data for educational purposes as described
                    in the <Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>.
                    I understand that AI-generated content will be used for teaching and may occasionally contain errors.
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account →'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or continue with</span>
            </div>
          </div>

          {/* Google Sign Up */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span className="font-medium text-gray-700">
              {googleLoading ? 'Connecting...' : 'Sign up with Google'}
            </span>
          </button>

          <p className="mt-4 text-xs text-center text-gray-500">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
          </p>

          <div className="mt-6 text-center">
            <span className="text-gray-500">Already have an account?</span>{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
              Log in
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
