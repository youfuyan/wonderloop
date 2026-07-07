import { describe, expect, it } from "vitest";

import {
  deriveRecallSessionUpdate,
  selectRecallPlan,
  shouldStartWithRecall,
  type RecallSessionCandidate
} from "./recall";

const recallQuestion = {
  answer_hint: { en: "They make honey.", zh: "它们会酿蜜。" },
  en: "What did bees make?",
  zh: "蜜蜂会做什么？"
};

describe("selectRecallPlan", () => {
  it("shows yesterday's recall after a completed loop", () => {
    const plan = selectRecallPlan(
      [candidate({ sessionDate: "2026-07-06", sessionId: "yesterday" })],
      "2026-07-07"
    );

    expect(plan?.sessionId).toBe("yesterday");
    expect(shouldStartWithRecall(plan)).toBe(true);
  });

  it("does not show recall after a four-day interruption", () => {
    expect(
      selectRecallPlan(
        [candidate({ sessionDate: "2026-07-03", sessionId: "old" })],
        "2026-07-07"
      )
    ).toBeNull();
  });

  it("ignores incomplete and already answered sessions", () => {
    expect(
      selectRecallPlan(
        [
          candidate({ loopComplete: false, sessionDate: "2026-07-06" }),
          candidate({ recallAnswered: true, sessionDate: "2026-07-05" })
        ],
        "2026-07-07"
      )
    ).toBeNull();
  });

  it("chooses the most recent eligible completed session", () => {
    expect(
      selectRecallPlan(
        [
          candidate({ sessionDate: "2026-07-04", sessionId: "older" }),
          candidate({ sessionDate: "2026-07-06", sessionId: "newer" })
        ],
        "2026-07-07"
      )?.sessionId
    ).toBe("newer");
  });

  it("does not recall today's already completed session", () => {
    expect(
      selectRecallPlan(
        [candidate({ sessionDate: "2026-07-07", sessionId: "today" })],
        "2026-07-07"
      )
    ).toBeNull();
  });
});

describe("deriveRecallSessionUpdate", () => {
  it("writes recall_answered to the previous session, not today", () => {
    const plan = selectRecallPlan(
      [candidate({ sessionDate: "2026-07-06", sessionId: "previous-session" })],
      "2026-07-07"
    );

    if (plan === null) {
      throw new Error("Expected recall plan");
    }

    expect(deriveRecallSessionUpdate(plan)).toEqual({
      sessionId: "previous-session",
      update: { recall_answered: true }
    });
  });
});

function candidate(
  overrides: Partial<RecallSessionCandidate> = {}
): RecallSessionCandidate {
  return {
    episodeId: "episode-1",
    loopComplete: true,
    recallAnswered: false,
    recallQuestion,
    sessionDate: "2026-07-06",
    sessionId: "session-1",
    ...overrides
  };
}
