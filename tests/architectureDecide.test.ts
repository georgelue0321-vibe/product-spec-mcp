import { describe, it, expect } from "vitest";
import { decideArchitecture } from "../src/core/architectureEngine.js";

describe("architectureDecide", () => {
  it("should recommend frontend only for display pages", () => {
    const result = decideArchitecture("展示页", "web", [], false, "individual");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
  });

  it("should recommend backend for login features", () => {
    const result = decideArchitecture(
      "管理系统",
      "web",
      ["登录", "用户中心", "历史记录"],
      false,
      "individual"
    );
    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
  });

  it("should recommend separation for admin features", () => {
    const result = decideArchitecture(
      "管理系统",
      "web",
      ["后台管理", "审核", "权限"],
      false,
      "small_team"
    );
    expect(result.needSeparation).toBe(true);
    expect(result.needAdmin).toBe(true);
  });

  it("should warn about payment risk", () => {
    const result = decideArchitecture(
      "电商系统",
      "web",
      ["支付", "订单", "退款"],
      true,
      "small_team"
    );
    expect(result.paymentRisk).toBe(true);
  });

  it("should warn about AI key risk", () => {
    const result = decideArchitecture(
      "AI 助手",
      "web",
      ["AI", "GPT", "智能问答"],
      false,
      "individual"
    );
    expect(result.aiKeyRisk).toBe(true);
  });

  it("should recommend PostgreSQL for enterprise", () => {
    const result = decideArchitecture(
      "企业系统",
      "web",
      ["登录", "管理"],
      true,
      "enterprise"
    );
    expect(result.recommendedDatabase).toBe("PostgreSQL");
  });

  it("should have reasoning when features empty", () => {
    const result = decideArchitecture("系统", "web", [], false, "individual");
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it("should NOT recommend database for display-only pages", () => {
    const result = decideArchitecture("展示官网", "web", [], false, "individual");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.recommendedDatabase).toBe("无需数据库");
  });

  it("should NOT recommend database for portfolio sites", () => {
    const result = decideArchitecture("作品展示", "web", [], false, "individual");
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.recommendedDatabase).toContain("无需");
  });

  it("should force backend for payment features", () => {
    const result = decideArchitecture("电商", "web", ["支付", "订单"], false, "individual");
    expect(result.needBackend).toBe(true);
    expect(result.paymentRisk).toBe(true);
    expect(result.mvpSuggestion).toContain("后端");
  });

  it("should warn about AI key exposure", () => {
    const result = decideArchitecture("AI工具", "web", ["AI", "GPT"], false, "individual");
    expect(result.aiKeyRisk).toBe(true);
    expect(result.mvpSuggestion).toContain("后端");
    expect(result.mvpSuggestion).toContain("Key");
  });
});
