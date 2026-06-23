import { describe, expect, it } from "vitest";
import { buildTechnicalProfile } from "../src/core/technicalProfile.js";

describe("technicalProfile", () => {
  it("classifies static display pages as frontend-only", () => {
    const profile = buildTechnicalProfile("个人作品展示网站，放介绍、作品图片和联系方式。");

    expect(profile.shape).toBe("static_page");
    expect(profile.frontendOnly).toBe(true);
    expect(profile.needsBackend).toBe(false);
    expect(profile.suggestedStorage).toBe("none");
  });

  it("classifies browser-local beginner tools as local_storage_tool", () => {
    const profile = buildTechnicalProfile("冰箱食材管理工具，数据存在浏览器里，不需要账号。");

    expect(profile.shape).toBe("local_storage_tool");
    expect(profile.frontendOnly).toBe(true);
    expect(profile.needsBackend).toBe(false);
    expect(profile.suggestedStorage).toBe("localStorage");
  });

  it("classifies import/export tools as local_json_import_export", () => {
    const profile = buildTechnicalProfile("露营装备清单，支持 JSON 导入导出备份，自己用。");

    expect(profile.shape).toBe("local_json_import_export");
    expect(profile.frontendOnly).toBe(true);
    expect(profile.suggestedStorage).toBe("json_file");
  });

  it("classifies travel map data pages as static_json_data_page", () => {
    const profile = buildTechnicalProfile("旅行攻略 HTML，用 data.json 加载美食、酒店、景点，并在地图点位展示。");

    expect(profile.shape).toBe("static_json_data_page");
    expect(profile.frontendOnly).toBe(true);
    expect(profile.suggestedStorage).toBe("static_json");
  });

  it("classifies registration/admin projects as light backend", () => {
    const profile = buildTechnicalProfile("活动报名系统，用户提交报名，管理员后台查看和导出。");

    expect(profile.shape).toBe("light_backend_json_sqlite");
    expect(profile.needsBackend).toBe(true);
    expect(profile.needsAuth).toBe(true);
    expect(profile.suggestedStorage).toBe("sqlite");
  });

  it("does not let default false tool flags override registration backend signals", () => {
    const profile = buildTechnicalProfile("活动报名系统，用户填写姓名、电话、报名人数，后台查看和导出，管理员需要登录。", {
      has_backend: false,
      has_auth: false,
      has_payment: false,
    });

    expect(profile.shape).toBe("light_backend_json_sqlite");
    expect(profile.frontendOnly).toBe(false);
    expect(profile.needsBackend).toBe(true);
    expect(profile.needsAuth).toBe(true);
    expect(profile.needsAdmin).toBe(true);
  });

  it("classifies team knowledge bases as light backend even when AI and payment are excluded", () => {
    const profile = buildTechnicalProfile("内部知识库，可以写文档、发布文档、按分类搜索。草稿只有自己能看，发布后团队能看。不接 AI，不接支付。");

    expect(profile.shape).toBe("light_backend_json_sqlite");
    expect(profile.frontendOnly).toBe(false);
    expect(profile.needsBackend).toBe(true);
    expect(profile.needsAuth).toBe(true);
  });

  it("classifies paid AI SaaS as full backend", () => {
    const profile = buildTechnicalProfile("AI 文案生成 SaaS，按次数套餐收费，调用 DeepSeek API。");

    expect(profile.shape).toBe("full_backend_saas");
    expect(profile.needsBackend).toBe(true);
    expect(profile.needsAuth).toBe(true);
    expect(profile.suggestedStorage).toBe("postgresql");
    expect(profile.blockers.join("\n")).toContain("密钥");
  });

  it("asks beginner-friendly next questions with examples", () => {
    const profile = buildTechnicalProfile("植物浇水提醒小工具，自己用，本地保存。");

    expect(profile.nextQuestions.length).toBeGreaterThan(0);
    for (const question of profile.nextQuestions) {
      expect(question.question).toBeTruthy();
      expect(question.example).toMatch(/比如/);
      expect(question.why).toBeTruthy();
    }
  });
});
