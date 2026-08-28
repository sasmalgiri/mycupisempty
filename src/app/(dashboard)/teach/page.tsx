'use client';

/**
 * Teach — the surface you run a real lesson from.
 *
 * Pick a chapter, and the Conversion Engine returns it broken into units, each
 * labelled with what KIND of knowledge it is and taught the way that kind of
 * knowledge actually goes in. Facts get a Lorayne image the student builds.
 * Procedures get fading worked examples. Concepts get contrast cases.
 *
 * Three things are deliberately visible that most apps hide:
 *   - the cue list ("why did you teach it this way")
 *   - what else was legal, and what was blocked
 *   - how little we actually know yet about this student
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, LoadingSpinner, EmptyState } from '@/components/ui/index';

// ---------------------------------------------------------------------------

interface Plan {
  unitId: string;
  topicId: string;
  heading: string;
  body: string;
  source: string;
  knowledgeType: string;
  typeLabel: string;
  representation: string;
  representationLabel: string;
  companionInstruction: string;
  studentPrompt: string;
  checkQuestion: string;
  retentionProbeDays: number;
  honest: string;
  rationale: string;
  exploring: boolean;
  evidence: string;
  observations: number;
  cues: string[];
  confidence: number;
  needsEnrichment: boolean;
  alsoLegal: string[];
}

interface ConversionResponse {
  subject: { id?: string; name: string; slug: string; classLevel: number };
  chapter: { id: string; title: string };
  mix: Array<{ type: string; label: string; share: number }>;
  unitCount: number;
  topicCount: number;
  generatedTopics: number;
  observations: number;
  warnings: string[];
  plans: Plan[];
}

const TYPE_STYLE: Record<string, { ring: string; text: string; icon: string }> = {
  arbitrary_fact:       { ring: 'border-amber-500/30 bg-amber-900/10',   text: 'text-amber-300',   icon: '🔑' },
  causal_sequence:      { ring: 'border-sky-500/30 bg-sky-900/10',       text: 'text-sky-300',     icon: '⛓️' },
  concept:              { ring: 'border-violet-500/30 bg-violet-900/10', text: 'text-violet-300',  icon: '💡' },
  procedure:            { ring: 'border-emerald-500/30 bg-emerald-900/10', text: 'text-emerald-300', icon: '🛠️' },
  relational_structure: { ring: 'border-cyan-500/30 bg-cyan-900/10',     text: 'text-cyan-300',    icon: '🗺️' },
  judgment:             { ring: 'border-rose-500/30 bg-rose-900/10',     text: 'text-rose-300',    icon: '⚖️' },
};

const EVIDENCE_STYLE: Record<string, { label: string; cls: string }> = {
  no_evidence: { label: 'No evidence yet', cls: 'bg-gray-700 text-gray-300' },
  weak:        { label: 'Too early to say', cls: 'bg-gray-700 text-gray-300' },
  emerging:    { label: 'Pattern forming', cls: 'bg-blue-900/50 text-blue-300' },
  established: { label: 'Backed by evidence', cls: 'bg-green-900/50 text-green-300' },
};

const VERDICT_STYLE: Record<string, { cls: string; icon: string; word: string }> = {
  comfortable:  { cls: 'border-green-500/30 bg-green-900/10',  icon: '✅', word: 'On track' },
  tight:        { cls: 'border-blue-500/30 bg-blue-900/10',    icon: '🟦', word: 'Fits, but no slack' },
  crunch:       { cls: 'border-amber-500/40 bg-amber-900/10',  icon: '⚠️', word: 'Not enough time for all of it' },
  not_possible: { cls: 'border-red-500/40 bg-red-900/10',      icon: '🛑', word: 'Full coverage is not possible' },
};

interface ExamPlanResponse {
  exam: { date: string | null; title: string | null };
  verdict: string;
  message: string;
  levers: string[];
  time: { weeksAvailable: number; requiredHours: number; reservedReviewHours: number; grossCapacityHours: number; feasibility: number };
  marks: { covered: number; atRisk: number };
  included: Array<{ chapterId: string; title: string; subject: string; hours: number; marksAtStake: number; currentMastery: number }>;
  dropped: Array<{ chapterId: string; title: string; reason?: string }>;
  confidence: { note: string; adherence: number; adherenceMeasured: boolean };
  howSheLearns: string[];
  stillLearning: string[];
}

// ---------------------------------------------------------------------------

export default function TeachPage() {
  const [classLevel, setClassLevel] = useState(10);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [chapterId, setChapterId] = useState('');

  const [data, setData] = useState<ConversionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [probes, setProbes] = useState<any[]>([]);
  const [plan, setPlan] = useState<ExamPlanResponse | null>(null);
  const [planError, setPlanError] = useState('');

  // The destination. Loaded once and shown above everything else, because
  // "which chapter next" is only answerable relative to the exam date.
  useEffect(() => {
    fetch('/api/exam-plan')
      .then((r) => r.json())
      .then((j) => (j.success ? setPlan(j) : setPlanError(j.error || '')))
      .catch(() => setPlanError('Could not load the exam plan'));
  }, []);

  // Triage status per chapter, so the picker can show what the plan thinks.
  const chapterStatus = React.useMemo(() => {
    const m = new Map<string, { kept: boolean; hours?: number; marks?: number; reason?: string }>();
    plan?.included.forEach((c) => m.set(c.chapterId, { kept: true, hours: c.hours, marks: c.marksAtStake }));
    plan?.dropped.forEach((c) => m.set(c.chapterId, { kept: false, reason: c.reason }));
    return m;
  }, [plan]);

  // Chapters ordered by what the plan says matters most, not by chapter number.
  const orderedChapters = React.useMemo(() => {
    if (!plan) return chapters;
    const rank = new Map(plan.included.map((c, i) => [c.chapterId, i]));
    return [...chapters].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : 9999;
      const rb = rank.has(b.id) ? rank.get(b.id)! : 9999;
      return ra - rb;
    });
  }, [chapters, plan]);

  // --- Load subjects for the class ---------------------------------------
  useEffect(() => {
    setSubjects([]); setSubjectId(''); setChapters([]); setChapterId(''); setData(null);
    fetch(`/api/curriculum?action=subjects&classLevel=${classLevel}`)
      .then((r) => r.json())
      .then((j) => setSubjects(j.subjects || []))
      .catch(() => setSubjects([]));
  }, [classLevel]);

  // --- Load chapters for the subject -------------------------------------
  useEffect(() => {
    if (!subjectId) return;
    setChapters([]); setChapterId(''); setData(null);
    fetch(`/api/curriculum?action=chapters&subjectClassId=${subjectId}`)
      .then((r) => r.json())
      .then((j) => setChapters(j.chapters || []))
      .catch(() => setChapters([]));
  }, [subjectId]);

  // --- Pending retention probes ------------------------------------------
  const loadProbes = useCallback(() => {
    fetch('/api/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'due_probes', limit: 5 }),
    })
      .then((r) => r.json())
      .then((j) => setProbes(j.probes || []))
      .catch(() => setProbes([]));
  }, []);

  useEffect(() => { loadProbes(); }, [loadProbes]);

  // --- Build the lesson ---------------------------------------------------
  const buildLesson = async () => {
    if (!chapterId) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res = await fetch(`/api/conversion?chapterId=${chapterId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to build the lesson');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🎓 Teach</h1>
        <p className="text-gray-400">
          Pick a chapter. Each part gets taught the way that <em>kind</em> of knowledge
          actually goes in — facts, procedures and ideas are not the same job.
        </p>
      </div>

      {/* The destination — everything below is "given this deadline" */}
      {plan && <PlanBanner plan={plan} />}
      {planError && !plan && (
        <Card className="p-3 mb-6 border-gray-700">
          <p className="text-xs text-gray-500">
            No exam plan yet — {planError}. You can still teach; the plan appears once an exam date and syllabus are set.
          </p>
        </Card>
      )}

      {/* Pending probes — the loop that makes the system learn */}
      {probes.length > 0 && (
        <Card className="p-4 mb-6 border-amber-500/30 bg-amber-900/10">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">
            ⏰ {probes.length} retention check{probes.length === 1 ? '' : 's'} due
          </h3>
          <p className="text-xs text-amber-200/70 mb-3">
            These decide what the system actually believes. Until they are answered,
            everything stays a guess.
          </p>
          <div className="space-y-2">
            {probes.map((p) => (
              <ProbeRow key={p.outcome_id} probe={p} onDone={loadProbes} />
            ))}
          </div>
        </Card>
      )}

      {/* Pickers */}
      <Card className="p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="block text-gray-400 mb-1">Class</span>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-gray-400 mb-1">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={subjects.length === 0}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-40"
            >
              <option value="">{subjects.length ? 'Choose…' : 'None for this class'}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-gray-400 mb-1">Chapter</span>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={chapters.length === 0}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-40"
            >
              <option value="">{chapters.length ? 'Choose…' : '—'}</option>
              {orderedChapters.map((c) => {
                const st = chapterStatus.get(c.id);
                const tag = !st ? '' : st.kept
                  ? `  · ${st.hours}h${st.marks ? `, ${st.marks} marks` : ''}`
                  : '  · set aside by the plan';
                return (
                  <option key={c.id} value={c.id}>
                    {c.chapter_no}. {c.title_en}{tag}
                  </option>
                );
              })}
            </select>
            {plan && (
              <span className="block mt-1 text-[10px] text-gray-500">
                Ordered by what the plan says matters most, not chapter number.
              </span>
            )}
          </label>
        </div>

        {chapterId && chapterStatus.get(chapterId)?.kept === false && (
          <p className="mt-3 text-xs text-amber-300/90">
            ⚠️ The plan set this chapter aside — {chapterStatus.get(chapterId)?.reason}. Teaching it anyway is
            fine, but it comes out of the time budgeted for the chapters above.
          </p>
        )}

        <Button onClick={buildLesson} disabled={!chapterId || loading} className="mt-4">
          {loading ? 'Building…' : 'Build the lesson'}
        </Button>
      </Card>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-400">
            Writing the teaching text, then classifying each part…
          </p>
        </div>
      )}

      {error && (
        <Card className="p-4 border-red-500/30 bg-red-900/10">
          <p className="text-red-300 text-sm">{error}</p>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Mix — one chapter, several kinds of knowledge */}
          <Card className="p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">{data.chapter.title}</h2>
            <p className="text-xs text-gray-500 mb-3">
              {data.topicCount} topics → {data.unitCount} units · {data.subject.name} · Class {data.subject.classLevel}
            </p>

            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {data.mix.map((m) => (
                <div
                  key={m.type}
                  style={{ width: `${m.share}%` }}
                  className={(TYPE_STYLE[m.type]?.ring || 'bg-gray-600').replace(/border-\S+/, '').replace('/10', '/60')}
                  title={`${m.label} ${m.share}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.mix.map((m) => (
                <span key={m.type} className={`text-xs ${TYPE_STYLE[m.type]?.text || 'text-gray-400'}`}>
                  {TYPE_STYLE[m.type]?.icon} {m.label} {m.share}%
                </span>
              ))}
            </div>

            {data.warnings.length > 0 && (
              <div className="mt-3 text-xs text-amber-300/80 space-y-1">
                {data.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            {data.plans.map((p, i) => (
              <UnitCard
                key={p.unitId}
                plan={p}
                index={i + 1}
                subject={data.subject}
                chapterId={data.chapter.id}
                onRecorded={loadProbes}
              />
            ))}
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <EmptyState
          icon="📘"
          title="No lesson built yet"
          description="Choose a class, subject and chapter above."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The plan banner.
 *
 * Deliberately leads with the verdict rather than a progress bar. A student
 * eight weeks out needs to know whether the current hours are enough — and if
 * they are not, which chapters are being given up and what that costs. Every
 * competitor shows encouraging percentages here; the useful thing is the
 * number of marks being left on the table while there is still time to change
 * the decision.
 */
function PlanBanner({ plan }: { plan: ExamPlanResponse }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT_STYLE[plan.verdict] || VERDICT_STYLE.tight;
  const behind = plan.verdict === 'crunch' || plan.verdict === 'not_possible';

  return (
    <Card className={`p-4 mb-6 border ${v.cls}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{v.icon}</span>
            <h2 className="text-white font-semibold">{v.word}</h2>
            {plan.exam.date && (
              <span className="text-xs text-gray-400">
                · {plan.exam.title || 'Exam'} {plan.exam.date} · {Math.round(plan.time.weeksAvailable)} weeks left
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">{plan.message}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-white">{plan.marks.covered}%</div>
          <div className="text-[10px] text-gray-400">of marks covered</div>
          {plan.marks.atRisk > 0 && (
            <div className="text-[10px] text-amber-400 mt-0.5">{plan.marks.atRisk}% at risk</div>
          )}
        </div>
      </div>

      {/* The numbers that decide the verdict */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Stat label="Needed" value={`${plan.time.requiredHours}h`} />
        <Stat label="Available" value={`${plan.time.grossCapacityHours}h`} />
        <Stat label="Of that, review" value={`${plan.time.reservedReviewHours}h`} />
        <Stat label="Adherence" value={`${plan.confidence.adherence}%`}
          hint={plan.confidence.adherenceMeasured ? 'measured' : 'assumed'} />
      </div>

      {behind && plan.levers.length > 0 && (
        <div className="mt-3 space-y-1">
          {plan.levers.slice(0, 2).map((l, i) => (
            <p key={i} className="text-xs text-gray-300">→ {l}</p>
          ))}
        </div>
      )}

      <button onClick={() => setOpen(!open)} className="mt-3 text-[11px] text-gray-500 hover:text-gray-300">
        {open ? '▾' : '▸'} what this plan assumes
      </button>
      {open && (
        <div className="mt-2 text-[11px] text-gray-500 space-y-2 border-l border-gray-700 pl-3">
          <p>{plan.confidence.note}</p>

          {plan.dropped.length > 0 && (
            <div>
              <p className="text-gray-400 mb-0.5">Set aside ({plan.dropped.length}):</p>
              {plan.dropped.slice(0, 6).map((d) => (
                <p key={d.chapterId}>· {d.title} — {d.reason}</p>
              ))}
            </div>
          )}

          {plan.howSheLearns.length > 0 && (
            <div>
              <p className="text-gray-400 mb-0.5">What we have learned about how she learns:</p>
              {plan.howSheLearns.map((s, i) => <p key={i}>· {s}</p>)}
            </div>
          )}
          {plan.stillLearning.length > 0 && (
            <p className="text-gray-600">
              Still watching, not enough evidence to say: {plan.stillLearning.slice(0, 4).join('; ')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg px-3 py-2">
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] text-gray-500">{label}{hint ? ` (${hint})` : ''}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProbeRow({ probe, onDone }: { probe: any; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const answer = async (score: number) => {
    setBusy(true);
    await fetch('/api/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_probe', outcomeId: probe.outcome_id, retentionScore: score }),
    });
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-900/50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-300 flex-1">
        {probe.question || 'Can they still do this one, unaided?'}
      </p>
      <div className="flex gap-1">
        <button onClick={() => answer(1)} disabled={busy}
          className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-300 hover:bg-green-900 disabled:opacity-40">Got it</button>
        <button onClick={() => answer(0.5)} disabled={busy}
          className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900 disabled:opacity-40">Partly</button>
        <button onClick={() => answer(0)} disabled={busy}
          className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300 hover:bg-red-900 disabled:opacity-40">Gone</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UnitCard({
  plan, index, subject, chapterId, onRecorded,
}: {
  plan: Plan; index: number; subject: any; chapterId: string; onRecorded: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [builtOwn, setBuiltOwn] = useState(true);
  const [startedAt] = useState(() => Date.now());

  const style = TYPE_STYLE[plan.knowledgeType] || { ring: 'border-gray-700', text: 'text-gray-300', icon: '📄' };
  const ev = EVIDENCE_STYLE[plan.evidence] || EVIDENCE_STYLE.no_evidence;

  const record = async (immediateScore: number) => {
    setBusy(true);
    await fetch('/api/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: plan.unitId,
        knowledgeType: plan.knowledgeType,
        representation: plan.representation,
        constructedOwn: builtOwn,
        immediateScore,
        engagementScore: 0.7,
        completed: true,
        timeSpentSeconds: Math.round((Date.now() - startedAt) / 1000),
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: plan.topicId,
        chapterId,
        retentionProbeDays: plan.retentionProbeDays,
      }),
    });
    setBusy(false);
    setRecorded(true);
    onRecorded();
  };

  return (
    <Card className={`p-5 border ${style.ring}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-gray-500">#{index}</span>
            <span className={`text-xs font-semibold ${style.text}`}>
              {style.icon} {plan.typeLabel}
            </span>
            <span className="text-gray-600">→</span>
            <Badge variant="default">{plan.representationLabel}</Badge>
            {plan.exploring && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">
                trying this one
              </span>
            )}
          </div>
          <h3 className="text-white font-medium truncate">{plan.heading}</h3>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded whitespace-nowrap ${ev.cls}`}>{ev.label}</span>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed mb-4">{plan.body}</p>

      {/* What you actually say */}
      <div className="rounded-lg bg-gray-900/60 border border-gray-700 p-3 mb-3">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Ask the student</p>
        <p className="text-sm text-white">{plan.studentPrompt}</p>
      </div>

      <div className="rounded-lg bg-gray-900/40 p-3 mb-3">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Your job while they answer</p>
        <p className="text-xs text-gray-400">{plan.companionInstruction}</p>
      </div>

      <div className="rounded-lg bg-gray-900/40 p-3 mb-4">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
          Check · re-check in {plan.retentionProbeDays} days
        </p>
        <p className="text-sm text-gray-200">{plan.checkQuestion}</p>
      </div>

      {/* Record the outcome */}
      {recorded ? (
        <p className="text-xs text-green-400">
          ✓ Recorded. We will ask again in {plan.retentionProbeDays} days — that answer is what counts.
        </p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mr-2">
            <input type="checkbox" checked={builtOwn} onChange={(e) => setBuiltOwn(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600" />
            they built it themselves
          </label>
          <button onClick={() => record(1)} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-900/50 text-green-300 hover:bg-green-900 disabled:opacity-40">
            Got it
          </button>
          <button onClick={() => record(0.5)} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900 disabled:opacity-40">
            Shaky
          </button>
          <button onClick={() => record(0)} disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 disabled:opacity-40">
            Lost them
          </button>
        </div>
      )}

      {/* Audit trail */}
      <button onClick={() => setShowWhy(!showWhy)}
        className="mt-3 text-[11px] text-gray-500 hover:text-gray-300">
        {showWhy ? '▾' : '▸'} why this way?
      </button>
      {showWhy && (
        <div className="mt-2 text-[11px] text-gray-500 space-y-1.5 border-l border-gray-700 pl-3">
          <p><span className="text-gray-400">Signals read:</span> {plan.cues.join('; ') || 'none'}</p>
          <p><span className="text-gray-400">Confidence:</span> {(plan.confidence * 100).toFixed(0)}%
            {plan.needsEnrichment && ' — too little text; classified from the subject alone'}</p>
          <p><span className="text-gray-400">Also allowed:</span> {plan.alsoLegal.join(', ') || '—'}</p>
          <p><span className="text-gray-400">Choice:</span> {plan.rationale}</p>
          <p className="text-gray-400">{plan.honest}</p>
          {plan.source === 'fallback' && (
            <p className="text-amber-500/80">Text from syllabus only — no GEMINI_API_KEY set.</p>
          )}
        </div>
      )}
    </Card>
  );
}
