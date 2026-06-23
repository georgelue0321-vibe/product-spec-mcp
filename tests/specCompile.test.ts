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
    expect(spec.apiDesign).toContain("无需 API");
    expect(spec.apiDesign).not.toContain("POST /api");
    expect(spec.coreFeatures).toContain("个人介绍、作品图片、联系方式、响应式布局");
  });

  it("should compile actionable specs from AI copywriting SaaS answers", () => {
    const rawIdea = "AI小红书文案生成工具（Web端）：用户输入产品信息（产品名称、产品介绍、目标人群、卖点），系统调用AI大模型一次生成3条小红书风格文案，每条包含标题、正文、标签。支持按次数收费的套餐模式。";
    const answers = {
      generation_input_schema: "用户需要填写4个字段：产品名称、产品介绍、目标人群、核心卖点",
      generation_output_spec: "一次生成3条不同风格的小红书文案，每条包含标题、正文、推荐标签",
      llm_provider: "后端做可替换模型接口，MVP默认接DeepSeek API",
      account_and_auth: "首次访问免登录可试用1次生成，之后必须登录",
      payment_and_quota: "MVP阶段按次套餐收费，后台人工发放次数",
      history_and_storage: "登录用户保存最近100条生成历史，同时记录每次扣次日志",
      content_safety: "内置小红书基础敏感词库，命中时标记风险提示",
      admin_metrics: "管理员后台包含用户列表、充值记录、生成日志、基础统计",
      tech_stack: "前端React+TailwindCSS，后端Node.js+Express，数据库PostgreSQL",
      target_platform: "Web端，移动端优先的响应式设计",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);

    expect(readiness.score).toBeGreaterThanOrEqual(60);
    expect(spec.isActionable).toBe(true);
    expect(spec.productGoal).toContain("AI");
    expect(spec.targetUser).toContain("小红书");
    expect(spec.architecture).not.toBe("纯前端架构");
    expect(spec.architecture).toContain("后端 API");
    expect(spec.coreFeatures.join("\n")).toContain("AI 生成结果");
    expect(spec.dataModel).toContain("credit_accounts");
    expect(spec.dataModel).toContain("generation_jobs");
    expect(spec.apiDesign).toContain("POST /api/generations");
    expect(spec.apiDesign).toContain("POST /api/admin/credits/grant");
    expect(spec.riskBoundaries.join("\n")).toContain("AI API Key 不能暴露");
    expect(spec.coreFeatures).not.toContain("待用户补充具体功能");
  });

  it("should not render boolean user_roles as true in domain specs", () => {
    const cases = [
      {
        rawIdea: "工单协作系统，用户提交工单，管理员分配处理人，处理人更新状态。",
        answers: {
          user_roles: true,
          ticket_fields: "标题、描述、提交人、处理人、优先级、状态",
          status_flow: "open -> assigned -> in_progress -> resolved -> closed",
          assignment_flow: "管理员分配处理人",
        },
      },
      {
        rawIdea: "团队知识库系统，成员创建文档，管理员发布和设置权限。",
        answers: {
          user_roles: true,
          document_fields: "标题、正文、目录、作者、状态",
          folder_structure: "一级目录",
          permission_rule: "成员只能查看有权限文档",
        },
      },
      {
        rawIdea: "轻量 CRM 系统，销售录入客户和联系人，记录跟进，管理员分配客户。",
        answers: {
          user_roles: true,
          customer_fields: "名称、来源、阶段、负责人",
          contact_fields: "姓名、电话、微信",
          followup_fields: "内容、方式、时间、下次跟进时间",
        },
      },
    ];

    for (const item of cases) {
      const readiness = calculateReadiness(item.rawIdea, item.answers);
      const spec = buildSpec(item.rawIdea, item.answers, readiness);
      const coreFeatures = spec.coreFeatures.join("\n");

      expect(coreFeatures).toContain("用户角色：");
      expect(coreFeatures).not.toContain("用户角色：true");
      expect(coreFeatures).not.toContain("用户角色：false");
    }
  });

  it("should downgrade personal single-user CRM instead of generating sales/admin roles", () => {
    const rawIdea = "我想做一个个人轻量 CRM，就我一个人用，没有团队，不需要多角色权限，也不需要销售账号。记录客户、联系人、跟进内容、客户阶段和下次跟进时间。";
    const answers = {
      user_roles: "就我一个人用，不需要多角色权限，不需要销售账号",
      customer_fields: "客户包含名称、来源、阶段、备注、下次跟进时间",
      contact_fields: "联系人包含姓名、电话、微信、职位、备注",
      followup_fields: "跟进记录包含内容、跟进方式、跟进时间、下次跟进时间",
      stage_rule: "客户阶段包含 new、contacted、interested、proposal、won、lost",
      assignment_rule: "不需要分配，所有客户都是我自己维护",
      reminder_rule: "按下次跟进时间筛选",
      has_auth: false,
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.targetUser}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.riskBoundaries.join("\n")}\n${spec.successCriteria.join("\n")}`;

    expect(spec.productGoal).toContain("个人");
    expect(spec.targetUser).toContain("个人");
    expect(combined).toContain("个人单用户");
    expect(combined).toContain("customers");
    expect(combined).toContain("contacts");
    expect(combined).toContain("followups");
    expect(combined).toContain("GET /api/customers");
    expect(combined).not.toContain("admin_users");
    expect(combined).not.toContain("customer_assignments");
    expect(combined).not.toContain("销售注册");
    expect(combined).not.toContain("/api/admin/customers");
  });

  it("should consume structured answers in generic fallback drafts", () => {
    const rawIdea = "我想做一个设备资产管理系统，记录设备台账、借用归还、维修记录、责任人和状态变更。";
    const answers = {
      device_fields: "设备名称、编号、分类、状态、责任人、购买日期",
      borrow_flow: "员工借用设备，归还后状态恢复可用",
      repair_flow: "设备故障后登记维修记录，维修完成后关闭",
      status_rule: "available、borrowed、repairing、retired",
      admin_features: "管理员可以筛选设备和处理维修",
      data_persistence: "本地 SQLite 或 JSON",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.riskBoundaries.join("\n")}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("device_fields");
    expect(combined).toContain("borrow_flow");
    expect(combined).toContain("repair_flow");
    expect(combined).toContain("status_rule");
    expect(combined).toContain("未命中稳定 domain pack");
    expect(combined).not.toContain("registrations");
    expect(combined).not.toContain("generation_jobs");
  });

  it("should keep personal learning navigation as generic instead of knowledge base", () => {
    const rawIdea = "我想做一个个人学习资源导航 HTML，不登录、不做权限管理，保存课程、文章和工具链接，支持分类、搜索和收藏。";
    const answers = {
      resource_fields: "标题、链接、类型、标签、备注、收藏状态",
      filter_rule: "按课程、文章、工具和标签筛选",
      search_rule: "按标题和备注搜索",
      storage_rule: "localStorage 本地保存",
      non_goals: "不登录、不做多人协作、不做权限管理、不做后台",
      target_platform: "纯 HTML/CSS/JS",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.readinessStatus).toBe("Draft Ready");
    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("resource_fields");
    expect(combined).not.toContain("document_permissions");
    expect(combined).not.toContain("admin_users");
    expect(combined).not.toContain("/api/auth/register");
  });

  it("should keep personal reading lists as generic instead of knowledge base", () => {
    const rawIdea = "我想做一个读书清单网页，记录我读过/想读的书、评分、摘录、读书状态，可以按标签和状态筛选。个人使用，不需要登录，数据存在浏览器里。";
    const answers = {
      book_fields: "书名、作者、封面链接、阅读状态、评分、标签、开始日期、完成日期、备注",
      quote_fields: "书籍ID、摘录内容、页码、感想、创建时间",
      status_rule: "want_to_read、reading、finished、paused",
      filter_rule: "按状态、标签、评分筛选",
      search_rule: "按书名、作者、摘录内容搜索",
      storage_rule: "localStorage 保存，支持导出和导入 JSON",
      non_goals: "不登录、不做知识库权限、不做团队协作、不做后台",
      target_platform: "web 静态页",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.readinessStatus).toBe("Draft Ready");
    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("book_fields");
    expect(combined).toContain("quote_fields");
    expect(combined).not.toContain("document_permissions");
    expect(combined).not.toContain("admin_users");
    expect(combined).not.toContain("publish");
  });

  it("should keep pet reminders as generic instead of CRM", () => {
    const rawIdea = "我想做一个宠物疫苗驱虫提醒小工具，自己用，不登录，本地保存猫的疫苗、驱虫、体检记录和到期提醒。";
    const answers = {
      pet_fields: "宠物名称、品种、生日、备注",
      health_record_fields: "类型、日期、下次到期时间、备注",
      reminder_rule: "按到期时间排序，区分已过期、即将到期和未到期",
      storage_rule: "localStorage 本地保存",
      non_goals: "不登录、不做后台、不做团队协作",
      target_platform: "纯 HTML/CSS/JS",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.readinessStatus).toBe("Draft Ready");
    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("pet_fields");
    expect(combined).toContain("health_record_fields");
    expect(combined).not.toContain("个人轻量 CRM");
    expect(combined).not.toContain("customers");
    expect(combined).not.toContain("followups");
  });

  it("should not generate Chinese API paths for generic bill splitting tools", () => {
    const rawIdea = "我想做一个 AA 分账计算器，添加人员、消费项目、付款人和参与人，自动算出谁转给谁多少钱。纯前端本地用。";
    const answers = {
      participant_fields: "姓名、是否参与",
      expense_fields: "项目名称、金额、付款人、参与人",
      settlement_rule: "按参与人均摊，最后合并成最少转账次数",
      storage_rule: "localStorage 本地保存",
      non_goals: "不登录、不接支付、不做后台",
      target_platform: "纯 HTML/CSS/JS",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("settlement_rule");
    expect(combined).not.toMatch(/\/api\/[\u4e00-\u9fff]/);
    expect(spec.apiDesign).toContain("无需 API");
  });

  it("should keep plant care reminders as generic instead of ticket workflow", () => {
    const rawIdea = "我想做一个植物养护提醒页面，记录每盆植物的名称、位置、浇水周期、施肥周期、上次浇水时间，然后告诉我今天该照顾哪些植物。个人用，不登录，本地保存。";
    const answers = {
      plant_fields: "植物名称、位置、照片、浇水周期、施肥周期、备注",
      care_record_fields: "植物ID、照顾类型、日期、备注",
      reminder_rule: "根据周期和上次记录计算今天待办",
      filter_rule: "按位置、是否今天待办筛选",
      storage_rule: "localStorage 本地保存",
      non_goals: "不登录、不做团队任务、不做工单、不做后台",
      target_platform: "纯 HTML/CSS/JS",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.productGoal}\n${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${JSON.stringify(spec.inputConsumption ?? {})}`;

    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(combined).toContain("plant_fields");
    expect(combined).toContain("care_record_fields");
    expect(combined).not.toContain("tickets");
    expect(combined).not.toContain("assignee");
    expect(combined).not.toContain("status_history");
  });

  it("should include knowledge-base version table only when version history is requested", () => {
    const rawIdea = "团队知识库文档管理系统，成员创建文档，管理员发布和设置权限，支持搜索文档。";
    const baseAnswers = {
      user_roles: "成员创建和编辑文档，管理员管理成员和发布状态",
      document_fields: "标题、正文、目录、作者、状态、可见范围",
      folder_structure: "一级目录",
      document_status: "draft 和 published",
      permission_rule: "简单角色 + 文档可见范围",
      search_scope: "只搜索有权限的 published 文档",
    };
    const withVersions = {
      ...baseAnswers,
      version_history: "需要保存完整版本历史，后续可能支持回滚",
    };
    const withoutVersions = {
      ...baseAnswers,
      version_history: "MVP 先保存更新时间，不做完整版本历史",
    };

    const readinessWith = calculateReadiness(rawIdea, withVersions);
    const specWith = buildSpec(rawIdea, withVersions, readinessWith);
    const readinessWithout = calculateReadiness(rawIdea, withoutVersions);
    const specWithout = buildSpec(rawIdea, withoutVersions, readinessWithout);

    expect(specWith.dataModel).toContain("document_versions");
    expect(specWith.nonGoals.join("\n")).not.toContain("不做完整版本历史");
    expect(specWithout.dataModel).not.toContain("document_versions");
    expect(specWithout.nonGoals.join("\n")).toContain("不做完整版本历史");
  });

  it("should treat registration string answers as backend requirements", () => {
    const rawIdea = "活动报名系统，用户提交姓名电话和报名信息，管理员后台查看并导出 Excel。";
    const answers = {
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
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);

    expect(spec.architecture).not.toContain("纯前端");
    expect(spec.dataModel).not.toContain("无需数据库");
    expect(spec.apiDesign).not.toBe("纯前端项目，无需 API");
    expect(spec.coreFeatures.join("\n")).toContain("姓名");
    expect(spec.coreFeatures.join("\n")).toContain("手机号去重");
    expect(spec.coreFeatures.join("\n")).toContain("导出 Excel");
    expect(spec.dataModel).toContain("registrations");
    expect(spec.dataModel).toContain("phone TEXT NOT NULL UNIQUE");
    expect(spec.apiDesign).toContain("POST /api/registrations");
    expect(spec.apiDesign).toContain("GET /api/admin/registrations");
    expect(spec.apiDesign).toContain("GET /api/admin/registrations/export");
    expect(spec.apiDesign).not.toContain("/api/登录");
    expect(spec.successCriteria.join("\n")).toContain("同一手机号重复报名会被拦截");
    expect(spec.inputConsumption?.matchedDomain).toBe("registration");
    expect(spec.inputConsumption?.consumedAnswers).toContain("form_fields");
  });

  it("should keep generic frontend data model free of PostgreSQL placeholders", () => {
    const rawIdea = "我想做一个露营装备清单 HTML，记录帐篷、炉具、餐具、药品、补货状态和备注，数据存在浏览器里。";
    const answers = {
      item_fields: "装备名称、分类、数量、补货状态、备注",
      storage_rule: "数据存在浏览器里",
      target_platform: "HTML",
      non_goals: "不登录、不做后台、不接支付",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);

    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(spec.dataModel).toContain("localStorage");
    expect(spec.dataModel).not.toContain("PostgreSQL");
    expect(spec.apiDesign).toContain("无需 API");
  });

  it("should extract local record, reminder and visual signals without a domain pack", () => {
    const rawIdea = "用户想做一个家庭药品管理工具，功能需求是：记录家里有哪些药、快过期提醒、页面高级一点。";
    const readiness = calculateReadiness(rawIdea, {});
    const spec = buildSpec(rawIdea, {}, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.architecture}\n${spec.successCriteria.join("\n")}\n${JSON.stringify(spec.technicalProfile ?? {})}`;

    expect(spec.inputConsumption?.matchedDomain).toBe("generic");
    expect(spec.readinessStatus).toBe("Draft Ready");
    expect(spec.targetUser).toBe("家庭自用用户");
    expect(spec.technicalProfile?.shape).toBe("local_storage_tool");
    expect(spec.technicalProfile?.frontendOnly).toBe(true);
    expect(spec.coreFeatures).toContain("药品记录管理");
    expect(spec.coreFeatures).toContain("新增/编辑/删除");
    expect(spec.coreFeatures).toContain("搜索/筛选/分类");
    expect(spec.coreFeatures).not.toContain("管理");
    expect(spec.coreFeatures).toContain("到期/过期提醒");
    expect(spec.coreFeatures).toContain("高级界面与响应式布局");
    expect(spec.dataModel).toContain("字段建议：药品名、数量/库存、有效期/到期日、分类、存放位置、备注");
    expect(spec.dataModel).toContain("\"quantity\":1");
    expect(spec.dataModel).toContain("\"expireDate\":\"2026-12-31\"");
    expect(combined).toContain("localStorage");
    expect(combined).toContain("无需 API");
    expect(combined).toContain("刷新页面后，已保存记录仍能从 localStorage 恢复");
    expect(combined).toContain("提醒列表能按日期排序");
    expect(combined).not.toContain("核心功能可用");
    expect(combined).not.toContain("无明显 Bug");
    expect(combined).not.toContain("PostgreSQL");
    expect(combined).not.toContain("RBAC");
  });

  it("should compile travel guide map pages as static data without REST APIs", () => {
    const rawIdea = "旅行攻略 HTML，用 data.json 加载美食、酒店、景点，并在地图上展示点位。";
    const answers = {
      data_items: "美食、酒店、景点",
      item_fields: "名称、地址、类型、标签、评分、图片、备注、经纬度",
      map_provider: "Leaflet/OpenStreetMap",
      storage_rule: "手写 data.json，纯前端读取",
      non_goals: "不登录、不做后台、不接支付",
      target_platform: "纯 HTML/CSS/JS",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = `${spec.dataModel}\n${spec.apiDesign}\n${spec.architecture}\n${JSON.stringify(spec.technicalProfile ?? {})}`;

    expect(spec.technicalProfile?.shape).toBe("static_json_data_page");
    expect(spec.technicalProfile?.frontendOnly).toBe(true);
    expect(combined).toContain("data.json");
    expect(combined).toContain("fetch('./data.json')");
    expect(combined).toContain("无需 API");
    expect(combined).not.toContain("POST /api");
    expect(combined).not.toContain("admin_users");
    expect(combined).not.toContain("PostgreSQL");
  });

  it("should compile roommate task collaboration through PM gate", () => {
    const rawIdea = "我想做个多人使用的任务清单，我和我的室友的日程会在每一天具体的展示出来，哪些在同一个时间，哪些在不同时间，可以相互安排任务，对方需要认领，自己给自己安排的任务直接可用。";
    const readiness = calculateReadiness(rawIdea, {});
    const spec = buildSpec(rawIdea, {}, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.apiDesign}\n${spec.successCriteria.join("\n")}`;

    expect(spec.pmIntentDecision?.needType).toBe("multi_user_collaboration");
    expect(spec.pmIntentDecision?.technicalShape).toBe("light_backend_json_sqlite");
    expect(combined).toContain("待认领");
    expect(combined).toContain("POST /api/tasks/:id/claim");
    expect(combined).toContain("同一时间任务");
    expect(combined).not.toContain("联系方式怎么呈现");
  });

  it("should compile gym GEO content sites as agent-assisted static content", () => {
    const rawIdea = "我打算做个我健身房的网站，配合 GEO 服务，我会传很多我的 Q&A 上去，还有健身房的照片，用户的反馈，近期的促销活动，我的教练的信息等等上去，我会不定期的去维护上面的内容";
    const readiness = calculateReadiness(rawIdea, {});
    const spec = buildSpec(rawIdea, {}, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.architecture}\n${spec.riskBoundaries.join("\n")}\n${spec.nonGoals.join("\n")}`;

    expect(spec.pmIntentDecision?.needType).toBe("content_marketing_site");
    expect(spec.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(combined).toContain("Agent 更新内容文件并重新部署");
    expect(combined).toContain("FAQ");
    expect(combined).toContain("促销");
    expect(combined).toContain("暂不默认做 CMS 后台");
    expect(combined).not.toContain("admin_users");
  });

  it("should compile xlsx chart sites as agent-assisted static visualization", () => {
    const rawIdea = "我想做个图表网站，每次我提供新的 xlsx 的文件，这个网站就根据新的数据渲染出结果";
    const readiness = calculateReadiness(rawIdea, {});
    const spec = buildSpec(rawIdea, {}, readiness);
    const combined = `${spec.coreFeatures.join("\n")}\n${spec.dataModel}\n${spec.architecture}\n${spec.successCriteria.join("\n")}`;

    expect(spec.pmIntentDecision?.needType).toBe("data_visualization_site");
    expect(spec.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(combined).toContain("Agent 从 xlsx 解析");
    expect(combined).toContain("静态数据图表站");
    expect(combined).toContain("不默认后台或数据库");
    expect(combined).not.toContain("admin_users");
  });

  it("should not extract negated login or backend as generic features", () => {
    const cases = [
      "我想做一个个人作品展示网站，放我的介绍、作品图片、联系方式，看起来高级一点，手机上也要好看。不需要登录，不需要后台。",
      "我想做一个抽签分组小工具，输入一堆名字，设置分几组，然后随机分组。可以保存上次结果到浏览器里。不需要登录，不需要后台。",
    ];

    for (const rawIdea of cases) {
      const readiness = calculateReadiness(rawIdea, {});
      const spec = buildSpec(rawIdea, {}, readiness);
      const coreFeatures = spec.coreFeatures.join("\n");

      expect(spec.platform).toBe("web");
      expect(coreFeatures).not.toContain("登录");
      expect(spec.apiDesign).not.toContain("POST /api");
    }
  });

  it("should compile digital product store answers without AI template pollution", () => {
    const rawIdea = "数字资料售卖网站：用户可以浏览资料包、下单购买，支付成功后才能下载文件。管理员能上架资料、看订单和下载记录。MVP 先用 mock 支付。";
    const answers = {
      product_catalog: "资料包包含标题、简介、价格、封面、文件路径、上下架状态",
      order_flow: "用户选择资料包 -> 创建待支付订单 -> mock 支付成功 -> 获得下载权限",
      payment_provider: "MVP 使用 mock payment provider，后续替换微信/支付宝",
      payment_confirmation: "支付状态必须由后端确认，不能只看前端跳转",
      price_calculation: "订单金额必须由后端根据商品价格计算",
      download_permission: "只有已登录且已支付该订单的用户可以下载对应文件",
      admin_features: "管理员可以新增/编辑/上下架资料包，查看订单和下载记录",
      data_persistence: "本地文件或 SQLite 即可",
      account_and_auth: "购买和下载前需要用户登录，后台需要管理员登录",
      target_platform: "Web 端，手机和桌面都要可用",
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = [
      spec.productGoal,
      spec.coreFeatures.join("\n"),
      spec.dataModel,
      spec.apiDesign,
      spec.riskBoundaries.join("\n"),
    ].join("\n");

    expect(spec.isActionable).toBe(true);
    expect(spec.productGoal).toContain("数字资料售卖");
    expect(spec.architecture).not.toContain("纯前端");
    expect(spec.dataModel).toContain("products");
    expect(spec.dataModel).toContain("orders");
    expect(spec.dataModel).toContain("payments");
    expect(spec.dataModel).toContain("downloads");
    expect(spec.dataModel).toContain("admin_users");
    expect(spec.apiDesign).toContain("GET /api/products");
    expect(spec.apiDesign).toContain("POST /api/orders");
    expect(spec.apiDesign).toContain("POST /api/orders/:id/pay");
    expect(spec.apiDesign).toContain("GET /api/downloads/:productId");
    expect(spec.apiDesign).toContain("PATCH /api/admin/products/:id");
    expect(combined).toContain("订单金额必须由后端");
    expect(combined).toContain("未支付订单不能下载");
    expect(combined).not.toContain("AI 小红书");
    expect(combined).not.toContain("credit_accounts");
    expect(combined).not.toContain("generation_jobs");
    expect(combined).not.toContain("POST /api/generations");
  });

  it("should compile appointment booking answers without registration fallback", () => {
    const rawIdea = "预约服务系统：用户可以选择服务项目和时间段提交预约，后台可以设置可预约时间段、限制每个时间段的人数，用户可以取消预约。MVP 不接支付。";
    const answers = {
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
    };
    const readiness = calculateReadiness(rawIdea, answers);
    const spec = buildSpec(rawIdea, answers, readiness);
    const combined = [
      spec.productGoal,
      spec.coreFeatures.join("\n"),
      spec.dataModel,
      spec.apiDesign,
      spec.riskBoundaries.join("\n"),
      spec.successCriteria.join("\n"),
      spec.assumptions.join("\n"),
      JSON.stringify(spec.inputConsumption ?? {}),
    ].join("\n");

    expect(spec.isActionable).toBe(true);
    expect(spec.productGoal).toContain("预约服务");
    expect(spec.architecture).not.toContain("纯前端");
    expect(spec.dataModel).toContain("services");
    expect(spec.dataModel).toContain("time_slots");
    expect(spec.dataModel).toContain("bookings");
    expect(spec.dataModel).toContain("admin_users");
    expect(spec.apiDesign).toContain("GET /api/services");
    expect(spec.apiDesign).toContain("GET /api/time-slots");
    expect(spec.apiDesign).toContain("POST /api/bookings");
    expect(spec.apiDesign).toContain("POST /api/bookings/:id/cancel");
    expect(spec.apiDesign).toContain("POST /api/admin/time-slots");
    expect(spec.apiDesign).toContain("PATCH /api/admin/time-slots/:id");
    expect(combined).toContain("每个时间段达到最大人数后不能继续预约");
    expect(combined).toContain("pending、confirmed、cancelled");
    expect(combined).toContain("容量限制必须在后端");
    expect(combined).toContain("service_catalog");
    expect(combined).toContain("capacity_rule");
    expect(combined).not.toContain("registrations");
    expect(combined).not.toContain("phone TEXT NOT NULL UNIQUE");
    expect(combined).not.toContain("GET /api/admin/registrations/export");
    expect(combined).not.toContain("products");
    expect(combined).not.toContain("orders");
    expect(combined).not.toContain("credit_accounts");
    expect(combined).not.toContain("generation_jobs");
  });
});
