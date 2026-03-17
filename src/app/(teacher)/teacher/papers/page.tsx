'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface PaperSection {
  title: string;
  questions: any[];
}

interface Paper {
  id: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  class_level: number;
  paper_data: {
    title: string;
    total_marks: number;
    duration_minutes: number;
    class_level: number;
    sections: PaperSection[];
    answer_key: any[];
    question_count: number;
  };
  criteria: any;
  created_at: string;
}

export default function TeacherPapersPage() {
  const [tab, setTab] = useState<'generate' | 'preview' | 'history'>('generate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate form state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [classLevel, setClassLevel] = useState(6);
  const [difficultyDist, setDifficultyDist] = useState({ easy: 30, medium: 50, hard: 20 });
  const [bloomDist, setBloomDist] = useState({
    remember: 20, understand: 25, apply: 25, analyze: 15, evaluate: 10, create: 5,
  });
  const [typeMix, setTypeMix] = useState({ mcq: 30, short_answer: 30, long_answer: 30, true_false: 10 });

  // Preview
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // History
  const [papers, setPapers] = useState<Paper[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSubjects();
    fetchPaperHistory();
  }, []);

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }
    fetchChapters();
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    const supabase = createBrowserClient();
    const { data } = await (supabase.from('subjects') as any).select('id, name');
    setSubjects(data || []);
  };

  const fetchChapters = async () => {
    const supabase = createBrowserClient();
    const { data } = await (supabase.from('chapters') as any)
      .select('id, title, chapter_number')
      .eq('subject_id', selectedSubject)
      .order('chapter_number');
    setChapters(data || []);
  };

  const fetchPaperHistory = async () => {
    try {
      const res = await fetch('/api/teacher/generate-paper');
      const data = await res.json();
      if (data.success) {
        setPapers(data.data || []);
      }
    } catch {}
  };

  const handleDifficultyChange = (key: string, value: number) => {
    const newDist = { ...difficultyDist, [key]: value };
    const total = Object.values(newDist).reduce((s, v) => s + v, 0);
    if (total <= 100) {
      setDifficultyDist(newDist);
    }
  };

  const handleBloomChange = (key: string, value: number) => {
    const newDist = { ...bloomDist, [key]: value };
    const total = Object.values(newDist).reduce((s, v) => s + v, 0);
    if (total <= 100) {
      setBloomDist(newDist);
    }
  };

  const handleTypeMixChange = (key: string, value: number) => {
    const newMix = { ...typeMix, [key]: value };
    const total = Object.values(newMix).reduce((s, v) => s + v, 0);
    if (total <= 100) {
      setTypeMix(newMix);
    }
  };

  const toggleChapter = (chapterId: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((c) => c !== chapterId)
        : [...prev, chapterId]
    );
  };

  const generatePaper = async () => {
    if (!selectedSubject) {
      setError('Please select a subject');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/teacher/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: selectedSubject,
          chapter_ids: selectedChapters,
          total_marks: totalMarks,
          duration_minutes: durationMinutes,
          difficulty_distribution: difficultyDist,
          bloom_distribution: bloomDist,
          question_type_mix: typeMix,
          class_level: classLevel,
          title: title || 'Question Paper',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentPaper(data.data);
        setTab('preview');
        fetchPaperHistory();
      } else {
        setError(data.error || 'Failed to generate paper');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const deletePaper = async (paperId: string) => {
    try {
      await fetch('/api/teacher/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', paper_id: paperId }),
      });
      fetchPaperHistory();
    } catch {}
  };

  const handlePrint = () => {
    window.print();
  };

  const difficultyTotal = Object.values(difficultyDist).reduce((s, v) => s + v, 0);
  const bloomTotal = Object.values(bloomDist).reduce((s, v) => s + v, 0);
  const typeTotal = Object.values(typeMix).reduce((s, v) => s + v, 0);

  // --- RENDER ---

  const accentColors: Record<string, string> = {
    green: 'accent-green-500',
    yellow: 'accent-yellow-500',
    red: 'accent-red-500',
    blue: 'accent-blue-500',
    indigo: 'accent-indigo-500',
    purple: 'accent-purple-500',
  };

  const renderSlider = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    color: string
  ) => (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 capitalize">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`flex-1 h-2 rounded-full appearance-none cursor-pointer ${accentColors[color] || 'accent-blue-500'}`}
      />
      <span className="text-sm font-bold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  );

  const renderGenerateForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Generate Question Paper</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paper Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Mid-Term Examination 2025"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapters([]);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select subject</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Chapters */}
          {chapters.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapters ({selectedChapters.length} selected)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {chapters.map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(c.id)}
                      onChange={() => toggleChapter(c.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {c.chapter_number ? `Ch ${c.chapter_number}: ` : ''}{c.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Basic settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value) || 100)}
                min={10}
                max={200}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 180)}
                min={15}
                max={300}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Level</label>
              <input
                type="number"
                value={classLevel}
                onChange={(e) => setClassLevel(parseInt(e.target.value) || 6)}
                min={1}
                max={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Difficulty Distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Difficulty Distribution</label>
              <span className={`text-xs font-bold ${difficultyTotal === 100 ? 'text-green-600' : 'text-red-500'}`}>
                Total: {difficultyTotal}%
              </span>
            </div>
            <div className="space-y-2 bg-gray-50 rounded-xl p-4">
              {renderSlider('Easy', difficultyDist.easy, (v) => handleDifficultyChange('easy', v), 'green')}
              {renderSlider('Medium', difficultyDist.medium, (v) => handleDifficultyChange('medium', v), 'yellow')}
              {renderSlider('Hard', difficultyDist.hard, (v) => handleDifficultyChange('hard', v), 'red')}
            </div>
          </div>

          {/* Bloom's Level Distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Bloom&apos;s Taxonomy Distribution</label>
              <span className={`text-xs font-bold ${bloomTotal === 100 ? 'text-green-600' : 'text-red-500'}`}>
                Total: {bloomTotal}%
              </span>
            </div>
            <div className="space-y-2 bg-gray-50 rounded-xl p-4">
              {renderSlider('Remember', bloomDist.remember, (v) => handleBloomChange('remember', v), 'blue')}
              {renderSlider('Understand', bloomDist.understand, (v) => handleBloomChange('understand', v), 'blue')}
              {renderSlider('Apply', bloomDist.apply, (v) => handleBloomChange('apply', v), 'blue')}
              {renderSlider('Analyze', bloomDist.analyze, (v) => handleBloomChange('analyze', v), 'indigo')}
              {renderSlider('Evaluate', bloomDist.evaluate, (v) => handleBloomChange('evaluate', v), 'indigo')}
              {renderSlider('Create', bloomDist.create, (v) => handleBloomChange('create', v), 'indigo')}
            </div>
          </div>

          {/* Question Type Mix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Question Type Mix</label>
              <span className={`text-xs font-bold ${typeTotal === 100 ? 'text-green-600' : 'text-red-500'}`}>
                Total: {typeTotal}%
              </span>
            </div>
            <div className="space-y-2 bg-gray-50 rounded-xl p-4">
              {renderSlider('MCQ', typeMix.mcq, (v) => handleTypeMixChange('mcq', v), 'blue')}
              {renderSlider('Short Ans', typeMix.short_answer, (v) => handleTypeMixChange('short_answer', v), 'green')}
              {renderSlider('Long Ans', typeMix.long_answer, (v) => handleTypeMixChange('long_answer', v), 'purple')}
              {renderSlider('True/False', typeMix.true_false, (v) => handleTypeMixChange('true_false', v), 'yellow')}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generatePaper}
            disabled={loading || difficultyTotal !== 100}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-lg"
          >
            {loading ? 'Generating Paper...' : 'Generate Question Paper'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => {
    const paper = currentPaper?.paper_data;
    if (!paper) return <p className="text-center text-gray-400">No paper generated yet.</p>;

    let questionNum = 0;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-4 no-print">
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition"
          >
            Print / Download PDF
          </button>
          <button
            onClick={() => setShowAnswerKey(!showAnswerKey)}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            {showAnswerKey ? 'Hide' : 'Show'} Answer Key
          </button>
        </div>

        {/* Paper */}
        <div ref={printRef} className="bg-white rounded-2xl shadow-lg p-8 print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">{paper.title}</h1>
            <div className="flex justify-center gap-8 mt-2 text-sm text-gray-600">
              <span>Class: {paper.class_level}</span>
              <span>Total Marks: {paper.total_marks}</span>
              <span>Duration: {paper.duration_minutes} minutes</span>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <p>General Instructions:</p>
              <p>1. All questions are compulsory. 2. Read each question carefully before answering.</p>
            </div>
          </div>

          {/* Sections */}
          {paper.sections.map((section, sIdx) => (
            <div key={sIdx} className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-300 pb-2">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.questions.map((q: any, qIdx: number) => {
                  questionNum++;
                  return (
                    <div key={qIdx} className="pl-2">
                      <div className="flex gap-2">
                        <span className="font-bold text-gray-700 shrink-0">Q{questionNum}.</span>
                        <div className="flex-1">
                          <p className="text-gray-900">
                            {q.question_text}
                            <span className="text-gray-400 text-sm ml-2">[{q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}]</span>
                          </p>
                          {(q.options && q.options.length > 0) && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {q.options.map((opt: string, oIdx: number) => (
                                <p key={oIdx} className="text-gray-700 text-sm">
                                  ({String.fromCharCode(97 + oIdx)}) {opt}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.ai_generated && (
                            <span className="text-xs text-blue-400 no-print">(AI generated)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="text-center text-gray-400 text-sm mt-8 border-t border-gray-200 pt-4">
            --- End of Question Paper ---
          </div>
        </div>

        {/* Answer Key */}
        {showAnswerKey && (
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-8 no-print">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Answer Key</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paper.answer_key.map((a: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="font-bold text-blue-600 shrink-0">Q{a.question_number}.</span>
                  <div>
                    <p className="text-gray-900 font-medium">{a.correct_answer}</p>
                    {a.explanation && (
                      <p className="text-gray-500 text-sm mt-1">{a.explanation}</p>
                    )}
                    <p className="text-xs text-gray-400">{a.marks} mark{a.marks > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Paper History</h2>

        {papers.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No papers generated yet.</p>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-2xl">
                  &#128196;
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{paper.title}</p>
                  <p className="text-sm text-gray-500">
                    {paper.total_marks} marks | {paper.duration_minutes} mins | Class {paper.class_level}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(paper.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCurrentPaper(paper); setTab('preview'); }}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deletePaper(paper.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Question Paper Generator
        </h1>
        <p className="text-gray-500 mt-1">Auto-generate question papers with customizable distributions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 no-print">
        {[
          { key: 'generate', label: 'Generate' },
          { key: 'preview', label: 'Preview' },
          { key: 'history', label: 'History' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-6 py-2 rounded-xl font-medium transition ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'generate' && renderGenerateForm()}
      {tab === 'preview' && renderPreview()}
      {tab === 'history' && renderHistory()}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          aside, header, nav { display: none !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
