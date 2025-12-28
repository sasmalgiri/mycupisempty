'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface JoinClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JoinClassroomModal({ isOpen, onClose, onSuccess }: JoinClassroomModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classroomInfo, setClassroomInfo] = useState<{ name: string; class_level: number } | null>(null);

  const handleCodeChange = async (code: string) => {
    const upperCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInviteCode(upperCode);
    setError('');
    setClassroomInfo(null);

    if (upperCode.length === 6) {
      // Look up classroom
      const supabase = createBrowserClient();
      const { data: classroom } = await supabase
        .from('classrooms')
        .select('name, class_level, is_active')
        .eq('invite_code', upperCode)
        .single();

      if (classroom && classroom.is_active) {
        setClassroomInfo({
          name: classroom.name,
          class_level: classroom.class_level,
        });
      } else if (classroom && !classroom.is_active) {
        setError('This classroom is no longer active');
      } else {
        setError('Invalid invite code');
      }
    }
  };

  const handleJoin = async () => {
    if (!inviteCode || inviteCode.length !== 6) {
      setError('Please enter a valid 6-character invite code');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    try {
      // Find classroom by invite code
      const { data: classroom, error: findError } = await supabase
        .from('classrooms')
        .select('id, name, max_students')
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single();

      if (findError || !classroom) {
        setError('Invalid or expired invite code');
        setLoading(false);
        return;
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('classroom_enrollments')
        .select('id, status')
        .eq('classroom_id', classroom.id)
        .eq('student_id', user.id)
        .single();

      if (existingEnrollment) {
        if (existingEnrollment.status === 'active') {
          setError('You are already enrolled in this classroom');
        } else if (existingEnrollment.status === 'removed') {
          setError('You were removed from this classroom');
        } else {
          // Re-enroll
          await supabase
            .from('classroom_enrollments')
            .update({ status: 'active', joined_at: new Date().toISOString() })
            .eq('id', existingEnrollment.id);

          onSuccess();
          handleClose();
        }
        setLoading(false);
        return;
      }

      // Check classroom capacity
      const { count: currentStudents } = await supabase
        .from('classroom_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('classroom_id', classroom.id)
        .eq('status', 'active');

      if (currentStudents && currentStudents >= classroom.max_students) {
        setError('This classroom is full');
        setLoading(false);
        return;
      }

      // Enroll student
      const { error: enrollError } = await supabase
        .from('classroom_enrollments')
        .insert({
          classroom_id: classroom.id,
          student_id: user.id,
          status: 'active',
        });

      if (enrollError) {
        throw enrollError;
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error joining classroom:', err);
      setError(err.message || 'Failed to join classroom');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setError('');
    setClassroomInfo(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🏫
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Join a Classroom</h2>
          <p className="text-gray-500 mt-1">Enter the invite code from your teacher</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all uppercase"
            />
          </div>

          {/* Classroom Info */}
          {classroomInfo && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                  ✓
                </div>
                <div>
                  <p className="font-semibold text-green-900">{classroomInfo.name}</p>
                  <p className="text-sm text-green-700">Class {classroomInfo.class_level}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={loading || !classroomInfo}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining...' : 'Join Classroom'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Ask your teacher for the classroom invite code
        </p>
      </div>
    </div>
  );
}
