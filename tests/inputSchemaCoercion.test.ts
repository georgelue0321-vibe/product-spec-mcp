import { describe, expect, it } from "vitest";
import { ProductSpecAssistInputSchema } from "../src/schemas/productSpecAssist.schema.js";
import { SpecCompileInputSchema } from "../src/schemas/specCompile.schema.js";
import { ArchitectureDecideInputSchema } from "../src/schemas/architectureDecide.schema.js";
import { AcceptanceGenerateInputSchema } from "../src/schemas/acceptanceGenerate.schema.js";

describe("input schema coercion", () => {
  it("coerces string booleans for product_spec_assist", () => {
    const result = ProductSpecAssistInputSchema.parse({
      message: "家庭药品管理工具",
      auto_execute: "false",
    });

    expect(result.auto_execute).toBe(false);
  });

  it("coerces string booleans and numbers for spec_compile", () => {
    const result = SpecCompileInputSchema.parse({
      raw_idea: "家庭药品管理工具",
      allow_assumptions: "true",
      min_readiness_score: "60",
    });

    expect(result.allow_assumptions).toBe(true);
    expect(result.min_readiness_score).toBe(60);
  });

  it("coerces WorkBuddy-style item arrays for architecture_decide", () => {
    const result = ArchitectureDecideInputSchema.parse({
      product_type: "家庭药品管理工具",
      platform: "web",
      features: { item: ["药品记录", "过期提醒"] },
      commercial_intent: "false",
    });

    expect(result.features).toEqual(["药品记录", "过期提醒"]);
    expect(result.commercial_intent).toBe(false);
  });

  it("coerces WorkBuddy-style item arrays and booleans for acceptance_generate", () => {
    const result = AcceptanceGenerateInputSchema.parse({
      product_type: "家庭药品管理工具",
      platform: "web",
      features: { item: ["药品记录", "过期提醒"] },
      has_backend: "false",
      has_payment: "false",
      has_auth: "false",
    });

    expect(result.features).toEqual(["药品记录", "过期提醒"]);
    expect(result.has_backend).toBe(false);
    expect(result.has_payment).toBe(false);
    expect(result.has_auth).toBe(false);
  });
});
