import { describe, it, expect } from "vitest";
import { generateAcceptance } from "../src/core/acceptanceEngine.js";

describe("acceptanceGenerate", () => {
  it("should generate base acceptance rules", () => {
    const result = generateAcceptance("表单工具", ["表单", "提交"], "web", false, false, false);
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.definitionOfDone.length).toBeGreaterThan(0);
  });

  it("should include form validation rules", () => {
    const result = generateAcceptance("表单工具", ["表单", "提交"], "web", false, false, false);
    const formCat = result.categories.find((c) => c.category === "表单验收");
    expect(formCat).toBeDefined();
    expect(formCat!.items.some((i) => i.includes("必填"))).toBe(true);
  });

  it("should include mobile overflow check", () => {
    const result = generateAcceptance("网站", ["展示"], "web", false, false, false);
    const allItems = result.categories.flatMap((c) => c.items);
    expect(allItems.some((i) => i.includes("横向溢出"))).toBe(true);
  });

  it("should generate static-site acceptance without dynamic app checks", () => {
    const result = generateAcceptance(
      "个人作品集展示网站（纯HTML/CSS/JS静态站）",
      ["导航栏", "Hero首屏", "关于我", "作品集", "联系方式", "响应式设计", "滚动渐入动画"],
      "web",
      false,
      false,
      false
    );

    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.categories.some((c) => c.category === "页面与内容验收")).toBe(true);
    expect(allItems).toContain("占位内容");
    expect(allItems).toContain("favicon");
    expect(allItems).toContain("meta description");
    expect(allItems).toContain("robots.txt");
    expect(allItems).toContain("noopener noreferrer");
    expect(allItems).toContain("prefers-reduced-motion");
    expect(allItems).not.toContain("loading 或 skeleton");
    expect(allItems).not.toContain("空数据");
    expect(allItems).not.toContain("表单提交");
    expect(allItems).not.toContain("接口超时");
    expect(allItems).not.toContain("500 错误");
  });

  it("should include backend rules when has backend", () => {
    const result = generateAcceptance("管理系统", ["管理"], "web", true, false, false);
    const backendCat = result.categories.find((c) => c.category === "后端验收");
    expect(backendCat).toBeDefined();
  });

  it("should include payment rules when has payment", () => {
    const result = generateAcceptance("电商", ["支付"], "web", true, true, false);
    const paymentCat = result.categories.find((c) => c.category === "支付验收");
    expect(paymentCat).toBeDefined();
    expect(paymentCat!.items.some((i) => i.includes("后端回调"))).toBe(true);
  });

  it("should include auth rules when has auth", () => {
    const result = generateAcceptance("系统", ["登录"], "web", true, false, true);
    const authCat = result.categories.find((c) => c.category === "权限验收");
    expect(authCat).toBeDefined();
    expect(authCat!.items.some((i) => i.includes("权限校验不能只靠前端"))).toBe(true);
  });

  it("should include mini program rules", () => {
    const result = generateAcceptance("小程序", ["展示"], "mini_program", false, false, false);
    const mpCat = result.categories.find((c) => c.category === "小程序验收");
    expect(mpCat).toBeDefined();
  });
});
