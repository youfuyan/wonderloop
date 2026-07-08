import { describe, expect, it } from "vitest";

import {
  getTodayCardState,
  getWeekDateStrings,
  getZonedDateString,
  hasTodaySessionProgress,
  selectTodayEpisode
} from "./today";

describe("getZonedDateString", () => {
  it("uses the family timezone around a UTC date switch", () => {
    const utcDate = new Date("2026-07-07T02:30:00.000Z");

    expect(getZonedDateString(utcDate, "America/New_York")).toBe("2026-07-06");
    expect(getZonedDateString(utcDate, "Asia/Shanghai")).toBe("2026-07-07");
  });
});

describe("getWeekDateStrings", () => {
  it("returns a Sunday-to-Saturday family week", () => {
    expect(getWeekDateStrings("2026-07-07")).toEqual([
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11"
    ]);
  });
});

describe("selectTodayEpisode", () => {
  it("prefers the episode published on the family today", () => {
    expect(
      selectTodayEpisode(
        [
          { id: "old", publishDate: "2026-07-06" },
          { id: "today", publishDate: "2026-07-07" }
        ],
        "2026-07-07"
      )
    ).toEqual({
      episode: { id: "today", publishDate: "2026-07-07" },
      isFallback: false
    });
  });

  it("falls back to the latest earlier episode when content has a gap", () => {
    expect(
      selectTodayEpisode(
        [
          { id: "older", publishDate: "2026-07-04" },
          { id: "latest", publishDate: "2026-07-06" }
        ],
        "2026-07-07"
      )
    ).toEqual({
      episode: { id: "latest", publishDate: "2026-07-06" },
      isFallback: true
    });
  });
});

describe("getTodayCardState", () => {
  it("returns the three visible today-card states", () => {
    expect(getTodayCardState(null)).toEqual({ kind: "not_started" });
    expect(
      getTodayCardState({
        answered_think: false,
        asked_new_question: false,
        listened: false,
        predict_choice: null,
        recall_answered: false,
        taught_back: false
      })
    ).toEqual({ kind: "not_started" });
    expect(
      getTodayCardState({
        answered_think: false,
        asked_new_question: false,
        listened: true,
        predict_choice: "b",
        recall_answered: false,
        taught_back: false
      })
    ).toEqual({ kind: "in_progress", status: "think_paused" });
    expect(
      getTodayCardState({
        answered_think: true,
        asked_new_question: true,
        listened: true,
        predict_choice: "b",
        recall_answered: false,
        taught_back: true
      })
    ).toEqual({ kind: "completed" });
  });
});

describe("hasTodaySessionProgress", () => {
  it("treats an inserted but untouched session as not started", () => {
    expect(hasTodaySessionProgress({})).toBe(false);
    expect(
      hasTodaySessionProgress({
        answered_think: false,
        asked_new_question: false,
        listened: false,
        predict_choice: null,
        recall_answered: false,
        taught_back: false
      })
    ).toBe(false);
  });

  it("detects any real loop interaction", () => {
    expect(hasTodaySessionProgress({ predict_choice: "b" })).toBe(true);
    expect(hasTodaySessionProgress({ listened: true })).toBe(true);
  });
});
