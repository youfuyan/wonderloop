import { describe, expect, it } from "vitest";

import {
  advance,
  initialLoopState,
  isLoopComplete,
  type LoopEvent,
  type LoopSessionProgress
} from "./loop";

describe("loop progress", () => {
  it("matches the WonderLoop completion definition", () => {
    const completeSession: LoopSessionProgress = {
      listened: true,
      answeredThink: true,
      taughtBack: true,
      askedNewQuestion: true
    };

    expect(isLoopComplete(completeSession)).toBe(true);
    expect(isLoopComplete({ ...completeSession, askedNewQuestion: false })).toBe(false);
  });

  it("marks the loop complete when all required events are present", () => {
    const events: LoopEvent[] = [
      { type: "listened" },
      { type: "answered_think" },
      { type: "taught_back" },
      { type: "asked_new_question" }
    ];

    const state = events.reduce(advance, initialLoopState);

    expect(state.step).toBe("complete");
  });
});
