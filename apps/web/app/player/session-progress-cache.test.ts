import { describe, expect, it } from "vitest";

import {
  clearSessionProgress,
  loadSessionProgress,
  resumePromptText,
  saveSessionProgress
} from "./session-progress-cache";
import { initialLoopState } from "@wonderloop/core";

describe("session progress cache", () => {
  it("restores cached audio time and loop state", () => {
    const storage = createMemoryStorage();
    saveSessionProgress(
      {
        currentTime: 123,
        episodeId: "episode-1",
        loopState: { ...initialLoopState, listened: true, status: "think_paused" }
      },
      storage
    );

    const progress = loadSessionProgress("episode-1", storage);

    expect(progress?.currentTime).toBe(123);
    expect(progress?.loopState.status).toBe("think_paused");
    expect(progress === null ? "" : resumePromptText(progress)).toContain("想一想");
  });

  it("ignores progress for a different episode and clears current progress", () => {
    const storage = createMemoryStorage();
    saveSessionProgress(
      {
        currentTime: 42,
        episodeId: "episode-1",
        loopState: initialLoopState
      },
      storage
    );

    expect(loadSessionProgress("episode-2", storage)).toBeNull();
    clearSessionProgress("episode-1", storage);
    expect(loadSessionProgress("episode-1", storage)).toBeNull();
  });
});

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    clear() {
      items.clear();
    },
    getItem(key) {
      return items.get(key) ?? null;
    },
    key(index) {
      return Array.from(items.keys())[index] ?? null;
    },
    get length() {
      return items.size;
    },
    removeItem(key) {
      items.delete(key);
    },
    setItem(key, value) {
      items.set(key, value);
    }
  };
}
