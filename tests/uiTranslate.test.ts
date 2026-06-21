import { describe, it, expect } from "vitest";
import { translateUiDescription } from "../src/core/uiPromptEngine.js";

describe("uiTranslate", () => {
  it('should map "上面那块" to Header/Hero', () => {
    const result = translateUiDescription("修改上面那块");
    expect(result.frontendTerms).toContain("Header");
  });

  it('should map "按钮碰上去" to Hover State', () => {
    const result = translateUiDescription("按钮碰上去变一下");
    expect(result.frontendTerms).toContain("Button Hover State");
  });

  it('should map "下面加联系方式" to Footer/ContactBlock', () => {
    const result = translateUiDescription("下面加联系方式");
    expect(result.frontendTerms).toContain("Footer Contact Section");
  });

  it('should map "手机上乱了" to Responsive issue', () => {
    const result = translateUiDescription("手机上乱了");
    expect(result.frontendTerms).toContain("Responsive Layout Issue");
  });

  it('should provide upgrade suggestions for "高级一点"', () => {
    const result = translateUiDescription("高级一点");
    expect(result.frontendTerms.length).toBeGreaterThan(0);
    expect(result.codeHints.length).toBeGreaterThan(0);
  });

  it("should provide concrete premium hero motion guidance", () => {
    const result = translateUiDescription(
      "首页Hero区域太普通了，想要更高级的首屏效果，比如动态背景、光效、粒子、渐变流动，但要保持极简高级感，深色主题，金色点缀。"
    );

    expect(result.suggestedComponent).toBe("hero");
    expect(result.identifiedIntent).toContain("Hero");
    expect(result.frontendTerms).toContain("Layered Ambient Background");
    expect(result.frontendTerms).toContain("Subtle Particle Field");
    expect(result.codeHints.join("\n")).toContain("prefers-reduced-motion");
    expect(result.codeHints.join("\n")).toContain("移动端");
    expect(result.codeHints.join("\n")).toContain("不要使用多个大面积渐变球");
    expect(result.codeHints.join("\n")).toContain("持续循环的文字 shimmer");
    expect(result.codeHints.join("\n")).toContain("最多启用 1-2 个");
  });

  it("should generate modification prompt", () => {
    const result = translateUiDescription("修改上面那块", "首页");
    expect(result.modificationPrompt).toContain("首页");
  });

  it("should handle unknown descriptions", () => {
    const result = translateUiDescription("随便改改");
    expect(result.frontendTerms.length).toBeGreaterThan(0);
  });
});
