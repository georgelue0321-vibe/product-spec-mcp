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

  it("should generate domain-specific questions for AI copywriting monetization tools", () => {
    const rawIdea =
      "我想做一个 AI 文案生成工具，用户输入产品介绍，系统帮他生成小红书文案。以后我想收费，可以按次数卖套餐。";
    const readiness = calculateReadiness(rawIdea, {
      monetization: "按次数卖套餐",
      target_users: "小红书博主、电商卖家、品牌运营",
      core_feature: "输入产品信息生成小红书文案",
      platform: "Web",
    });
    const result = generateClarification(
      rawIdea,
      readiness,
      "build_product",
      "web",
      "grill",
      {
        monetization: "按次数卖套餐",
        target_users: "小红书博主、电商卖家、品牌运营",
        core_feature: "输入产品信息生成小红书文案",
        platform: "Web",
      }
    );

    const questionText = result.questions.map((q) => `${q.field} ${q.question} ${q.options.join(" ")}`).join("\n");

    expect(questionText).toContain("generation_output_spec");
    expect(questionText).toContain("llm_provider");
    expect(questionText).toContain("account_and_auth");
    expect(questionText).toContain("payment_and_quota");
    expect(questionText).toContain("content_safety");
    expect(questionText).not.toContain("姓名+电话");
    expect(questionText).not.toContain("Excel");
    expect(questionText).not.toContain("手机号去重");
    expect(questionText).not.toContain("提交后需要审核");
  });
});
