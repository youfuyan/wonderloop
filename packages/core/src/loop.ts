export type LoopStep =
  "hook" | "predict" | "story" | "think" | "teach_back" | "new_question" | "complete";

export type LoopSessionProgress = {
  listened: boolean;
  answeredThink: boolean;
  taughtBack: boolean;
  askedNewQuestion: boolean;
};

export type LoopState = LoopSessionProgress & {
  step: LoopStep;
  recallAnswered: boolean;
};

export type LoopEvent =
  | { type: "listened" }
  | { type: "answered_think" }
  | { type: "taught_back" }
  | { type: "asked_new_question" }
  | { type: "recall_answered" };

export const initialLoopState: LoopState = {
  step: "hook",
  listened: false,
  answeredThink: false,
  taughtBack: false,
  askedNewQuestion: false,
  recallAnswered: false
};

export function isLoopComplete(session: LoopSessionProgress): boolean {
  return (
    session.listened &&
    session.answeredThink &&
    session.taughtBack &&
    session.askedNewQuestion
  );
}

export function advance(state: LoopState, event: LoopEvent): LoopState {
  const nextState = applyEvent(state, event);

  if (isLoopComplete(nextState)) {
    return { ...nextState, step: "complete" };
  }

  return nextState;
}

function applyEvent(state: LoopState, event: LoopEvent): LoopState {
  switch (event.type) {
    case "listened":
      return { ...state, listened: true };
    case "answered_think":
      return { ...state, answeredThink: true };
    case "taught_back":
      return { ...state, taughtBack: true };
    case "asked_new_question":
      return { ...state, askedNewQuestion: true };
    case "recall_answered":
      return { ...state, recallAnswered: true };
  }
}
