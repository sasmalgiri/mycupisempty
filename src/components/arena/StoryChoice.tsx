'use client';

/**
 * Story Choice — narrative comprehension + decision-tempo + risk-leaning
 * minigame.
 *
 * Mechanic: a short branching micro-story. At each node the student picks
 * one of three choices, each tagged risky/empathetic/analytical. Decision
 * latency captures tempo. Branch choices reveal disposition. The student
 * may "go back to re-read", which we record as a comprehension proxy.
 *
 * What it measures (silently):
 *   - inference / comprehension (analytical share + reread count)
 *   - decision tempo (median latency)
 *   - risk preference (risky branch share)
 *   - empathy leaning (help-others branch share)
 *
 * Not a personality test. We never label a student "the careful one." This
 * just feeds the multi-axis Arena profile that the rest of the app reads.
 */

import { useEffect, useRef, useState } from 'react';
import type { StoryChoiceSignals } from '@/lib/arena-signals';

type ChoiceKind = 'risky' | 'empathetic' | 'analytical';

interface Choice {
  text: string;
  kind: ChoiceKind;
  next: string;            // next node id, or 'end_*'
}

interface StoryNode {
  id: string;
  text: string;
  choices?: Choice[];      // present unless this is an end node
  ending?: string;         // present at end nodes
}

// Simple seed story; can be replaced with DB-driven stories later. The graph
// has 1 starting node, 3 forks (one per ChoiceKind), 3 second-level forks,
// converging to varied endings. Total ~6-9 decisions.
const STORY: Record<string, StoryNode> = {
  start: {
    id: 'start',
    text:
      "It's the school sports day. You're at the relay starting line and you spot a younger student crying near the side. The whistle hasn't blown yet. What do you do?",
    choices: [
      { text: 'Run over and check on them — the race can wait', kind: 'empathetic', next: 'helped' },
      { text: 'Stay focused on the race; you can talk after',  kind: 'risky',     next: 'raced' },
      { text: 'Look around to see why they\'re crying first',  kind: 'analytical', next: 'inquired' },
    ],
  },
  helped: {
    id: 'helped',
    text:
      "You jog to the kid. They've lost their water bottle and are missing their mother's phone call. The whistle's about to blow. The teacher hasn't noticed.",
    choices: [
      { text: 'Give them your phone — your race can be redone', kind: 'empathetic', next: 'end_kindness' },
      { text: 'Yell to your teacher and dash back to the line', kind: 'risky',      next: 'end_split' },
      { text: 'Promise you\'ll find them right after — and run', kind: 'analytical', next: 'end_compromise' },
    ],
  },
  raced: {
    id: 'raced',
    text:
      "You stay focused. You take off when the whistle blows. Mid-race you remember the kid. Your team is just behind the leaders.",
    choices: [
      { text: 'Push through — you\'ll help after the race',    kind: 'risky',     next: 'end_won' },
      { text: 'Slow down and look back, signalling a teacher', kind: 'empathetic', next: 'end_split' },
      { text: 'Finish strong but check in immediately after',  kind: 'analytical', next: 'end_compromise' },
    ],
  },
  inquired: {
    id: 'inquired',
    text:
      "You spot the broken handle on a water bottle and another student walking away too quickly. You only have a few seconds before your race.",
    choices: [
      { text: 'Confront the other student — that\'s not okay',  kind: 'risky',      next: 'end_drama' },
      { text: 'Quietly tell a teacher what you noticed',        kind: 'analytical', next: 'end_just' },
      { text: 'Hand the kid your bottle and dash to the start', kind: 'empathetic', next: 'end_kindness' },
    ],
  },
  end_kindness:   { id: 'end_kindness',   text: 'You missed the race but the kid found their mum. The teacher noticed too.',                  ending: 'kindness' },
  end_split:      { id: 'end_split',      text: 'You finish second but your teacher said you did the right thing in the moment.',             ending: 'split' },
  end_compromise: { id: 'end_compromise', text: 'You finish strong AND find the kid afterwards. Your captain remembers it.',                  ending: 'compromise' },
  end_won:        { id: 'end_won',        text: 'You won. The kid was fine. You felt a quiet question in your chest about the choice.',       ending: 'won' },
  end_drama:      { id: 'end_drama',      text: 'There was a small scene. The teacher sorted it out. Your team did fine.',                    ending: 'drama' },
  end_just:       { id: 'end_just',       text: 'The teacher handled it well. You ran your race. The kid waved at you afterward.',            ending: 'just' },
};

interface Props {
  onComplete: (signals: StoryChoiceSignals, summary: { paths: number; rtP50: number; durationSec: number }) => void;
  onAbort?: () => void;
}

export default function StoryChoice({ onComplete, onAbort }: Props) {
  const [started, setStarted] = useState(false);
  const [nodeId, setNodeId] = useState<string>('start');
  const [history, setHistory] = useState<string[]>([]);
  const decisionsRef = useRef<{ rt: number; kind: ChoiceKind }[]>([]);
  const rereadsRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const nodeShownAtRef = useRef<number>(0);

  const node = STORY[nodeId];

  const start = () => {
    setStarted(true);
    setNodeId('start');
    setHistory([]);
    decisionsRef.current = [];
    rereadsRef.current = 0;
    startedAtRef.current = Date.now();
    nodeShownAtRef.current = Date.now();
  };

  useEffect(() => {
    nodeShownAtRef.current = Date.now();
  }, [nodeId]);

  const goBack = () => {
    if (history.length === 0) return;
    rereadsRef.current += 1;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setNodeId(prev);
  };

  const choose = (c: Choice) => {
    const rt = Date.now() - nodeShownAtRef.current;
    decisionsRef.current.push({ rt, kind: c.kind });
    setHistory((h) => [...h, nodeId]);
    setNodeId(c.next);
    if (STORY[c.next]?.ending) {
      // Defer finish so the ending text is read.
      setTimeout(() => finish(true, c.next), 400);
    }
  };

  const finish = (finished: boolean, terminalNodeId?: string) => {
    const decisions = decisionsRef.current;
    const risky = decisions.filter((d) => d.kind === 'risky').length;
    const empathetic = decisions.filter((d) => d.kind === 'empathetic').length;
    const analytical = decisions.filter((d) => d.kind === 'analytical').length;
    const latencies = decisions.map((d) => d.rt);
    const sortedRt = [...latencies].sort((a, b) => a - b);
    const rtP50 = sortedRt.length ? sortedRt[Math.floor(sortedRt.length / 2)] : 0;
    const signals: StoryChoiceSignals = {
      pathsExplored: history.length + 1,
      decisionLatenciesMs: latencies,
      riskySelections: risky,
      empatheticSelections: empathetic,
      analyticalSelections: analytical,
      rereadCount: rereadsRef.current,
      finishedStory: finished,
    };
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    onComplete(signals, { paths: signals.pathsExplored, rtP50, durationSec });
    setStarted(false);
  };

  if (!started) {
    return (
      <div className="rounded-2xl border-2 border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 p-6">
        <h3 className="font-bold text-lg mb-2">📖 Story Choice</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          A short story. Your choices steer it. Pick what feels right — there are no wrong answers.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={start} className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-semibold">
            Start
          </button>
          {onAbort && (
            <button type="button" onClick={onAbort} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800">Skip</button>
          )}
        </div>
      </div>
    );
  }

  const isEnd = !!node?.ending;

  return (
    <div className="rounded-2xl border-2 border-pink-200 dark:border-pink-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-mono text-gray-500">Choices made: {history.length}</span>
        {!isEnd && history.length > 0 && (
          <button type="button" onClick={goBack} className="text-xs text-gray-500 hover:text-gray-800">
            ↶ Re-read
          </button>
        )}
      </div>

      <p className="text-base leading-relaxed mb-4">{node?.text}</p>

      {!isEnd && node?.choices && (
        <div className="space-y-2">
          {node.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(c)}
              className="w-full text-left px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-pink-400 text-sm transition-colors"
            >
              {c.text}
            </button>
          ))}
        </div>
      )}

      {isEnd && (
        <div className="mt-4 p-3 rounded-lg bg-pink-50 dark:bg-pink-900/30 text-sm">
          <strong>Story complete.</strong> Closing the loop now.
        </div>
      )}
    </div>
  );
}
