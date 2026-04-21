'use client';

/**
 * VirtualLab — wraps any subject tool with a challenge mode.
 *
 * Given a challenge from the library, renders:
 *   - The challenge card (instructions, rubric, hints)
 *   - The tool itself (dynamically chosen)
 *   - A submission box
 *   - Result + XP after grading
 */

import { useState } from 'react';
import RichContent from './RichContent';

interface Challenge {
  id: string;
  title: string;
  subject: string;
  chapter?: string;
  tool: string;
  maturityBand: number[];
  instructions: string;
  successCriteria: string;
  submissionKind: 'numeric' | 'equation' | 'code' | 'text' | 'multi_choice' | 'free_build';
  expected?: any;
  tolerance?: number;
  hints?: string[];
  estimatedMinutes: number;
  xpReward: number;
  studentProgress?: { best_score: number; correct: boolean; attempts: number } | null;
}

interface Props {
  challenges: Challenge[];
  onToolOpen?: (tool: string) => void;
}

export default function VirtualLab({ challenges, onToolOpen }: Props) {
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [submission, setSubmission] = useState<string>('');
  const [showHints, setShowHints] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; score: number; feedback: string; xpAwarded: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Parse submission based on kind
      let parsed: any = submission;
      if (selected.submissionKind === 'numeric') {
        const nums = submission.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
        parsed = nums.length === 1 ? nums[0] : nums;
      }
      const res = await fetch('/api/lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', challengeId: selected.id, submission: parsed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');
      setResult({ ...data.result, xpAwarded: data.xpAwarded || 0 });
    } catch (err: any) {
      setResult({ correct: false, score: 0, feedback: err.message, xpAwarded: 0 });
    } finally {
      setSubmitting(false);
    }
  };

  if (selected) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <button
              type="button"
              onClick={() => { setSelected(null); setSubmission(''); setResult(null); setShowHints(false); }}
              aria-label="Back"
              className="text-primary-600 text-sm font-semibold mb-2"
            >← Back to challenges</button>
            <h3 className="font-bold text-lg">{selected.title}</h3>
            <p className="text-xs text-gray-500">
              {selected.subject}{selected.chapter ? ` · ${selected.chapter}` : ''} · ~{selected.estimatedMinutes} min · +{selected.xpReward} XP
            </p>
          </div>
          {selected.studentProgress?.correct && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">✓ Done</span>
          )}
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-3">
          <p className="text-sm font-medium mb-1">Instructions</p>
          <RichContent text={selected.instructions} className="text-sm" />
          <p className="text-xs text-gray-500 mt-2">Success: {selected.successCriteria}</p>
        </div>

        {onToolOpen && (
          <button
            type="button"
            onClick={() => onToolOpen(selected.tool)}
            className="w-full mb-3 px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-lg font-semibold"
          >🔬 Open {toolLabel(selected.tool)} →</button>
        )}

        {selected.hints && selected.hints.length > 0 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowHints(!showHints)}
              aria-label="Toggle hints"
              className="text-sm text-amber-700 dark:text-amber-400 font-semibold"
            >{showHints ? '− Hide' : '+ Show'} hints</button>
            {showHints && (
              <ul className="mt-2 list-disc ml-5 text-sm text-gray-700 dark:text-gray-300">
                {selected.hints.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mb-3">
          <label className="text-sm font-medium block mb-1">Your answer</label>
          {selected.submissionKind === 'code' ? (
            <textarea
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="Paste your output or code result"
              aria-label="Submission"
              rows={4}
              className="w-full border border-gray-200 dark:border-gray-800 rounded p-2 font-mono text-sm bg-white dark:bg-gray-950"
            />
          ) : selected.submissionKind === 'numeric' ? (
            <input
              type="text"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="e.g., 9.8 or 3.14, 2.71"
              aria-label="Submission"
              className="w-full border border-gray-200 dark:border-gray-800 rounded p-2 text-sm bg-white dark:bg-gray-950"
            />
          ) : (
            <input
              type="text"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder={selected.submissionKind === 'equation' ? 'e.g., 4Fe + 3O2 = 2Fe2O3' : 'Your answer'}
              aria-label="Submission"
              className="w-full border border-gray-200 dark:border-gray-800 rounded p-2 text-sm bg-white dark:bg-gray-950"
            />
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!submission || submitting}
          aria-label="Submit"
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold"
        >{submitting ? 'Checking…' : 'Submit ✓'}</button>

        {result && (
          <div className={`mt-3 p-4 rounded-lg border-2 ${result.correct ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-900/20' : 'bg-amber-50 border-amber-400 dark:bg-amber-900/20'}`}>
            <p className="font-bold text-lg mb-1">
              {result.correct ? '✓ Correct!' : '↻ Not yet — try again'}
            </p>
            <p className="text-sm">{result.feedback}</p>
            <p className="text-xs text-gray-600 mt-2">Score: {Math.round(result.score * 100)}% {result.xpAwarded > 0 && `· +${result.xpAwarded} XP earned`}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-lg flex items-center gap-2">🔬 Lab Challenges</h3>
      {challenges.length === 0 ? (
        <p className="text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">No challenges available for your current level yet. Keep practicing — new ones unlock as you grow.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {challenges.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setSelected(c); setSubmission(''); setResult(null); }}
              aria-label={c.title}
              className="text-left p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-primary-400 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-semibold text-sm">{c.title}</h4>
                {c.studentProgress?.correct && <span className="text-xs text-emerald-600">✓</span>}
              </div>
              <p className="text-xs text-gray-500 mb-2">{c.subject}{c.chapter ? ` · ${c.chapter}` : ''}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">~{c.estimatedMinutes} min</span>
                <span className="font-semibold text-primary-600">+{c.xpReward} XP</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function toolLabel(t: string): string {
  const labels: Record<string, string> = {
    graph_plotter: 'Graph Plotter',
    calculator: 'Calculator',
    geometry: 'Geometry Constructor',
    physics_pendulum: 'Pendulum Lab',
    physics_projectile: 'Projectile Lab',
    physics_wave: 'Wave Lab',
    physics_circuit: 'Circuit Lab',
    unit_converter: 'Unit Converter',
    periodic_table: 'Periodic Table',
    molecule_viewer: 'Molecule Viewer',
    reaction_balancer: 'Reaction Balancer',
    diagram_explorer: 'Diagram Explorer',
    taxonomy_tree: 'Taxonomy Tree',
    writing: 'Writing Tool',
    pronunciation: 'Pronunciation Coach',
    dictionary: 'Dictionary',
    reading_comprehension: 'Reading Comprehension',
    timeline: 'Timeline',
    india_map: 'India Map',
    chart_builder: 'Chart Builder',
    code_sandbox: 'Code Sandbox',
    algorithm_viz: 'Algorithm Visualizer',
  };
  return labels[t] || 'Tool';
}
