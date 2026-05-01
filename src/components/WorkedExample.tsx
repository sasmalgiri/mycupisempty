'use client';

/**
 * WorkedExample — a STEM teaching pattern with backward fading.
 *
 * Pedagogy: novices learn faster from worked examples than from solving
 * problems unaided. Effect size in math meta-analysis (Barbieri et al. 2023):
 *   g = 0.48 vs unaided problem-solving for novices
 *   d = 0.55-0.73 in secondary-ed STEM
 *
 * Backward fading > forward fading: remove the LAST step first, then the
 * second-to-last, etc. The student sees most of the worked solution and
 * fills in the final step — gradually building up to solving the whole thing.
 *
 * Critical caveat (expertise reversal effect): worked examples HURT once a
 * student is past novice. Caller should pass `showWorkedExample={mastery <
 * 'developing'}` and bypass this component for stronger students.
 *
 * Each step has:
 *   - prompt: what we're computing in this step
 *   - work:   the math/reasoning for the step
 *   - answer: the result (this is what the student fills in when faded)
 *
 * The component reveals steps progressively as the student types or clicks
 * "Show me." The final step is always faded; earlier steps fade as the
 * student proves competence (3 successful uses unfades the next step).
 */

import { useState } from 'react';

export interface WorkedStep {
  prompt: string;
  work: string;       // the worked-out reasoning (rich text or LaTeX-lite)
  answer: string;     // what the student types when this step is faded
  hint?: string;      // optional hint shown after a wrong attempt
}

interface Props {
  problem: string;
  steps: WorkedStep[];
  /** How many *trailing* steps to fade. 0 = full worked example, steps.length = solve-it-all-yourself. */
  fadeCount?: number;
  onComplete?: (result: { correct: number; total: number }) => void;
}

type StepStage = 'hidden' | 'shown' | 'fading' | 'attempted_wrong' | 'attempted_right';

export default function WorkedExample({ problem, steps, fadeCount = 1, onComplete }: Props) {
  const fadedFromIndex = Math.max(0, steps.length - fadeCount);

  const [stages, setStages] = useState<StepStage[]>(() =>
    steps.map((_, i) => (i < fadedFromIndex ? 'shown' : 'fading'))
  );
  const [inputs, setInputs] = useState<string[]>(() => steps.map(() => ''));
  const [done, setDone] = useState(false);

  const submitAttempt = (idx: number) => {
    const given = inputs[idx].trim();
    const expected = steps[idx].answer.trim();
    const correct = normalize(given) === normalize(expected);
    setStages((s) => {
      const next = [...s];
      next[idx] = correct ? 'attempted_right' : 'attempted_wrong';
      return next;
    });
    if (correct && idx === steps.length - 1) {
      const total = steps.length;
      const correctCount = stages.filter((s, i) => i < idx && (s === 'attempted_right' || s === 'shown')).length + 1;
      setDone(true);
      onComplete?.({ correct: correctCount, total });
    }
  };

  const reveal = (idx: number) => {
    setStages((s) => {
      const next = [...s];
      next[idx] = 'shown';
      return next;
    });
  };

  return (
    <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span aria-hidden="true">🧮</span>
        <h3 className="font-bold text-base">Worked example</h3>
      </div>
      <p className="text-sm font-semibold mb-4 p-3 rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800">
        {problem}
      </p>

      <ol className="space-y-3">
        {steps.map((step, i) => {
          const stage = stages[i];
          const isFaded = stage === 'fading' || stage === 'attempted_wrong';
          return (
            <li key={i} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300 font-bold mb-1">
                Step {i + 1}
              </p>
              <p className="text-sm font-medium mb-2">{step.prompt}</p>

              {(stage === 'shown' || stage === 'attempted_right') ? (
                <>
                  <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    {step.work}
                  </pre>
                  <p className="text-sm font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                    = {step.answer}
                    {stage === 'attempted_right' && <span className="ml-2 text-xs">✓ you got it</span>}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Your turn — what&apos;s the answer for this step?
                    {stage === 'attempted_wrong' && step.hint && (
                      <span className="block mt-1 text-amber-700 dark:text-amber-300">Hint: {step.hint}</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputs[i]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setInputs((arr) => { const copy = [...arr]; copy[i] = v; return copy; });
                      }}
                      placeholder="Type your answer"
                      aria-label={`Step ${i + 1} answer`}
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => submitAttempt(i)}
                      disabled={!inputs[i].trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                    >
                      Check
                    </button>
                    <button
                      type="button"
                      onClick={() => reveal(i)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
                      title="Show me"
                    >
                      Show me
                    </button>
                  </div>
                  {isFaded && stage === 'attempted_wrong' && (
                    <p className="text-xs text-amber-600 mt-1">
                      Not quite — try once more, or click <em>Show me</em> to see the work.
                    </p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-sm">
          ✓ Complete. Try a similar problem on your own next — that&apos;s how the worked example transfers to your own skill.
        </div>
      )}
    </div>
  );
}

// Loose answer-string equivalence: trim, lowercase, strip whitespace and
// trailing punctuation. Doesn't try to evaluate math expressions — caller
// should normalize numbers (e.g., "1/2" vs "0.5") before passing them in.
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '').replace(/[.,;]+$/, '');
}
