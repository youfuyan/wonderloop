"use client";

import { useEffect, useState } from "react";
import type {
  EpisodeContent,
  EpisodeSegment,
  PlayerLanguageMode,
  PlayerSegmentType,
  RecallPlan
} from "@wonderloop/core";

type LoopCardsProps = {
  bridge: EpisodeContent["bilingual_bridge"];
  languageMode: PlayerLanguageMode;
  segment: EpisodeSegment | null;
  status:
    | "predict_paused"
    | "think_paused"
    | "teach_back_paused"
    | "new_question_paused"
    | "completed";
  onAnswer: (payload?: { predictChoice?: string; questionText?: string }) => void;
  onSkip: () => void;
};

type BilingualText = {
  en: string;
  zh: string;
};

export function RecallCard({
  languageMode,
  plan,
  onAnswered,
  onContinue
}: {
  languageMode: PlayerLanguageMode;
  plan: RecallPlan;
  onAnswered: () => void;
  onContinue: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);

  function answerRecall() {
    if (!answered) {
      setAnswered(true);
      onAnswered();
    }
  }

  return (
    <section className="loopCard recallCard" aria-live="polite">
      <CardText text={plan.recallQuestion} languageMode={languageMode} />
      <div className="loopCardActions">
        <button
          onClick={() => {
            answerRecall();
            onContinue();
          }}
          type="button"
        >
          Remembered / 记得！
        </button>
        <button
          className="secondaryButton"
          onClick={() => {
            answerRecall();
            setShowHint(true);
          }}
          type="button"
        >
          A Bit Fuzzy / 有点忘了
        </button>
      </div>
      {showHint ? (
        <div className="loopCardNote">
          <CardText
            text={plan.recallQuestion.answer_hint}
            languageMode={languageMode}
          />
          <button onClick={onContinue} type="button">
            Continue / 继续
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function LoopCards({
  bridge,
  languageMode,
  segment,
  status,
  onAnswer,
  onSkip
}: LoopCardsProps) {
  if (status === "completed") {
    return <CompletionCard bridge={bridge} languageMode={languageMode} />;
  }

  if (status === "predict_paused" && segment?.type === "predict") {
    return (
      <PredictCard
        languageMode={languageMode}
        segment={segment}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />
    );
  }

  if (status === "think_paused" && segment?.type === "think") {
    return (
      <ThinkCard
        languageMode={languageMode}
        segment={segment}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />
    );
  }

  if (status === "teach_back_paused" && segment?.type === "teach_back") {
    return (
      <TeachBackCard
        languageMode={languageMode}
        segment={segment}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />
    );
  }

  if (status === "new_question_paused" && segment?.type === "new_question") {
    return (
      <NewQuestionCard
        languageMode={languageMode}
        segment={segment}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />
    );
  }

  return null;
}

function PredictCard({
  languageMode,
  segment,
  onAnswer,
  onSkip
}: {
  languageMode: PlayerLanguageMode;
  segment: Extract<EpisodeSegment, { type: "predict" }>;
  onAnswer: (payload?: { predictChoice?: string }) => void;
  onSkip: () => void;
}) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  return (
    <section className="loopCard" aria-live="polite">
      <CardText text={segment.question} languageMode={languageMode} />
      <div className="predictOptions">
        {segment.options.map((option) => (
          <button
            className={selectedChoice === option.id ? "selectedOption" : undefined}
            key={option.id}
            onClick={() => {
              setSelectedChoice(option.id);
            }}
            type="button"
          >
            <CardText text={option} languageMode={languageMode} />
          </button>
        ))}
      </div>
      {selectedChoice !== null ? (
        <div className="loopCardNote">
          <CardText text={segment.no_wrong_answer_note} languageMode={languageMode} />
          <button
            onClick={() => {
              onAnswer({ predictChoice: selectedChoice });
            }}
            type="button"
          >
            Continue / 继续
          </button>
        </div>
      ) : null}
      <button className="secondaryButton" onClick={onSkip} type="button">
        Skip / 跳过
      </button>
    </section>
  );
}

function ThinkCard({
  languageMode,
  segment,
  onAnswer,
  onSkip
}: {
  languageMode: PlayerLanguageMode;
  segment: Extract<EpisodeSegment, { type: "think" }>;
  onAnswer: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="loopCard" aria-live="polite">
      <CardText text={segment.question} languageMode={languageMode} />
      <details className="answerGuidance">
        <summary>Reference for parent / 给家长的参考答案</summary>
        <CardText text={segment.answer_guidance} languageMode={languageMode} />
      </details>
      <div className="loopCardActions">
        <button onClick={onAnswer} type="button">
          Child Answered / 孩子回答了
        </button>
        <button className="secondaryButton" onClick={onSkip} type="button">
          Skip / 跳过
        </button>
      </div>
    </section>
  );
}

function TeachBackCard({
  languageMode,
  segment,
  onAnswer,
  onSkip
}: {
  languageMode: PlayerLanguageMode;
  segment: Extract<EpisodeSegment, { type: "teach_back" }>;
  onAnswer: () => void;
  onSkip: () => void;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="loopCard" aria-live="polite">
      <CardText text={segment.prompt} languageMode={languageMode} />
      <div className="countdownTrack" aria-hidden="true">
        <span
          style={{
            width: `${String((secondsRemaining / 30) * 100)}%`
          }}
        />
      </div>
      <p className="countdownText">
        {String(secondsRemaining)}s / {String(secondsRemaining)} 秒
      </p>
      <div className="loopCardActions">
        <button onClick={onAnswer} type="button">
          Done / 讲完了
        </button>
        <button className="secondaryButton" onClick={onSkip} type="button">
          Skip / 跳过
        </button>
      </div>
    </section>
  );
}

function NewQuestionCard({
  languageMode,
  segment,
  onAnswer,
  onSkip
}: {
  languageMode: PlayerLanguageMode;
  segment: Extract<EpisodeSegment, { type: "new_question" }>;
  onAnswer: (payload?: { questionText?: string }) => void;
  onSkip: () => void;
}) {
  const [questionText, setQuestionText] = useState("");
  const trimmedQuestion = questionText.trim();

  return (
    <section className="loopCard" aria-live="polite">
      <CardText text={segment.prompt} languageMode={languageMode} />
      <label className="parentQuestionField">
        <span>Parent-entered child question / 家长帮孩子记下这个问题</span>
        <textarea
          maxLength={300}
          onChange={(event) => {
            setQuestionText(event.target.value);
          }}
          value={questionText}
        />
      </label>
      <div className="loopCardActions">
        <button
          disabled={trimmedQuestion.length === 0}
          onClick={() => {
            onAnswer({ questionText: trimmedQuestion });
          }}
          type="button"
        >
          Save Question / 记好了
        </button>
        <button className="secondaryButton" onClick={onSkip} type="button">
          No New Question / 没有新问题
        </button>
      </div>
    </section>
  );
}

function CompletionCard({
  bridge,
  languageMode
}: {
  bridge: EpisodeContent["bilingual_bridge"];
  languageMode: PlayerLanguageMode;
}) {
  return (
    <section className="loopCard completionCard" aria-live="polite">
      <p>Loop complete. Nice curious work today.</p>
      <p>今日好奇循环完成。</p>
      {languageMode === "bilingual" ? <BilingualBridgeCard bridge={bridge} /> : null}
    </section>
  );
}

function BilingualBridgeCard({
  bridge
}: {
  bridge: EpisodeContent["bilingual_bridge"];
}) {
  return (
    <div className="bilingualBridgeCard">
      {bridge.slice(0, 3).map((word) => (
        <div className="bridgeWord" key={`${word.zh}-${word.en}`}>
          <strong>{word.zh}</strong>
          <span>{word.pinyin}</span>
          <span>{word.en}</span>
        </div>
      ))}
    </div>
  );
}

function CardText({
  text,
  languageMode
}: {
  text: BilingualText;
  languageMode: PlayerLanguageMode;
}) {
  if (languageMode === "en") {
    return <span>{text.en}</span>;
  }

  if (languageMode === "zh") {
    return <span>{text.zh}</span>;
  }

  return (
    <span className="bilingualLines">
      <span>{text.zh}</span>
      <span>{text.en}</span>
    </span>
  );
}

export function segmentForCard(
  segments: readonly EpisodeSegment[],
  segmentType: PlayerSegmentType
): EpisodeSegment | null {
  return segments.find((segment) => segment.type === segmentType) ?? null;
}
