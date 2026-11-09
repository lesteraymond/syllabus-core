// Client library for Coordinated Whole-Syllabus Improvement Plan
import { syllabusCheck } from './api';

export const VALIDATION_STATUS = {
  VERIFIED: 'VERIFIED',
  NEEDS_FACULTY_REVIEW: 'NEEDS_FACULTY_REVIEW',
  UNRESOLVED: 'UNRESOLVED',
  NOT_CHECKED: 'NOT_CHECKED',
};

export function hasImprovementPlan(run) {
  return !!(run?.hybrid?.improvementPlan || run?.improvementPlan);
}

export function improvementPlanOf(run) {
  return run?.hybrid?.improvementPlan || run?.improvementPlan || null;
}

export async function fetchImprovementPlan(runId) {
  const res = await syllabusCheck.getImprovementPlan(runId);
  return res?.plan || null;
}

export async function applyImprovementPlan(runId, { planId, sourceHash, approvedChangeIds = null } = {}) {
  return syllabusCheck.applyImprovementPlan(runId, {
    planId,
    sourceHash,
    approvedChangeIds,
  });
}

export function statusBadgeClass(status) {
  switch (status) {
    case VALIDATION_STATUS.VERIFIED:
      return 'hy-pill ok';
    case VALIDATION_STATUS.NEEDS_FACULTY_REVIEW:
      return 'hy-pill warn';
    case VALIDATION_STATUS.UNRESOLVED:
      return 'hy-pill danger';
    default:
      return 'hy-pill quiet';
  }
}
