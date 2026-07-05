import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sqlPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/0001_init.sql"
);

const expectedSqlFields = [
  "listened",
  "answered_think",
  "taught_back",
  "asked_new_question"
] as const;

describe("loop_complete SQL consistency", () => {
  it("uses the same four inputs as packages/core isLoopComplete", () => {
    const sql = readFileSync(sqlPath, "utf8");
    const loopCompleteExpression =
      /loop_complete\s+boolean\s+generated\s+always\s+as\s*\((?<expression>[^)]+)\)\s+stored/ims;
    const match = loopCompleteExpression.exec(sql);
    const expression = match?.groups?.expression;

    expect(expression).toBeDefined();
    if (expression === undefined) {
      throw new Error("Missing loop_complete generated column expression");
    }

    const tokens = expression.match(/\b[a-z_]+\b/g) ?? [];
    const fields = tokens.filter((token) => token !== "and");

    expect(fields).toEqual([...expectedSqlFields]);
  });
});
