import { NextResponse } from "next/server";
import { createWonderLoopClient } from "@wonderloop/api-client";
import { derivePlayerPlan, EpisodeSegmentSchema } from "@wonderloop/core";
import type {
  EpisodeSegment,
  PlayerAccess,
  PlayerLanguageMode
} from "@wonderloop/core";

export const runtime = "nodejs";

const signedUrlExpiresInSeconds = 60 * 60 * 2;

type AudioUrlRequest = {
  episodeId: string;
  languageMode: PlayerLanguageMode;
};

type FullEpisodeRpcResponse = {
  access: PlayerAccess;
  audio: unknown;
  content: {
    segments: EpisodeSegment[];
  };
};

export async function POST(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ") !== true) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 403 });
  }

  const body = await readAudioUrlRequest(request);
  if (body === null) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const env = readSupabaseEnv();
  if (env === null) {
    return NextResponse.json({ error: "missing_configuration" }, { status: 500 });
  }

  const userClient = createWonderLoopClient(env.url, env.anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data, error } = await userClient.rpc("get_full_episode", {
    p_episode_id: body.episodeId
  });

  if (error !== null || data === null) {
    return NextResponse.json({ error: "episode_unavailable" }, { status: 403 });
  }

  const episode = parseRpcEpisode(data);
  if (episode === null) {
    return NextResponse.json({ error: "invalid_episode_payload" }, { status: 500 });
  }

  if (episode.access === "story_only") {
    return NextResponse.json({ error: "paywall_required" }, { status: 403 });
  }

  const plan = derivePlayerPlan(episode, body.languageMode);
  const serviceClient = createWonderLoopClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false }
  });
  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from("episode-audio")
    .createSignedUrl(plan.audioPath, signedUrlExpiresInSeconds);

  if (signedUrlError !== null) {
    return NextResponse.json({ error: "audio_unavailable" }, { status: 404 });
  }

  return NextResponse.json({
    audioUrl: signedUrlData.signedUrl,
    expiresIn: signedUrlExpiresInSeconds,
    plan
  });
}

async function readAudioUrlRequest(request: Request): Promise<AudioUrlRequest | null> {
  const body: unknown = await request.json().catch(() => null);

  if (!isRecord(body)) {
    return null;
  }

  const { episodeId, languageMode } = body;
  if (typeof episodeId !== "string" || episodeId.length === 0) {
    return null;
  }

  if (languageMode !== "en" && languageMode !== "zh" && languageMode !== "bilingual") {
    return null;
  }

  return { episodeId, languageMode };
}

function readSupabaseEnv(): {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || anonKey === undefined || serviceRoleKey === undefined) {
    return null;
  }

  return { anonKey, serviceRoleKey, url };
}

function parseRpcEpisode(data: unknown): FullEpisodeRpcResponse | null {
  if (!isRecord(data)) {
    return null;
  }

  const access = data.access;
  if (access !== "full" && access !== "story_only") {
    return null;
  }

  if (!isRecord(data.content) || !Array.isArray(data.content.segments)) {
    return null;
  }

  const parsedSegments: EpisodeSegment[] = [];
  for (const segment of data.content.segments) {
    const result = EpisodeSegmentSchema.safeParse(segment);
    if (!result.success) {
      return null;
    }

    parsedSegments.push(result.data);
  }

  return {
    access,
    audio: data.audio,
    content: {
      segments: parsedSegments
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
