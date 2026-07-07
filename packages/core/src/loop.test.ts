import { describe, expect, it } from "vitest";

import {
  advance,
  deriveSessionUpdate,
  initialLoopState,
  isLoopComplete,
  restoreLoopStateFromSession,
  type DailySession,
  type LoopEvent,
  type LoopSessionProgress,
  type LoopState,
  type LoopStatus
} from "./loop";

type SegmentEndEvent = Extract<LoopEvent, { type: "SEGMENT_END" }>;
type SegmentType = NonNullable<SegmentEndEvent["segmentType"]>;

const complete = {
  listened: true,
  answeredThink: true,
  taughtBack: true,
  askedNewQuestion: true
} satisfies LoopSessionProgress;

describe("loop state machine", () => {
  it("matches the SQL loop_complete inputs", () => {
    expect(isLoopComplete(complete)).toBe(true);
    expect(isLoopComplete({ ...complete, listened: false })).toBe(false);
    expect(isLoopComplete({ ...complete, answeredThink: false })).toBe(false);
    expect(isLoopComplete({ ...complete, taughtBack: false })).toBe(false);
    expect(isLoopComplete({ ...complete, askedNewQuestion: false })).toBe(false);
  });

  it.each([
    ["idle starts", st("idle"), { type: "RESUME" }, "hook_playing"],
    ["idle ignores end", st("idle"), { type: "SEGMENT_END" }, "idle"],
    ["hook ends", st("hook_playing"), { type: "SEGMENT_END" }, "predict_paused"],
    [
      "predict answer",
      st("predict_paused"),
      { type: "ANSWER_SUBMITTED", predictChoice: "a" },
      "story_playing"
    ],
    ["predict skip", st("predict_paused"), { type: "SKIP" }, "story_playing"],
    ["predict resume", st("predict_paused"), { type: "RESUME" }, "story_playing"],
    ["story to think", st("story_playing"), end("think"), "think_paused"],
    [
      "story to teach-back",
      st("story_playing", { listened: true, answeredThink: true }),
      end("teach_back"),
      "teach_back_paused"
    ],
    [
      "story to new question",
      st("story_playing", {
        listened: true,
        answeredThink: true,
        taughtBack: true
      }),
      end("new_question"),
      "new_question_paused"
    ],
    ["think answer", st("think_paused"), { type: "ANSWER_SUBMITTED" }, "story_playing"],
    ["think skip", st("think_paused"), { type: "SKIP" }, "story_playing"],
    [
      "teach-back answer",
      st("teach_back_paused"),
      { type: "ANSWER_SUBMITTED" },
      "story_playing"
    ],
    ["teach-back skip", st("teach_back_paused"), { type: "SKIP" }, "story_playing"],
    [
      "new question answer",
      st("new_question_paused", {
        listened: true,
        answeredThink: true,
        taughtBack: true
      }),
      { type: "ANSWER_SUBMITTED" },
      "completed"
    ],
    [
      "new question skip",
      st("new_question_paused", {
        listened: true,
        answeredThink: true,
        taughtBack: true
      }),
      { type: "SKIP" },
      "completed"
    ],
    ["completed is terminal", st("completed", complete), { type: "SKIP" }, "completed"]
  ] satisfies [string, LoopState, LoopEvent, LoopStatus][])(
    "%s",
    (_name, state, event, status) => {
      expect(advance(state, event).status).toBe(status);
    }
  );

  it("records predict choice without completing a required interaction", () => {
    expect(
      advance(st("predict_paused"), {
        type: "ANSWER_SUBMITTED",
        predictChoice: "b"
      })
    ).toMatchObject({
      status: "story_playing",
      predictChoice: "b",
      answeredThink: false
    });
  });

  it("completes only after listen, think, teach-back, and new-question events", () => {
    const events: LoopEvent[] = [
      { type: "RESUME" },
      end("predict"),
      { type: "ANSWER_SUBMITTED", predictChoice: "a" },
      end("think"),
      { type: "ANSWER_SUBMITTED" },
      end("teach_back"),
      { type: "ANSWER_SUBMITTED" },
      end("new_question"),
      { type: "ANSWER_SUBMITTED" }
    ];
    const finalState = events.reduce(advance, initialLoopState);

    expect(finalState.status).toBe("completed");
    expect(isLoopComplete(finalState)).toBe(true);
  });

  it("keeps loop_complete false when every interaction is skipped", () => {
    const events: LoopEvent[] = [
      { type: "RESUME" },
      end("predict"),
      { type: "SKIP" },
      end("think"),
      { type: "SKIP" },
      end("teach_back"),
      { type: "SKIP" },
      end("new_question"),
      { type: "SKIP" }
    ];
    const finalState = events.reduce(advance, initialLoopState);

    expect(finalState.status).toBe("completed");
    expect(isLoopComplete(finalState)).toBe(false);
  });
});

describe("deriveSessionUpdate", () => {
  it.each([
    [st("story_playing"), end("think"), { listened: true }],
    [
      st("predict_paused"),
      { type: "ANSWER_SUBMITTED", predictChoice: "c" },
      { predict_choice: "c" }
    ],
    [st("think_paused"), { type: "ANSWER_SUBMITTED" }, { answered_think: true }],
    [st("teach_back_paused"), { type: "ANSWER_SUBMITTED" }, { taught_back: true }],
    [
      st("new_question_paused"),
      { type: "ANSWER_SUBMITTED" },
      { asked_new_question: true }
    ],
    [st("think_paused"), { type: "SKIP" }, {}]
  ] satisfies [LoopState, LoopEvent, Partial<DailySession>][])(
    "returns the session delta for %#",
    (state, event, update) => {
      expect(deriveSessionUpdate(state, event)).toEqual(update);
    }
  );
});

describe("restoreLoopStateFromSession", () => {
  it.each([
    [{}, "idle"],
    [{ listened: true }, "think_paused"],
    [{ listened: true, answered_think: true }, "teach_back_paused"],
    [
      { listened: true, answered_think: true, taught_back: true },
      "new_question_paused"
    ],
    [
      {
        listened: true,
        answered_think: true,
        taught_back: true,
        asked_new_question: true
      },
      "completed"
    ]
  ] satisfies [Partial<DailySession>, LoopStatus][])(
    "restores %s to %s",
    (session, status) => {
      expect(restoreLoopStateFromSession(session).status).toBe(status);
    }
  );

  it("does not hydrate prior-session recall into today's loop state", () => {
    expect(
      restoreLoopStateFromSession({
        recall_answered: true
      })
    ).not.toHaveProperty("recallAnswered");
  });
});

function st(
  status: LoopStatus,
  progress: Partial<LoopSessionProgress> = {}
): LoopState {
  return { ...initialLoopState, status, ...progress };
}

function end(segmentType: SegmentType): LoopEvent {
  return { type: "SEGMENT_END", segmentType } satisfies LoopEvent;
}
