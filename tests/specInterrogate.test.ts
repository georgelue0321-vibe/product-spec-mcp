import { describe, it, expect } from "vitest";
import { generateClarification } from "../src/core/clarificationEngine.js";
import { calculateReadiness } from "../src/core/specReadiness.js";

describe("clarificationEngine", () => {
  it("should generate questions for missing fields", () => {
    const readiness = calculateReadiness("我想做一个报名系统");
    const result = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "unknown",
      "normal"
    );

    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  it("should include default assumptions", () => {
    const readiness = calculateReadiness("我想做一个报名系统");
    const result = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "unknown",
      "normal"
    );

    expect(Object.keys(result.defaultAssumptions).length).toBeGreaterThan(0);
  });

  it("should generate fewer questions when context is provided", () => {
    const readiness = calculateReadiness("我想做一个报名系统", {
      target_user: "学生",
      platform: "web",
      data_persistence: true,
    });
    const result = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "web",
      "normal",
      { target_user: "学生", platform: "web", data_persistence: true }
    );

    expect(result.missingFields.length).toBeLessThan(16);
  });

  it("should generate more questions in grill mode", () => {
    const readiness = calculateReadiness("我想做一个报名系统");
    const normalResult = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "unknown",
      "normal"
    );
    const grillResult = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "unknown",
      "grill"
    );

    expect(grillResult.questions.length).toBeGreaterThanOrEqual(
      normalResult.questions.length
    );
  });

  it("should have correct question structure", () => {
    const readiness = calculateReadiness("我想做一个报名系统");
    const result = generateClarification(
      "我想做一个报名系统",
      readiness,
      "build_product",
      "unknown",
      "normal"
    );

    for (const q of result.questions) {
      expect(q.field).toBeDefined();
      expect(q.question).toBeDefined();
      expect(q.whyImportant).toBeDefined();
      expect(q.options).toBeDefined();
      expect(q.defaultAssumption).toBeDefined();
      expect(q.priority).toBeDefined();
    }
  });
});
