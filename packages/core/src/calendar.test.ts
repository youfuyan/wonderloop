import { describe, expect, it } from "vitest";

import {
  buildCalendarMonth,
  getAdjacentMonth,
  getCalendarSessionState,
  getMonthRange,
  summarizeCalendarMonth
} from "./calendar";

describe("getCalendarSessionState", () => {
  it("renders untouched, listened-only, partial, and complete states", () => {
    expect(getCalendarSessionState(null)).toBe("none");
    expect(
      getCalendarSessionState({
        answered_think: false,
        asked_new_question: false,
        listened: false,
        predict_choice: null,
        recall_answered: false,
        taught_back: false
      })
    ).toBe("none");
    expect(
      getCalendarSessionState({
        answered_think: false,
        asked_new_question: false,
        listened: true,
        predict_choice: null,
        recall_answered: false,
        taught_back: false
      })
    ).toBe("listened");
    expect(
      getCalendarSessionState({
        answered_think: true,
        asked_new_question: false,
        listened: true,
        predict_choice: "b",
        recall_answered: false,
        taught_back: false
      })
    ).toBe("partial");
    expect(
      getCalendarSessionState({
        answered_think: true,
        asked_new_question: true,
        listened: true,
        predict_choice: "b",
        recall_answered: false,
        taught_back: true
      })
    ).toBe("complete");
  });
});

describe("calendar month helpers", () => {
  it("builds a Sunday-to-Saturday month grid with session states", () => {
    const days = buildCalendarMonth("2026-07", [
      {
        answered_think: false,
        asked_new_question: false,
        listened: true,
        predict_choice: null,
        sessionDate: "2026-07-02",
        taught_back: false
      },
      {
        answered_think: true,
        asked_new_question: false,
        listened: true,
        predict_choice: "b",
        sessionDate: "2026-07-03",
        taught_back: false
      }
    ]);

    expect(days).toHaveLength(35);
    expect(days[0]).toMatchObject({ date: "2026-06-28", inMonth: false });
    expect(days.find((day) => day.date === "2026-07-02")?.state).toBe("listened");
    expect(days.find((day) => day.date === "2026-07-03")?.state).toBe("partial");
  });

  it("returns month ranges and adjacent months", () => {
    expect(getMonthRange("2026-02")).toEqual({
      end: "2026-02-28",
      start: "2026-02-01"
    });
    expect(getAdjacentMonth("2026-01", -1)).toBe("2025-12");
    expect(getAdjacentMonth("2026-12", 1)).toBe("2027-01");
  });

  it("summarizes completed loops and parent-entered questions", () => {
    expect(
      summarizeCalendarMonth(
        [
          {
            answered_think: true,
            asked_new_question: true,
            listened: true,
            sessionDate: "2026-07-01",
            taught_back: true
          },
          {
            answered_think: true,
            asked_new_question: false,
            listened: true,
            sessionDate: "2026-07-02",
            taught_back: true
          }
        ],
        [
          { date: "2026-07-01", id: "question-1" },
          { date: "2026-07-02", id: "question-2" }
        ]
      )
    ).toEqual({ completedLoops: 1, questionCount: 2 });
  });
});
