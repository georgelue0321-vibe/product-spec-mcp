import { describe, it, expect } from "vitest";
import { calculateReadiness } from "../src/core/specReadiness.js";
import { generateClarification } from "../src/core/clarificationEngine.js";
import { buildSpec } from "../src/core/promptBuilder.js";
import { buildConfirmation } from "../src/core/confirmationBuilder.js";

describe("specCompile", () => {
  it("should handle not_ready mode", () => {
    const readiness = calculateReadiness("我想做一个系统");
    expect(readiness.status).toBe("Not Ready");
    expect(readiness.score).toBeLessThan(60);
  });

  it("should build spec with context", () => {
    const readiness = calculateReadiness("报名系统", {
      target_user: "学生",
      platform: "web",
    });
    const spec = buildSpec("报名系统", { target_user: "学生", platform: "web" }, readiness);
    expect(spec.targetUser).toBe("学生");
    expect(spec.platform).toBe("web");
  });

  it("should generate confirmation", () => {
    const readiness = calculateReadiness("报名系统", {
      target_user: "学生",
      platform: "web",
    });
    const spec = buildSpec("报名系统", { target_user: "学生", platform: "web" }, readiness);
    const confirmation = buildConfirmation(spec);
    expect(confirmation.markdown).toContain("待用户确认");
    expect(confirmation.items.length).toBeGreaterThan(0);
  });

  it("should include all required sections in confirmation", () => {
    const readiness = calculateReadiness("报名系统", {
      target_user: "学生",
      platform: "web",
    });
    const spec = buildSpec("报名系统", { target_user: "学生", platform: "web" }, readiness);
    const confirmation = buildConfirmation(spec);
    expect(confirmation.markdown).toContain("产品目标");
    expect(confirmation.markdown).toContain("目标用户");
    expect(confirmation.markdown).toContain("MVP");
    expect(confirmation.markdown).toContain("架构");
    expect(confirmation.markdown).toContain("数据方案");
    expect(confirmation.markdown).toContain("暂不包含");
    expect(confirmation.markdown).toContain("验收标准");
  });

  it("should extract features from raw idea", () => {
    const readiness = calculateReadiness("做一个可以登录和提交表单的系统");
    const spec = buildSpec("做一个可以登录和提交表单的系统", {}, readiness);
    expect(spec.coreFeatures.length).toBeGreaterThan(0);
  });

  it("should handle empty context gracefully", () => {
    const readiness = calculateReadiness("系统");
    const spec = buildSpec("系统", {}, readiness);
    expect(spec.productGoal).toBeDefined();
    expect(spec.targetUser).toBeDefined();
    expect(spec.platform).toBeDefined();
  });

  it("should NOT generate fake API for low readiness", () => {
    const readiness = calculateReadiness("做一个展示官网");
    const spec = buildSpec("做一个展示官网", {}, readiness);
    expect(spec.apiDesign).not.toContain("POST /api/核心功能");
    expect(spec.assumptions.length).toBeGreaterThan(0);
  });

  it("should mark low readiness spec as not actionable", () => {
    const readiness = calculateReadiness("系统");
    const spec = buildSpec("系统", {}, readiness);
    expect(spec.isActionable).toBe(false);
    expect(spec.readinessScore).toBeLessThan(70);
  });

  it("should use placeholder for generic features", () => {
    const readiness = calculateReadiness("做一个系统");
    const spec = buildSpec("做一个系统", {}, readiness);
    expect(spec.coreFeatures).toContain("待用户补充具体功能");
  });

  it("should mark high readiness spec as actionable", () => {
    const readiness = calculateReadiness("报名系统", {
      target_user: "学生",
      platform: "web",
      data_persistence: true,
      user_roles: true,
      core_features: ["报名", "审核", "支付"],
      backend_need: true,
      workflow: "用户提交报名 -> 管理员审核 -> 支付完成",
    });
    const spec = buildSpec("报名系统", {
      target_user: "学生",
      platform: "web",
      data_persistence: true,
      user_roles: true,
      core_features: ["报名", "审核", "支付"],
      backend_need: true,
      workflow: "用户提交报名 -> 管理员审核 -> 支付完成",
    }, readiness);
    expect(spec.readinessScore).toBeGreaterThanOrEqual(60);
  });

  it("should respect negative string answers for static portfolio sites", () => {
    const rawIdea = "个人作品展示网站，包含个人介绍、作品图片展示、联系方式，要求设计高级感，响应式布局适配手机端";
    const answers = {
      data_persistence: "不需要保存数据，纯静态展示",
      user_roles: "不需要登录和用户角色",
      backend_need: "不需要后端，纯前端静态网站",
      external_integrations: "不涉及任何第三方服务",
      core_features: "个人介绍、作品图片、联系方式、响应式布局",
      workflow: "无业务流程，纯展示",
      form_fields: "不需要表单",
      export_format: "不需要导出",
      dedup_strategy: "不需要去重",
      admin_access: "不需要后台管理",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);

    expect(spec.architecture).toBe("纯前端架构");
    expect(spec.dataModel).toMatch(/无需/);
    expect(spec.apiDesign).toBe("纯前端项目，无需 API");
    expect(spec.apiDesign).not.toContain("POST /api");
    expect(spec.coreFeatures).toContain("个人介绍、作品图片、联系方式、响应式布局");
  });
});
