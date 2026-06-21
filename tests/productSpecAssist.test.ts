import { describe, it, expect } from "vitest";
import { executeAssist } from "../src/core/assistEngine.js";

describe("productSpecAssist", () => {
  describe("build_product routing", () => {
    it("should route build_product scenario", () => {
      const result = executeAssist("我想做一个报名系统，学生可以提交资料，后台审核");

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(result.executed).toBe(true);
      expect(result.result).toBeDefined();
    });

    it("should return readiness in result", () => {
      const result = executeAssist("报名系统");
      const structured = result.result as any;

      expect(structured?.readiness).toBeDefined();
      expect(typeof structured?.readiness?.score).toBe("number");
    });

    it("should return quick questions for form-like product intake", () => {
      const result = executeAssist("我想做一个活动报名系统，用户可以提交姓名电话，我能导出 Excel");

      expect(result.quickQuestions.length).toBeGreaterThan(0);
      expect(result.quickQuestions.some((q) => q.id === "user_login")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "admin_auth")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "admin_scope")).toBe(true);
      expect(result.quickQuestions.find((q) => q.id === "user_login")?.defaultValue).toBe("none");
    });

    it("should tell agents not to rewrite quick questions", () => {
      const result = executeAssist("我想做一个活动报名系统");

      expect(result.agentGuidance.join("\n")).toContain("quickQuestions");
      expect(result.agentGuidance.join("\n")).toContain("不要");
    });

    it("should treat portfolio sites as static display sites", () => {
      const result = executeAssist("我想做一个个人作品展示网站，放我的介绍、作品图片、联系方式，看起来高级一点，手机上也要好看。");

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("architecture_decide");
      expect(result.executed).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "visual_style")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "contact_method")).toBe(true);
      expect(result.markdown).toContain("静态展示网站");
      expect(result.markdown).toContain("可以纯前端");
      expect(result.markdown).not.toContain("是否需要保存数据");
      expect(result.markdown).not.toContain("如何防止重复提交");
    });

    it("should guide agents not to apply business-system questions to portfolio sites", () => {
      const result = executeAssist("个人作品展示网站，包含个人介绍、作品图片和联系方式");

      expect(result.agentGuidance.join("\n")).toContain("不要套用表单");
      expect(result.agentGuidance.join("\n")).toContain("纯前端静态网站");
    });

    it("should require spec_compile before building after static site quick answers", () => {
      const result = executeAssist("我想做一个个人作品展示网站，放我的介绍、作品图片、联系方式，看起来高级一点，手机上也要好看。");

      expect(result.nextAction.suggestedTool).toBe("spec_compile");
      expect(result.agentGuidance.join("\n")).toContain("先调用 spec_compile");
      expect(result.agentGuidance.join("\n")).toContain("不要直接创建项目文件");
      expect(result.markdown).toContain("用户回答选项后");
      expect(result.markdown).toContain("不要直接创建项目文件");
    });

    it("should not auto_execute when disabled", () => {
      const result = executeAssist("报名系统", undefined, "unknown", "normal", false);

      expect(result.executed).toBe(false);
      expect(result.nextAction.suggestedTool).toBe("spec_interrogate");
    });
  });

  describe("modify_ui routing", () => {
    it("should route modify_ui scenario", () => {
      const result = executeAssist("首页上面那块高级一点");

      expect(result.routedIntent.scenario).toBe("modify_ui");
      expect(result.selectedTool).toBe("ui_translate");
      expect(result.executed).toBe(true);
    });

    it("should route existing portfolio hero upgrade requests to ui_translate", () => {
      const result = executeAssist(
        "我做了一个个人作品展示网站，首页Hero区域太普通了，就是居中的名字+副标题+一个按钮，没什么视觉冲击力。我想要更高级的首屏效果，比如动态背景、光效、粒子、渐变流动之类的，但要保持极简高级感，不能花哨。深色主题，金色点缀。请给我具体的UI升级方案。",
        {
          current_stack: "HTML5 + CSS3 + Vanilla JS",
          theme: "dark (#0a0a0a) + gold accent (#c8a97e)",
          style: "高级极简",
          current_hero: "居中文字：greeting + name + title + divider + desc + CTA button",
        },
        "web",
        "light",
        true
      );

      expect(result.routedIntent.scenario).toBe("modify_ui");
      expect(result.selectedTool).toBe("ui_translate");
      expect(result.executed).toBe(true);
      expect(result.markdown).toContain("UI 修改");
      expect(result.markdown).toContain("Layered Ambient Background");
      expect(result.markdown).toContain("prefers-reduced-motion");
      expect(result.markdown).not.toContain("静态展示网站");
      expect(result.agentGuidance.join("\n")).toContain("不要擅自改业务需求或创建文件");
    });

    it("should return frontendTerms in result", () => {
      const result = executeAssist("上面那块改一下");
      const structured = result.result as any;

      expect(structured?.translation?.frontendTerms).toBeDefined();
    });
  });

  describe("debug routing", () => {
    it("should route debug scenario", () => {
      const result = executeAssist("小程序打开以后白屏");

      expect(result.routedIntent.scenario).toBe("debug");
      expect(result.selectedTool).toBe("debug_guide");
      expect(result.executed).toBe(true);
    });

    it("should detect mini_program platform", () => {
      const result = executeAssist("小程序白屏了");
      const structured = result.result as any;

      expect(structured?.guide?.platform).toBe("mini_program");
    });

    it("should detect backend platform", () => {
      const result = executeAssist("接口报500错误");
      const structured = result.result as any;

      expect(structured?.guide?.platform).toBe("backend");
    });

    it("should default to web platform", () => {
      const result = executeAssist("控制台报错了");
      const structured = result.result as any;

      expect(structured?.guide?.platform).toBe("web");
    });
  });

  describe("launch routing", () => {
    it("should route launch scenario", () => {
      const result = executeAssist("我想上线这个项目");

      expect(result.routedIntent.scenario).toBe("launch");
      expect(result.executed).toBe(false);
      expect(result.nextAction.type).toBe("review_launch_readiness");
    });

    it("should prioritize launch intent over product keywords", () => {
      const result = executeAssist("这个个人作品网站我想上线了，需要注意什么？");

      expect(result.routedIntent.scenario).toBe("launch");
      expect(result.selectedTool).toBeNull();
      expect(result.executed).toBe(false);
      expect(result.markdown).toContain("上线前缺口检查");
    });

    it("should return launch quick questions and guardrails", () => {
      const result = executeAssist("这个个人作品网站我想上线了，需要注意什么？");

      expect(result.quickQuestions.some((q) => q.id === "site_type")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "domain")).toBe(true);
      expect(result.agentGuidance.join("\n")).toContain("不要主动搜索本地文件");
      expect(result.agentGuidance.join("\n")).toContain("不要创建任务列表");
      expect(result.markdown).toContain("Agent 行为边界");
    });

    it("should not repeat launch questions already answered by static-site context", () => {
      const result = executeAssist(
        "个人作品网站要上线了，需要注意什么？纯静态站，HTML/CSS/JS，无框架无后端。",
        {
          content: "个人作品集展示：导航、Hero首屏、关于、作品集（筛选）、联系方式、页脚",
          hosting_preference: "未定",
          tech_stack: "纯HTML/CSS/JS静态站，无框架无构建工具，无后端",
        },
        "web",
        "grill",
        true
      );

      expect(result.routedIntent.scenario).toBe("launch");
      expect(result.quickQuestions.some((q) => q.id === "site_type")).toBe(false);
      expect(result.quickQuestions.some((q) => q.id === "interactive_features")).toBe(false);
      expect(result.quickQuestions.some((q) => q.id === "domain")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "audience_region")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "rollback")).toBe(true);
      expect(result.markdown).not.toContain("这个网站是纯静态页面，还是有后端");
      expect(result.markdown).not.toContain("网站有没有表单、登录、支付或数据提交");
    });

    it("should not claim ready to launch", () => {
      const result = executeAssist("部署到服务器");

      expect(result.markdown).not.toContain("可以直接上线");
      expect(result.markdown).toContain("不要声称上线已就绪");
      expect(result.markdown).toContain("缺口");
    });
  });

  describe("unknown routing", () => {
    it("should route unknown scenario", () => {
      const result = executeAssist("帮我看看");

      expect(result.routedIntent.scenario).toBe("unknown");
      expect(result.executed).toBe(false);
      expect(result.nextAction.type).toBe("choose_tool_manually");
    });

    it("should list available tools", () => {
      const result = executeAssist("帮忙");

      expect(result.markdown).toContain("spec_interrogate");
      expect(result.markdown).toContain("ui_translate");
      expect(result.markdown).toContain("debug_guide");
    });
  });

  describe("structuredContent", () => {
    it("should return structuredContent with required fields", () => {
      const result = executeAssist("报名系统");

      expect(result.routedIntent).toBeDefined();
      expect(result.selectedTool).toBeDefined();
      expect(typeof result.executed).toBe("boolean");
      expect(result.nextAction).toBeDefined();
      expect(result.nextAction.type).toBeDefined();
      expect(result.nextAction.message).toBeDefined();
      expect(Array.isArray(result.quickQuestions)).toBe(true);
      expect(Array.isArray(result.agentGuidance)).toBe(true);
    });
  });
});
