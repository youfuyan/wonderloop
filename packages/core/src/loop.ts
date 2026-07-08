import type { PlayerSegmentType } from "./player";

export type LoopStatus =
  | "idle"
  | "hook_playing"
  | "predict_paused"
  | "story_playing"
  | "think_paused"
  | "teach_back_paused"
  | "new_question_paused"
  | "completed";

export type LoopSessionProgress = {
  listened: boolean;
  answeredThink: boolean;
  taughtBack: boolean;
  askedNewQuestion: boolean;
};

export type DailySession = {
  listened: boolean;
  predict_choice: string | null;
  answered_think: boolean;
  taught_back: boolean;
  asked_new_question: boolean;
  recall_answered: boolean;
};

export type LoopState = LoopSessionProgress & {
  status: LoopStatus;
  predictChoice: string | null;
};

export type LoopEvent =
  | { type: "RESUME" }
  | { type: "SEGMENT_END"; segmentType?: PlayerSegmentType }
  | { type: "ANSWER_SUBMITTED"; predictChoice?: string }
  | { type: "SKIP" };

export const initialLoopState: LoopState = {
  status: "idle",
  listened: false,
  predictChoice: null,
  answeredThink: false,
  taughtBack: false,
  askedNewQuestion: false
};

export function isLoopComplete(session: LoopSessionProgress): boolean {
  return (
    session.listened &&
    session.answeredThink &&
    session.taughtBack &&
    session.askedNewQuestion
  );
}

export function isDailySessionLoopComplete(session: Partial<DailySession>): boolean {
  return (
    session.listened === true &&
    session.answered_think === true &&
    session.taught_back === true &&
    session.asked_new_question === true
  );
}

export function advance(state: LoopState, event: LoopEvent): LoopState {
  const nextState = applyEvent(state, event);

  if (isLoopComplete(nextState)) {
    return { ...nextState, status: "completed" };
  }

  return nextState;
}

export function deriveSessionUpdate(
  state: LoopState,
  event: LoopEvent
): Partial<DailySession> {
  if (event.type === "SEGMENT_END" && state.status === "story_playing") {
    return { listened: true };
  }

  if (event.type !== "ANSWER_SUBMITTED") {
    return {};
  }

  switch (state.status) {
    case "predict_paused":
      return event.predictChoice === undefined
        ? {}
        : { predict_choice: event.predictChoice };
    case "think_paused":
      return { answered_think: true };
    case "teach_back_paused":
      return { taught_back: true };
    case "new_question_paused":
      return { asked_new_question: true };
    default:
      return {};
  }
}

export function restoreLoopStateFromSession(session: Partial<DailySession>): LoopState {
  const listened = session.listened ?? false;
  const answeredThink = session.answered_think ?? false;
  const taughtBack = session.taught_back ?? false;
  const askedNewQuestion = session.asked_new_question ?? false;
  const restoredState: LoopState = {
    status: "idle",
    listened,
    predictChoice: session.predict_choice ?? null,
    answeredThink,
    taughtBack,
    askedNewQuestion
  };

  if (isLoopComplete(restoredState)) {
    return { ...restoredState, status: "completed" };
  }

  if (!listened) {
    return restoredState;
  }

  if (!answeredThink) {
    return { ...restoredState, status: "think_paused" };
  }

  if (!taughtBack) {
    return { ...restoredState, status: "teach_back_paused" };
  }

  if (!askedNewQuestion) {
    return { ...restoredState, status: "new_question_paused" };
  }

  return { ...restoredState, status: "completed" };
}

function applyEvent(state: LoopState, event: LoopEvent): LoopState {
  if (state.status === "completed") {
    return state;
  }

  switch (state.status) {
    case "idle":
      return event.type === "RESUME" ? { ...state, status: "hook_playing" } : state;
    case "hook_playing":
      return event.type === "SEGMENT_END"
        ? { ...state, status: "predict_paused" }
        : state;
    case "predict_paused":
      return applyPredictPausedEvent(state, event);
    case "story_playing":
      return applyStoryPlayingEvent(state, event);
    case "think_paused":
      return applyThinkPausedEvent(state, event);
    case "teach_back_paused":
      return applyTeachBackPausedEvent(state, event);
    case "new_question_paused":
      return applyNewQuestionPausedEvent(state, event);
  }
}

function applyPredictPausedEvent(state: LoopState, event: LoopEvent): LoopState {
  if (event.type === "ANSWER_SUBMITTED") {
    return {
      ...state,
      status: "story_playing",
      predictChoice: event.predictChoice ?? state.predictChoice
    };
  }

  if (event.type === "SKIP" || event.type === "RESUME") {
    return { ...state, status: "story_playing" };
  }

  return state;
}

function applyStoryPlayingEvent(state: LoopState, event: LoopEvent): LoopState {
  if (event.type !== "SEGMENT_END") {
    return state;
  }

  if (event.segmentType === "teach_back") {
    return { ...state, status: "teach_back_paused", listened: true };
  }

  if (event.segmentType === "new_question") {
    return { ...state, status: "new_question_paused", listened: true };
  }

  return { ...state, status: "think_paused", listened: true };
}

function applyThinkPausedEvent(state: LoopState, event: LoopEvent): LoopState {
  if (event.type === "ANSWER_SUBMITTED") {
    return { ...state, status: "story_playing", answeredThink: true };
  }

  if (event.type === "SKIP" || event.type === "RESUME") {
    return { ...state, status: "story_playing" };
  }

  return state;
}

function applyTeachBackPausedEvent(state: LoopState, event: LoopEvent): LoopState {
  if (event.type === "ANSWER_SUBMITTED") {
    return { ...state, status: "story_playing", taughtBack: true };
  }

  if (event.type === "SKIP" || event.type === "RESUME") {
    return { ...state, status: "story_playing" };
  }

  return state;
}

function applyNewQuestionPausedEvent(state: LoopState, event: LoopEvent): LoopState {
  if (event.type === "ANSWER_SUBMITTED") {
    return { ...state, status: "completed", askedNewQuestion: true };
  }

  if (event.type === "SKIP" || event.type === "RESUME") {
    return { ...state, status: "completed" };
  }

  return state;
}
