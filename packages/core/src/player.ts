import { z } from "zod";

import type { EpisodeSegment } from "./types/episode";

export type AudioLanguage = "en" | "zh";
export type PlayerAccess = "full" | "story_only";
export type PlayerLanguageMode = AudioLanguage | "bilingual";
export type PlayerSegmentType = EpisodeSegment["type"];

const playerSegmentTypes = [
  "hook",
  "predict",
  "story",
  "think",
  "teach_back",
  "new_question"
] as const satisfies readonly PlayerSegmentType[];

const AudioSegmentSchema = z
  .object({
    type: z.enum(playerSegmentTypes),
    start: z.number().nonnegative(),
    end: z.number().positive()
  })
  .strict()
  .refine((segment) => segment.end > segment.start, {
    message: "Audio segment end must be after start."
  });

const AudioTrackSchema = z
  .object({
    path: z.string().min(1),
    duration_sec: z.number().positive(),
    segments: z.array(AudioSegmentSchema).min(1)
  })
  .strict();

export const EpisodeAudioSchema = z
  .object({
    en: AudioTrackSchema.optional(),
    zh: AudioTrackSchema.optional()
  })
  .strict()
  .refine((audio) => audio.en !== undefined || audio.zh !== undefined, {
    message: "At least one audio language is required."
  });

export type AudioSegment = z.infer<typeof AudioSegmentSchema>;
export type EpisodeAudio = z.infer<typeof EpisodeAudioSchema>;

export type PlayerEpisode = {
  access?: PlayerAccess;
  audio: unknown;
  content: {
    segments: readonly EpisodeSegment[];
  };
};

export type PlayerSegment = AudioSegment & {
  index: number;
  pauseAfter: boolean;
};

export type SegmentBoundary = {
  segmentIndex: number;
  segmentType: PlayerSegmentType;
  at: number;
  resumeAt: number | null;
};

export type PlayerPlan = {
  access: PlayerAccess;
  audioLanguage: AudioLanguage;
  audioPath: string;
  durationSec: number;
  languageMode: PlayerLanguageMode;
  pauseToleranceSec: number;
  segments: PlayerSegment[];
};

const pauseToleranceSec = 0.3;

export function derivePlayerPlan(
  episode: PlayerEpisode,
  languageMode: PlayerLanguageMode
): PlayerPlan {
  const audio = EpisodeAudioSchema.parse(episode.audio);
  const audioLanguage = chooseAudioLanguage(audio, languageMode);
  const track = audio[audioLanguage];

  if (track === undefined) {
    throw new Error("Selected audio track is unavailable.");
  }

  const visibleSegmentTypes = new Set(
    episode.content.segments.map((segment) => segment.type)
  );
  const contentSegmentByType = new Map(
    episode.content.segments.map((segment) => [segment.type, segment])
  );
  const segments = track.segments
    .filter((segment) => visibleSegmentTypes.has(segment.type))
    .map((segment, index): PlayerSegment => {
      const contentSegment = contentSegmentByType.get(segment.type);
      return {
        ...segment,
        index,
        pauseAfter: contentSegment?.pause_after ?? false
      };
    });

  if (segments.length === 0) {
    throw new Error("Audio track has no playable segments.");
  }

  const access = episode.access ?? inferAccessFromSegments(segments);

  return {
    access,
    audioLanguage,
    audioPath: track.path,
    durationSec:
      access === "story_only"
        ? Math.max(...segments.map((segment) => segment.end))
        : track.duration_sec,
    languageMode,
    pauseToleranceSec,
    segments
  };
}

export function shouldPauseAt(
  plan: PlayerPlan,
  currentTime: number
): SegmentBoundary | null {
  for (const segment of plan.segments) {
    if (!segment.pauseAfter) {
      continue;
    }

    if (Math.abs(currentTime - segment.end) <= plan.pauseToleranceSec) {
      const nextSegment = plan.segments[segment.index + 1];
      return {
        at: segment.end,
        resumeAt: nextSegment?.start ?? null,
        segmentIndex: segment.index,
        segmentType: segment.type
      };
    }
  }

  return null;
}

function chooseAudioLanguage(
  audio: EpisodeAudio,
  languageMode: PlayerLanguageMode
): AudioLanguage {
  const preferredLanguage: AudioLanguage = languageMode === "en" ? "en" : "zh";
  const fallbackLanguage: AudioLanguage = preferredLanguage === "en" ? "zh" : "en";

  if (audio[preferredLanguage] !== undefined) {
    return preferredLanguage;
  }

  if (audio[fallbackLanguage] !== undefined) {
    return fallbackLanguage;
  }

  throw new Error("No audio track is available.");
}

function inferAccessFromSegments(segments: readonly PlayerSegment[]): PlayerAccess {
  const segmentTypes = new Set(segments.map((segment) => segment.type));
  const storyOnly =
    segmentTypes.size > 0 &&
    [...segmentTypes].every((type) => type === "hook" || type === "story");

  return storyOnly ? "story_only" : "full";
}
