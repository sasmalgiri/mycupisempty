'use client';

import React, { useState, useEffect } from 'react';
import { useTeachingMethods } from '@/hooks/upgrade';
import { MethodCard } from '@/components/ui/upgrade';
import { Card, Button, Badge, LoadingSpinner } from '@/components/ui/index';

export default function StudentMethodsPage({ params }: { params: { studentId: string } }) {
  const { methods, loading: methodsLoading } = useTeachingMethods();
  const [assigned, setAssigned] = useState<any[]>([]);
  const [effectiveness, setEffectiveness] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/teacher/methods?studentId=${params.studentId}`);
        if (res.ok) {
          const data = await res.json();
          setAssigned(data.data?.assigned || []);
          setEffectiveness(data.data?.method_stats || {});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.studentId]);

  const toggleMethod = (code: string) => {
    setSelectedMethods(prev =>
      prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]
    );
  };

  const saveAssignment = async () => {
    if (selectedMethods.length === 0) return;
    setSaving(true);
    try {
      await fetch('/api/teacher/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: params.studentId,
          subject_id: selectedSubject === 'all' ? null : selectedSubject,
          recommended_methods: selectedMethods,
          notes,
        }),
      });
      // Refresh
      const res = await fetch(`/api/teacher/methods?studentId=${params.studentId}`);
      if (res.ok) {
        const data = await res.json();
        setAssigned(data.data?.assigned || []);
      }
      setSelectedMethods([]);
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || methodsLoading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Teaching Methods Assignment</h1>
        <p className="text-gray-400 text-sm">
          Assign and track the best teaching methods for this student
        </p>
      </div>

      {/* Currently assigned */}
      {assigned.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Currently Assigned</h2>
          <div className="space-y-3">
            {assigned.map((a: any) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">
                      {a.subjects?.name || 'All Subjects'}
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {a.recommended_methods.map((m: string) => (
                        <Badge key={m} variant="primary">{m.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                    {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Method effectiveness */}
      {effectiveness && Object.keys(effectiveness).length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Method Effectiveness (Student Data)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(effectiveness).map(([code, stats]: any) => (
              <Card key={code} className="p-3 text-center">
                <p className="text-xs text-gray-400 capitalize">{code.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold text-white">{Math.round(stats.avg_rating * 20)}%</p>
                <p className="text-[10px] text-gray-500">{stats.attempts} uses</p>
                <div className="h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${stats.avg_rating * 20}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Assign new methods */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Assign Methods</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select methods you recommend for this student. Click to toggle.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {methods.map(method => (
            <MethodCard
              key={method.id}
              code={method.code}
              name={method.name}
              nameHindi={method.name_hindi || undefined}
              category={method.category}
              description={method.description}
              icon={method.icon || '📖'}
              bestForVark={method.best_for_vark}
              isSelected={selectedMethods.includes(method.code)}
              onClick={() => toggleMethod(method.code)}
            />
          ))}
        </div>

        {selectedMethods.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-sm text-gray-400">Selected:</span>
              {selectedMethods.map(m => (
                <Badge key={m} variant="primary">{m.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for the student (optional)..."
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm resize-none h-16 mb-3"
            />
            <Button onClick={saveAssignment} variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Assign Methods'}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
