import { describe, expect, it, vi } from "vitest";

import {
  buildDedupedSessionUpdate,
  buildSessionUpsert,
  enqueueSessionUpdate,
  flushQueuedSessionUpdates,
  readSessionRetryQueue,
  sessionRetryQueueKey,
  sessionUpsertConflictTarget
} from "./sessions";
import type { QueuedSessionUpdate } from "./sessions";
import type { Database } from "./database.types";

type DailySessionRow = Database["public"]["Tables"]["daily_sessions"]["Row"];

const session = {
  answered_think: false,
  asked_new_question: false,
  child_profile_id: null,
  completed_at: null,
  created_at: "2026-07-06T00:00:00Z",
  episode_id: "episode-1",
  family_id: "family-1",
  id: "session-1",
  language_mode: "bilingual",
  listened: false,
  loop_complete: false,
  predict_choice: null,
  recall_answered: false,
  session_date: "2026-07-06",
  taught_back: false,
  updated_at: "2026-07-06T00:00:00Z"
} satisfies DailySessionRow;

describe("session upsert payload", () => {
  it("uses the family and episode unique constraint", () => {
    expect(sessionUpsertConflictTarget).toBe("family_id,episode_id");
    expect(
      buildSessionUpsert("family-1", {
        childProfileId: "child-1",
        episodeId: "episode-1",
        languageMode: "bilingual"
      })
    ).toEqual({
      child_profile_id: "child-1",
      episode_id: "episode-1",
      family_id: "family-1",
      language_mode: "bilingual"
    });
  });
});

describe("buildDedupedSessionUpdate", () => {
  it("does not rewrite fields already set to true", () => {
    expect(
      buildDedupedSessionUpdate(
        {
          ...session,
          answered_think: true,
          listened: true
        },
        {
          answered_think: true,
          listened: true,
          taught_back: true
        }
      )
    ).toEqual({ taught_back: true });
  });

  it("keeps predict choice updates when the selected option changes", () => {
    expect(
      buildDedupedSessionUpdate(
        { ...session, predict_choice: "a" },
        { predict_choice: "b" }
      )
    ).toEqual({ predict_choice: "b" });
  });
});

describe("session retry queue", () => {
  it("queues a failed offline update in local storage", () => {
    const storage = createMemoryStorage();

    enqueueSessionUpdate("session-1", { answered_think: true }, storage);

    expect(readSessionRetryQueue(storage)).toEqual([
      {
        attempts: 0,
        queuedAt: expect.any(String) as string,
        sessionId: "session-1",
        update: { answered_think: true }
      }
    ]);
  });

  it("flushes queued updates and clears storage after success", async () => {
    const storage = createMemoryStorage();
    const sendUpdate = vi
      .fn<(item: QueuedSessionUpdate) => Promise<void>>()
      .mockResolvedValue(undefined);
    enqueueSessionUpdate("session-1", { taught_back: true }, storage);

    await expect(flushQueuedSessionUpdates(sendUpdate, storage)).resolves.toBe(1);

    const sentItem = sendUpdate.mock.calls[0]?.[0];
    expect(sentItem?.attempts).toBe(0);
    expect(typeof sentItem?.queuedAt).toBe("string");
    expect(sentItem?.sessionId).toBe("session-1");
    expect(sentItem?.update).toEqual({ taught_back: true });
    expect(storage.getItem(sessionRetryQueueKey)).toBeNull();
  });

  it("keeps failed queued updates with an incremented attempt count", async () => {
    const storage = createMemoryStorage();
    const sendUpdate = vi
      .fn<(item: QueuedSessionUpdate) => Promise<void>>()
      .mockRejectedValue(new Error("offline"));
    enqueueSessionUpdate("session-1", { asked_new_question: true }, storage);

    await expect(flushQueuedSessionUpdates(sendUpdate, storage)).resolves.toBe(0);

    expect(readSessionRetryQueue(storage)).toEqual([
      {
        attempts: 1,
        queuedAt: expect.any(String) as string,
        sessionId: "session-1",
        update: { asked_new_question: true }
      }
    ]);
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
