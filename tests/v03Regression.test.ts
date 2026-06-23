import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type ToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: any;
};

describe("v0.3 black-box regression", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.cjs"],
      cwd: process.cwd(),
    });
    client = new Client({ name: "v03-regression-test", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return await client.callTool({ name, arguments: args }) as ToolResult;
  }

  function text(result: ToolResult): string {
    return result.content?.map((item) => item.text || "").join("\n") || "";
  }

  describe("activity registration", () => {
    it("routes registration ideas to spec_interrogate with registration questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个活动报名系统，用户可以提交姓名电话和报名信息，我能在后台看到，最好还能导出 Excel。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("user_login");
      expect(ids).toContain("dedup_strategy");
      expect(text(result)).toContain("手机号去重");
    });

    it("compiles registration answers into backend APIs and data model", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "活动报名系统，用户提交姓名电话和报名信息，管理员后台查看并导出 Excel。",
        answers: {
          data_persistence: "本地文件存储即可，SQLite 也可以",
          user_login: "用户不需要登录，填表直接提交",
          admin_features: "看列表 + 筛选 + 导出",
          workflow: "提交即完成，不需要审核",
          primary_platform: "手机端为主",
          dedup_strategy: "手机号去重",
          admin_access: "管理员登录才能访问",
          third_party: "都不需要",
          form_fields: "姓名、手机号、报名人数、备注",
          export_format: "Excel",
          backend_need: true,
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.successCriteria.join("\n")}`;

      expect(spec.architecture).not.toContain("纯前端");
      expect(combined).toContain("registrations");
      expect(combined).toContain("phone TEXT NOT NULL UNIQUE");
      expect(combined).toContain("POST /api/registrations");
      expect(combined).toContain("GET /api/admin/registrations/export");
      expect(combined).not.toContain("/api/登录");
    });

    it("keeps individual registration architecture lightweight", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "活动报名系统",
        platform: "web",
        features: ["用户报名表单", "提交报名数据保存到数据库", "管理员登录", "后台报名列表", "按手机号搜索", "导出 Excel"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;

      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needSeparation).toBe(false);
      expect(decision.recommendedDatabase).toBe("SQLite");
      expect(decision.mvpSuggestion).toContain("Session");
    });

    it("generates registration-specific acceptance checks", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "活动报名系统",
        features: ["报名表单", "后台管理", "按手机号搜索", "Excel导出", "管理员登录"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("手机号格式错误");
      expect(items).toContain("同一手机号重复报名");
      expect(items).toContain("按手机号搜索");
      expect(items).toContain("导出 Excel");
      expect(items).toContain("退出登录后不能继续访问后台数据");
    });
  });

  describe("portfolio site, UI and launch", () => {
    it("routes portfolio creation as a static display site", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个个人作品展示网站，放我的介绍、作品图片、联系方式，看起来高级一点，手机上也要好看。",
        preferred_platform: "web",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("architecture_decide");
      expect(ids).toContain("visual_style");
      expect(text(result)).toContain("静态展示网站");
      expect(text(result)).not.toContain("手机号去重");
    });

    it("routes existing hero polish requests to ui_translate", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我做了一个个人作品展示网站，首页Hero区域太普通了，就是居中的名字+副标题+一个按钮，没什么视觉冲击力。我想要更高级的首屏效果，比如动态背景、光效、粒子、渐变流动之类的，但要保持极简高级感，不能花哨。深色主题，金色点缀。请给我具体的UI升级方案。",
        preferred_platform: "web",
        strictness: "light",
        known_context: {
          current_stack: "HTML5 + CSS3 + Vanilla JS",
          theme: "dark + gold",
          current_hero: "居中文字 + CTA button",
        },
      });
      const structured = result.structuredContent;

      expect(structured.routedIntent.scenario).toBe("modify_ui");
      expect(structured.selectedTool).toBe("ui_translate");
      expect(text(result)).toContain("Layered Ambient Background");
      expect(text(result)).not.toContain("静态展示网站");
    });

    it("routes portfolio launch questions to launch review", async () => {
      const result = await callTool("product_spec_assist", {
        message: "个人作品网站我想上线了，需要注意什么？我是一个B2B产品经理转内容创作者，有9年产品经验，目前做自媒体运营和AI应用开发。网站主要展示我的作品集、项目经历和技术能力。",
        preferred_platform: "web",
      });
      const structured = result.structuredContent;

      expect(structured.routedIntent.scenario).toBe("launch");
      expect(structured.executed).toBe(false);
      expect(text(result)).toContain("上线前缺口检查");
      expect(text(result)).not.toContain("静态展示网站");
    });

    it("generates static-site acceptance without dynamic app checks", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "个人作品集展示网站（纯HTML/CSS/JS静态站）",
        features: ["导航栏", "Hero首屏", "关于我", "作品集", "联系方式", "响应式设计", "滚动渐入动画"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("占位内容");
      expect(items).toContain("favicon");
      expect(items).toContain("meta description");
      expect(items).not.toContain("接口超时");
      expect(items).not.toContain("表单提交");
    });
  });

  describe("appointment booking", () => {
    it("routes appointment ideas with appointment questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个预约服务系统，用户可以选择服务项目和时间段提交预约。后台可以看到预约列表、设置可预约时间段、限制每个时间段的人数。用户提交后可以收到确认信息，最好也能取消预约。MVP 先不接支付。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);
      const output = text(result);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("service_catalog");
      expect(ids).toContain("time_slot_rule");
      expect(ids).toContain("capacity_rule");
      expect(ids).toContain("cancel_rule");
      expect(output).toContain("时间段");
      expect(output).not.toContain("报名数据怎么保存");
      expect(output).not.toContain("手机号去重");
      expect(output).not.toContain("导出 Excel");
    });

    it("compiles appointment answers into services, slots and bookings", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "预约服务系统：用户可以选择服务项目和时间段提交预约，后台可以设置可预约时间段、限制每个时间段的人数，用户可以取消预约。MVP 不接支付。",
        answers: {
          service_catalog: "服务项目包含名称、简介、时长、可预约状态",
          time_slot_rule: "管理员可以设置日期、开始时间、结束时间、最大预约人数",
          booking_flow: "用户选择服务项目和时间段 -> 填写姓名手机号 -> 提交预约 -> 后台可查看",
          capacity_rule: "每个时间段达到最大人数后不能继续预约",
          booking_status: "预约状态包含 pending、confirmed、cancelled",
          cancel_rule: "用户可以通过手机号和预约号取消预约",
          admin_features: "管理员可以管理服务项目、设置时间段、查看预约列表、筛选状态",
          notification: "MVP 先页面提示确认信息，不接短信",
          payment: "MVP 不接支付",
          data_persistence: "本地 JSON 或 SQLite 即可",
          target_platform: "Web 端，手机优先",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(spec.productGoal).toContain("预约服务");
      expect(combined).toContain("services");
      expect(combined).toContain("time_slots");
      expect(combined).toContain("bookings");
      expect(combined).toContain("GET /api/time-slots");
      expect(combined).toContain("POST /api/bookings/:id/cancel");
      expect(combined).toContain("容量限制必须在后端");
      expect(combined).toContain("service_catalog");
      expect(combined).toContain("capacity_rule");
      expect(combined).not.toContain("registrations");
      expect(combined).not.toContain("GET /api/admin/registrations/export");
      expect(combined).not.toContain("products");
      expect(combined).not.toContain("credit_accounts");
    });

    it("flags appointment capacity architecture risk without registration wording", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "预约服务系统",
        platform: "web",
        features: ["服务项目", "时间段设置", "预约提交", "容量限制", "取消预约", "后台管理"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needSeparation).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(decision.aiKeyRisk).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(output).toContain("容量");
      expect(output).not.toContain("导出接口");
    });

    it("generates appointment acceptance checks without payment or export pollution", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "预约服务系统",
        features: ["服务项目", "时间段", "预约提交", "容量限制", "取消预约", "后台管理", "状态筛选"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("用户可以查看可预约服务项目");
      expect(items).toContain("满员时间段不能继续预约");
      expect(items).toContain("取消预约后释放对应时间段容量");
      expect(items).toContain("管理员可以新增、编辑和停用时间段");
      expect(items).toContain("管理员可以按状态筛选预约");
      expect(items).not.toContain("导出 Excel");
      expect(items).not.toContain("支付金额");
      expect(items).not.toContain("AI API Key");
    });
  });

  describe("content community moderation", () => {
    it("routes content community ideas with moderation questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个内容社区，用户可以注册登录后发布文章，别人可以浏览和评论。为了防止乱发内容，文章发布后需要管理员审核，通过后才公开展示。用户也可以举报评论，管理员可以隐藏违规评论和下架文章。MVP 先不做支付，也不接 AI。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);
      const output = text(result);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("content_model");
      expect(ids).toContain("publish_flow");
      expect(ids).toContain("comment_flow");
      expect(ids).toContain("report_flow");
      expect(output).toContain("文章");
      expect(output).toContain("举报");
      expect(output).not.toContain("手机号去重");
      expect(output).not.toContain("资料包");
      expect(output).not.toContain("时间段");
      expect(output).not.toContain("AI 模型");
    });

    it("compiles content community answers without AI or commerce pollution", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "内容社区投稿审核系统：用户注册登录后发布文章、评论和举报评论；文章发布后需要管理员审核，通过后才公开展示；管理员可以隐藏违规评论和下架文章。MVP 不接支付，不接 AI。",
        answers: {
          user_roles: "普通用户可以注册登录、发布文章、评论和举报；管理员可以审核文章、隐藏评论、下架文章",
          content_model: "文章包含标题、正文、作者、状态、发布时间；评论包含文章ID、作者、内容、状态",
          publish_flow: "用户提交文章 -> 状态为 pending -> 管理员审核 -> approved 后公开展示，rejected 不公开",
          comment_flow: "登录用户可以评论已公开文章；管理员可以隐藏违规评论",
          report_flow: "用户可以举报评论，管理员在后台查看举报并处理",
          moderation_status: "文章状态包含 draft、pending、approved、rejected、removed；评论状态包含 visible、hidden",
          admin_features: "管理员可以查看待审文章、通过/拒绝文章、下架文章、查看举报、隐藏评论",
          data_persistence: "本地 JSON 或 SQLite 即可",
          notification: "MVP 先不做通知",
          payment: "MVP 不接支付",
          ai: "MVP 不接 AI",
          target_platform: "Web 端，桌面和手机都要可用",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(spec.productGoal).toContain("内容社区");
      expect(combined).toContain("users");
      expect(combined).toContain("posts");
      expect(combined).toContain("comments");
      expect(combined).toContain("reports");
      expect(combined).toContain("moderation_actions");
      expect(combined).toContain("POST /api/posts");
      expect(combined).toContain("POST /api/comments/:id/report");
      expect(combined).toContain("POST /api/admin/posts/:id/approve");
      expect(combined).toContain("POST /api/admin/comments/:id/hide");
      expect(combined).toContain("pending");
      expect(combined).toContain("approved");
      expect(combined).toContain("hidden");
      expect(combined).toContain("content_model");
      expect(combined).toContain("publish_flow");
      expect(combined).toContain("comment_flow");
      expect(combined).toContain("report_flow");
      expect(combined).not.toContain("credit_accounts");
      expect(combined).not.toContain("generation_jobs");
      expect(combined).not.toContain("POST /api/generations");
      expect(combined).not.toContain("products");
      expect(combined).not.toContain("downloads");
      expect(combined).not.toContain("bookings");
      expect(combined).not.toContain("registrations");
    });

    it("keeps content community architecture lightweight and moderation-aware", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "内容社区投稿审核系统",
        platform: "web",
        features: ["用户注册登录", "发布文章", "文章审核", "评论", "举报评论", "隐藏评论", "下架文章", "管理员后台"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("content_community");
      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needSeparation).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(decision.aiKeyRisk).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(output).toContain("文章审核");
      expect(output).toContain("操作追踪");
      expect(output).not.toContain("手机号");
      expect(output).not.toContain("导出");
      expect(output).not.toContain("下载权限");
    });

    it("generates content moderation acceptance without other domain pollution", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "内容社区投稿审核系统",
        features: ["用户注册登录", "发布文章", "文章审核", "评论", "举报评论", "隐藏评论", "下架文章", "管理员后台"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("登录用户提交文章后进入 pending 状态");
      expect(items).toContain("pending 文章不能在公开列表或详情页展示");
      expect(items).toContain("管理员通过文章后，文章状态变为 approved 并公开展示");
      expect(items).toContain("管理员拒绝或下架文章后，文章不能公开展示");
      expect(items).toContain("登录用户可以评论 approved 文章");
      expect(items).toContain("用户可以举报评论");
      expect(items).toContain("管理员隐藏评论后，该评论不在前台展示");
      expect(items).not.toContain("导出 Excel");
      expect(items).not.toContain("支付金额");
      expect(items).not.toContain("下载接口");
      expect(items).not.toContain("满员时间段");
      expect(items).not.toContain("AI API Key");
    });
  });

  describe("reverse domain isolation and ticket workflow", () => {
    it("does not let content community absorb digital commerce or appointment specs", async () => {
      const commerce = await callTool("spec_compile", {
        raw_idea: "我想做一个数字资料售卖网站，用户注册登录后可以买资料包，支付成功后才能下载文件，管理员可以上架和下架资料。",
        answers: {
          product_catalog: "资料包包含标题、简介、价格、封面、文件路径、上下架状态",
          order_flow: "用户选择资料包 -> 创建订单 -> mock 支付成功 -> 获得下载权限",
          payment_provider: "MVP 使用 mock payment provider",
          payment_confirmation: "支付状态必须由后端确认",
          price_calculation: "订单金额必须由后端根据商品价格计算",
          download_permission: "只有已登录且已支付该订单的用户可以下载对应文件",
          admin_features: "管理员可以新增、编辑、上下架资料包，查看订单和下载记录",
        },
      });
      const commerceSpec = commerce.structuredContent.spec;
      const commerceText = `${commerceSpec.dataModel}\n${commerceSpec.apiDesign}\n${JSON.stringify(commerceSpec.inputConsumption ?? {})}`;

      expect(commerceText).toContain("products");
      expect(commerceText).toContain("orders");
      expect(commerceText).toContain("downloads");
      expect(commerceText).toContain("digital_commerce");
      expect(commerceText).not.toContain("posts");
      expect(commerceText).not.toContain("moderation_actions");

      const appointment = await callTool("spec_compile", {
        raw_idea: "我想做一个预约系统，用户可以选择服务和时间段预约，时间段有人数上限，满员不能再约，用户可以取消预约，管理员可以管理时间段。",
        answers: {
          service_catalog: "服务项目包含名称、简介、时长、可预约状态",
          time_slot_rule: "管理员设置日期、开始时间、结束时间、最大预约人数",
          booking_flow: "用户选择服务项目和时间段 -> 提交预约",
          capacity_rule: "每个时间段达到最大人数后不能继续预约",
          booking_status: "预约状态包含 pending、confirmed、cancelled",
          cancel_rule: "用户可以取消预约",
          admin_features: "管理员管理服务项目、时间段和预约列表",
        },
      });
      const appointmentSpec = appointment.structuredContent.spec;
      const appointmentText = `${appointmentSpec.dataModel}\n${appointmentSpec.apiDesign}\n${JSON.stringify(appointmentSpec.inputConsumption ?? {})}`;

      expect(appointmentText).toContain("services");
      expect(appointmentText).toContain("time_slots");
      expect(appointmentText).toContain("bookings");
      expect(appointmentText).toContain("appointment");
      expect(appointmentText).not.toContain("posts");
      expect(appointmentText).not.toContain("moderation_actions");
    });

    it("routes ticket workflow ideas with workflow questions, not registration or content moderation", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个简单的工单系统。用户可以提交问题或任务，管理员可以在后台查看工单，把工单分配给处理人，处理人可以更新状态和回复处理进展。工单有优先级、状态、截止时间。管理员可以筛选未处理、处理中、已解决的工单。MVP 先不做支付，也不接 AI，也不需要复杂团队权限。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);
      const output = text(result);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("ticket_fields");
      expect(ids).toContain("status_flow");
      expect(ids).toContain("assignment_flow");
      expect(output).toContain("处理人");
      expect(output).toContain("状态流转");
      expect(output).not.toContain("报名数据怎么保存");
      expect(output).not.toContain("手机号去重");
      expect(output).not.toContain("文章审核");
      expect(output).not.toContain("举报评论");
    });

    it("compiles ticket workflow answers without existing domain template pollution", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "工单任务协作系统，用户提交工单，管理员分配处理人，处理人更新状态和回复处理进展。MVP 不接支付，不接 AI。",
        answers: {
          user_roles: "普通用户可以提交工单和查看自己的工单；管理员可以查看全部工单、分配处理人、修改优先级；处理人可以更新状态和回复处理进展",
          ticket_fields: "工单包含标题、描述、提交人、处理人、优先级、状态、截止时间、创建时间、更新时间",
          status_flow: "状态包含 open、assigned、in_progress、resolved、closed、reopened",
          assignment_flow: "管理员可以把工单分配给处理人；处理人只能查看和处理分配给自己的工单",
          ticket_comment_flow: "用户、管理员、处理人都可以在工单下留言；处理人回复需要记录时间和内容",
          admin_features: "后台可以按状态、优先级、处理人、截止时间筛选工单，可以查看处理记录",
          data_persistence: "本地 JSON 或 SQLite 即可",
          payment: "MVP 不接支付",
          ai: "MVP 不接 AI",
          target_platform: "Web 端，桌面和手机都要可用",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(combined).toContain("工单");
      expect(combined).toContain("tickets");
      expect(combined).toContain("ticket_comments");
      expect(combined).toContain("ticket_assignments");
      expect(combined).toContain("status_history");
      expect(combined).toContain("POST /api/tickets");
      expect(combined).toContain("PATCH /api/admin/tickets/:id/assign");
      expect(combined).toContain("PATCH /api/handler/tickets/:id/status");
      expect(combined).toContain("ticket_workflow");
      expect(combined).toContain("ticket_fields");
      expect(combined).toContain("status_flow");
      expect(combined).toContain("assignment_flow");
      expect(combined).not.toContain("posts");
      expect(combined).not.toContain("reports");
      expect(combined).not.toContain("registrations");
      expect(combined).not.toContain("products");
      expect(combined).not.toContain("time_slots");
      expect(combined).not.toContain("credit_accounts");
    });

    it("keeps ticket workflow architecture lightweight and workflow-aware", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "工单任务协作系统，MVP 先不做支付，也不接 AI，不需要复杂团队权限",
        platform: "web",
        features: [
          "用户提交工单",
          "管理员后台",
          "分配处理人",
          "处理人更新状态",
          "工单评论",
          "状态流转",
          "优先级",
          "截止时间",
          "筛选工单",
          "MVP 不接支付",
          "MVP 不接 AI",
          "不需要复杂团队权限",
        ],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("ticket_workflow");
      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needSeparation).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(decision.aiKeyRisk).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(decision.mvpSuggestion).toContain("Session");
      expect(decision.mvpSuggestion).not.toContain("RBAC");
      expect(output).toContain("状态流转");
      expect(output).toContain("处理人权限");
      expect(output).not.toContain("手机号");
      expect(output).not.toContain("导出");
      expect(output).not.toContain("文章审核");
      expect(output).not.toContain("支付金额");
      expect(output).not.toContain("AI Key");
    });

    it("generates ticket workflow acceptance checks without other domain pollution", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "工单任务协作系统",
        features: ["用户提交工单", "管理员后台", "分配处理人", "处理人更新状态", "工单评论", "状态流转", "优先级", "截止时间", "筛选工单"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("用户只能查看自己的工单");
      expect(items).toContain("管理员可以把工单分配给处理人");
      expect(items).toContain("处理人只能查看和处理分配给自己的工单");
      expect(items).toContain("状态只能按允许流程流转");
      expect(items).toContain("评论和处理记录能按时间展示");
      expect(items).toContain("按状态、优先级、处理人和截止时间筛选工单");
      expect(items).not.toContain("导出 Excel");
      expect(items).not.toContain("支付金额");
      expect(items).not.toContain("下载接口");
      expect(items).not.toContain("文章审核");
      expect(items).not.toContain("满员时间段");
      expect(items).not.toContain("AI API Key");
    });
  });

  describe("knowledge base document management", () => {
    it("routes knowledge base ideas with document and permission questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个团队知识库系统。成员登录后可以创建和编辑文档，文档可以放到不同目录里。管理员可以管理成员、目录和文档权限。文档需要支持草稿和已发布状态，已发布文档团队成员可以搜索和查看。MVP 先不做 AI，不接支付，也不需要复杂企业权限。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);
      const output = text(result);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("document_fields");
      expect(ids).toContain("folder_structure");
      expect(ids).toContain("document_status");
      expect(ids).toContain("permission_rule");
      expect(ids).toContain("search_scope");
      expect(output).toContain("文档");
      expect(output).toContain("可见范围");
      expect(output).not.toContain("手机号去重");
      expect(output).not.toContain("导出格式");
      expect(output).not.toContain("举报评论");
      expect(output).not.toContain("处理人");
      expect(output).not.toContain("AI 模型");
    });

    it("compiles knowledge base answers into documents, folders and permissions", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "团队知识库系统，成员登录后可以创建和编辑文档，文档可以放到不同目录里。管理员可以管理成员、目录和文档权限。文档支持草稿和已发布状态，已发布文档团队成员可以搜索和查看。MVP 不接 AI，不接支付，不需要复杂企业权限。",
        answers: {
          user_roles: "成员可以登录、创建文档、编辑自己有权限的文档、搜索和查看已发布文档；管理员可以管理成员、目录、文档权限和发布状态",
          document_fields: "文档包含标题、正文、目录ID、作者、状态、可见范围、创建时间、更新时间",
          folder_structure: "目录支持一级或多级目录，MVP 可以先支持树形目录",
          document_status: "文档状态包含 draft 和 published。draft 只有作者和管理员可见，published 对有权限的成员可见",
          permission_rule: "MVP 先做简单权限：成员、管理员，以及文档可见范围；不做复杂企业 RBAC",
          search_scope: "成员可以搜索自己有权限查看的已发布文档，管理员可以搜索全部文档",
          version_history: "MVP 先保存更新时间，不做完整版本历史",
          admin_features: "管理员可以管理成员、目录、文档权限、发布或撤回文档",
          data_persistence: "本地 JSON 或 SQLite 即可",
          notification: "MVP 先不做通知",
          payment: "MVP 不接支付",
          ai: "MVP 不接 AI",
          target_platform: "Web 端，桌面优先，手机可用",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(text(result)).not.toContain("119 / 100");
      expect(spec.productGoal).toContain("知识库");
      expect(combined).toContain("users");
      expect(combined).toContain("folders");
      expect(combined).toContain("documents");
      expect(combined).toContain("document_permissions");
      expect(combined).toContain("POST /api/documents");
      expect(combined).toContain("GET /api/search?q=");
      expect(combined).toContain("PATCH /api/admin/documents/:id/publish");
      expect(combined).toContain("PATCH /api/admin/documents/:id/permissions");
      expect(combined).toContain("draft");
      expect(combined).toContain("published");
      expect(combined).toContain("knowledge_base");
      expect(combined).toContain("document_fields");
      expect(combined).toContain("permission_rule");
      expect(combined).toContain("search_scope");
      expect(combined).not.toContain("registrations");
      expect(combined).not.toContain("moderation_actions");
      expect(combined).not.toContain("products");
      expect(combined).not.toContain("bookings");
      expect(combined).not.toContain("generation_jobs");
      expect(combined).not.toContain("ticket_assignments");
    });

    it("keeps knowledge base architecture lightweight and permission-aware", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "团队知识库文档管理系统，MVP 先不做 AI，不接支付，不需要复杂企业权限",
        platform: "web",
        features: [
          "成员登录",
          "创建文档",
          "编辑文档",
          "目录管理",
          "文档草稿",
          "文档发布",
          "搜索文档",
          "文档权限",
          "管理员后台",
          "MVP 不接支付",
          "MVP 不接 AI",
          "不需要复杂企业权限",
        ],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("knowledge_base");
      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needSeparation).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(decision.aiKeyRisk).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(decision.mvpSuggestion).toContain("Session");
      expect(decision.mvpSuggestion).not.toContain("RBAC");
      expect(output).toContain("draft");
      expect(output).toContain("搜索结果");
      expect(output).not.toContain("手机号");
      expect(output).not.toContain("导出");
      expect(output).not.toContain("AI Key");
      expect(output).not.toContain("支付金额");
      expect(output).not.toContain("处理人权限");
    });

    it("generates knowledge base acceptance checks without other domain pollution", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "团队知识库文档管理系统",
        features: ["成员登录", "创建文档", "编辑文档", "目录管理", "文档草稿", "文档发布", "搜索文档", "文档权限", "管理员后台"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("成员登录后可以创建 draft 文档");
      expect(items).toContain("draft 文档不出现在普通成员列表和搜索结果中");
      expect(items).toContain("published 文档可以被有权限成员查看");
      expect(items).toContain("无权限成员不能查看受限文档详情");
      expect(items).toContain("管理员可以设置文档权限或可见范围");
      expect(items).toContain("搜索结果只返回当前用户有权限查看的 published 文档");
      expect(items).not.toContain("导出 Excel");
      expect(items).not.toContain("支付金额");
      expect(items).not.toContain("下载接口");
      expect(items).not.toContain("举报评论");
      expect(items).not.toContain("满员时间段");
      expect(items).not.toContain("处理人");
      expect(items).not.toContain("AI API Key");
    });
  });

  describe("light CRM customer follow-up", () => {
    it("routes CRM ideas with customer, contact and follow-up questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个轻量 CRM 系统。用户登录后可以录入客户和联系人，记录每次跟进内容，给客户设置跟进阶段和下次跟进时间。管理员可以查看所有客户、分配客户给销售、按阶段和负责人筛选客户。MVP 先不做支付，不接 AI，也不需要复杂企业权限。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);
      const output = text(result);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("customer_fields");
      expect(ids).toContain("contact_fields");
      expect(ids).toContain("followup_fields");
      expect(ids).toContain("stage_rule");
      expect(ids).toContain("assignment_rule");
      expect(output).toContain("客户");
      expect(output).toContain("跟进");
      expect(output).not.toContain("手机号去重");
      expect(output).not.toContain("导出格式");
      expect(output).not.toContain("举报评论");
      expect(output).not.toContain("AI 模型");
      expect(output).not.toContain("文档权限");
    });

    it("compiles CRM answers into customers, contacts and followups", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "轻量 CRM 系统，用户登录后可以录入客户和联系人，记录每次跟进内容，给客户设置跟进阶段和下次跟进时间。管理员可以查看所有客户、分配客户给销售、按阶段和负责人筛选客户。MVP 不接支付，不接 AI，不需要复杂企业权限。",
        answers: {
          user_roles: "普通销售可以登录、创建客户、编辑自己负责的客户、记录跟进；管理员可以查看所有客户、分配客户给销售、管理阶段和筛选客户",
          customer_fields: "客户包含名称、来源、阶段、负责人、备注、下次跟进时间、创建时间、更新时间",
          contact_fields: "联系人包含客户ID、姓名、电话、微信、职位、备注",
          followup_fields: "跟进记录包含客户ID、跟进人、内容、跟进方式、跟进时间、下次跟进时间",
          stage_rule: "客户阶段包含 new、contacted、interested、proposal、won、lost。MVP 允许销售按规则手动更新阶段",
          assignment_rule: "管理员可以把客户分配给销售；销售只能查看和编辑自己负责的客户",
          reminder_rule: "MVP 先不做消息通知，只在列表里按下次跟进时间筛选即将跟进客户",
          admin_features: "管理员可以查看所有客户、按阶段和负责人筛选、分配客户、管理销售账号",
          data_persistence: "本地 JSON 或 SQLite 即可",
          notification: "MVP 先不做通知",
          payment: "MVP 不接支付",
          ai: "MVP 不接 AI",
          target_platform: "Web 端，桌面优先，手机可用",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(result.structuredContent.inputConsumption).toEqual(spec.inputConsumption);
      expect(spec.productGoal).toContain("CRM");
      expect(combined).toContain("customers");
      expect(combined).toContain("contacts");
      expect(combined).toContain("followups");
      expect(combined).toContain("customer_assignments");
      expect(combined).toContain("next_followup_at");
      expect(combined).not.toContain("用户角色：true");
      expect(combined).not.toContain("用户角色：false");
      expect(combined).toContain("POST /api/customers");
      expect(combined).toContain("POST /api/customers/:id/contacts");
      expect(combined).toContain("POST /api/customers/:id/followups");
      expect(combined).toContain("GET /api/admin/customers?stage=&owner=");
      expect(combined).toContain("PATCH /api/admin/customers/:id/assign");
      expect(combined).toContain("crm");
      expect(combined).toContain("customer_fields");
      expect(combined).toContain("followup_fields");
      expect(combined).toContain("assignment_rule");
      expect(combined).not.toContain("/api/登录");
      expect(combined).not.toContain("registrations");
      expect(combined).not.toContain("moderation_actions");
      expect(combined).not.toContain("payments");
      expect(combined).not.toContain("bookings");
      expect(combined).not.toContain("generation_jobs");
      expect(combined).not.toContain("ticket_assignments");
      expect(combined).not.toContain("document_permissions");
    });

    it("keeps CRM architecture lightweight and owner-permission aware", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "轻量 CRM 客户跟进系统，MVP 先不做 AI，不接支付，不需要复杂企业权限",
        platform: "web",
        features: [
          "销售登录",
          "客户录入",
          "联系人管理",
          "跟进记录",
          "客户阶段",
          "负责人分配",
          "下次跟进时间",
          "客户筛选",
          "管理员后台",
          "MVP 不接支付",
          "MVP 不接 AI",
          "不需要复杂企业权限",
        ],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("crm");
      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.needAdmin).toBe(true);
      expect(decision.needLogging).toBe(false);
      expect(decision.needSeparation).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(decision.aiKeyRisk).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(decision.mvpSuggestion).toContain("Session");
      expect(decision.mvpSuggestion).not.toContain("RBAC");
      expect(output).toContain("销售只能访问自己负责的客户");
      expect(output).toContain("负责人分配");
      expect(output).not.toContain("手机号");
      expect(output).not.toContain("导出");
      expect(output).not.toContain("AI Key");
      expect(output).not.toContain("支付金额");
      expect(output).not.toContain("文档权限");
    });

    it("keeps covered small-team architecture aligned with compile domains", async () => {
      const registrationResult = await callTool("architecture_decide", {
        product_type: "活动报名系统",
        platform: "web",
        features: ["报名表单", "报名列表", "导出 Excel", "管理员后台"],
        commercial_intent: false,
        expected_users: "small_team",
      });
      const crmResult = await callTool("architecture_decide", {
        product_type: "轻量 CRM 客户跟进系统",
        platform: "web",
        features: ["销售登录", "客户录入", "联系人管理", "跟进记录", "负责人分配", "管理员后台"],
        commercial_intent: false,
        expected_users: "small_team",
      });
      const registration = registrationResult.structuredContent.decision;
      const crm = crmResult.structuredContent.decision;

      expect(registration.domain).toBe("registration");
      expect(registration.needSeparation).toBe(false);
      expect(registration.recommendedDatabase).toBe("SQLite");
      expect(crm.domain).toBe("crm");
      expect(crm.needSeparation).toBe(false);
      expect(crm.recommendedDatabase).toMatch(/SQLite|JSON/);
    });

    it("generates CRM acceptance checks without other domain pollution", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "轻量 CRM 客户跟进系统",
        features: ["销售登录", "客户录入", "联系人管理", "跟进记录", "客户阶段", "负责人分配", "下次跟进时间", "客户筛选", "管理员后台"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("销售可以创建客户");
      expect(items).toContain("销售只能查看和编辑自己负责的客户");
      expect(items).toContain("管理员可以分配客户给销售");
      expect(items).toContain("跟进记录可以新增并按时间展示");
      expect(items).toContain("下次跟进时间可以保存和筛选");
      expect(items).toContain("管理员可以按负责人筛选客户");
      expect(items).not.toContain("导出 Excel");
      expect(items).not.toContain("支付金额");
      expect(items).not.toContain("下载接口");
      expect(items).not.toContain("举报评论");
      expect(items).not.toContain("满员时间段");
      expect(items).not.toContain("resolved");
      expect(items).not.toContain("draft 文档");
      expect(items).not.toContain("AI API Key");
    });

    it("downgrades explicit personal single-user CRM across compile, architecture and acceptance", async () => {
      const compileResult = await callTool("spec_compile", {
        raw_idea: "个人轻量 CRM，就我一个人用，没有团队，不需要多角色权限，不需要销售账号。记录客户、联系人、跟进内容、客户阶段和下次跟进时间。",
        answers: {
          user_roles: "就我一个人用，不需要多角色权限，不需要销售账号",
          customer_fields: "客户包含名称、来源、阶段、备注、下次跟进时间",
          contact_fields: "联系人包含姓名、电话、微信、职位、备注",
          followup_fields: "跟进记录包含内容、跟进方式、跟进时间、下次跟进时间",
          stage_rule: "客户阶段包含 new、contacted、interested、proposal、won、lost",
          assignment_rule: "不需要分配，所有客户都是我自己维护",
          reminder_rule: "按下次跟进时间筛选",
          has_auth: false,
        },
      });
      const spec = compileResult.structuredContent.spec;
      const compiled = `${spec.productGoal}\n${spec.targetUser}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}`;

      expect(compiled).toContain("个人单用户");
      expect(compiled).toContain("customers");
      expect(compiled).toContain("contacts");
      expect(compiled).toContain("followups");
      expect(compiled).toContain("GET /api/customers");
      expect(compiled).not.toContain("admin_users");
      expect(compiled).not.toContain("customer_assignments");
      expect(compiled).not.toContain("/api/admin/customers");
      expect(compiled).not.toContain("销售注册");

      const archResult = await callTool("architecture_decide", {
        product_type: "个人轻量 CRM，就我一个人用，没有团队，不需要多角色权限，不需要销售账号",
        platform: "web",
        features: ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要管理员", "不需要登录"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = archResult.structuredContent.decision;
      const archOutput = text(archResult);

      expect(decision.domain).toBe("crm");
      expect(decision.needAuth).toBe(false);
      expect(decision.needAdmin).toBe(false);
      expect(decision.needSeparation).toBe(false);
      expect(decision.recommendedDatabase).toMatch(/SQLite|JSON/);
      expect(decision.mvpSuggestion).toContain("个人单用户");
      expect(archOutput).not.toContain("负责人分配");
      expect(archOutput).not.toContain("RBAC");

      const compactArchResult = await callTool("architecture_decide", {
        product_type: "轻量 CRM 客户跟进系统",
        platform: "web",
        features: ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要多角色权限", "不需要销售账号", "不需要管理员"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const compactDecision = compactArchResult.structuredContent.decision;

      expect(compactDecision.domain).toBe("crm");
      expect(compactDecision.needAuth).toBe(false);
      expect(compactDecision.needAdmin).toBe(false);
      expect(compactDecision.mvpSuggestion).toContain("个人单用户");
      expect(compactDecision.mvpSuggestion).not.toContain("customer_assignments");

      const acceptanceResult = await callTool("acceptance_generate", {
        product_type: "个人轻量 CRM，就我一个人用，不需要多角色权限，不需要销售账号",
        features: ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要管理员"],
        platform: "web",
        has_backend: true,
        has_payment: false,
        has_auth: false,
      });
      const items = acceptanceResult.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("可以新增、查看、编辑和删除或归档客户");
      expect(items).toContain("客户可以保存联系人信息");
      expect(items).not.toContain("销售只能查看和编辑自己负责的客户");
      expect(items).not.toContain("管理员可以分配客户给销售");
      expect(items).not.toContain("未登录用户不能创建或查看客户");
      expect(items).not.toContain("敏感操作有审计日志");
    });
  });

  describe("unknown domain safe fallback", () => {
    it("keeps beginner local tools in generic fallback without knowledge base or CRM pollution", async () => {
      const learningResult = await callTool("spec_compile", {
        raw_idea: "我想做一个个人学习资源导航 HTML，不登录、不做权限管理，保存课程、文章和工具链接，支持分类、搜索和收藏。",
        answers: {
          resource_fields: "标题、链接、类型、标签、备注、收藏状态",
          filter_rule: "按课程、文章、工具和标签筛选",
          search_rule: "按标题和备注搜索",
          storage_rule: "localStorage 本地保存",
          non_goals: "不登录、不做多人协作、不做权限管理、不做后台",
          target_platform: "纯 HTML/CSS/JS",
        },
      });
      const learningSpec = learningResult.structuredContent.spec;
      const learningCombined = `${learningSpec.productGoal}\n${learningSpec.coreFeatures.join("\n")}\n${learningSpec.dataModel}\n${learningSpec.apiDesign}\n${JSON.stringify(learningSpec.inputConsumption ?? {})}`;

      expect(learningResult.structuredContent.readiness.status).toBe("Draft Ready");
      expect(learningResult.structuredContent.inputConsumption).toEqual(learningSpec.inputConsumption);
      expect(learningSpec.inputConsumption.matchedDomain).toBe("generic");
      expect(learningCombined).toContain("resource_fields");
      expect(learningCombined).not.toContain("document_permissions");
      expect(learningCombined).not.toContain("admin_users");
      expect(learningCombined).not.toContain("/api/auth/register");

      const petResult = await callTool("spec_compile", {
        raw_idea: "我想做一个宠物疫苗驱虫提醒小工具，自己用，不登录，本地保存猫的疫苗、驱虫、体检记录和到期提醒。",
        answers: {
          pet_fields: "宠物名称、品种、生日、备注",
          health_record_fields: "类型、日期、下次到期时间、备注",
          reminder_rule: "按到期时间排序，区分已过期、即将到期和未到期",
          storage_rule: "localStorage 本地保存",
          non_goals: "不登录、不做后台、不做团队协作",
          target_platform: "纯 HTML/CSS/JS",
        },
      });
      const petSpec = petResult.structuredContent.spec;
      const petCombined = `${petSpec.productGoal}\n${petSpec.coreFeatures.join("\n")}\n${petSpec.dataModel}\n${petSpec.apiDesign}\n${JSON.stringify(petSpec.inputConsumption ?? {})}`;

      expect(petResult.structuredContent.readiness.status).toBe("Draft Ready");
      expect(petSpec.inputConsumption.matchedDomain).toBe("generic");
      expect(petCombined).toContain("pet_fields");
      expect(petCombined).toContain("health_record_fields");
      expect(petCombined).not.toContain("个人轻量 CRM");
      expect(petCombined).not.toContain("customers");
      expect(petCombined).not.toContain("followups");
    });

    it("keeps reading list and plant care tools in generic fallback", async () => {
      const readingResult = await callTool("spec_compile", {
        raw_idea: "我想做一个读书清单网页，记录我读过/想读的书、评分、摘录、读书状态，可以按标签和状态筛选。个人使用，不需要登录，数据存在浏览器里。",
        answers: {
          book_fields: "书名、作者、封面链接、阅读状态、评分、标签、开始日期、完成日期、备注",
          quote_fields: "书籍ID、摘录内容、页码、感想、创建时间",
          status_rule: "want_to_read、reading、finished、paused",
          filter_rule: "按状态、标签、评分筛选",
          search_rule: "按书名、作者、摘录内容搜索",
          storage_rule: "localStorage 保存，支持导出和导入 JSON",
          non_goals: "不登录、不做知识库权限、不做团队协作、不做后台",
          target_platform: "web 静态页",
        },
      });
      const readingSpec = readingResult.structuredContent.spec;
      const readingCombined = `${readingSpec.coreFeatures.join("\n")}\n${readingSpec.dataModel}\n${readingSpec.apiDesign}\n${JSON.stringify(readingSpec.inputConsumption ?? {})}`;

      expect(readingSpec.inputConsumption.matchedDomain).toBe("generic");
      expect(readingCombined).toContain("book_fields");
      expect(readingCombined).toContain("quote_fields");
      expect(readingCombined).not.toContain("document_permissions");
      expect(readingCombined).not.toContain("admin_users");
      expect(readingCombined).not.toContain("/api/auth/register");

      const plantResult = await callTool("spec_compile", {
        raw_idea: "我想做一个植物养护提醒页面，记录每盆植物的名称、位置、浇水周期、施肥周期、上次浇水时间，然后告诉我今天该照顾哪些植物。个人用，不登录，本地保存。",
        answers: {
          plant_fields: "植物名称、位置、照片、浇水周期、施肥周期、备注",
          care_record_fields: "植物ID、照顾类型、日期、备注",
          reminder_rule: "根据周期和上次记录计算今天待办",
          filter_rule: "按位置、是否今天待办筛选",
          storage_rule: "localStorage 本地保存",
          non_goals: "不登录、不做团队任务、不做工单、不做后台",
          target_platform: "纯 HTML/CSS/JS",
        },
      });
      const plantSpec = plantResult.structuredContent.spec;
      const plantCombined = `${plantSpec.coreFeatures.join("\n")}\n${plantSpec.dataModel}\n${plantSpec.apiDesign}\n${JSON.stringify(plantSpec.inputConsumption ?? {})}`;

      expect(plantSpec.inputConsumption.matchedDomain).toBe("generic");
      expect(plantCombined).toContain("plant_fields");
      expect(plantCombined).toContain("care_record_fields");
      expect(plantCombined).not.toContain("tickets");
      expect(plantCombined).not.toContain("assignee");
      expect(plantCombined).not.toContain("status_history");
    });

    it("keeps personal local tool architecture frontend-only", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "宠物疫苗驱虫提醒小工具，自己用，不登录，本地保存",
        platform: "web",
        features: ["宠物档案", "疫苗记录", "驱虫记录", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("generic");
      expect(decision.canBeFrontendOnly).toBe(true);
      expect(decision.needBackend).toBe(false);
      expect(decision.needAuth).toBe(false);
      expect(decision.needAdmin).toBe(false);
      expect(decision.needSeparation).toBe(false);
      expect(output).not.toContain("PostgreSQL");
      expect(output).not.toContain("JWT");
      expect(output).not.toContain("Redis");
    });

    it("keeps household medicine architecture frontend-only", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "家庭药箱管理工具，家里自己用，不登录，本地保存",
        platform: "web",
        features: ["药品名称", "用途", "库存", "有效期", "服用说明", "到期提醒", "库存不足提醒", "localStorage 或单个 JSON 文件", "不需要登录"],
        commercial_intent: false,
        expected_users: "small_team",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("generic");
      expect(decision.canBeFrontendOnly).toBe(true);
      expect(decision.needBackend).toBe(false);
      expect(decision.needAuth).toBe(false);
      expect(decision.needAdmin).toBe(false);
      expect(decision.needSeparation).toBe(false);
      expect(output).not.toContain("PostgreSQL");
      expect(output).not.toContain("RBAC");
    });

    it("keeps browser-local management tools frontend-only", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "冰箱食材管理工具，数据存在浏览器里，不需要账号",
        platform: "web",
        features: ["食材名称", "数量", "保质期", "所在位置", "快过期筛选", "菜谱灵感"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("generic");
      expect(decision.canBeFrontendOnly).toBe(true);
      expect(decision.needBackend).toBe(false);
      expect(decision.needAuth).toBe(false);
      expect(decision.needAdmin).toBe(false);
      expect(decision.needSeparation).toBe(false);
      expect(output).not.toContain("PostgreSQL");
      expect(output).not.toContain("RBAC");
    });

    it("keeps personal subscription architecture frontend-only instead of payment backend", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "个人订阅续费提醒小工具，自己用，纯前端本地保存，不登录",
        platform: "web",
        features: ["订阅名称", "价格", "续费周期", "下次续费日期", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const decision = result.structuredContent.decision;
      const output = text(result);

      expect(decision.domain).toBe("generic");
      expect(decision.canBeFrontendOnly).toBe(true);
      expect(decision.needBackend).toBe(false);
      expect(decision.needAuth).toBe(false);
      expect(decision.needAdmin).toBe(false);
      expect(decision.paymentRisk).toBe(false);
      expect(output).not.toContain("PostgreSQL");
      expect(output).not.toContain("支付回调");
      expect(output).not.toContain("订单系统");

      const gift = await callTool("architecture_decide", {
        product_type: "生日礼物灵感和预算工具，自己用，不登录，不接支付，不做订单",
        platform: "web",
        features: ["送礼对象", "预算", "礼物想法", "购买状态", "链接", "备注", "localStorage 本地保存", "不需要后台"],
        commercial_intent: false,
        expected_users: "individual",
      });
      const giftDecision = gift.structuredContent.decision;
      const giftOutput = text(gift);

      expect(giftDecision.domain).toBe("generic");
      expect(giftDecision.canBeFrontendOnly).toBe(true);
      expect(giftDecision.needBackend).toBe(false);
      expect(giftDecision.needAuth).toBe(false);
      expect(giftDecision.needAdmin).toBe(false);
      expect(giftDecision.paymentRisk).toBe(false);
      expect(giftOutput).not.toContain("支付回调");
      expect(giftOutput).not.toContain("PostgreSQL");
    });

    it("keeps generic local acceptance free of commerce, admin and pet pollution", async () => {
      const subscription = await callTool("acceptance_generate", {
        product_type: "个人订阅续费提醒小工具，自己用，纯前端本地保存，不登录",
        features: ["订阅名称", "价格", "续费周期", "下次续费日期", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const subscriptionItems = subscription.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(subscriptionItems).toContain("订阅项能保存名称、周期、价格、下次续费日期和备注");
      expect(subscriptionItems).toContain("本地记录不会触发支付、订单或后台权限流程");
      expect(subscriptionItems).not.toContain("资料包");
      expect(subscriptionItems).not.toContain("订单金额");
      expect(subscriptionItems).not.toContain("管理员可以");

      const repair = await callTool("acceptance_generate", {
        product_type: "家庭维修保修记录小工具，自己用，不登录，本地保存",
        features: ["家电名称", "维修日期", "费用", "保修到期", "状态", "备注", "搜索筛选", "不需要后台"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const repairItems = repair.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(repairItems).toContain("维修或保修记录能保存物品名称、日期、费用、状态和备注");
      expect(repairItems).not.toContain("疫苗");
      expect(repairItems).not.toContain("驱虫");
      expect(repairItems).not.toContain("管理员可以");

      const insurance = await callTool("acceptance_generate", {
        product_type: "家庭保险保单提醒 HTML，小白自己用，不登录，本地保存",
        features: ["保险名称", "保费", "缴费周期", "到期日", "客服电话", "备注", "到期提醒", "不接支付", "不做后台"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const insuranceItems = insurance.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(insuranceItems).toContain("保单记录能保存保险名称、保费、缴费周期、到期日、客服电话和备注");
      expect(insuranceItems).not.toContain("维修或保修记录");
      expect(insuranceItems).not.toContain("资料包");

      const game = await callTool("acceptance_generate", {
        product_type: "游戏收藏与进度记录工具，自己用，不登录，本地保存",
        features: ["游戏名", "平台", "游玩状态", "评分", "成就进度", "标签筛选", "备注"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const gameItems = game.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(gameItems).toContain("游戏条目能保存游戏名、平台、游玩状态、评分、成就进度、标签和备注");
      expect(gameItems).not.toContain("电影条目");
      expect(gameItems).not.toContain("管理员可以");
    });

    it("keeps personal local assist questions out of registration defaults", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个家庭保险保单提醒 HTML，小白自己用，不登录，本地保存。记录保险名称、保费、缴费周期、到期日、客服电话、备注，到期前提醒我，不接支付、不做后台。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const combined = `${text(result)}\n${JSON.stringify(result.structuredContent)}`;
      const ids = result.structuredContent.quickQuestions.map((q: any) => q.id);

      expect(ids).toContain("login_need");
      expect(ids).toContain("data_storage");
      expect(ids).not.toContain("dedup_strategy");
      expect(combined).not.toContain("手机号去重");
      expect(combined).not.toContain("导出 Excel");
      expect(combined).not.toContain("报名数据怎么保存");
    });

    it("keeps browser-stored checklist assist questions local-first", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个露营装备清单 HTML，记录帐篷、炉具、餐具、药品、补货状态和备注，数据存在浏览器里。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const combined = `${text(result)}\n${JSON.stringify(result.structuredContent)}`;
      const ids = result.structuredContent.quickQuestions.map((q: any) => q.id);
      const dataStorage = result.structuredContent.quickQuestions.find((q: any) => q.id === "data_storage");

      expect(ids).toContain("login_need");
      expect(ids).toContain("data_storage");
      expect(dataStorage.defaultValue).toBe("local_file");
      expect(ids).not.toContain("dedup_strategy");
      expect(combined).not.toContain("手机号去重");
      expect(combined).not.toContain("导出 Excel");
      expect(combined).not.toContain("报名数据怎么保存");
      expect(combined).not.toContain("管理员登录才能访问");
    });

    it("keeps bare household medicine requests local-first and contextual", async () => {
      const message = "用户想做一个家庭药品管理工具，功能需求是：记录家里有哪些药、快过期提醒、页面高级一点。";
      const assist = await callTool("product_spec_assist", {
        message,
        preferred_platform: "web",
        strictness: "normal",
      });
      const assistCombined = `${text(assist)}\n${JSON.stringify(assist.structuredContent)}`;
      const ids = assist.structuredContent.quickQuestions.map((q: any) => q.id);

      expect(assist.structuredContent.routedIntent.scenario).toBe("build_product");
      expect(assist.structuredContent.selectedTool).toBe("spec_compile");
      expect(assist.structuredContent.nextAction.type).toBe("confirm_spec");
      expect(assist.structuredContent.nextAction.suggestedTool).toBe("spec_compile");
      expect(assist.structuredContent.nextAction.message).toContain("MVP 草案");
      expect(assist.structuredContent.result.mode).toBe("draft");
      expect(assist.structuredContent.result.spec.inputConsumption.matchedDomain).toBe("generic");
      expect(assist.structuredContent.result.spec.apiDesign).toContain("无需 API");
      expect(assist.structuredContent.technicalProfile.shape).toBe("local_storage_tool");
      expect(ids).toContain("data_storage");
      expect(assist.structuredContent.agentGuidance.join("\n")).toContain("不要把 quickQuestions 原样抛给用户");
      expect(assist.structuredContent.agentGuidance.join("\n")).toContain("页面高级感只影响 UI");
      expect(assistCombined).toContain("MVP 产品规格草案");
      expect(assistCombined).toContain("药品名");
      expect(assistCombined).toContain("到期/过期提醒");
      expect(assistCombined).toContain("小白默认路径");
      expect(assistCombined).toContain("高级页面可以仍然使用 localStorage");
      expect(assistCombined).not.toContain("手机号去重");
      expect(assistCombined).not.toContain("管理员登录才能访问");

      const compile = await callTool("spec_compile", {
        raw_idea: message,
        answers: {},
      });
      const spec = compile.structuredContent.spec;
      const specCombined = `${spec.coreFeatures.join("\n")}\n${spec.apiDesign}\n${spec.architecture}\n${JSON.stringify(spec.technicalProfile)}`;

      expect(spec.inputConsumption.matchedDomain).toBe("generic");
      expect(spec.technicalProfile.shape).toBe("local_storage_tool");
      expect(specCombined).toContain("药品记录管理");
      expect(specCombined).toContain("无需 API");
      expect(specCombined).not.toContain("PostgreSQL");

      const acceptance = await callTool("acceptance_generate", {
        product_type: "家庭药品管理工具",
        features: ["记录家里有哪些药", "快过期提醒", "页面高级一点"],
        platform: "web",
        has_backend: false,
        has_payment: false,
        has_auth: false,
      });
      const items = acceptance.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(acceptance.structuredContent.technicalProfile.shape).toBe("local_storage_tool");
      expect(items).toContain("药品记录能保存药品名、数量/库存、有效期/到期日、分类、存放位置、备注");
      expect(items).toContain("页面视觉风格一致");
      expect(items).not.toContain("管理员可以");
    });

    it("routes roommate task scheduling through the multi-user PM gate", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做个多人使用的任务清单，我和我的室友的日程会在每一天具体的展示出来，哪些在同一个时间，哪些在不同时间，可以相互安排任务，对方需要认领，自己给自己安排的任务直接可用。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const combined = `${text(result)}\n${JSON.stringify(result.structuredContent)}`;
      const ids = result.structuredContent.quickQuestions.map((q: any) => q.id);

      expect(result.structuredContent.selectedTool).toBe("spec_interrogate");
      expect(result.structuredContent.pmIntentDecision.needType).toBe("multi_user_collaboration");
      expect(result.structuredContent.pmIntentDecision.technicalShape).toBe("light_backend_json_sqlite");
      expect(result.structuredContent.pmIntentDecision.maintenanceMode).toBe("runtime_collaboration");
      expect(ids).toContain("access_topology");
      expect(ids).toContain("claim_rule");
      expect(ids).toContain("time_conflict_rule");
      expect(combined).toContain("多人协作工具");
      expect(combined).toContain("局域网");
      expect(combined).not.toContain("联系方式怎么呈现");
      expect(combined).not.toContain("静态展示网站");
    });

    it("routes gym GEO content sites through content marketing without default CMS", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我打算做个我健身房的网站，配合 GEO 服务，我会传很多我的 Q&A 上去，还有健身房的照片，用户的反馈，近期的促销活动，我的教练的信息等等上去，我会不定期的去维护上面的内容",
        preferred_platform: "web",
        strictness: "normal",
      });
      const combined = `${text(result)}\n${JSON.stringify(result.structuredContent)}`;
      const ids = result.structuredContent.quickQuestions.map((q: any) => q.id);

      expect(result.structuredContent.pmIntentDecision.needType).toBe("content_marketing_site");
      expect(result.structuredContent.pmIntentDecision.usageScope).toBe("public_audience");
      expect(result.structuredContent.pmIntentDecision.maintenanceMode).toBe("agent_assisted");
      expect(result.structuredContent.pmIntentDecision.technicalShape).toBe("static_json_data_page");
      expect(ids).toContain("maintenance_mode");
      expect(ids).toContain("geo_goal");
      expect(ids).toContain("visitor_submission");
      expect(combined).toContain("内容经常改不等于必须做后台");
      expect(combined).not.toContain("管理员登录才能访问");
    });

    it("routes xlsx chart sites through data visualization without default backend", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做个图表网站，每次我提供新的 xlsx 的文件，这个网站就根据新的数据渲染出结果",
        preferred_platform: "web",
        strictness: "normal",
      });
      const combined = `${text(result)}\n${JSON.stringify(result.structuredContent)}`;
      const ids = result.structuredContent.quickQuestions.map((q: any) => q.id);

      expect(result.structuredContent.pmIntentDecision.needType).toBe("data_visualization_site");
      expect(result.structuredContent.pmIntentDecision.maintenanceMode).toBe("agent_assisted");
      expect(result.structuredContent.pmIntentDecision.technicalShape).toBe("static_json_data_page");
      expect(result.structuredContent.pmIntentDecision.mustNotUse).toContain("admin_backend_by_default");
      expect(ids).toContain("data_update_mode");
      expect(ids).toContain("audience_scope");
      expect(ids).toContain("history_versions");
      expect(combined).toContain("新的 xlsx 是交给 Agent 更新网站");
      expect(combined).not.toContain("管理后台");
    });

    it("does not generate Chinese API paths and preserves settlement rules for AA calculators", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "我想做一个 AA 分账计算器，添加人员、消费项目、付款人和参与人，自动算出谁转给谁多少钱。纯前端本地用。",
        answers: {
          participant_fields: "姓名、是否参与",
          expense_fields: "项目名称、金额、付款人、参与人",
          settlement_rule: "按参与人均摊，最后合并成最少转账次数",
          storage_rule: "localStorage 本地保存",
          non_goals: "不登录、不接支付、不做后台",
          target_platform: "纯 HTML/CSS/JS",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(spec.inputConsumption.matchedDomain).toBe("generic");
      expect(combined).toContain("settlement_rule");
      expect(combined).not.toMatch(/\/api\/[\u4e00-\u9fff]/);
      expect(spec.apiDesign).toContain("无需 API");
    });

    it("warns in assist and consumes structured answers in generic compile drafts", async () => {
      const assistResult = await callTool("product_spec_assist", {
        message: "我想做一个设备资产管理系统，记录设备台账、借用归还、维修记录、责任人、状态变更，管理员可以筛选设备和处理维修。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const assistOutput = text(assistResult);

      expect(assistResult.structuredContent.routedIntent.scenario).toBe("build_product");
      expect(assistOutput).toContain("未命中稳定 domain pack");
      expect(assistOutput).not.toContain("报名数据怎么保存");

      const compileResult = await callTool("spec_compile", {
        raw_idea: "设备资产管理系统，记录设备台账、借用归还、维修记录、责任人和状态变更。",
        answers: {
          device_fields: "设备名称、编号、分类、状态、责任人、购买日期",
          borrow_flow: "员工借用设备，归还后状态恢复可用",
          repair_flow: "设备故障后登记维修记录，维修完成后关闭",
          status_rule: "available、borrowed、repairing、retired",
          admin_features: "管理员可以筛选设备和处理维修",
          data_persistence: "本地 SQLite 或 JSON",
        },
      });
      const spec = compileResult.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

      expect(spec.inputConsumption.matchedDomain).toBe("generic");
      expect(combined).toContain("device_fields");
      expect(combined).toContain("borrow_flow");
      expect(combined).toContain("repair_flow");
      expect(combined).toContain("status_rule");
      expect(combined).toContain("未命中稳定 domain pack");
      expect(combined).not.toContain("registrations");
      expect(combined).not.toContain("generation_jobs");
      expect(combined).not.toContain("customer_assignments");
      expect(combined).not.toContain("/api/登录");
    });

    it("exposes registration input consumption in structured output", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "活动报名系统，用户提交姓名电话和报名信息，管理员后台查看并导出 Excel。",
        answers: {
          data_persistence: "本地文件存储即可，SQLite 也可以",
          user_login: "用户不需要登录，填表直接提交",
          admin_features: "看列表 + 筛选 + 导出",
          workflow: "提交即完成，不需要审核",
          primary_platform: "手机端为主",
          dedup_strategy: "手机号去重",
          admin_access: "管理员登录才能访问",
          third_party: "都不需要",
          form_fields: "姓名、手机号、报名人数、备注",
          export_format: "Excel",
          backend_need: true,
        },
      });
      const spec = result.structuredContent.spec;

      expect(spec.inputConsumption.matchedDomain).toBe("registration");
      expect(result.structuredContent.inputConsumption).toEqual(spec.inputConsumption);
      expect(spec.inputConsumption.consumedAnswers).toContain("form_fields");
    });
  });

  describe("AI copywriting SaaS and debug", () => {
    it("routes AI SaaS ideas with dedicated quick questions", async () => {
      const result = await callTool("product_spec_assist", {
        message: "我想做一个 AI 文案生成工具，用户输入产品介绍，系统帮他生成小红书文案。以后我想收费，可以按次数卖套餐。",
        preferred_platform: "web",
        strictness: "normal",
      });
      const structured = result.structuredContent;
      const ids = structured.quickQuestions.map((q: any) => q.id);

      expect(structured.routedIntent.scenario).toBe("build_product");
      expect(structured.selectedTool).toBe("spec_interrogate");
      expect(ids).toContain("llm_provider");
      expect(ids).toContain("payment_and_quota");
      expect(ids).toContain("content_safety");
      expect(text(result)).not.toContain("手机号去重");
    });

    it("compiles AI SaaS answers with backend, quota and model-risk boundaries", async () => {
      const result = await callTool("spec_compile", {
        raw_idea: "AI小红书文案生成工具（Web端）：用户输入产品信息，系统调用AI大模型一次生成3条小红书风格文案。支持按次数收费的套餐模式。",
        answers: {
          generation_input_schema: "用户需要填写4个字段：产品名称、产品介绍、目标人群、核心卖点",
          generation_output_spec: "一次生成3条不同风格的小红书文案，每条包含标题、正文、推荐标签",
          llm_provider: "后端做可替换模型接口，MVP默认接DeepSeek API",
          account_and_auth: "首次访问免登录可试用1次生成，之后必须登录",
          payment_and_quota: "MVP阶段按次套餐收费，后台人工发放次数",
          history_and_storage: "登录用户保存最近100条生成历史，同时记录每次扣次日志",
          content_safety: "内置小红书基础敏感词库，命中时标记风险提示",
          admin_metrics: "管理员后台包含用户列表、充值记录、生成日志、基础统计",
        },
      });
      const spec = result.structuredContent.spec;
      const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}`;

      expect(spec.productGoal).toContain("AI");
      expect(spec.architecture).toContain("后端 API");
      expect(combined).toContain("credit_accounts");
      expect(combined).toContain("generation_jobs");
      expect(combined).toContain("POST /api/generations");
      expect(combined).toContain("AI API Key 不能暴露");
    });

    it("preserves AI SaaS context after default confirmation", async () => {
      const result = await callTool("product_spec_assist", {
        message: "用户已确认全部使用默认值，请基于以下确认信息生成完整产品规格文档：一次生成3条，每条包含标题、正文、标签；先做可替换模型接口；免登录试用1次，购买前必须登录；MVP先按次套餐，后台人工发放次数。",
        preferred_platform: "web",
        known_context: {
          generation_input_schema: "产品名称+产品介绍+目标人群+卖点",
          generation_output_spec: "一次生成3条，包含标题、正文、标签",
          llm_provider: "可替换模型接口",
          account_and_auth: "免登录试用1次，购买前必须登录",
          payment_and_quota: "MVP先按次套餐，后台人工发放次数",
          history_and_storage: "保存最近生成历史和扣次记录",
          content_safety: "内置基础敏感词和营销风险提示",
          admin_metrics: "MVP看用户+订单+剩余次数",
        },
      });

      expect(text(result)).toContain("AI 模型或 API");
      expect(text(result)).not.toContain("报名数据怎么保存");
      expect(text(result)).not.toContain("手机号去重");
    });

    it("flags AI and payment architecture risks", async () => {
      const result = await callTool("architecture_decide", {
        product_type: "AI 文案生成 SaaS",
        platform: "web",
        features: ["AI", "GPT", "用户登录", "套餐购买", "按次数扣减", "支付", "历史记录"],
        commercial_intent: true,
        expected_users: "small_team",
      });
      const decision = result.structuredContent.decision;

      expect(decision.needBackend).toBe(true);
      expect(decision.needAuth).toBe(true);
      expect(decision.paymentRisk).toBe(true);
      expect(decision.aiKeyRisk).toBe(true);
      expect(text(result)).toContain("支付金额");
      expect(text(result)).toContain("后端计算");
    });

    it("asks for evidence when AI generation fails", async () => {
      const result = await callTool("debug_guide", {
        platform: "web",
        error_description: "AI 文案生成工具点击生成后一直 loading，最后提示失败。",
        current_info: {
          browser: "Chrome",
          user_action: "点击生成按钮",
        },
      });
      const output = text(result);
      const structured = result.structuredContent;

      expect(output).toContain("Console");
      expect(output).toContain("Network");
      expect(output).toContain("request_id");
      expect(output).toContain("后端日志");
      expect(output).toContain("AI API Key");
      expect(structured.missingRequiredInfo).toContain("console_error");
      expect(structured.missingRequiredInfo).toContain("network_error");
    });

    it("generates AI SaaS acceptance checks", async () => {
      const result = await callTool("acceptance_generate", {
        product_type: "AI 文案生成 SaaS",
        features: ["AI", "登录", "支付", "套餐", "历史记录"],
        platform: "web",
        has_backend: true,
        has_payment: true,
        has_auth: true,
      });
      const items = result.structuredContent.checklist.map((item: any) => item.text).join("\n");

      expect(items).toContain("AI API Key 不能暴露在前端");
      expect(items).toContain("支付金额必须后端计算");
      expect(items).toContain("生成历史可查看");
      expect(items).toContain("request_id");
    });
  });
});
