import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

type DailySessionRow = Database["public"]["Tables"]["daily_sessions"]["Row"];
type DailySessionInsert = Database["public"]["Tables"]["daily_sessions"]["Insert"];
type DailySessionUpdate = Pick<
  DailySessionRow,
  | "answered_think"
  | "asked_new_question"
  | "listened"
  | "predict_choice"
  | "taught_back"
>;
type SessionUpdatePayload = Partial<DailySessionUpdate>;
type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type WonderLoopSupabaseClient = SupabaseClient<Database>;

export type GetOrCreateSessionParams = {
  childProfileId?: string | null;
  episodeId: string;
  languageMode: Database["public"]["Enums"]["language_mode"];
};

export type QueuedSessionUpdate = {
  attempts: number;
  queuedAt: string;
  sessionId: string;
  update: SessionUpdatePayload;
};

export const sessionRetryQueueKey = "wonderloop.sessionRetryQueue.v1";
export const sessionUniqueConflictTarget = "family_id,episode_id";

export async function getOrCreateSession(
  client: WonderLoopSupabaseClient,
  params: GetOrCreateSessionParams
): Promise<DailySessionRow> {
  const existingSession = await getSessionByEpisodeId(client, params.episodeId);
  if (existingSession !== null) {
    return existingSession;
  }

  const familyId = await getCurrentFamilyId(client);
  const { data, error } = await client
    .from("daily_sessions")
    .insert(buildSessionUpsert(familyId, params))
    .select("*")
    .single();

  if (error !== null) {
    if (error.code === "23505") {
      const racedSession = await getSessionByEpisodeId(client, params.episodeId);
      if (racedSession !== null) {
        return racedSession;
      }
    }

    throw new Error(`Unable to get or create daily session: ${error.message}`);
  }

  return data;
}

export async function updateSession(
  client: WonderLoopSupabaseClient,
  sessionId: string,
  partial: SessionUpdatePayload,
  options: { queueOnFailure?: boolean } = {}
): Promise<DailySessionRow> {
  try {
    const current = await getSessionById(client, sessionId);
    const update = buildDedupedSessionUpdate(current, partial);

    if (!hasSessionUpdate(update)) {
      return current;
    }

    const { data, error } = await client
      .from("daily_sessions")
      .update(update)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error !== null) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    if (options.queueOnFailure !== false) {
      enqueueSessionUpdate(sessionId, partial);
    }

    throw error;
  }
}

export async function flushSessionRetryQueue(
  client: WonderLoopSupabaseClient,
  storage = getBrowserStorage()
): Promise<number> {
  return flushQueuedSessionUpdates(async (item) => {
    await updateSession(client, item.sessionId, item.update, {
      queueOnFailure: false
    });
  }, storage);
}

export function buildSessionUpsert(
  familyId: string,
  params: GetOrCreateSessionParams
): DailySessionInsert {
  return {
    child_profile_id: params.childProfileId ?? null,
    episode_id: params.episodeId,
    family_id: familyId,
    language_mode: params.languageMode
  };
}

export function buildDedupedSessionUpdate(
  current: DailySessionRow,
  partial: SessionUpdatePayload
): SessionUpdatePayload {
  const update: SessionUpdatePayload = {};

  if (partial.listened === true && !current.listened) {
    update.listened = true;
  }

  if (partial.answered_think === true && !current.answered_think) {
    update.answered_think = true;
  }

  if (partial.taught_back === true && !current.taught_back) {
    update.taught_back = true;
  }

  if (partial.asked_new_question === true && !current.asked_new_question) {
    update.asked_new_question = true;
  }

  if (
    partial.predict_choice !== undefined &&
    partial.predict_choice !== current.predict_choice
  ) {
    update.predict_choice = partial.predict_choice;
  }

  return update;
}

export function enqueueSessionUpdate(
  sessionId: string,
  update: SessionUpdatePayload,
  storage = getBrowserStorage()
): void {
  if (storage === null || !hasSessionUpdate(update)) {
    return;
  }

  const queue = readSessionRetryQueue(storage);
  queue.push({
    attempts: 0,
    queuedAt: new Date().toISOString(),
    sessionId,
    update
  });
  storage.setItem(sessionRetryQueueKey, JSON.stringify(queue));
}

export function readSessionRetryQueue(
  storage = getBrowserStorage()
): QueuedSessionUpdate[] {
  if (storage === null) {
    return [];
  }

  const rawQueue = storage.getItem(sessionRetryQueueKey);
  if (rawQueue === null) {
    return [];
  }

  const parsed = parseJson(rawQueue);
  return Array.isArray(parsed) ? parsed.filter(isQueuedSessionUpdate) : [];
}

export async function flushQueuedSessionUpdates(
  sendUpdate: (item: QueuedSessionUpdate) => Promise<void>,
  storage = getBrowserStorage()
): Promise<number> {
  if (storage === null) {
    return 0;
  }

  const queue = readSessionRetryQueue(storage);
  const remaining: QueuedSessionUpdate[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      await sendUpdate(item);
      flushed += 1;
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  if (remaining.length === 0) {
    storage.removeItem(sessionRetryQueueKey);
  } else {
    storage.setItem(sessionRetryQueueKey, JSON.stringify(remaining));
  }

  return flushed;
}

function hasSessionUpdate(update: SessionUpdatePayload): boolean {
  return Object.keys(update).length > 0;
}

async function getCurrentFamilyId(client: WonderLoopSupabaseClient): Promise<string> {
  const { data, error } = await client.from("families").select("id").single();

  if (error !== null) {
    throw new Error(error.message);
  }

  return data.id;
}

async function getSessionByEpisodeId(
  client: WonderLoopSupabaseClient,
  episodeId: string
): Promise<DailySessionRow | null> {
  const { data, error } = await client
    .from("daily_sessions")
    .select("*")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(error.message);
  }

  return data;
}

async function getSessionById(
  client: WonderLoopSupabaseClient,
  sessionId: string
): Promise<DailySessionRow> {
  const { data, error } = await client
    .from("daily_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error !== null) {
    throw new Error(error.message);
  }

  return data;
}

function getBrowserStorage(): SessionStorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isQueuedSessionUpdate(value: unknown): value is QueuedSessionUpdate {
  if (!isRecord(value) || !isRecord(value.update)) {
    return false;
  }

  return (
    typeof value.sessionId === "string" &&
    typeof value.queuedAt === "string" &&
    typeof value.attempts === "number"
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
