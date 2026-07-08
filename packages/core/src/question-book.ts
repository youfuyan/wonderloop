export type QuestionBookExportEntry = {
  childNickname: string | null;
  createdAt: string;
  episodeTitle: string | null;
  questionText: string;
};

export function buildQuestionBookExport(
  entries: readonly QuestionBookExportEntry[]
): string {
  const lines = ["WonderLoop Question Book", ""];

  for (const entry of entries) {
    lines.push(formatDate(entry.createdAt));
    if (entry.childNickname !== null) {
      lines.push(`Child: ${entry.childNickname}`);
    }
    if (entry.episodeTitle !== null) {
      lines.push(`Episode: ${entry.episodeTitle}`);
    }
    lines.push(entry.questionText);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function isValidQuestionText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 300;
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}
