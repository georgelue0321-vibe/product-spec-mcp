import { describe, it, expect } from "vitest";
import { calculateReadiness } from "../src/core/specReadiness.js";
import { generateClarification } from "../src/core/clarificationEngine.js";
import { buildSpec } from "../src/core/promptBuilder.js";
import { buildConfirmation } from "../src/core/confirmationBuilder.js";
import { decideArchitecture } from "../src/core/architectureEngine.js";
import { translateUiDescription } from "../src/core/uiPromptEngine.js";
import { generateDebugGuide } from "../src/core/debugEngine.js";
import { generateAcceptance } from "../src/core/acceptanceEngine.js";
import {
  buildInterrogateStructuredOutput,
  buildCompileStructuredOutput,
  buildAcceptanceStructuredOutput,
  buildArchitectureStructuredOutput,
  buildUiTranslateStructuredOutput,
  buildDebugGuideStructuredOutput,
} from "../src/core/structuredResultBuilder.js";
import { SpecInterrogateOutputSchema } from "../src/schemas/outputs/specInterrogate.output.js";
import { SpecCompileOutputSchema } from "../src/schemas/outputs/specCompile.output.js";
import { AcceptanceGenerateOutputSchema } from "../src/schemas/outputs/acceptanceGenerate.output.js";
import { ArchitectureDecideOutputSchema } from "../src/schemas/outputs/architectureDecide.output.js";
import { UiTranslateOutputSchema } from "../src/schemas/outputs/uiTranslate.output.js";
import { DebugGuideOutputSchema } from "../src/schemas/outputs/debugGuide.output.js";
import { ProductSpecAssistOutputSchema } from "../src/schemas/outputs/productSpecAssist.output.js";
import { executeAssist } from "../src/core/assistEngine.js";

describe("structuredOutput", () => {
  describe("spec_interrogate", () => {
    it("should return valid structured output", () => {
      const readiness = calculateReadiness("我想做一个报名系统");
      const clarification = generateClarification(
        "我想做一个报名系统",
        readiness,
        "build_product",
        "unknown",
        "normal"
      );
      const output = buildInterrogateStructuredOutput(readiness, clarification);

      expect(output.readiness.score).toBe(readiness.score);
      expect(output.readiness.status).toBe(readiness.status);
      expect(Array.isArray(output.clarification.missingFields)).toBe(true);
      expect(Array.isArray(output.clarification.questions)).toBe(true);
      expect(typeof output.recommendation.canProceed).toBe("boolean");
      expect(output.recommendation.suggestedNextTool).toBeDefined();
    });

    it("should pass Zod schema validation", () => {
      const readiness = calculateReadiness("报名系统", { target_user: "学生" });
      const clarification = generateClarification(
        "报名系统",
        readiness,
        "build_product",
        "web",
        "normal",
        { target_user: "学生" }
      );
      const output = buildInterrogateStructuredOutput(readiness, clarification);
      const result = SpecInterrogateOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });

    it("should set canProceed=false for Not Ready", () => {
      const readiness = calculateReadiness("系统");
      const clarification = generateClarification(
        "系统",
        readiness,
        "unknown",
        "unknown",
        "normal"
      );
      const output = buildInterrogateStructuredOutput(readiness, clarification);

      expect(output.readiness.status).toBe("Not Ready");
      expect(output.recommendation.canProceed).toBe(false);
      expect(output.recommendation.suggestedNextTool).toBe("spec_interrogate");
    });
  });

  describe("spec_compile", () => {
    it("should return structured output for formal mode", () => {
      const readiness = calculateReadiness("报名系统", {
        target_user: "学生",
        platform: "web",
        data_persistence: true,
        core_features: ["报名", "审核"],
      });
      const spec = buildSpec("报名系统", {
        target_user: "学生",
        platform: "web",
        data_persistence: true,
        core_features: ["报名", "审核"],
      }, readiness);
      const confirmation = buildConfirmation(spec);
      const output = buildCompileStructuredOutput("formal", readiness, spec, confirmation);

      expect(output.mode).toBe("formal");
      expect(output.spec).toBeDefined();
      expect(output.spec!.productGoal).toBe(spec.productGoal);
      expect(output.confirmation).toBeDefined();
      expect(output.nextAction.type).toBe("start_build");
    });

    it("should return structured output for not_ready mode", () => {
      const readiness = calculateReadiness("系统");
      const clarification = generateClarification(
        "系统",
        readiness,
        "unknown",
        "unknown",
        "normal"
      );
      const output = buildCompileStructuredOutput("not_ready", readiness, undefined, undefined, clarification);

      expect(output.mode).toBe("not_ready");
      expect(output.spec).toBeUndefined();
      expect(output.clarification).toBeDefined();
      expect(output.nextAction.type).toBe("answer_questions");
    });

    it("should pass Zod schema validation", () => {
      const readiness = calculateReadiness("报名系统", { target_user: "学生" });
      const spec = buildSpec("报名系统", { target_user: "学生" }, readiness);
      const confirmation = buildConfirmation(spec);
      const output = buildCompileStructuredOutput("formal", readiness, spec, confirmation);
      const result = SpecCompileOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("acceptance_generate", () => {
    it("should return structured output with checklist", () => {
      const acceptance = generateAcceptance("表单工具", ["表单提交"], "web", true, false, false);
      const output = buildAcceptanceStructuredOutput(acceptance);

      expect(output.productType).toBe("表单工具");
      expect(output.platform).toBe("web");
      expect(Array.isArray(output.categories)).toBe(true);
      expect(Array.isArray(output.checklist)).toBe(true);
      expect(output.checklist.length).toBeGreaterThan(0);
    });

    it("should have stable checklist ids", () => {
      const acceptance = generateAcceptance("工具", ["功能"], "web", false, false, false);
      const output = buildAcceptanceStructuredOutput(acceptance);

      for (const item of output.checklist) {
        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe("string");
        expect(item.id.length).toBeGreaterThan(0);
      }
    });

    it("should pass Zod schema validation", () => {
      const acceptance = generateAcceptance("系统", ["功能"], "web", true, true, true);
      const output = buildAcceptanceStructuredOutput(acceptance);
      const result = AcceptanceGenerateOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("architecture_decide", () => {
    it("should return structured output with risk level", () => {
      const decision = decideArchitecture("展示页", "web", [], false, "individual");
      const output = buildArchitectureStructuredOutput(decision);

      expect(output.decision).toBeDefined();
      expect(output.riskLevel).toBeDefined();
      expect(Array.isArray(output.blockers)).toBe(true);
    });

    it("should set high risk for payment", () => {
      const decision = decideArchitecture("电商", "web", ["支付"], false, "individual");
      const output = buildArchitectureStructuredOutput(decision);

      expect(output.riskLevel).toBe("high");
      expect(output.blockers.length).toBeGreaterThan(0);
    });

    it("should pass Zod schema validation", () => {
      const decision = decideArchitecture("系统", "web", ["功能"], false, "individual");
      const output = buildArchitectureStructuredOutput(decision);
      const result = ArchitectureDecideOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("ui_translate", () => {
    it("should return structured output with confidence", () => {
      const translation = translateUiDescription("上面那块");
      const output = buildUiTranslateStructuredOutput(translation);

      expect(output.translation).toBeDefined();
      expect(output.confidence).toBeDefined();
      expect(["low", "medium", "high"]).toContain(output.confidence);
    });

    it("should set high confidence for known terms", () => {
      const translation = translateUiDescription("上面那块");
      const output = buildUiTranslateStructuredOutput(translation);

      expect(output.confidence).toBe("high");
    });

    it("should pass Zod schema validation", () => {
      const translation = translateUiDescription("高级一点");
      const output = buildUiTranslateStructuredOutput(translation);
      const result = UiTranslateOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("debug_guide", () => {
    it("should return structured output with missing info", () => {
      const guide = generateDebugGuide("web", "页面报错");
      const output = buildDebugGuideStructuredOutput(guide);

      expect(output.guide).toBeDefined();
      expect(Array.isArray(output.missingRequiredInfo)).toBe(true);
      expect(typeof output.canDiagnoseNow).toBe("boolean");
    });

    it("should set canDiagnoseNow=false when info missing", () => {
      const guide = generateDebugGuide("web", "页面报错");
      const output = buildDebugGuideStructuredOutput(guide);

      expect(output.canDiagnoseNow).toBe(false);
      expect(output.missingRequiredInfo.length).toBeGreaterThan(0);
    });

    it("should pass Zod schema validation", () => {
      const guide = generateDebugGuide("web", "报错", { console_error: "TypeError" });
      const output = buildDebugGuideStructuredOutput(guide);
      const result = DebugGuideOutputSchema.safeParse(output);

      expect(result.success).toBe(true);
    });
  });

  describe("product_spec_assist", () => {
    it("should pass Zod schema validation", () => {
      const result = executeAssist("我想做一个报名系统");
      const output = {
        routedIntent: result.routedIntent,
        selectedTool: result.selectedTool,
        executed: result.executed,
        result: result.result ?? null,
        nextAction: result.nextAction,
        quickQuestions: result.quickQuestions,
        agentGuidance: result.agentGuidance,
      };

      const parsed = ProductSpecAssistOutputSchema.safeParse(output);

      expect(parsed.success).toBe(true);
    });

    it("should validate architecture result from static display assist", () => {
      const result = executeAssist("我想做一个个人作品展示网站，放我的介绍、作品图片、联系方式");
      const output = {
        routedIntent: result.routedIntent,
        selectedTool: result.selectedTool,
        executed: result.executed,
        result: result.result ?? null,
        nextAction: result.nextAction,
        quickQuestions: result.quickQuestions,
        agentGuidance: result.agentGuidance,
      };

      const parsed = ProductSpecAssistOutputSchema.safeParse(output);

      expect(parsed.success).toBe(true);
      expect(output.selectedTool).toBe("architecture_decide");
    });

    it("should validate launch output with null result", () => {
      const result = executeAssist("这个个人作品网站我想上线了，需要注意什么？");
      const output = {
        routedIntent: result.routedIntent,
        selectedTool: result.selectedTool,
        executed: result.executed,
        result: result.result ?? null,
        nextAction: result.nextAction,
        quickQuestions: result.quickQuestions,
        agentGuidance: result.agentGuidance,
      };

      const parsed = ProductSpecAssistOutputSchema.safeParse(output);

      expect(parsed.success).toBe(true);
      expect(output.selectedTool).toBeNull();
    });
  });
});
