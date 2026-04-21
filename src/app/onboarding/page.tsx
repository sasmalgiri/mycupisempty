'use client';

/**
 * Onboarding — a gentle 5-step flow that seeds the profile AND sets an
 * intentional character goal for the year. Designed to take under 2 minutes
 * and leave the student feeling seen, not judged.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LegalDisclaimer from '@/components/LegalDisclaimer';

type Lang = 'en' | 'hi' | 'bn';

const SUBJECT_OPTIONS = [
  'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'Bengali', 'Social Science', 'History',
  'Geography', 'Civics', 'Economics', 'Computer Science',
];

interface CharacterGoalOption {
  id: string;
  label: string;
  icon: string;
  why: string;
}

const CHARACTER_GOALS: CharacterGoalOption[] = [
  { id: 'patience',          label: 'Patience',             icon: '🌱', why: 'Stay with hard things a little longer each time.' },
  { id: 'curiosity',         label: 'Curiosity',            icon: '🔍', why: 'Ask bigger questions without needing answers right away.' },
  { id: 'persistence',       label: 'Persistence',          icon: '🧗', why: 'Come back to the problem the next day — not just today.' },
  { id: 'honesty',           label: 'Honesty',              icon: '🪞', why: 'Name what you don\'t know. That\'s the start of knowing.' },
  { id: 'discipline',        label: 'Discipline',           icon: '📏', why: 'Small, same-time effort — the river that smooths the stone.' },
  { id: 'confidence',        label: 'Confidence',           icon: '💪', why: 'Speak your thinking before you\'re certain of it.' },
  { id: 'failure_handling',  label: 'Failure handling',     icon: '🔁', why: 'Every wrong answer is a map to a right one.' },
  { id: 'empathy',           label: 'Empathy',              icon: '🤝', why: 'Learn with people, not just beside them.' },
  { id: 'emotional_regulation', label: 'Emotional balance', icon: '🫁', why: 'Breathe. Stay. Then decide.' },
  { id: 'self_direction',    label: 'Self-direction',       icon: '🧭', why: 'Own your pace — not the one the crowd sets.' },
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [classLevel, setClassLevel] = useState<number>(8);
  const [boardCode, setBoardCode] = useState<string>('cbse');
  const [language, setLanguage] = useState<Lang>('en');
  const [easiestSubject, setEasiestSubject] = useState<string>('');
  const [toughestSubject, setToughestSubject] = useState<string>('');
  const [characterGoal, setCharacterGoal] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => setStep((s) => (s < 6 ? ((s + 1) as Step) : s));
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.slice(0, 100),
          classLevel,
          boardCode,
          language,
          easiestSubject,
          toughestSubject,
          characterGoal,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save');
      try { localStorage.setItem('mcie_locale', language); } catch {}
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-500/30">🧠</span>
            <span className="font-bold text-xl gradient-text">MyCupIsEmpty</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-10">
          {/* Progress */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Step {step} of 6</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span key={n} className={`w-8 h-1.5 rounded-full ${n <= step ? 'bg-primary-500' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>

          {step === 1 && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome.</h1>
              <p className="text-gray-600 mb-6">Your cup is empty — and that&apos;s exactly the right way to start. A few questions so we know who we\'re learning with. No quiz. No judgment.</p>
              <label className="text-sm font-medium block mb-2">What should we call you?</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name (or just a first name)"
                aria-label="Your name"
                className="w-full border border-gray-200 rounded-lg p-3 text-base mb-6"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={next}
                  disabled={!fullName.trim()}
                  aria-label="Next"
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                >Next →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold mb-4">Your class + board</h2>
              <p className="text-gray-600 mb-4 text-sm">We use your board only to align topics to what you\'re studying at school. <span className="font-semibold">We\'re not affiliated with any board</span>.</p>
              <label className="text-sm font-medium block mb-1">Class</label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value))}
                aria-label="Class level"
                className="w-full border border-gray-200 rounded-lg p-3 text-base mb-4"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <label className="text-sm font-medium block mb-1">Board</label>
              <select
                value={boardCode}
                onChange={(e) => setBoardCode(e.target.value)}
                aria-label="Board"
                className="w-full border border-gray-200 rounded-lg p-3 text-base mb-6"
              >
                <option value="cbse">CBSE</option>
                <option value="icse">ICSE / CISCE</option>
                <option value="wbbse">WBBSE (West Bengal)</option>
                <option value="ssc">SSC</option>
                <option value="state">Other state board</option>
                <option value="other">Other</option>
              </select>
              <div className="flex justify-between">
                <button type="button" onClick={back} className="px-4 py-2 text-gray-600 font-medium">← Back</button>
                <button type="button" onClick={next} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold">Next →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold mb-4">Preferred language</h2>
              <p className="text-gray-600 mb-4 text-sm">You can switch anytime. We\'ll match this for tutors and content where possible.</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { id: 'en', label: 'English', flag: '🇬🇧' },
                  { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
                  { id: 'bn', label: 'বাংলা', flag: '🇧🇩' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id as Lang)}
                    aria-label={l.label}
                    className={`p-4 rounded-xl border-2 transition ${language === l.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                  >
                    <div className="text-3xl mb-1">{l.flag}</div>
                    <div className="font-semibold">{l.label}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button type="button" onClick={back} className="px-4 py-2 text-gray-600 font-medium">← Back</button>
                <button type="button" onClick={next} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold">Next →</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl font-bold mb-2">Right now, which subject feels easy?</h2>
              <p className="text-gray-600 mb-4 text-sm">There\'s no wrong answer — and this will change as you grow. We\'re just asking today, not forever.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                {SUBJECT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEasiestSubject(s)}
                    aria-label={s}
                    className={`p-3 rounded-lg border text-sm transition ${easiestSubject === s ? 'border-primary-500 bg-primary-50 font-semibold' : 'border-gray-200 hover:border-primary-300'}`}
                  >{s}</button>
                ))}
              </div>
              <div className="flex justify-between">
                <button type="button" onClick={back} className="px-4 py-2 text-gray-600 font-medium">← Back</button>
                <button type="button" onClick={next} disabled={!easiestSubject} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold">Next →</button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-2xl font-bold mb-2">And which feels tougher?</h2>
              <p className="text-gray-600 mb-4 text-sm">The subject you pick here will get extra care from our tutors. Not every subject has to be a strength — some become strengths later.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                {SUBJECT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setToughestSubject(s)}
                    aria-label={s}
                    className={`p-3 rounded-lg border text-sm transition ${toughestSubject === s ? 'border-amber-500 bg-amber-50 font-semibold' : 'border-gray-200 hover:border-amber-300'}`}
                  >{s}</button>
                ))}
              </div>
              <div className="flex justify-between">
                <button type="button" onClick={back} className="px-4 py-2 text-gray-600 font-medium">← Back</button>
                <button type="button" onClick={next} disabled={!toughestSubject} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold">Next →</button>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="text-2xl font-bold mb-2">One character quality to grow this year</h2>
              <p className="text-gray-600 mb-4 text-sm">We track four kinds of growth: academic, cognitive, character, and life-readiness. Pick the ONE character quality you\'d most like to grow this year. We\'ll weave it quietly into every session.</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-6">
                {CHARACTER_GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setCharacterGoal(g.id)}
                    aria-label={g.label}
                    className={`p-4 rounded-xl border-2 text-left transition ${characterGoal === g.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{g.icon}</span>
                      <span className="font-semibold">{g.label}</span>
                    </div>
                    <p className="text-xs text-gray-600">{g.why}</p>
                  </button>
                ))}
              </div>

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex justify-between items-center">
                <button type="button" onClick={back} className="px-4 py-2 text-gray-600 font-medium">← Back</button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!characterGoal || submitting}
                  aria-label="Finish onboarding"
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-semibold"
                >{submitting ? 'Saving…' : 'Begin my journey →'}</button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4">
          <LegalDisclaimer compact />
        </div>
      </div>
    </div>
  );
}
