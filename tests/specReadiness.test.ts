import { describe, it, expect } from "vitest";
import { calculateReadiness } from "../src/core/specReadiness.js";

describe("specReadiness", () => {
  it("should return low score for minimal input", () => {
    const result = calculateReadiness("我想做一个报名系统");
    expect(result.score).toBeLessThan(60);
    expect(result.status).toBe("Not Ready");
  });

  it("should return higher score for detailed input", () => {
    const result = calculateReadiness(
      "我想做一个报名系统，用户可以提交资料，后台管理员可以审核，需要保存数据到数据库"
    );
    expect(result.score).toBeGreaterThan(30);
  });

  it("should recognize platform keywords", () => {
    const result = calculateReadiness("做一个 web 网站");
    expect(result.fields.platform.present).toBe(true);
  });

  it("should recognize user role keywords", () => {
    const result = calculateReadiness("需要登录和管理员权限");
    expect(result.fields.user_roles.present).toBe(true);
  });

  it("should use known context to boost score", () => {
    const result = calculateReadiness("做一个系统", {
      target_user: "学生",
      platform: "web",
      data_persistence: true,
    });
    expect(result.score).toBeGreaterThan(20);
    expect(result.fields.target_user.present).toBe(true);
    expect(result.fields.platform.present).toBe(true);
  });

  it("should return Draft Ready for medium score", () => {
    const result = calculateReadiness(
      "开发一个 web 报名系统，用户可以登录提交资料，需要保存数据",
      {
        target_user: "学生",
        platform: "web",
      }
    );
    expect(result.status).toBe("Draft Ready");
  });

  it("should return Build Ready for high score", () => {
    const result = calculateReadiness(
      "开发一个 web 报名系统，用户可以登录提交资料，需要保存数据到数据库，后台管理员可以审核，需要支付功能",
      {
        target_user: "学生",
        platform: "web",
        core_features: ["报名", "审核", "支付"],
        data_persistence: true,
        user_roles: true,
        backend_need: true,
        workflow: "用户提交 -> 管理员审核 -> 支付完成",
      }
    );
    expect(result.status).toBe("Build Ready");
  });
});
