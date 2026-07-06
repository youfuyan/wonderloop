import { describe, expect, it } from "vitest";

import { derivePlayerPlan, shouldPauseAt } from "./player";
import type { PlayerEpisode } from "./player";
import type { EpisodeSegment } from "./types/episode";

const hookSegment: EpisodeSegment = {
  type: "hook",
  pause_after: false,
  script: { en: "Hook", zh: "开头" }
};

const predictSegment: EpisodeSegment = {
  type: "predict",
  pause_after: true,
  question: { en: "Guess?", zh: "猜猜？" },
  options: [
    { id: "a", en: "A", zh: "甲" },
    { id: "b", en: "B", zh: "乙" }
  ],
  no_wrong_answer_note: { en: "Guess first.", zh: "先猜。" }
};

const storySegment: EpisodeSegment = {
  type: "story",
  pause_after: false,
  script: { en: "Story", zh: "故事" }
};

const thinkSegment: EpisodeSegment = {
  type: "think",
  pause_after: true,
  question: { en: "Think?", zh: "想想？" },
  answer_guidance: { en: "Guide", zh: "提示" }
};

const teachBackSegment: EpisodeSegment = {
  type: "teach_back",
  pause_after: true,
  prompt: { en: "Teach back", zh: "讲给爸妈听" }
};

const newQuestionSegment: EpisodeSegment = {
  type: "new_question",
  pause_after: true,
  prompt: { en: "New question", zh: "新问题" }
};

const segments: EpisodeSegment[] = [
  hookSegment,
  predictSegment,
  storySegment,
  thinkSegment,
  teachBackSegment,
  newQuestionSegment
];

const audio = {
  en: {
    path: "episodes/sample.en.mp3",
    duration_sec: 120,
    segments: [
      { type: "hook", start: 0, end: 10 },
      { type: "predict", start: 10, end: 20 },
      { type: "story", start: 20, end: 70 },
      { type: "think", start: 70, end: 80 },
      { type: "teach_back", start: 80, end: 95 },
      { type: "new_question", start: 95, end: 110 }
    ]
  },
  zh: {
    path: "episodes/sample.zh.mp3",
    duration_sec: 132,
    segments: [
      { type: "hook", start: 0, end: 12 },
      { type: "predict", start: 12, end: 24 },
      { type: "story", start: 24, end: 78 },
      { type: "think", start: 78, end: 90 },
      { type: "teach_back", start: 90, end: 108 },
      { type: "new_question", start: 108, end: 124 }
    ]
  }
};

const fullEpisode: PlayerEpisode = {
  access: "full",
  audio,
  content: { segments }
};

describe("derivePlayerPlan", () => {
  it("selects English audio for English mode", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(plan.audioLanguage).toBe("en");
    expect(plan.audioPath).toBe("episodes/sample.en.mp3");
  });

  it("selects Chinese audio for Chinese mode", () => {
    const plan = derivePlayerPlan(fullEpisode, "zh");

    expect(plan.audioLanguage).toBe("zh");
    expect(plan.audioPath).toBe("episodes/sample.zh.mp3");
  });

  it("defaults bilingual mode to Chinese audio", () => {
    const plan = derivePlayerPlan(fullEpisode, "bilingual");

    expect(plan.audioLanguage).toBe("zh");
  });

  it("falls back to the available track when preferred audio is missing", () => {
    const plan = derivePlayerPlan(
      {
        ...fullEpisode,
        audio: { en: audio.en }
      },
      "zh"
    );

    expect(plan.audioLanguage).toBe("en");
  });

  it("keeps full access duration from the selected track", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(plan.access).toBe("full");
    expect(plan.durationSec).toBe(120);
  });

  it("marks only interactive content segments as pause boundaries", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(plan.segments.map((segment) => segment.pauseAfter)).toEqual([
      false,
      true,
      false,
      true,
      true,
      true
    ]);
  });

  it("filters story-only plans to hook and story segments", () => {
    const storyOnly = derivePlayerPlan(
      {
        access: "story_only",
        audio,
        content: { segments: [hookSegment, storySegment] }
      },
      "en"
    );

    expect(storyOnly.segments.map((segment) => segment.type)).toEqual([
      "hook",
      "story"
    ]);
    expect(storyOnly.durationSec).toBe(70);
  });

  it("infers story-only access from visible hook and story segments", () => {
    const storyOnly = derivePlayerPlan(
      {
        audio,
        content: { segments: [hookSegment, storySegment] }
      },
      "en"
    );

    expect(storyOnly.access).toBe("story_only");
  });

  it("throws for malformed audio metadata", () => {
    expect(() =>
      derivePlayerPlan({ audio: {}, content: { segments } }, "en")
    ).toThrow();
  });
});

describe("shouldPauseAt", () => {
  it("returns null before a pause boundary", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 19.6)).toBeNull();
  });

  it("matches a pause boundary within tolerance", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 19.8)).toEqual({
      at: 20,
      resumeAt: 20,
      segmentIndex: 1,
      segmentType: "predict"
    });
  });

  it("matches a pause boundary exactly", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 80)?.segmentType).toBe("think");
  });

  it("does not pause for non-interactive story boundaries", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 70)).toBeNull();
  });

  it("does not pause after the tolerance window", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 20.31)).toBeNull();
  });

  it("returns null for story-only plans with no interactive pauses", () => {
    const plan = derivePlayerPlan(
      {
        access: "story_only",
        audio,
        content: { segments: [hookSegment, storySegment] }
      },
      "en"
    );

    expect(shouldPauseAt(plan, 70)).toBeNull();
  });

  it("uses null resume time for the final segment boundary", () => {
    const plan = derivePlayerPlan(fullEpisode, "en");

    expect(shouldPauseAt(plan, 110)?.resumeAt).toBeNull();
  });
});
