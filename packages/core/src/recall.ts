import type { EpisodeContent } from "./types/episode";

export type RecallQuestion = EpisodeContent["recall_question"];

export type RecallSessionCandidate = {
  episodeId: string;
  loopComplete: boolean;
  recallAnswered: boolean;
  recallQuestion: RecallQuestion;
  sessionDate: string;
  sessionId: string;
};

export type RecallPlan = {
  episodeId: string;
  recallQuestion: RecallQuestion;
  sessionDate: string;
  sessionId: string;
};

export type RecallSessionUpdate = {
  sessionId: string;
  update: {
    recall_answered: true;
  };
};

const maxRecallAgeDays = 3;

export function selectRecallPlan(
  candidates: readonly RecallSessionCandidate[],
  today: string
): RecallPlan | null {
  const eligible = candidates
    .filter((candidate) => isEligibleRecallCandidate(candidate, today))
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate));
  const candidate = eligible[0];

  if (candidate === undefined) {
    return null;
  }

  return {
    episodeId: candidate.episodeId,
    recallQuestion: candidate.recallQuestion,
    sessionDate: candidate.sessionDate,
    sessionId: candidate.sessionId
  };
}

export function deriveRecallSessionUpdate(plan: RecallPlan): RecallSessionUpdate {
  return {
    sessionId: plan.sessionId,
    update: { recall_answered: true }
  };
}

export function shouldStartWithRecall(plan: RecallPlan | null): boolean {
  return plan !== null;
}

function isEligibleRecallCandidate(
  candidate: RecallSessionCandidate,
  today: string
): boolean {
  if (!candidate.loopComplete || candidate.recallAnswered) {
    return false;
  }

  const ageDays = daysBetween(candidate.sessionDate, today);
  return ageDays >= 1 && ageDays <= maxRecallAgeDays;
}

function daysBetween(start: string, end: string): number {
  const startDate = Date.parse(`${start}T00:00:00.000Z`);
  const endDate = Date.parse(`${end}T00:00:00.000Z`);

  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((endDate - startDate) / 86400000);
}
