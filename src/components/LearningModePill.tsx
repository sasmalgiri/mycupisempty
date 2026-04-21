'use client';

/**
 * Learning Mode Pill — small chip that shows the student how the app is
 * currently teaching them, and lets them override it in one click.
 *
 * Philosophy: the 5-layer engine runs invisibly in the background. This pill
 * exists for the subset of students who are self-aware about how they learn
 * best ("I'm visual", "I want examples first") — giving them a steering wheel
 * instead of black-box silence. Default stays observed; override is a pill-click
 * away.
 */

import { useEffect, useState } from 'react';

export type ExplanationMode =
  | 'visual' | 'story' | 'step_by_step' | 'example_first' | 'socratic' | 'drill' | 'hands_on';

type Source = 'observed' | 'manual' | 'default';

interface ModeOption {
  value: ExplanationMode;
  label: string;
  icon: string;
  hint: string;
}

export const MODE_OPTIONS: ModeOption[] = [
  { value: 'visual',        label: 'Visual',         icon: '👁', hint: 'Diagrams, maps, color-coded steps' },
  { value: 'story',         label: 'Story',          icon: '📖', hint: 'Narrative with characters + analogies' },
  { value: 'example_first', label: 'Example-first',  icon: '🎯', hint: 'Show me examples before the rule' },
  { value: 'step_by_step',  label: 'Step-by-step',   icon: '📋', hint: 'Clear numbered breakdown' },
  { value: 'socratic',      label: 'Socratic',       icon: '❓', hint: 'Ask me questions, let me think' },
  { value: 'drill',         label: 'Drill',          icon: '⚡', hint: 'Rapid practice, minimal theory' },
  { value: 'hands_on',      label: 'Hands-on',       icon: '🧪', hint: 'Let me try / sim / experiment' },
];

export function modeLabel(mode: ExplanationMode): string {
  return MODE_OPTIONS.find((o) => o.value === mode)?.label || 'Step-by-step';
}

export function modeIcon(mode: ExplanationMode): string {
  return MODE_OPTIONS.find((o) => o.value === mode)?.icon || '📋';
}

interface Props {
  subjectId?: string;
  onChange?: (mode: ExplanationMode) => void;
  className?: string;
  variant?: 'dark' | 'light';
}

export default function LearningModePill({ subjectId, onChange, className = '', variant = 'light' }: Props) {
  const [mode, setMode] = useState<ExplanationMode>('step_by_step');
  const [source, setSource] = useState<Source>('default');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
    fetch(`/api/learning-mode${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setMode(d.mode);
          setSource(d.source);
        }
      })
      .catch(() => {});
  }, [subjectId]);

  const pick = async (next: ExplanationMode) => {
    setMode(next);
    setSource('manual');
    setOpen(false);
    onChange?.(next);
    setSaving(true);
    try {
      await fetch('/api/learning-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subjectId || undefined, mode: next }),
      });
    } finally {
      setSaving(false);
    }
  };

  const isDark = variant === 'dark';
  const pillClass = isDark
    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700';

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Learning mode: ${modeLabel(mode)}. Tap to change.`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${pillClass}`}
      >
        <span aria-hidden="true">{modeIcon(mode)}</span>
        <span>Teach me: <span className="font-bold">{modeLabel(mode)}</span></span>
        {source === 'observed' && <span className="text-[9px] opacity-60 font-normal">· observed</span>}
        {saving && <span className="text-[9px] opacity-60 font-normal">· saving</span>}
        <span className="opacity-50">▾</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className={`absolute z-40 mt-2 w-64 rounded-2xl shadow-xl border p-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <p className={`px-2 py-1 text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              How should I teach you?
            </p>
            {MODE_OPTIONS.map((opt) => {
              const active = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt.value)}
                  aria-label={opt.label}
                  className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg transition-colors ${
                    active
                      ? isDark ? 'bg-primary-500/20 text-primary-300' : 'bg-primary-50 text-primary-700'
                      : isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-base flex-shrink-0" aria-hidden="true">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{opt.hint}</div>
                  </div>
                  {active && <span className="text-xs flex-shrink-0">✓</span>}
                </button>
              );
            })}
            <p className={`px-2 pt-1 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              We observe how you learn — but you can always override.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
