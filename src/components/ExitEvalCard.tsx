'use client';

/**
 * ExitEvalCard — single transfer question that gates session completion.
 *
 * Anti-cheat instrumentation lives here: time-to-first-keystroke, paste
 * detection (clipboard event + suspicious instant typing), tab-blur counter
 * via window blur events. The student is told plainly that we're tracking
 * focus — not as punishment, but so the score reflects honest effort.
 *
 * The question can't be skipped. "Submit blank" is allowed and counts as
 * a wrong answer (still earns Honesty XP for completing the loop).
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  topicId: string;
  topicTitle?: string;
  subjectId?: string;
  companionId?: string;
  modeUsed?: string;
  sessionId?: string;
  onComplete: (result: {
    score: number;
    correct: boolean;
    components: any;
    cheatFlags: string[];
    modeProposal?: { newMode: string; reason: string } | null;
  }) => void;
}

type Stage = 'loading' | 'confidence' | 'answering' | 'submitting' | 'feedback' | 'failed';

export default function ExitEvalCard({ topicId, topicTitle, subjectId, companionId, modeUsed, sessionId, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('loading');
  const [question, setQuestion] = useState<any>(null);
  const [confidence, setConfidence] = useState<'guess' | 'unsure' | 'sure' | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [proposal, setProposal] = useState<{ newMode: string; reason: string } | null>(null);

  // Anti-cheat instrumentation
  const stageStartedRef = useRef<number>(0);
  const firstKeystrokeRef = useRef<number>(0);
  const pasteDetectedRef = useRef<boolean>(false);
  const tabBlurCountRef = useRef<number>(0);
  const answerStartedRef = useRef<number>(0);

  // Fetch question
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exit-eval?topicId=${encodeURIComponent(topicId)}${subjectId ? `&subjectId=${encodeURIComponent(subjectId)}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.success && d.question) {
          setQuestion(d.question);
          setStage('confidence');
          stageStartedRef.current = Date.now();
        } else {
          setError(d?.error || 'Could not load the exit question.');
          setStage('failed');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Network error.');
        setStage('failed');
      });
    return () => { cancelled = true; };
  }, [topicId, subjectId]);

  // Tab-blur tracking: register globally while answering.
  useEffect(() => {
    if (stage !== 'answering') return;
    const onBlur = () => { tabBlurCountRef.current += 1; };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [stage]);

  const startAnswering = () => {
    setStage('answering');
    answerStartedRef.current = Date.now();
    firstKeystrokeRef.current = 0;
  };

  const onAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (firstKeystrokeRef.current === 0 && e.target.value.length > 0) {
      firstKeystrokeRef.current = Date.now() - answerStartedRef.current;
    }
    setAnswer(e.target.value);
  };

  const onPaste = () => { pasteDetectedRef.current = true; };

  const submit = async () => {
    if (!question) return;
    setStage('submitting');
    const durationSeconds = Math.max(1, Math.round((Date.now() - answerStartedRef.current) / 1000));
    try {
      const res = await fetch('/api/exit-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          prompt: question.prompt,
          expectedAnswer: question.expectedAnswer,
          acceptableAnswers: question.acceptableAnswers || [],
          questionKind: question.kind,
          source: question.source,
          studentAnswer: answer,
          confidenceBefore: confidence,
          timeToFirstKeystrokeMs: firstKeystrokeRef.current,
          pasteDetected: pasteDetectedRef.current,
          tabBlurCount: tabBlurCountRef.current,
          durationSeconds,
          topicId,
          subjectId,
          companionId,
          modeUsed,
          sessionId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Save failed.');
      }
      setResult(json.result);
      setProposal(json.modeProposal || null);
      setStage('feedback');
      onComplete({
        score: json.result.score,
        correct: json.result.correct,
        components: json.result.components,
        cheatFlags: json.result.cheatFlags,
        modeProposal: json.modeProposal,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not submit.');
      setStage('failed');
    }
  };

  if (stage === 'loading') {
    return <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-sm text-gray-500">Loading your exit question…</div>;
  }
  if (stage === 'failed') {
    return (
      <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm">
        <strong>Couldn&apos;t load:</strong> {error}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl" aria-hidden="true">✍️</span>
        <h3 className="font-bold text-base">Exit question{topicTitle ? ` — ${topicTitle}` : ''}</h3>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        One question. Apply what you just learned to a slightly different situation. We track focus and time on this — not to punish, but so the score is honest.
      </p>

      {question && (
        <p className="text-sm font-medium leading-relaxed mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          {question.prompt}
        </p>
      )}

      {stage === 'confidence' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Before you answer — how sure do you feel?</p>
          <div className="flex gap-2 mb-3">
            {(['guess', 'unsure', 'sure'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setConfidence(c)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${
                  confidence === c
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                {c === 'guess' && '🤷 Just guessing'}
                {c === 'unsure' && '🤔 Not sure'}
                {c === 'sure' && '💪 Pretty sure'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startAnswering}
            disabled={!confidence}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            Start answering
          </button>
        </>
      )}

      {stage === 'answering' && (
        <>
          <textarea
            value={answer}
            onChange={onAnswerChange}
            onPaste={onPaste}
            placeholder="Your answer…"
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3"
          />
          <button
            type="button"
            onClick={submit}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            Submit answer
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            No skip. Submit blank if you really want — it still counts as completing the loop.
          </p>
        </>
      )}

      {stage === 'submitting' && (
        <p className="text-sm text-center text-gray-500">Scoring…</p>
      )}

      {stage === 'feedback' && result && (
        <div className="space-y-3">
          <div className={`p-3 rounded-lg ${result.correct ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
            <p className="text-sm font-bold">
              {result.correct ? '✓ Correct' : '→ Not quite'} — score {(result.score * 100).toFixed(0)}/100
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              correctness {(result.components.correctness * 100).toFixed(0)} ·
              calibration {(result.components.calibration * 100).toFixed(0)} ·
              timeliness {(result.components.timeliness * 100).toFixed(0)}
              {result.components.cheatPenalty > 0 && ` · penalty −${(result.components.cheatPenalty * 100).toFixed(0)}`}
            </p>
            {result.cheatFlags.length > 0 && (
              <p className="text-[10px] text-rose-700 mt-1">
                Flags: {result.cheatFlags.join(', ')}
              </p>
            )}
          </div>
          {proposal && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
              <p className="text-sm font-bold mb-1">Your companion suggests a change</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {proposal.reason}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Try <strong>{proposal.newMode.replace(/_/g, ' ')}</strong> next time. You can switch any time from your learning mode pill.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
