import { describe, it, expect } from "vitest";
import { generateDebugGuide } from "../src/core/debugEngine.js";

describe("debugGuide", () => {
  it("should generate web debug guide with Console and Network", () => {
    const result = generateDebugGuide("web", "页面报错了");
    expect(result.platform).toBe("web");
    expect(result.requiredInfo.length).toBeGreaterThan(0);
    expect(result.troubleshootingSteps.length).toBeGreaterThan(0);
  });

  it("should generate mini program debug guide", () => {
    const result = generateDebugGuide("mini_program", "小程序白屏");
    expect(result.platform).toBe("mini_program");
    expect(result.commonIssues).toContain("域名未配置到合法域名列表");
  });

  it("should generate app debug guide", () => {
    const result = generateDebugGuide("app", "App 闪退");
    expect(result.platform).toBe("app");
    expect(result.requiredInfo.some((i) => i.field === "device_model")).toBe(true);
  });

  it("should generate backend debug guide", () => {
    const result = generateDebugGuide("backend", "接口 500 错误");
    expect(result.platform).toBe("backend");
    expect(result.requiredInfo.some((i) => i.field === "trace_id")).toBe(true);
  });

  it("should generate build debug guide", () => {
    const result = generateDebugGuide("build", "构建失败");
    expect(result.platform).toBe("build");
    expect(result.requiredInfo.some((i) => i.field === "build_command")).toBe(true);
  });

  it("should mark known info as provided", () => {
    const result = generateDebugGuide("web", "页面报错", {
      console_error: "TypeError: Cannot read property",
    });
    expect(result.checklist.some((c) => c.includes("☑"))).toBe(true);
  });
});
