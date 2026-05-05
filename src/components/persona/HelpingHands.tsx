'use client';

/**
 * Helping Hands — branching micro-scenario. Friend needs help right when
 * you're behind on your own work. Reveals social_orientation and
 * conscientiousness without asking.
 */

import { useState } from 'react';
import type { HelpingHandsSignals } from '@/lib/persona-games';

interface Props {
  onComplete: (signals: HelpingHandsSignals, durationSec: number) => void;
  onSkip?: () => void;
}

type Step = 'intro' | 'first' | 'split' | 'finish' | 'done';

export default function HelpingHands({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [helped, setHelped] = useState<boolean | null>(null);
  const [splitFraction, setSplitFraction] = useState<number>(0.5);
  const [finishedOwn, setFinishedOwn] = useState<boolean>(false);
  const [selfishExit, setSelfishExit] = useState<boolean>(false);
  const [startedAt] = useState(() => Date.now());

  const finish = () => {
    onComplete({
      helpedClassmate: helped === true,
      finishedOwnWork: finishedOwn,
      splitTimeFraction: helped === true ? splitFraction : 0,
      tookSelfishExit: selfishExit,
    }, Math.round((Date.now() - startedAt) / 1000));
    setStep('done');
  };

  return (
    <section className="rounded-2xl border-2 border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 p-5">
      <h3 className="font-bold text-base mb-1">🤝 Helping Hands</h3>

      {step === 'intro' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            It&apos;s the night before a test. You have 3 chapters left and you&apos;re tired. Your friend Riya messages: <em>&quot;Stuck on chapter 4 — please can you explain the diagram? Tomorrow is the test.&quot;</em>
          </p>
          <div className="space-y-2">
            <button type="button" onClick={() => { setHelped(true); setStep('split'); }} className="w-full text-left p-3 rounded-xl border-2 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-sm">
              Reply yes — help her now.
            </button>
            <button type="button" onClick={() => { setHelped(false); setStep('finish'); }} className="w-full text-left p-3 rounded-xl border-2 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-sm">
              Reply later — finish your chapters first.
            </button>
            <button type="button" onClick={() => { setHelped(false); setSelfishExit(true); setStep('finish'); }} className="w-full text-left p-3 rounded-xl border-2 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm">
              Don&apos;t reply — you don&apos;t have the bandwidth.
            </button>
          </div>
        </>
      )}

      {step === 'split' && helped && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            How much of your remaining time goes to helping Riya?
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={Math.round(splitFraction * 100)}
            onChange={(e) => setSplitFraction(Number(e.target.value) / 100)}
            className="w-full mb-2"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">
            {Math.round(splitFraction * 100)}% to Riya · {100 - Math.round(splitFraction * 100)}% to your work
          </p>
          <button type="button" onClick={() => setStep('finish')} className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-semibold">
            Continue
          </button>
        </>
      )}

      {step === 'finish' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Did you finish your own 3 chapters by morning?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setFinishedOwn(true); finish(); }} className="py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold">
              Yes
            </button>
            <button type="button" onClick={() => { setFinishedOwn(false); finish(); }} className="py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold">
              Partly / no
            </button>
          </div>
        </>
      )}

      {step === 'intro' && onSkip && (
        <button type="button" onClick={onSkip} className="mt-3 text-xs text-gray-500 hover:text-gray-800">Skip</button>
      )}
    </section>
  );
}
