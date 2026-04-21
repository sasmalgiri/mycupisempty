'use client';

/**
 * Study Circles — small peer groups that share a join code and see a daily
 * shared challenge. Deliberately minimal: no chat, no public feed. The point
 * is to make friends visible in the learning loop without inviting
 * moderation headaches.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CIRCLE_PROMPT_TEMPLATES } from '@/lib/content-safety';

interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  role: 'founder' | 'member';
  isFounder: boolean;
  memberCount: number;
  maxMembers: number;
  todayChallenge: {
    id: string;
    prompt: string;
    subjectHint: string | null;
    completionCount: number;
    completedByMe: boolean;
  } | null;
}

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/circles')
      .then((r) => r.json())
      .then((d) => { if (d?.success) setCircles(d.circles || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createCircle = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name }),
      }).then(r => r.json());
      if (res?.success) {
        setNewName('');
        setFlash(`Created "${res.circle.name}" · share code ${res.circle.inviteCode}`);
        load();
      } else {
        setFlash(res?.error || 'Could not create');
      }
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 5000);
    }
  };

  const joinCircle = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setFlash('Codes are 6 characters'); setTimeout(() => setFlash(null), 3000); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code }),
      }).then(r => r.json());
      if (res?.success) {
        setJoinCode('');
        setFlash(`Joined "${res.circle.name}"`);
        load();
      } else {
        setFlash(res?.error || 'Could not join');
      }
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 5000);
    }
  };

  const leaveCircle = async (circleId: string) => {
    if (!confirm('Leave this circle? You can rejoin with the invite code.')) return;
    await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', circleId }),
    });
    load();
  };

  const completeChallenge = async (challengeId: string) => {
    await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete_challenge', challengeId }),
    });
    load();
  };

  const [pickerCircleId, setPickerCircleId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const pickTemplate = async (circleId: string, templateId: string) => {
    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed_today_challenge', circleId, templateId }),
    }).then(r => r.json());
    if (!res?.success) { setFlash(res?.error || 'Could not set prompt'); setTimeout(() => setFlash(null), 5000); }
    setPickerCircleId(null);
    load();
  };

  const submitCustom = async (circleId: string) => {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed_today_challenge', circleId, prompt }),
    }).then(r => r.json());
    if (res?.success) {
      setPickerCircleId(null);
      setCustomPrompt('');
      load();
    } else {
      setFlash(res?.error || 'Could not set prompt');
      setTimeout(() => setFlash(null), 5000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Study Circles</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Small groups (up to 6) who share a daily challenge. Just enough peer energy — no feeds, no DMs.
        </p>
      </div>

      {flash && (
        <div className="p-3 rounded-lg bg-primary-50 border border-primary-200 text-sm text-primary-800">
          {flash}
        </div>
      )}

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <h2 className="font-bold mb-1">Create a circle</h2>
          <p className="text-xs text-gray-500 mb-3">You&apos;ll get a 6-char code to share with friends.</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Circle name (e.g., Class 8-A Prep)"
            maxLength={60}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-2 text-sm"
          />
          <button
            type="button"
            onClick={createCircle}
            disabled={busy || !newName.trim()}
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            Create circle
          </button>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <h2 className="font-bold mb-1">Join a circle</h2>
          <p className="text-xs text-gray-500 mb-3">Got a code from a friend? Enter it here.</p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABC234"
            maxLength={6}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mb-2 text-sm font-mono tracking-wider text-center uppercase"
          />
          <button
            type="button"
            onClick={joinCircle}
            disabled={busy || joinCode.length !== 6}
            className="w-full py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            Join
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Your circles</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : circles.length === 0 ? (
          <div className="p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-center">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="font-bold">No circles yet</h3>
            <p className="text-sm text-gray-500 mt-1">Create one above, or ask a friend for their code.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {circles.map((c) => (
              <article key={c.id} className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <p className="text-xs text-gray-500">
                      {c.memberCount}/{c.maxMembers} members
                      {c.isFounder && ' · you founded this'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono tracking-wider select-all">
                      {c.inviteCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => leaveCircle(c.id)}
                      className="text-xs text-gray-400 hover:text-rose-600"
                    >Leave</button>
                  </div>
                </div>

                {c.todayChallenge ? (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950/30 dark:to-secondary-950/30 border border-primary-200 dark:border-primary-800">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-primary-600 mb-1">
                      Today&apos;s shared challenge
                      {c.todayChallenge.subjectHint && ` · ${c.todayChallenge.subjectHint}`}
                    </p>
                    <p className="text-sm mb-3">{c.todayChallenge.prompt}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {c.todayChallenge.completionCount} of {c.memberCount} done
                        {c.todayChallenge.completedByMe && ' · you ✓'}
                      </p>
                      {!c.todayChallenge.completedByMe && (
                        <button
                          type="button"
                          onClick={() => completeChallenge(c.todayChallenge!.id)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </div>
                ) : pickerCircleId === c.id ? (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                      Pick a starter
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2 mb-3">
                      {CIRCLE_PROMPT_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => pickTemplate(c.id, tpl.id)}
                          className="text-left p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-primary-400 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-base flex-shrink-0" aria-hidden="true">{tpl.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-snug">{tpl.prompt}</p>
                              {tpl.subjectHint && (
                                <p className="text-[10px] text-gray-500 mt-0.5">{tpl.subjectHint}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {c.isFounder ? (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] text-gray-500 mb-2">Or write your own (founder only):</p>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Write today's prompt…"
                          maxLength={300}
                          rows={2}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => submitCustom(c.id)}
                            disabled={!customPrompt.trim()}
                            className="flex-1 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                          >Post custom prompt</button>
                          <button
                            type="button"
                            onClick={() => { setPickerCircleId(null); setCustomPrompt(''); }}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickerCircleId(null)}
                        className="text-[10px] text-gray-500 hover:text-gray-700"
                      >Cancel</button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-center">
                    <p className="text-xs text-gray-500 mb-2">No shared challenge yet for today.</p>
                    <button
                      type="button"
                      onClick={() => setPickerCircleId(c.id)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                    >
                      Set one →
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-sm mb-1">How circles work</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-5">
          <li>Up to 6 students per circle — meant for a friend group or study pair, not a class.</li>
          <li>One shared challenge per day. Any member can set it.</li>
          <li>You see who&apos;s done it — that&apos;s the whole social layer. No chat, no posts.</li>
          <li>Leave anytime. Parents can review circles from the <Link href="/parent" className="text-primary-600 underline">Parent View</Link>.</li>
        </ul>
      </section>
    </div>
  );
}
