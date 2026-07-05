import { z } from "zod";

export const AgeBandSchema = z.enum(["5-6", "6-8", "5-8"]);
export const SensitivitySchema = z.enum(["none", "low", "high"]);

const BilingualTextSchema = z
  .object({
    en: z.string().min(1),
    zh: z.string().min(1)
  })
  .strict();

const PredictOptionSchema = z
  .object({
    id: z.string().min(1),
    en: z.string().min(1),
    zh: z.string().min(1)
  })
  .strict();

const HookSegmentSchema = z
  .object({
    type: z.literal("hook"),
    pause_after: z.literal(false),
    script: BilingualTextSchema
  })
  .strict();

const PredictSegmentSchema = z
  .object({
    type: z.literal("predict"),
    pause_after: z.literal(true),
    question: BilingualTextSchema,
    options: z.array(PredictOptionSchema).min(2),
    no_wrong_answer_note: BilingualTextSchema
  })
  .strict();

const StorySegmentSchema = z
  .object({
    type: z.literal("story"),
    pause_after: z.literal(false),
    script: BilingualTextSchema
  })
  .strict();

const ThinkSegmentSchema = z
  .object({
    type: z.literal("think"),
    pause_after: z.literal(true),
    question: BilingualTextSchema,
    answer_guidance: BilingualTextSchema
  })
  .strict();

const TeachBackSegmentSchema = z
  .object({
    type: z.literal("teach_back"),
    pause_after: z.literal(true),
    prompt: BilingualTextSchema
  })
  .strict();

const NewQuestionSegmentSchema = z
  .object({
    type: z.literal("new_question"),
    pause_after: z.literal(true),
    prompt: BilingualTextSchema
  })
  .strict();

export const EpisodeSegmentSchema = z.discriminatedUnion("type", [
  HookSegmentSchema,
  PredictSegmentSchema,
  StorySegmentSchema,
  ThinkSegmentSchema,
  TeachBackSegmentSchema,
  NewQuestionSegmentSchema
]);

export const EpisodeContentSchema = z
  .object({
    topic_id: z.string().min(1),
    version: z.literal(1),
    age_band: AgeBandSchema,
    category: z.string().min(1),
    title: BilingualTextSchema,
    knowledge_outline: z.array(z.string().min(1)).min(1),
    fact_claims: z
      .array(
        z
          .object({
            claim: z.string().min(1),
            source_url: z.string().url(),
            source_note: z.string().min(1)
          })
          .strict()
      )
      .min(1),
    segments: z.tuple([
      HookSegmentSchema,
      PredictSegmentSchema,
      StorySegmentSchema,
      ThinkSegmentSchema,
      TeachBackSegmentSchema,
      NewQuestionSegmentSchema
    ]),
    recall_question: z
      .object({
        en: z.string().min(1),
        zh: z.string().min(1),
        answer_hint: BilingualTextSchema
      })
      .strict(),
    bilingual_bridge: z
      .array(
        z
          .object({
            en: z.string().min(1),
            zh: z.string().min(1),
            pinyin: z.string().min(1)
          })
          .strict()
      )
      .min(1),
    sensitivity: SensitivitySchema,
    estimated_duration_sec: z
      .object({
        en: z.number().int().positive(),
        zh: z.number().int().positive()
      })
      .strict()
  })
  .strict();

export type AgeBand = z.infer<typeof AgeBandSchema>;
export type EpisodeContent = z.infer<typeof EpisodeContentSchema>;
export type EpisodeSegment = z.infer<typeof EpisodeSegmentSchema>;
export type Sensitivity = z.infer<typeof SensitivitySchema>;
