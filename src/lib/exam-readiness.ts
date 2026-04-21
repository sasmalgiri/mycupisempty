/**
 * Predictive Exam Readiness — forecast when the student will be exam-ready.
 *
 * Parents' #1 question: "Will my child be ready for boards/JEE/NEET?"
 * Every competitor dodges this with vague "keep studying!" copy.
 *
 * We forecast honestly using three signals:
 *   1. Current mastery coverage of the exam syllabus
 *   2. Historical growth rate (mastery gained per week)
 *   3. Remaining gap + variance (how stable the growth is)
 *
 * Returns: projected readiness date + confidence band + what needs to change
 * if the target date is closer than the projection.
 */

import type { SubjectMasteryMap } from './mastery';

export interface ReadinessInput {
  examType: 'board_10' | 'board_12' | 'jee_main' | 'jee_advanced' | 'neet' | 'ntse' | 'general';
  examTargetDate?: string;           // optional user-specified exam date
  masteryMaps: SubjectMasteryMap[];
  weeklyMasteryDeltas: number[];     // last N weeks of new topics-mastered
  recentAccuracy: number;            // 0..1 last 30 days
  activeMinutesPerDay: number;
}

export interface ReadinessForecast {
  currentReadiness: number;          // 0..100
  targetReadiness: number;           // what's considered "ready" for this exam
  topicsMastered: number;
  topicsRemaining: number;
  estimatedWeeksToReady: number;     // if at current pace
  projectedReadyDate: string;        // ISO date
  confidenceBand: { lowDate: string; highDate: string };
  status: 'on_track' | 'ahead' | 'behind' | 'crunch' | 'unclear';
  gap: number;                        // readiness points short of target
  recommendations: string[];
  parentMessage: string;             // natural-language summary for parents
}

// ============================================================
// Exam readiness bars — what "ready" means per exam
// ============================================================

const READINESS_TARGETS: Record<ReadinessInput['examType'], { target: number; label: string }> = {
  board_10:       { target: 70, label: 'Class 10 Board' },
  board_12:       { target: 75, label: 'Class 12 Board' },
  jee_main:       { target: 85, label: 'JEE Main' },
  jee_advanced:   { target: 92, label: 'JEE Advanced' },
  neet:           { target: 88, label: 'NEET' },
  ntse:           { target: 80, label: 'NTSE' },
  general:        { target: 75, label: 'General' },
};

// ============================================================
// The forecast
// ============================================================

export function forecastReadiness(input: ReadinessInput): ReadinessForecast {
  const { examType, examTargetDate, masteryMaps, weeklyMasteryDeltas, recentAccuracy, activeMinutesPerDay } = input;
  const targetConfig = READINESS_TARGETS[examType];

  // Current readiness: combine mastery coverage + recent accuracy (weighted)
  let totalTopics = 0;
  let masteredTopics = 0;
  for (const m of masteryMaps) {
    totalTopics += m.topics.length;
    masteredTopics += (m.counts.mastered || 0) + (m.counts.stable || 0);
  }
  const coverage = totalTopics > 0 ? masteredTopics / totalTopics : 0;
  const accuracyScore = recentAccuracy;
  // Weighted: 70% coverage, 30% accuracy
  const currentReadiness = Math.round((coverage * 0.7 + accuracyScore * 0.3) * 100);
  const topicsRemaining = Math.max(0, totalTopics - masteredTopics);

  // Growth rate: mean weekly topics-mastered, with variance
  const validDeltas = weeklyMasteryDeltas.filter((d) => d >= 0);
  const meanWeekly = validDeltas.length > 0
    ? validDeltas.reduce((s, d) => s + d, 0) / validDeltas.length
    : 0;
  // Variance for confidence band
  const variance = validDeltas.length > 1
    ? validDeltas.reduce((s, d) => s + Math.pow(d - meanWeekly, 2), 0) / validDeltas.length
    : 0;
  const stdDev = Math.sqrt(variance);

  // Weeks needed at current pace
  let estimatedWeeksToReady = meanWeekly > 0
    ? Math.ceil(topicsRemaining / meanWeekly)
    : 52;  // infinity → show 1 year as ceiling

  // If coverage is already at target, 0 weeks
  if (currentReadiness >= targetConfig.target) estimatedWeeksToReady = 0;

  const now = new Date();
  const projectedReady = new Date(now.getTime() + estimatedWeeksToReady * 7 * 24 * 60 * 60 * 1000);

  // Confidence band (±1 std dev scaled to weeks)
  const bandWeeks = meanWeekly > 0 ? Math.max(1, Math.round(stdDev / meanWeekly)) : 4;
  const lowDate = new Date(projectedReady.getTime() - bandWeeks * 7 * 24 * 60 * 60 * 1000);
  const highDate = new Date(projectedReady.getTime() + bandWeeks * 7 * 24 * 60 * 60 * 1000);

  // Status vs target date
  let status: ReadinessForecast['status'] = 'unclear';
  let gap = Math.max(0, targetConfig.target - currentReadiness);
  if (meanWeekly === 0 && validDeltas.length >= 2) {
    status = 'behind';
  } else if (examTargetDate) {
    const target = new Date(examTargetDate);
    const daysToTarget = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (projectedReady.getTime() <= target.getTime() - 7 * 24 * 60 * 60 * 1000) {
      status = 'ahead';
    } else if (projectedReady.getTime() <= target.getTime()) {
      status = 'on_track';
    } else if (daysToTarget > 30) {
      status = 'behind';
    } else {
      status = 'crunch';
    }
  } else {
    status = currentReadiness >= targetConfig.target ? 'on_track' : meanWeekly > 0 ? 'on_track' : 'unclear';
  }

  // Recommendations
  const recommendations: string[] = [];
  if (status === 'behind' || status === 'crunch') {
    const extraMinutes = Math.ceil(((topicsRemaining / Math.max(meanWeekly, 0.5)) / 7) * 60) - activeMinutesPerDay;
    if (extraMinutes > 0) {
      recommendations.push(`Add ${Math.min(extraMinutes, 45)} min/day to reach target in time.`);
    }
    recommendations.push(`Focus mastery on weakest subjects — don't spread effort evenly.`);
  }
  if (recentAccuracy < 0.6) {
    recommendations.push(`Accuracy is at ${Math.round(recentAccuracy * 100)}% — slow down and verify each answer. Mastery > speed.`);
  }
  if (meanWeekly === 0 && validDeltas.length >= 2) {
    recommendations.push(`No new topics mastered recently. One focused session today rebuilds momentum.`);
  }
  if (status === 'ahead') {
    recommendations.push(`Ahead of pace — try stretch topics (advanced/olympiad) to stay sharp.`);
  }
  if (recommendations.length === 0) {
    recommendations.push(`Keep the current pace — consistency is winning.`);
  }

  // Parent message
  const formatDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  let parentMessage: string;
  if (currentReadiness >= targetConfig.target) {
    parentMessage = `Already meets the ${targetConfig.label} readiness bar (${currentReadiness}/${targetConfig.target}). Stretch for higher score with advanced practice.`;
  } else if (meanWeekly === 0) {
    parentMessage = `Currently at ${currentReadiness}/${targetConfig.target} for ${targetConfig.label}. Not enough recent activity to project a ready date — a few consistent sessions will give a clearer picture.`;
  } else {
    parentMessage = `At the current pace, ready for ${targetConfig.label} around ${formatDate(projectedReady)} (between ${formatDate(lowDate)} and ${formatDate(highDate)}). Current readiness: ${currentReadiness}/${targetConfig.target}.`;
  }

  return {
    currentReadiness,
    targetReadiness: targetConfig.target,
    topicsMastered: masteredTopics,
    topicsRemaining,
    estimatedWeeksToReady,
    projectedReadyDate: projectedReady.toISOString(),
    confidenceBand: {
      lowDate: lowDate.toISOString(),
      highDate: highDate.toISOString(),
    },
    status,
    gap,
    recommendations,
    parentMessage,
  };
}
