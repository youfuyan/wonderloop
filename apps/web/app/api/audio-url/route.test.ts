import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();
  const from = vi.fn(() => ({ createSignedUrl }));
  const createWonderLoopClient = vi.fn((_url: string, key: string) =>
    key === "service-role-test-key" ? { storage: { from } } : { rpc }
  );

  return {
    createSignedUrl,
    createWonderLoopClient,
    from,
    rpc
  };
});

vi.mock("@wonderloop/api-client", () => ({
  createWonderLoopClient: mocks.createWonderLoopClient
}));

const fullSegments = [
  {
    pause_after: false,
    script: { en: "Hook", zh: "开头" },
    type: "hook"
  },
  {
    no_wrong_answer_note: { en: "Guess first.", zh: "先猜。" },
    options: [
      { en: "A", id: "a", zh: "甲" },
      { en: "B", id: "b", zh: "乙" }
    ],
    pause_after: true,
    question: { en: "Guess?", zh: "猜猜？" },
    type: "predict"
  },
  {
    pause_after: false,
    script: { en: "Story", zh: "故事" },
    type: "story"
  },
  {
    answer_guidance: { en: "Guide", zh: "提示" },
    pause_after: true,
    question: { en: "Think?", zh: "想想？" },
    type: "think"
  },
  {
    pause_after: true,
    prompt: { en: "Teach back", zh: "讲给爸妈听" },
    type: "teach_back"
  },
  {
    pause_after: true,
    prompt: { en: "New question", zh: "新问题" },
    type: "new_question"
  }
] as const;

const audio = {
  en: {
    duration_sec: 120,
    path: "episodes/sample.en.mp3",
    segments: [
      { end: 10, start: 0, type: "hook" },
      { end: 20, start: 10, type: "predict" },
      { end: 70, start: 20, type: "story" },
      { end: 80, start: 70, type: "think" },
      { end: 95, start: 80, type: "teach_back" },
      { end: 110, start: 95, type: "new_question" }
    ]
  },
  zh: {
    duration_sec: 132,
    path: "episodes/sample.zh.mp3",
    segments: [
      { end: 12, start: 0, type: "hook" },
      { end: 24, start: 12, type: "predict" },
      { end: 78, start: 24, type: "story" },
      { end: 90, start: 78, type: "think" },
      { end: 108, start: 90, type: "teach_back" },
      { end: 124, start: 108, type: "new_question" }
    ]
  }
};

describe("POST /api/audio-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it("refuses story-only access before signing a storage URL", async () => {
    const { POST } = await import("./route");
    mocks.rpc.mockResolvedValue({
      data: {
        access: "story_only",
        audio,
        content: { segments: [fullSegments[0], fullSegments[2]] }
      },
      error: null
    });

    const response = await POST(audioUrlRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "paywall_required" });
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs the selected audio path for full access", async () => {
    const { POST } = await import("./route");
    mocks.rpc.mockResolvedValue({
      data: {
        access: "full",
        audio,
        content: { segments: fullSegments }
      },
      error: null
    });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed" },
      error: null
    });

    const response = await POST(audioUrlRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("episode-audio");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("episodes/sample.zh.mp3", 7200);
    expect(isRecord(body) ? body.audioUrl : null).toBe(
      "https://storage.example/signed"
    );
  });

  it("returns 403 without bearer auth", async () => {
    const { POST } = await import("./route");

    const response = await POST(audioUrlRequest({ authorization: null }));

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});

function audioUrlRequest({
  authorization = "Bearer session-token"
}: {
  authorization?: string | null;
} = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }

  return new Request("http://localhost/api/audio-url", {
    body: JSON.stringify({
      episodeId: "00000000-0000-0000-0000-000000000001",
      languageMode: "bilingual"
    }),
    headers,
    method: "POST"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
