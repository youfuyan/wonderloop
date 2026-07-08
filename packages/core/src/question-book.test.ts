import { describe, expect, it } from "vitest";

import { buildQuestionBookExport, isValidQuestionText } from "./question-book";

describe("buildQuestionBookExport", () => {
  it("generates plain text question-book seeds", () => {
    expect(
      buildQuestionBookExport([
        {
          childNickname: "Seed Kid",
          createdAt: "2026-07-07T12:00:00.000Z",
          episodeTitle: "为什么小鸟站在电线上不会触电？",
          questionText: "为什么云会飘？"
        }
      ])
    ).toBe(
      [
        "WonderLoop Question Book",
        "",
        "2026-07-07",
        "Child: Seed Kid",
        "Episode: 为什么小鸟站在电线上不会触电？",
        "为什么云会飘？",
        ""
      ].join("\n")
    );
  });
});

describe("isValidQuestionText", () => {
  it("matches the database length boundary", () => {
    expect(isValidQuestionText("")).toBe(false);
    expect(isValidQuestionText("  ")).toBe(false);
    expect(isValidQuestionText("a".repeat(300))).toBe(true);
    expect(isValidQuestionText("a".repeat(301))).toBe(false);
  });
});
