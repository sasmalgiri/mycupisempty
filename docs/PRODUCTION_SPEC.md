# MyCupIsEmpty — Production Specification Document
## Whole-Student Development OS

**Version**: 1.0 (Frozen)
**Date**: 2026-03-16
**Status**: LOCKED — No theory changes. Build from this spec.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Final Module Map](#3-final-module-map)
4. [Database Schema](#4-database-schema)
5. [Learner State Model](#5-learner-state-model)
6. [Scoring Formulas](#6-scoring-formulas)
7. [Trigger Thresholds](#7-trigger-thresholds)
8. [Decision Engine](#8-decision-engine)
9. [Safety & Ethics Boundaries](#9-safety--ethics-boundaries)
10. [MVP Feature List (Phase A)](#10-mvp-feature-list-phase-a)
11. [Build Roadmap](#11-build-roadmap)
12. [API Contract Summary](#12-api-contract-summary)

---

## 1. Product Overview

**Mission**: Help every student become the best version of themselves — not just academically, but as a whole human being.

**Product Type**: Whole-Student Development OS

**4 Pillars**:
| Pillar | Focus | Dimensions |
|--------|-------|------------|
| Academic | Subject mastery via 8-module pedagogy engine | Mastery score (7 components) |
| Cognitive | How the student thinks | 8 dimensions |
| Character & Emotional | Who the student is becoming | 10 dimensions |
| Life Readiness | How prepared for the real world | 8 dimensions |

**5 Domains**: Learn, Think, Grow, Live, Path

**User Roles**: Student, Teacher, Parent

---

## 2. Architecture & Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 (App Router) + React 18 + Tailwind CSS | Student/Teacher/Parent dashboards |
| Backend | Next.js API Routes | All business logic |
| Database | Supabase (PostgreSQL) | Data + Auth + RLS |
| Auth | Supabase Auth | Email/password, role-based |
| AI | Ollama (self-hosted) | AI Guru, content generation |
| Hosting | Vercel | Frontend + API deployment |
| VCS | GitHub | Source control |
| State | Zustand | Client-side state |
| Charts | Recharts | Data visualization |
| Animation | Framer Motion | UI transitions |

**Key Dependencies**:
- `next` ^16.1.1, `react` ^18.3.1
- `@supabase/supabase-js` ^2.45.0, `@supabase/ssr` ^0.8.0
- `ai` ^3.4.0 (Vercel AI SDK)
- `zustand` ^5.0.0, `recharts` ^2.13.0, `framer-motion` ^11.5.0
- Node.js >=18.0.0

---

## 3. Final Module Map

### Layer A — Academic Pedagogy Engine (8 Modules)

| # | Module | Code | What It Does |
|---|--------|------|-------------|
| 1 | Access & Fit | `access_fit` | Captures VARK style, language, pace, chunk size preferences |
| 2 | Diagnostic Assessment | `diagnostic` | Prior knowledge check, prerequisite gaps, misconception probes |
| 3 | Teach & Scaffold | `teach_scaffold` | 5-level scaffolding: full worked → faded → guided → independent → assessment |
| 4 | Retrieve & Retain | `retrieve_retain` | SM-2 spaced repetition with 6 retrieval types |
| 5 | Feedback & Repair | `feedback_repair` | Corrective/explanatory/contrastive feedback + misconception resolution |
| 6 | Metacognition | `metacognition` | Confidence calibration, self-regulation (planning/monitoring/evaluation) |
| 7 | Mastery Check | `mastery_check` | 7-component mastery scoring with band classification |
| 8 | Tiered Support | `tiered_support` | MTSS Tier 1/2/3 escalation based on stalled cycles |

### Layer B — Cognitive Development (8 Dimensions)

| Code | Dimension | Tracked Via |
|------|-----------|------------|
| `focus` | Sustained attention | Session completion, distraction signals |
| `memory_habits` | Study memory techniques | Retrieval success, spaced rep adherence |
| `reasoning` | Logical/analytical thinking | Problem-solving accuracy, transfer tasks |
| `problem_solving` | Applied problem solving | Challenge completion, scenario responses |
| `reflection` | Self-awareness in learning | Reflection entries, metacognition scores |
| `decision_making` | Choice quality | Scenario assessments |
| `self_learning` | Independent learning | Scaffold independence level, hint usage |
| `curiosity` | Exploration drive | Topics explored, questions asked |

### Layer C — Character & Emotional (10 Dimensions)

| Code | Dimension |
|------|-----------|
| `discipline` | Self-control, following through |
| `patience` | Tolerating difficulty |
| `honesty` | Academic integrity, truthfulness |
| `empathy` | Understanding others' perspectives |
| `responsibility` | Owning actions and commitments |
| `consistency` | Regular effort over time |
| `failure_handling` | Resilience after setbacks |
| `confidence` | Healthy self-belief |
| `emotional_regulation` | Managing frustration, anxiety |
| `social_conduct` | Respectful interaction |

### Layer D — Life Readiness (8 Dimensions)

| Code | Dimension |
|------|-----------|
| `communication` | Clear expression |
| `financial_awareness` | Basic money understanding |
| `digital_safety` | Online safety awareness |
| `time_management` | Planning and prioritizing |
| `real_world_problem_solving` | Practical problem solving |
| `career_awareness` | Understanding career paths |
| `teamwork` | Collaborative skills |
| `practical_skills` | Hands-on capability |

### 10 Archetype Patterns (Not Labels)

| Pattern | Name | Growth Focus |
|---------|------|-------------|
| `high_curiosity_low_discipline` | Curious Explorer | discipline, consistency, time_management |
| `strong_memory_weak_confidence` | Quiet Knower | confidence, failure_handling, communication |
| `good_understanding_poor_consistency` | Bright Sprinter | consistency, discipline, patience |
| `emotionally_unstable_during_tests` | Sensitive Performer | emotional_regulation, confidence, patience |
| `good_practical_weak_textbook` | Hands-On Thinker | self_learning, reasoning, memory_habits |
| `creative_learner_weak_structure` | Creative Mind | discipline, time_management, consistency |
| `socially_strong_academically_weak` | Social Leader | focus, self_learning, memory_habits |
| `all_round_steady` | Steady Builder | balanced (no weak areas) |
| `high_achiever_low_empathy` | Focused Achiever | empathy, social_conduct, teamwork |
| `resilient_slow_learner` | Determined Climber | memory_habits, reasoning, self_learning |

---

## 4. Database Schema

### Migrations Overview (9 total)

| Migration | Tables | Purpose |
|-----------|--------|---------|
| 001 | profiles, subjects, topics, questions, user_progress, question_attempts, user_answers | Core schema |
| 002 | classrooms, classroom_enrollments, assignments, assignment_submissions | Teacher management |
| 003 | — | Security fixes (RLS) |
| 004 | flashcards, study_sessions, xp_transactions, achievements, user_achievements | Gamification |
| 005 | board_configs, board_subject_mapping, exam_configs, exam_topic_mapping | Multi-board exam |
| 006 | learning_styles, learning_teams, team_members, chat_messages | VARK + teams |
| 007 | learner_state, module_events, diagnostic_items/responses, scaffold_steps, retrieval_queue, misconception_bank, student_misconceptions, mastery_checkpoints, tier_assignments, engine_decisions | Pedagogy engine |
| 008 | student_development_profile, development_dimensions, habit_definitions, habit_tracking, student_habits, reflection_entries, scenario_bank, scenario_responses, student_goals, strength_assessments, student_interests, development_events, mentor_feedback, parent_student_link, development_badges, student_badges | Whole-student development |
| 009 | outcome_snapshots, safety_config, feature_flags | Outcomes + safety + MVP flags |

### Key Table Details

#### `learner_state` (Migration 007)
Central per-topic learner profile driving the pedagogy engine.

```
id, user_id, subject_id, topic_id
current_module (pedagogy module enum)
preferred_format, language_level, pacing, chunk_size
readiness_level, prior_knowledge_score, prerequisite_gaps[]
scaffold_level (0-5), consecutive_correct, consecutive_wrong
mastery_recall, mastery_comprehension, mastery_application,
mastery_transfer, mastery_retention, mastery_metacognition, mastery_independence
mastery_total (GENERATED: weighted sum / 100, clamped 0-100)
mastery_band (GENERATED: foundation/emerging/developing/secure/advanced)
confidence_score, accuracy_score
hint_usage_count, total_attempts
stalled_cycles, frustration_signals, fallback_loops
support_tier (1-3), tier_assigned_by
engagement_session_count, total_time_minutes, last_active_at
```

#### `student_development_profile` (Migration 008)
Central profile for non-academic development.

```
id, user_id
-- 8 Cognitive dimensions (NUMERIC 5,2 each, default 50)
focus, memory_habits, reasoning, problem_solving,
reflection, decision_making, self_learning, curiosity
-- GENERATED: cognitive_composite = avg of 8

-- 10 Character dimensions (NUMERIC 5,2 each, default 50)
discipline, patience, honesty, empathy, responsibility,
consistency, failure_handling, confidence, emotional_regulation, social_conduct
-- GENERATED: character_composite = avg of 10

-- 8 Life Readiness dimensions (NUMERIC 5,2 each, default 50)
communication, financial_awareness, digital_safety, time_management,
real_world_problem_solving, career_awareness, teamwork, practical_skills
-- GENERATED: life_readiness_composite = avg of 8

archetype_tags TEXT[] DEFAULT '{}'
strengths TEXT[] DEFAULT '{}'
growth_areas TEXT[] DEFAULT '{}'
```

#### `outcome_snapshots` (Migration 009)
Periodic measurement snapshots (weekly/monthly/topic_end/etc).

```
Academic: mastery_total, comprehension_gain, retention_after_delay,
          error_reduction_pct, time_to_mastery_minutes,
          topics_mastered_count, topics_attempted_count
Engagement: sessions_count, total_time_minutes, streak_days,
            session_completion_rate, engagement_consistency
Cognitive: confidence_calibration, self_regulation_score,
           hint_dependence_rate, scaffold_level_at_end
Development: cognitive_composite, character_composite,
             life_readiness_composite, habits_completed_count,
             reflections_count, goals_completed_count
Support: support_tier, misconception_count, misconceptions_resolved
```

#### `safety_config` (Migration 009)
7 locked core rules + 5 configurable school/parent settings.

#### `feature_flags` (Migration 009)
34 flags across Phase A (13 enabled), Phase B (9), Phase C (8), Future (4).

---

## 5. Learner State Model

The system maintains two state models per student:

### Academic State (`learner_state` — per topic)
```json
{
  "current_module": "teach_scaffold",
  "preferences": {
    "format": "visual",
    "language": "standard",
    "pacing": "normal",
    "chunk_size": "medium"
  },
  "diagnostic": {
    "readiness": "ready",
    "prior_knowledge": 65,
    "prerequisite_gaps": ["fractions"],
    "misconceptions_detected": 1
  },
  "scaffold": {
    "level": 3,
    "consecutive_correct": 2,
    "consecutive_wrong": 0
  },
  "mastery": {
    "recall": 72,
    "comprehension": 68,
    "application": 55,
    "transfer": 40,
    "retention": 80,
    "metacognition": 65,
    "independence": 70,
    "total": 64.25,
    "band": "developing"
  },
  "metacognition": {
    "confidence": 75,
    "accuracy": 68,
    "calibration_gap": 7
  },
  "support": {
    "tier": 1,
    "stalled_cycles": 0,
    "frustration_signals": 0,
    "fallback_loops": 0
  },
  "engagement": {
    "sessions": 12,
    "total_minutes": 145,
    "hint_usage": 8,
    "total_attempts": 45
  }
}
```

### Development State (`student_development_profile` — per student)
```json
{
  "cognitive": {
    "focus": 62, "memory_habits": 55, "reasoning": 70,
    "problem_solving": 65, "reflection": 58, "decision_making": 60,
    "self_learning": 48, "curiosity": 75,
    "composite": 61.63
  },
  "character": {
    "discipline": 45, "patience": 50, "honesty": 70, "empathy": 65,
    "responsibility": 55, "consistency": 40, "failure_handling": 50,
    "confidence": 55, "emotional_regulation": 48, "social_conduct": 68,
    "composite": 54.60
  },
  "life_readiness": {
    "communication": 60, "financial_awareness": 35, "digital_safety": 70,
    "time_management": 45, "real_world_problem_solving": 55,
    "career_awareness": 30, "teamwork": 65, "practical_skills": 50,
    "composite": 51.25
  },
  "archetypes": ["high_curiosity_low_discipline"],
  "strengths": ["curiosity", "reasoning", "honesty"],
  "growth_areas": ["consistency", "discipline", "financial_awareness"]
}
```

---

## 6. Scoring Formulas

### 6.1 Mastery Score (7-Component)

```
mastery_total = (
    recall × 0.20 +
    comprehension × 0.20 +
    application × 0.20 +
    transfer × 0.15 +
    retention × 0.10 +
    metacognition × 0.10 +
    independence × 0.05
)
```
Each component: 0–100. Total clamped to 0–100.

**Mastery Bands**:
| Band | Range | Meaning |
|------|-------|---------|
| Foundation | 0–39 | Significant gaps |
| Emerging | 40–59 | Basic understanding |
| Developing | 60–74 | Growing competence |
| Secure | 75–89 | Strong mastery |
| Advanced | 90–100 | Expert level |

**Minimum Component Rule**: Each component must be ≥ 50% of max for its weight to count. If any component is below minimum, it flags as weak.

### 6.2 SM-2 Spaced Repetition

```
EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
EF_min = 1.3

Quality mapping: 0-2 = forgotten, 3 = hard, 4 = good, 5 = perfect

Interval:
  rep 1 → 1 day
  rep 2 → 6 days
  rep 3+ → previous_interval × EF'
  If q < 3 → reset to rep 1, interval 1
```

### 6.3 Confidence Calibration

```
gap = |confidence_before - actual_score|
calibration = max(0, 100 - gap × 2)

Nudge thresholds:
  gap > 30 → "Your confidence was quite different from your score"
  gap > 15 → "Try to estimate more carefully next time"
  gap ≤ 15 → "Your self-assessment is well calibrated!"
```

### 6.4 Self-Regulation Score

```
self_regulation = (planning_used + monitoring_used + evaluation_used) / 3 × 100
Each component: boolean → 0 or 1
```

### 6.5 Retrieval Strength

```
For each item: accuracy = correct / (correct + wrong)
Average across all items:
  retrieval_strength = (avg_accuracy × 0.7 + avg_ef_weight × 0.3) × 100
Where ef_weight = (ease_factor - 1.3) / (2.5 - 1.3) clamped to 0-1
```

### 6.6 Hint Dependence

```
hint_dependence = (attempts_with_hint / total_attempts) × 100
```

### 6.7 Habit Score Impact (Development)

```
quality_multiplier = {1: 0.5, 2: 0.75, 3: 1.0, 4: 1.25, 5: 1.5}
streak_bonus = min(streak_days × 0.02, 0.3)
ceiling = max(0, 100 - current_score) / 100  // diminishing returns
impact = (0.5 × quality_multiplier + streak_bonus) × ceiling
new_score = current_score + impact
```

### 6.8 Dimension Score Update (Weighted Moving Average)

```
new_score = current_score × (1 - weight) + new_signal × weight
Default weight = 0.15
```

### 6.9 Domain Affinity Mapping

8 career domains computed from 26 dimension scores:

| Domain | Formula (dimension × weight) |
|--------|------------------------------|
| Science & Tech | reasoning(0.3) + problem_solving(0.3) + curiosity(0.2) + focus(0.2) |
| Arts & Creativity | curiosity(0.3) + emotional_regulation(0.2) + reflection(0.2) + confidence(0.15) + patience(0.15) |
| People & Social | empathy(0.3) + communication(0.25) + social_conduct(0.25) + patience(0.2) |
| Business & Organizing | decision_making(0.25) + time_management(0.25) + financial_awareness(0.2) + responsibility(0.15) + communication(0.15) |
| Building & Making | practical_skills(0.3) + problem_solving(0.25) + real_world_problem_solving(0.25) + patience(0.2) |
| Nature & Outdoor | curiosity(0.3) + practical_skills(0.25) + patience(0.2) + real_world_problem_solving(0.25) |
| Leadership | decision_making(0.25) + communication(0.25) + responsibility(0.2) + confidence(0.15) + social_conduct(0.15) |
| Sports & Physical | discipline(0.3) + consistency(0.25) + failure_handling(0.2) + confidence(0.15) + teamwork(0.1) |

### 6.10 Pillar Composites (GENERATED columns)

```
cognitive_composite = AVG(focus, memory_habits, reasoning, problem_solving,
                         reflection, decision_making, self_learning, curiosity)
character_composite = AVG(discipline, patience, honesty, empathy, responsibility,
                         consistency, failure_handling, confidence,
                         emotional_regulation, social_conduct)
life_readiness_composite = AVG(communication, financial_awareness, digital_safety,
                               time_management, real_world_problem_solving,
                               career_awareness, teamwork, practical_skills)
overall_development = (cognitive + character + life_readiness) / 3
```

---

## 7. Trigger Thresholds

### Academic Engine Thresholds

| Threshold | Value | What It Controls |
|-----------|-------|-----------------|
| `diagnostic_pass_score` | 70 | Score needed to skip scaffolding |
| `misconception_count_threshold` | 2 | Misconceptions before flagging |
| `scaffold_promote_consecutive_correct` | 3 | Correct answers to reduce scaffold level |
| `scaffold_demote_consecutive_wrong` | 2 | Wrong answers to increase scaffold level |
| `hint_dependence_max` | 30% | Max hint usage before intervention |
| `retrieval_strength_min` | 60 | Minimum retrieval strength to not trigger review |
| `retrieval_success_rate_promote` | 80% | Success rate to promote retrieval difficulty |
| `misconception_occurrences_escalate` | 3 | Same misconception repeats before escalation |
| `repair_attempts_max` | 5 | Max repair attempts before tier bump |
| `confidence_accuracy_gap_threshold` | 20 | Gap that triggers metacognition nudge |
| `careless_error_rate_threshold` | 15% | Careless error rate triggering awareness |
| `mastery_promote_min` | 75 | Mastery score for band promotion |
| `mastery_each_component_min_pct` | 50% | Each component minimum for valid mastery |
| `delayed_check_days` | 7 | Days between retention checks |
| `stalled_cycles_tier2` | 3 | Stalled cycles to escalate to Tier 2 |
| `stalled_cycles_tier3` | 6 | Stalled cycles to escalate to Tier 3 |
| `frustration_signals_escalate` | 5 | Frustration signals triggering support |
| `fallback_loop_max` | 3 | Max fallback loops before tier escalation |

### Scaffold Levels

| Level | Type | Description |
|-------|------|-------------|
| 5 | Full Worked Example | Complete solution shown step by step |
| 4 | Faded Example | Some steps removed, student fills gaps |
| 3 | Guided Practice | Hints available, student attempts full solution |
| 2 | Independent Practice | No hints, full solution required |
| 1 | Assessment | Test conditions |
| 0 | Mastered | No scaffolding needed |

### MTSS Tier Rules

| Tier | Trigger | Support Level |
|------|---------|--------------|
| Tier 1 | Default | Universal instruction |
| Tier 2 | stalled_cycles ≥ 3 OR frustration_signals ≥ 5 | Targeted small-group support |
| Tier 3 | stalled_cycles ≥ 6 OR fallback_loops ≥ 3 | Intensive 1:1 intervention |

### Concern Flag Triggers (Development)

| Concern | Trigger Condition |
|---------|------------------|
| Emotional regulation | `emotional_regulation < 25` |
| Confidence crisis | `confidence < 20` |
| Discipline issues | `discipline < 20 AND consistency < 20` |
| Focus concerns | `focus < 20` |
| Resilience risk | `failure_handling < 20` |
| Social conduct | `social_conduct < 20` |

---

## 8. Decision Engine

### Priority-Ordered Routing

The engine evaluates conditions in strict priority order. First match wins.

```
1. TIER ESCALATION
   IF stalled_cycles ≥ tier3_threshold OR fallback_loops ≥ max
   → Route to tiered_support, assign Tier 3

   IF stalled_cycles ≥ tier2_threshold OR frustration ≥ escalation_threshold
   → Route to tiered_support, assign Tier 2

2. MISCONCEPTION REPAIR
   IF active_misconceptions > misconception_threshold
   → Route to feedback_repair

3. METACOGNITION NUDGE
   IF confidence-accuracy gap > gap_threshold
   → Route to metacognition

4. RETRIEVAL REVIEW
   IF items_due > 0 AND retrieval_strength < minimum
   → Route to retrieve_retain

5. NORMAL FLOW (by mastery band)
   Foundation (< 40) → diagnostic (reassess)
   Emerging (40-59) → teach_scaffold (level 4-5)
   Developing (60-74) → teach_scaffold (level 2-3)
   Secure (75-89) → retrieve_retain (maintenance)
   Advanced (90+) → mastery_check (promotion gate)
```

### Module Outcome Transitions

| From | Outcome | Next Module |
|------|---------|-------------|
| diagnostic | pass (≥70) | teach_scaffold |
| diagnostic | fail (<70) | teach_scaffold (higher level) |
| teach_scaffold | promoted | retrieve_retain |
| teach_scaffold | stayed | teach_scaffold (same level) |
| teach_scaffold | fallback | teach_scaffold (higher level) |
| retrieve_retain | strong (≥80%) | mastery_check |
| retrieve_retain | weak (<60%) | teach_scaffold |
| mastery_check | passed (≥75) | next topic |
| mastery_check | failed | teach_scaffold |
| feedback_repair | resolved | previous module |
| feedback_repair | escalated | tiered_support |

---

## 9. Safety & Ethics Boundaries

### Locked Core Rules (Cannot Be Overridden)

| Rule | Policy |
|------|--------|
| **No Mental Health Diagnosis** | System detects patterns but NEVER diagnoses. Concern flags trigger human review only. |
| **No Ideology Shaping** | No political, religious, or ideological content. Character = universal values (self-management, respect, accountability, kindness, persistence, practical wisdom). |
| **No Moral Policing** | System does not judge moral choices. Scenarios present options and explain tradeoffs, never declare right/wrong on values. |
| **No Permanent Labels** | Archetype tags are patterns, not labels. They change as student grows. Never shown as fixed identity. Never used for sorting/ranking. |
| **Age-Appropriate Only** | All content respects developmental stage. Min tracking age: 5. Emotion tracking: 8+. Career awareness: 12+. |
| **Data Minimization** | Collect only what's needed for learning. No surveillance. No tracking outside sessions. No location data. |
| **Student Data Ownership** | Students can see all data collected. Students can request deletion. Reflections private by default. |

### Configurable Rules (School/Parent Can Adjust)

| Setting | Default |
|---------|---------|
| Parent can see reflections | `false` (opt-in) |
| Parent can see emotions | `false` (opt-in) |
| Parent can see academic | `true` |
| Parent can see character | `true` |
| Parent can see life readiness | `true` |
| Teacher can see shared reflections | `true` |
| Teacher can see habit tracking | `true` |
| Teacher can see concern flags | `true` |
| Teacher can see archetype tags | `false` |
| Character tracking | `enabled` (school can disable) |
| Life readiness tracking | `enabled` (school can disable) |
| Auto-flag teacher on concern | `true` |
| Auto-flag parent on concern | `false` |
| Parent notification requires consent | `true` |
| Urgent always flags teacher | `true` |

---

## 10. MVP Feature List (Phase A)

### Scope: Classes 6–8, Math + Science

| Feature | Flag Key | Status |
|---------|----------|--------|
| Full 8-module pedagogy engine | `academic_engine` | ON |
| Mathematics | `subjects_math` | ON |
| Science | `subjects_science` | ON |
| Classes 6, 7, 8 | `classes_6_to_8` | ON |
| Cognitive (partial: focus, memory, reasoning, reflection) | `cognitive_partial` | ON |
| Daily habit tracking | `habit_tracking` | ON |
| Reflection journal | `reflection_journal` | ON |
| Confidence calibration | `confidence_tracking` | ON |
| Consistency scoring | `consistency_tracking` | ON |
| SM-2 spaced repetition | `spaced_repetition` | ON |
| Topic mastery checkpoints | `mastery_checkpoints` | ON |
| AI Guru (Ollama) | `ai_guru_ollama` | ON |
| Weekly outcome snapshots | `outcome_tracking` | ON |

### Phase A Deliverables

1. **Student Dashboard** — Holistic view with 4-pillar scores
2. **Subject Learning** — Chapters, topics, questions with pedagogy engine routing
3. **Learning Engine UI** — Real-time module status, mastery bars, action items
4. **AI Guru** — Ollama-powered Socratic tutor
5. **Habit Tracker** — Daily habit logging with streak tracking
6. **Reflection Journal** — Age-aware prompts, private by default
7. **Flashcards** — SM-2 spaced repetition interface
8. **My Development** — Dimension scores, archetype display, concern flags
9. **Style Discovery** — VARK assessment (feeds Module 1)
10. **Settings** — Profile, preferences, assessment skip toggle

### Phase A Does NOT Include

- Parent dashboard (Phase B)
- Teacher development view (Phase B)
- Scenario-based assessments (Phase B)
- Goal setting (Phase B)
- Badges (Phase B)
- Concern auto-detection (Phase B)
- English subject (Phase B)
- Classes 9-10 (Phase B)
- Full character/life readiness pillars (Phase C)
- Path/career discovery (Phase C)
- Multilingual support (Phase C)
- Peer learning (Future)
- School admin dashboard (Future)

---

## 11. Build Roadmap

### Phase A — MVP Build (Current)

**Goal**: Working product for 5–10 test students.

```
Week 1-2: Foundation
├── Supabase project setup (run migrations 001-009)
├── Auth flow (login/signup with role selection)
├── Middleware (role routing, VARK gate)
├── Dashboard layout (student + teacher)
└── Profile management

Week 3-4: Academic Core
├── Subject/chapter/topic data seeding (Math + Science, Classes 6-8)
├── VARK assessment (Module 1 — Access & Fit)
├── Diagnostic assessment (Module 2)
├── Scaffold teaching UI (Module 3)
├── Question attempt flow
└── Basic progress tracking

Week 5-6: Pedagogy Engine
├── Decision engine routing (all 8 modules connected)
├── SM-2 spaced repetition (Module 4)
├── Feedback & misconception repair (Module 5)
├── Metacognition self-assessment (Module 6)
├── Mastery checkpoints (Module 7)
├── Tier assignment logic (Module 8)
└── Learning Engine dashboard

Week 7-8: AI + Development
├── Ollama integration (AI Guru)
├── Habit tracking system
├── Reflection journal
├── Confidence calibration scoring
├── Development profile initialization
├── Basic dimension scoring
└── Outcome snapshot generation (weekly)

Week 9-10: Polish + Deploy
├── Teacher dashboard (academic view)
├── Teacher pedagogy monitoring
├── Flashcard interface
├── Mobile responsiveness
├── Error handling + loading states
├── Vercel deployment
└── Supabase production setup
```

### Phase B — Pilot (20-100 Students)

**Goal**: Validate with real classroom data.

```
├── Parent dashboard + linking
├── Teacher development view
├── Scenario-based assessments
├── Student/parent goal setting
├── Mentor feedback system
├── Development badges
├── Concern auto-detection + escalation
├── English subject content
├── Classes 9-10 content
└── Data collection + analysis pipeline
```

### Phase C — Production Scale

```
├── Full character pillar (all 10 dimensions active)
├── Full life readiness (all 8 dimensions active)
├── Path/career discovery
├── Domain affinity matching
├── All classes (1-12+)
├── All subjects
├── Hindi + regional language support
├── Parent goal setting
└── Performance optimization
```

### Infrastructure Checklist

| Component | Tool | Setup |
|-----------|------|-------|
| Database | Supabase | Create project → run migrations 001-009 → seed data |
| Auth | Supabase Auth | Enable email provider → configure redirect URLs |
| RLS | Supabase | All tables have RLS enabled (done in migrations) |
| Frontend | Vercel | Connect GitHub repo → set env vars → deploy |
| AI | Ollama | Install on server → pull model → expose API |
| Domain | Vercel | Configure custom domain |
| Monitoring | Vercel Analytics | Enable web vitals + serverless monitoring |
| Backups | Supabase | Enable point-in-time recovery |

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_SKIP_ASSESSMENT=false
```

---

## 12. API Contract Summary

### Pedagogy API (`/api/pedagogy`)

| Method | Action | Description |
|--------|--------|-------------|
| GET | `state` | Learner state + current route + due items + misconceptions |
| GET | `diagnostic_items` | Diagnostic questions for topic |
| GET | `scaffold_steps` | Scaffold steps at specified level |
| GET | `retrieval_due` | Due spaced repetition items (max 20) |
| GET | `my_misconceptions` | Unresolved misconceptions |
| GET | `checkpoints` | Mastery checkpoint history |
| GET | `events` | Module event log (max 50) |
| GET | `decisions` | Engine decision log (max 50) |
| POST | `init` | Create learner state for topic |
| POST | `preferences` | Update learning preferences (Module 1) |
| POST | `diagnostic_submit` | Submit diagnostic responses → routes |
| POST | `scaffold_interact` | Record scaffold interaction → adjusts level |
| POST | `retrieval_submit` | Submit retrieval answer → SM-2 update |
| POST | `mastery_submit` | Submit mastery checkpoint → band update |
| POST | `metacognition_submit` | Submit self-assessment → calibration score |
| POST | `resolve_misconception` | Mark misconception resolved |
| POST | `log_engagement` | Log disengagement signals |

### Pedagogy Teacher API (`/api/pedagogy/teacher`)

| Method | Action | Description |
|--------|--------|-------------|
| GET | `overview` | Class summary with band/tier distribution |
| GET | `student_detail` | Individual student pedagogy state |
| GET | `flagged` | Students needing attention |
| GET | `tier_assignments` | Current tier assignments |
| POST | `tier_override` | Teacher overrides tier assignment |
| POST | `add_notes` | Teacher notes on student |
| POST | `resolve_review` | Mark flagged student as reviewed |

### Development API (`/api/development`)

| Method | Action | Description |
|--------|--------|-------------|
| GET | `profile` | Development profile + archetypes + concerns + affinities |
| GET | `dimensions` | Dimension definitions (filterable by pillar) |
| GET | `my_habits` | Active habits with definitions |
| GET | `available_habits` | All habit definitions |
| GET | `habit_history` | Habit tracking for date range |
| GET | `reflections` | Reflections (filterable by type) |
| GET | `reflection_prompts` | Age-appropriate prompts |
| GET | `goals` | Goals (filterable by status/pillar) |
| GET | `scenarios` | Scenarios by pillar and age |
| GET | `my_badges` | Earned badges |
| GET | `interests` | Student interests |
| GET | `feedback` | Visible mentor feedback |
| GET | `events` | Development event log |
| GET | `domain_affinities` | Career domain affinity scores |
| POST | `init_profile` | Create development profile |
| POST | `track_habit` | Log habit → updates streak + dimension |
| POST | `add_habit` | Add habit to active list |
| POST | `submit_reflection` | Submit reflection → updates dimensions |
| POST | `submit_scenario` | Submit scenario → scores + archetypes |
| POST | `create_goal` | Create goal |
| POST | `update_goal` | Update goal progress/status |
| POST | `acknowledge_feedback` | Mark feedback acknowledged |

### Development Parent API (`/api/development/parent`)

| Method | Action | Description |
|--------|--------|-------------|
| GET | `children` | Linked children |
| GET | `child_overview` | Child profile (respects visibility) |
| POST | `link_child` | Link parent to child |
| POST | `give_feedback` | Submit encouragement/observation |
| POST | `set_goal` | Set goal for child |
| POST | `update_preferences` | Update visibility preferences |

---

## File Map

```
src/
├── app/
│   ├── (auth)/           # Login, Signup
│   ├── (dashboard)/      # Student routes
│   │   ├── layout.tsx    # Student sidebar + nav
│   │   ├── dashboard/    # Main student dashboard
│   │   ├── me/           # Holistic development view
│   │   ├── subjects/     # Subject learning
│   │   ├── pedagogy/     # Learning engine dashboard
│   │   ├── guru/         # AI tutor
│   │   ├── flashcards/   # Spaced repetition
│   │   ├── habits/       # Habit tracker
│   │   ├── reflect/      # Reflection journal
│   │   ├── goals/        # Goal management
│   │   ├── parent/       # Parent dashboard
│   │   └── ...           # Other student pages
│   ├── (teacher)/        # Teacher routes
│   │   ├── layout.tsx    # Teacher sidebar + nav
│   │   └── teacher/
│   │       ├── dashboard/
│   │       ├── pedagogy/     # Pedagogy monitoring
│   │       ├── development/  # Development monitoring
│   │       ├── classrooms/
│   │       ├── students/
│   │       └── ...
│   └── api/
│       ├── pedagogy/
│       │   ├── route.ts          # Student pedagogy API
│       │   └── teacher/route.ts  # Teacher pedagogy API
│       └── development/
│           ├── route.ts          # Student development API
│           └── parent/route.ts   # Parent API
├── lib/
│   ├── pedagogy-engine.ts    # All scoring/routing logic
│   ├── development-engine.ts # All development logic
│   └── supabase.ts           # Supabase client helpers
├── hooks/
│   ├── pedagogy-engine.ts    # 13 pedagogy hooks
│   └── student-development.ts # 11 development hooks
├── types/
│   ├── pedagogy-engine.ts    # All pedagogy types
│   └── student-development.ts # All development types
└── middleware.ts              # Auth + role routing + VARK gate

supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_teacher_management.sql
    ├── 003_security_fixes.sql
    ├── 004_upgrade_schema.sql
    ├── 005_multiboard_exam.sql
    ├── 006_learning_style_teams.sql
    ├── 007_pedagogy_engine.sql
    ├── 008_whole_student_development.sql
    └── 009_outcome_metrics_and_safety.sql
```

---

**This spec is frozen. Build from it. Improve from pilot data, not from theory.**
