'use client';

/**
 * AlgorithmVisualizer — step-through animations for classic algorithms.
 * Bubble sort, insertion sort, binary search, BFS on a small graph.
 */

import { useEffect, useRef, useState } from 'react';

type Algo = 'bubble' | 'insertion' | 'binary_search';

interface Step { array: number[]; highlight: number[]; note: string; }

function bubbleSortSteps(input: number[]): Step[] {
  const arr = [...input];
  const steps: Step[] = [{ array: [...arr], highlight: [], note: 'Starting bubble sort' }];
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      steps.push({ array: [...arr], highlight: [j, j + 1], note: `Compare ${arr[j]} and ${arr[j + 1]}` });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        steps.push({ array: [...arr], highlight: [j, j + 1], note: `Swap — ${arr[j]} < ${arr[j + 1]}` });
      }
    }
  }
  steps.push({ array: [...arr], highlight: [], note: 'Sorted ✓' });
  return steps;
}

function insertionSortSteps(input: number[]): Step[] {
  const arr = [...input];
  const steps: Step[] = [{ array: [...arr], highlight: [], note: 'Starting insertion sort' }];
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    steps.push({ array: [...arr], highlight: [i], note: `Pick ${key}, insert into sorted left part` });
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      steps.push({ array: [...arr], highlight: [j, j + 1], note: `Shift ${arr[j]} right` });
      j--;
    }
    arr[j + 1] = key;
    steps.push({ array: [...arr], highlight: [j + 1], note: `Place ${key} at position ${j + 1}` });
  }
  steps.push({ array: [...arr], highlight: [], note: 'Sorted ✓' });
  return steps;
}

function binarySearchSteps(input: number[], target: number): Step[] {
  const arr = [...input].sort((a, b) => a - b);
  const steps: Step[] = [{ array: [...arr], highlight: [], note: `Sorted first; searching for ${target}` }];
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    steps.push({ array: [...arr], highlight: [lo, mid, hi], note: `lo=${lo}, mid=${mid}(${arr[mid]}), hi=${hi}` });
    if (arr[mid] === target) {
      steps.push({ array: [...arr], highlight: [mid], note: `Found at ${mid} ✓` });
      return steps;
    }
    if (arr[mid] < target) { lo = mid + 1; steps.push({ array: [...arr], highlight: [lo, hi], note: `${arr[mid]} < ${target} → go right` }); }
    else { hi = mid - 1; steps.push({ array: [...arr], highlight: [lo, hi >= 0 ? hi : 0], note: `${arr[mid]} > ${target} → go left` }); }
  }
  steps.push({ array: [...arr], highlight: [], note: `Not found` });
  return steps;
}

export default function AlgorithmVisualizer() {
  const [algo, setAlgo] = useState<Algo>('bubble');
  const [input, setInput] = useState('5, 2, 8, 1, 9, 3, 7, 4');
  const [target, setTarget] = useState(7);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<any>(null);

  const parsedInput = input.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));

  const generate = () => {
    if (parsedInput.length === 0) return;
    let s: Step[] = [];
    if (algo === 'bubble') s = bubbleSortSteps(parsedInput);
    else if (algo === 'insertion') s = insertionSortSteps(parsedInput);
    else s = binarySearchSteps(parsedInput, target);
    setSteps(s);
    setStepIdx(0);
  };

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setStepIdx((i) => {
        if (i >= steps.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 600);
    return () => clearInterval(timerRef.current);
  }, [playing, steps.length]);

  const current = steps[stepIdx];
  const maxVal = Math.max(...parsedInput, 1);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🧩 Algorithm Visualizer</h3>
        <div className="flex gap-1">
          {(['bubble', 'insertion', 'binary_search'] as Algo[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setAlgo(a); setSteps([]); setStepIdx(0); setPlaying(false); }}
              aria-label={a}
              className={`px-3 py-1 text-xs font-medium rounded ${algo === a ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >{a.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="5, 2, 8, 1, 9"
          aria-label="Array"
          className="flex-1 min-w-[200px] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm font-mono bg-white dark:bg-gray-950"
        />
        {algo === 'binary_search' && (
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(parseInt(e.target.value, 10) || 0)}
            placeholder="target"
            aria-label="Target"
            className="w-24 border border-gray-200 dark:border-gray-800 rounded px-2 py-1 text-sm bg-white dark:bg-gray-950"
          />
        )}
        <button
          type="button"
          onClick={generate}
          aria-label="Prepare steps"
          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm font-semibold"
        >Prepare</button>
      </div>

      {steps.length > 0 && current && (
        <>
          <div className="flex items-end gap-1 h-40 bg-gray-50 dark:bg-gray-950 rounded-lg p-2 border border-gray-200 dark:border-gray-800">
            {current.array.map((n, i) => (
              <div
                key={i}
                className="flex-1 min-w-0 flex flex-col items-center justify-end transition-all"
                style={{
                  height: `${(n / maxVal) * 100}%`,
                  backgroundColor: current.highlight.includes(i) ? '#ef4444' : '#6366f1',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 0',
                  borderRadius: '4px 4px 0 0',
                }}
              >{n}</div>
            ))}
          </div>
          <p className="text-sm text-center my-2 font-medium">{current.note}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
              aria-label="Previous"
              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
            >◀</button>
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label="Play/Pause"
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold"
            >{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button
              type="button"
              onClick={() => setStepIdx(Math.min(steps.length - 1, stepIdx + 1))}
              disabled={stepIdx >= steps.length - 1}
              aria-label="Next"
              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-50"
            >▶</button>
            <span className="ml-auto text-xs text-gray-500">Step {stepIdx + 1} / {steps.length}</span>
          </div>
        </>
      )}
    </div>
  );
}
