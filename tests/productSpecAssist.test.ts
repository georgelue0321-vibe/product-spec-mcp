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

    it("should return AI SaaS quick questions for copywriting monetization tools", () => {
      const result = executeAssist(
        "我想做一个 AI 文案生成工具，用户输入产品介绍，系统帮他生成小红书文案。以后我想收费，可以按次数卖套餐。",
        undefined,
        "web",
        "grill",
        true
      );
      const quickQuestionIds = result.quickQuestions.map((q) => q.id);
      const markdown = result.markdown;

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(quickQuestionIds).toContain("llm_provider");
      expect(quickQuestionIds).toContain("payment_and_quota");
      expect(quickQuestionIds).toContain("account_and_auth");
      expect(quickQuestionIds).toContain("content_safety");
      expect(markdown).toContain("准备用哪个 AI 模型或 API");
      expect(markdown).toContain("收费和扣次规则怎么设计");
      expect(markdown).not.toContain("姓名+电话");
      expect(markdown).not.toContain("Excel (.xlsx)");
      expect(markdown).not.toContain("手机号去重");
    });

    it("should preserve AI SaaS context after user accepts defaults", () => {
      const result = executeAssist(
        "用户已确认全部使用默认值，请基于以下确认信息生成完整产品规格文档：一次生成3条，每条包含标题、正文、标签；先做可替换模型接口；免登录试用1次，购买前必须登录；MVP先按次套餐，后台人工发放次数。",
        {
          generation_input_schema: "产品名称+产品介绍+目标人群+卖点",
          generation_output_spec: "一次生成3条，包含标题、正文、标签",
          llm_provider: "可替换模型接口",
          account_and_auth: "免登录试用1次，购买前必须登录",
          payment_and_quota: "MVP先按次套餐，后台人工发放次数",
          history_and_storage: "保存最近生成历史和扣次记录",
          content_safety: "内置基础敏感词和营销风险提示",
          admin_metrics: "MVP看用户+订单+剩余次数",
        },
        "web",
        "normal",
        true
      );
      const quickQuestionIds = result.quickQuestions.map((q) => q.id);

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(quickQuestionIds).toContain("llm_provider");
      expect(quickQuestionIds).toContain("payment_and_quota");
      expect(result.markdown).toContain("AI 模型或 API");
      expect(result.markdown).not.toContain("报名数据怎么保存");
      expect(result.markdown).not.toContain("姓名+电话");
      expect(result.markdown).not.toContain("Excel (.xlsx)");
      expect(result.markdown).not.toContain("手机号去重");
    });

    it("should ask commerce questions for digital product stores", () => {
      const result = executeAssist(
        "我想做一个数字资料售卖网站，用户可以浏览资料包、下单购买，支付成功后才能下载文件。管理员能上架资料、看订单和下载记录。MVP 可以先用 mock 支付。",
        undefined,
        "web",
        "normal",
        true
      );
      const quickQuestionIds = result.quickQuestions.map((q) => q.id);
      const markdown = result.markdown;

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(quickQuestionIds).toContain("product_catalog");
      expect(quickQuestionIds).toContain("order_flow");
      expect(quickQuestionIds).toContain("payment_provider");
      expect(quickQuestionIds).toContain("download_permission");
      expect(quickQuestionIds).toContain("admin_features");
      expect(markdown).toContain("资料包需要哪些商品信息");
      expect(markdown).toContain("支付成功后如何开放下载");
      expect(markdown).not.toContain("报名数据怎么保存");
      expect(markdown).not.toContain("手机号去重");
      expect(markdown).not.toContain("一次生成几条文案");
    });

    it("should ask appointment questions without falling back to registration", () => {
      const result = executeAssist(
        "我想做一个预约服务系统，用户可以选择服务项目和时间段提交预约。后台可以看到预约列表、设置可预约时间段、限制每个时间段的人数。用户提交后可以收到确认信息，最好也能取消预约。MVP 先不接支付。",
        undefined,
        "web",
        "normal",
        true
      );
      const quickQuestionIds = result.quickQuestions.map((q) => q.id);
      const markdown = result.markdown;

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(quickQuestionIds).toContain("service_catalog");
      expect(quickQuestionIds).toContain("time_slot_rule");
      expect(quickQuestionIds).toContain("capacity_rule");
      expect(quickQuestionIds).toContain("cancel_rule");
      expect(quickQuestionIds).toContain("admin_schedule");
      expect(markdown).toContain("服务项目");
      expect(markdown).toContain("时间段");
      expect(markdown).toContain("每个时间段的人数");
      expect(markdown).not.toContain("报名数据怎么保存");
      expect(markdown).not.toContain("手机号去重");
      expect(markdown).not.toContain("导出 Excel");
      expect(markdown).not.toContain("资料包");
      expect(markdown).not.toContain("AI 模型");
    });

    it("should warn when product intent does not match a stable domain pack", () => {
      const result = executeAssist(
        "我想做一个设备资产管理系统，记录设备台账、借用归还、维修记录、责任人、状态变更，管理员可以筛选设备和处理维修。",
        undefined,
        "web",
        "normal",
        true
      );

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(result.markdown).toContain("未命中稳定 domain pack");
      expect(result.agentGuidance.join("\n")).toContain("未命中稳定 domain pack");
      expect(result.markdown).not.toContain("报名数据怎么保存");
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

    it("should keep launch intent when portfolio context adds display keywords", () => {
      const result = executeAssist(
        "个人作品网站我想上线了，需要注意什么？我是一个B2B产品经理转内容创作者，有9年产品经验，目前做自媒体运营（头条+小红书）和AI应用开发。网站主要展示我的作品集、项目经历和技术能力。",
        undefined,
        "web",
        "normal",
        true
      );

      expect(result.routedIntent.scenario).toBe("launch");
      expect(result.selectedTool).toBeNull();
      expect(result.executed).toBe(false);
      expect(result.markdown).toContain("上线部署");
      expect(result.markdown).toContain("上线前缺口检查");
      expect(result.markdown).not.toContain("静态展示网站");
      expect(result.quickQuestions.some((q) => q.id === "domain")).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "audience_region")).toBe(true);
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

  describe("personal local tools", () => {
    it("should ask local-first questions for beginner tools", () => {
      const result = executeAssist("我想做一个个人订阅续费提醒小工具，自己用，纯前端本地保存，不登录。");

      const dataStorage = result.quickQuestions.find((q) => q.id === "data_storage");
      const loginNeed = result.quickQuestions.find((q) => q.id === "login_need");
      const resultText = `${result.markdown}\n${JSON.stringify(result.result)}`;

      expect(dataStorage?.defaultValue).toBe("local_file");
      expect(dataStorage?.options[0].value).toBe("local_storage");
      expect(loginNeed?.defaultValue).toBe("none");
      expect(result.quickQuestions.map((q) => q.id)).not.toContain("dedup_strategy");
      expect(resultText).not.toContain("报名数据怎么保存");
      expect(resultText).not.toContain("手机号去重");
      expect(resultText).not.toContain("导出 Excel");
    });

    it("should treat browser-stored checklists as local beginner tools", () => {
      const result = executeAssist(
        "我想做一个露营装备清单 HTML，记录帐篷、炉具、餐具、药品、补货状态和备注，数据存在浏览器里。"
      );

      const dataStorage = result.quickQuestions.find((q) => q.id === "data_storage");
      const resultText = `${result.markdown}\n${JSON.stringify(result.result)}\n${JSON.stringify(result.quickQuestions)}`;

      expect(dataStorage?.defaultValue).toBe("local_file");
      expect(dataStorage?.options[0].value).toBe("local_storage");
      expect(result.quickQuestions.map((q) => q.id)).not.toContain("dedup_strategy");
      expect(resultText).not.toContain("报名数据怎么保存");
      expect(resultText).not.toContain("手机号去重");
      expect(resultText).not.toContain("导出 Excel");
      expect(resultText).not.toContain("管理员登录才能访问");
    });

    it("should contextualize local-first questions without creating a medicine domain", () => {
      const result = executeAssist(
        "用户想做一个家庭药品管理工具，功能需求是：记录家里有哪些药、快过期提醒、页面高级一点。",
        undefined,
        "web",
        "normal",
        true
      );
      const specResult = result.result as any;
      const resultText = `${result.markdown}\n${JSON.stringify(result.result)}\n${JSON.stringify(result.quickQuestions)}`;

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_compile");
      expect(result.nextAction.type).toBe("confirm_spec");
      expect(result.nextAction.suggestedTool).toBe("spec_compile");
      expect(result.nextAction.message).toContain("MVP 草案");
      expect(specResult.mode).toBe("draft");
      expect(specResult.spec.inputConsumption.matchedDomain).toBe("generic");
      expect(specResult.spec.apiDesign).toContain("无需 API");
      expect(result.technicalProfile?.shape).toBe("local_storage_tool");
      expect(result.quickQuestions.map((q) => q.id)).toContain("data_storage");
      expect(result.agentGuidance.join("\n")).toContain("不要把 quickQuestions 原样抛给用户");
      expect(result.agentGuidance.join("\n")).toContain("最多问一句自然语言确认");
      expect(result.agentGuidance.join("\n")).toContain("页面高级感只影响 UI");
      expect(result.markdown).toContain("MVP 产品规格草案");
      expect(result.markdown).toContain("小白默认路径");
      expect(result.markdown).toContain("高级页面可以仍然使用 localStorage");
      expect(resultText).toContain("药品名");
      expect(resultText).toContain("有效期/到期日");
      expect(resultText).toContain("到期/过期提醒");
      expect(resultText).toContain("高级界面与响应式布局");
      expect(resultText).not.toContain("手机号去重");
      expect(resultText).not.toContain("导出 Excel");
      expect(resultText).not.toContain("管理员登录才能访问");
    });

    it("should expose technicalProfile and examples for travel map data pages", () => {
      const result = executeAssist(
        "我想做一个旅行攻略 HTML，用 data.json 保存美食、酒店、景点，还要在地图上看点位和按分类筛选。"
      );

      expect(result.technicalProfile?.shape).toBe("static_json_data_page");
      expect(result.technicalProfile?.frontendOnly).toBe(true);
      expect(result.quickQuestions.every((q) => q.example && q.example.includes("比如"))).toBe(true);
      expect(result.quickQuestions.some((q) => q.id === "map_provider")).toBe(true);
      expect(result.markdown).not.toContain("手机号去重");
      expect(result.markdown).not.toContain("管理员登录");
    });

    it("should route roommate task scheduling to multi-user PM gate instead of static display", () => {
      const result = executeAssist(
        "我想做个多人使用的任务清单，我和我的室友的日程会在每一天具体的展示出来，哪些在同一个时间，哪些在不同时间，可以相互安排任务，对方需要认领，自己给自己安排的任务直接可用。"
      );
      const ids = result.quickQuestions.map((q) => q.id);

      expect(result.selectedTool).toBe("spec_interrogate");
      expect(result.pmIntentDecision?.needType).toBe("multi_user_collaboration");
      expect(result.pmIntentDecision?.technicalShape).toBe("light_backend_json_sqlite");
      expect(result.pmIntentDecision?.maintenanceMode).toBe("runtime_collaboration");
      expect(result.pmIntentDecision?.recommendedDeployment).toBe("unknown");
      expect(ids).toContain("access_topology");
      expect(ids).toContain("claim_rule");
      expect(ids).toContain("time_conflict_rule");
      expect(result.markdown).toContain("多人协作工具");
      expect(result.markdown).toContain("局域网");
      expect(result.markdown).not.toContain("联系方式怎么呈现");
      expect(result.markdown).not.toContain("静态展示网站");
    });

    it("should route gym GEO content sites to agent-assisted content marketing", () => {
      const result = executeAssist(
        "我打算做个我健身房的网站，配合 GEO 服务，我会传很多我的 Q&A 上去，还有健身房的照片，用户的反馈，近期的促销活动，我的教练的信息等等上去，我会不定期的去维护上面的内容"
      );
      const ids = result.quickQuestions.map((q) => q.id);

      expect(result.pmIntentDecision?.needType).toBe("content_marketing_site");
      expect(result.pmIntentDecision?.usageScope).toBe("public_audience");
      expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
      expect(result.pmIntentDecision?.technicalShape).toBe("static_json_data_page");
      expect(ids).toContain("maintenance_mode");
      expect(ids).toContain("geo_goal");
      expect(ids).toContain("visitor_submission");
      expect(result.markdown).toContain("内容经常改不等于必须做后台");
      expect(result.markdown).not.toContain("管理员登录才能访问");
    });

    it("should route xlsx chart sites to data visualization without defaulting to admin backend", () => {
      const result = executeAssist(
        "我想做个图表网站，每次我提供新的 xlsx 的文件，这个网站就根据新的数据渲染出结果"
      );
      const ids = result.quickQuestions.map((q) => q.id);

      expect(result.pmIntentDecision?.needType).toBe("data_visualization_site");
      expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
      expect(result.pmIntentDecision?.technicalShape).toBe("static_json_data_page");
      expect(result.pmIntentDecision?.mustNotUse).toContain("admin_backend_by_default");
      expect(ids).toContain("data_update_mode");
      expect(ids).toContain("audience_scope");
      expect(ids).toContain("history_versions");
      expect(result.markdown).toContain("新的 xlsx 是交给 Agent 更新网站");
      expect(result.markdown).not.toContain("管理后台");
    });

    it("should treat internal knowledge bases as backend products, not launch or local tools", () => {
      const result = executeAssist(
        "我想做一个内部知识库，可以写文档、发布文档、按分类搜索。草稿只有自己能看，发布后团队能看。不接 AI，不接支付。",
        undefined,
        "web",
        "normal",
        true
      );

      expect(result.routedIntent.scenario).toBe("build_product");
      expect(result.selectedTool).toBe("spec_interrogate");
      expect(result.technicalProfile?.shape).toBe("light_backend_json_sqlite");
      expect(result.technicalProfile?.frontendOnly).toBe(false);
      expect(result.quickQuestions.map((q) => q.id)).toContain("document_fields");
      expect(result.quickQuestions.map((q) => q.id)).toContain("permission_rule");
      expect(result.markdown).not.toContain("上线前缺口检查");
      expect(result.markdown).not.toContain("手机号去重");
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
