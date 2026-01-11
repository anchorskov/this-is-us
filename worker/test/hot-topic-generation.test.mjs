// worker/test/hot-topic-generation.test.mjs

import {
  isValidHotTopicLabel,
  pickHotTopicLabel,
  slugifyHotTopicLabel,
  generateHotTopicCandidates,
} from "../src/lib/billSummaryAnalyzer.mjs";

describe("Hot topic helpers", () => {
  test("validates two-word Title Case labels", () => {
    expect(isValidHotTopicLabel("Public Safety")).toBe(true);
    expect(isValidHotTopicLabel("public safety")).toBe(false);
    expect(isValidHotTopicLabel("Public-Safety")).toBe(false);
    expect(isValidHotTopicLabel("Public")).toBe(false);
  });

  test("fallbacks to heuristic when OpenAI label is invalid", () => {
    const candidates = ["Public Safety", "Education Funding"];
    const label = pickHotTopicLabel("Bad-Label", candidates);
    expect(label).toBe("Public Safety");
  });

  test("slug generation is stable", () => {
    expect(slugifyHotTopicLabel("Public Safety")).toBe("public-safety");
  });

  test("heuristic candidates return at least one result", () => {
    const candidates = generateHotTopicCandidates(
      "This bill expands education funding for rural schools and teacher pay."
    );
    expect(candidates.length).toBeGreaterThan(0);
  });
});
