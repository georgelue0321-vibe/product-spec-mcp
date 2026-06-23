import { describe, it, expect } from "vitest";
import { decideArchitecture } from "../src/core/architectureEngine.js";
import { formatArchitectureResult } from "../src/core/markdownFormatter.js";

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

  it("should keep personal local tools frontend-only", () => {
    const result = decideArchitecture(
      "宠物疫苗驱虫提醒小工具，自己用，不登录，本地保存",
      "web",
      ["宠物档案", "疫苗记录", "驱虫记录", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
      false,
      "individual"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).toContain("纯 HTML/CSS/JS");
    expect(result.mvpSuggestion).not.toContain("JWT");
    expect(result.mvpSuggestion).not.toContain("Redis");
  });

  it("should keep household medicine tools frontend-only even when product says management", () => {
    const result = decideArchitecture(
      "家庭药箱管理工具，家里自己用，不登录，本地保存",
      "web",
      ["药品名称", "用途", "库存", "有效期", "服用说明", "到期提醒", "库存不足提醒", "localStorage 或单个 JSON 文件", "不需要登录"],
      false,
      "small_team"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).not.toContain("RBAC");
  });

  it("should not let management wording override browser-local beginner tools", () => {
    const result = decideArchitecture(
      "冰箱食材管理工具，数据存在浏览器里，不需要账号",
      "web",
      ["食材名称", "数量", "保质期", "所在位置", "快过期筛选", "菜谱灵感"],
      false,
      "individual"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).toContain("纯 HTML/CSS/JS");
    expect(result.mvpSuggestion).not.toContain("RBAC");
  });

  it("should keep travel guide map pages frontend-only with static JSON", () => {
    const result = decideArchitecture(
      "旅行攻略 HTML",
      "web",
      ["data.json", "地图点位", "美食酒店景点列表", "按分类筛选", "不登录", "不需要后台"],
      false,
      "individual"
    );

    expect(result.technicalProfile?.shape).toBe("static_json_data_page");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).toContain("纯 HTML/CSS/JS");
  });

  it("should not let management wording alone trigger backend for local tools", () => {
    const result = decideArchitecture(
      "冰箱食材管理工具",
      "web",
      ["食材名称", "数量", "保质期", "分类筛选", "数据存在浏览器里"],
      false,
      "individual"
    );

    expect(result.technicalProfile?.shape).toBe("local_storage_tool");
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
  });

  it("should not treat personal subscription reminders as payment systems", () => {
    const result = decideArchitecture(
      "个人订阅续费提醒小工具，自己用，纯前端本地保存，不登录",
      "web",
      ["订阅名称", "价格", "续费周期", "下次续费日期", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
      false,
      "individual"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.paymentRisk).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).not.toContain("支付回调");
  });

  it("should keep personal password hint tools out of backend admin mode", () => {
    const result = decideArchitecture(
      "个人密码提示卡小工具，自己用，不保存真实密码，纯前端本地保存",
      "web",
      ["账号名称", "分类", "提示信息", "搜索", "复制提示", "不需要登录", "不需要后台"],
      false,
      "individual"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.mvpSuggestion).not.toContain("后台");
  });

  it("should not treat gift budget purchase status as payment backend", () => {
    const result = decideArchitecture(
      "生日礼物灵感和预算工具，自己用，不登录，不接支付，不做订单",
      "web",
      ["送礼对象", "预算", "礼物想法", "购买状态", "链接", "备注", "localStorage 本地保存", "不需要后台"],
      false,
      "individual"
    );

    expect(result.domain).toBe("generic");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.paymentRisk).toBe(false);
    expect(result.recommendedDatabase).not.toBe("PostgreSQL");
    expect(result.mvpSuggestion).not.toContain("支付回调");
  });

  it("should force backend for payment features", () => {
    const result = decideArchitecture("电商", "web", ["支付", "订单"], false, "individual");
    expect(result.needBackend).toBe(true);
    expect(result.paymentRisk).toBe(true);
    expect(result.mvpSuggestion).toContain("后端");
  });

  it("should mention backend-calculated amount in payment risk markdown", () => {
    const result = decideArchitecture("AI 文案生成 SaaS", "web", ["支付", "套餐购买", "按次数扣减"], true, "small_team");
    const markdown = formatArchitectureResult(result);

    expect(markdown).toContain("支付金额");
    expect(markdown).toContain("后端计算");
  });

  it("should warn about AI key exposure", () => {
    const result = decideArchitecture("AI工具", "web", ["AI", "GPT"], false, "individual");
    expect(result.aiKeyRisk).toBe(true);
    expect(result.mvpSuggestion).toContain("后端");
    expect(result.mvpSuggestion).toContain("Key");
  });

  it("should keep individual registration MVP lightweight", () => {
    const result = decideArchitecture(
      "活动报名系统",
      "web",
      ["用户报名表单", "提交报名数据保存到数据库", "管理员登录", "后台报名列表", "按手机号搜索", "导出 Excel"],
      false,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
    expect(result.needAdmin).toBe(true);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).toBe("SQLite");
    expect(result.mvpSuggestion).toContain("Session");
    expect(result.mvpSuggestion).not.toContain("RBAC");
    expect(markdown).toContain("手机号");
    expect(markdown).toContain("导出接口必须鉴权");
  });

  it("should keep individual digital commerce MVP lightweight but backend-safe", () => {
    const result = decideArchitecture(
      "数字资料售卖网站",
      "web",
      ["资料包浏览", "下单购买", "mock 支付", "支付成功后下载", "管理员后台", "订单管理", "下载记录"],
      true,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
    expect(result.needAdmin).toBe(true);
    expect(result.paymentRisk).toBe(true);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).toMatch(/SQLite|JSON/);
    expect(result.mvpSuggestion).toContain("Mock Payment");
    expect(result.mvpSuggestion).toContain("Session");
    expect(markdown).toContain("支付金额");
    expect(markdown).toContain("后端计算");
  });

  it("should keep individual appointment MVP lightweight and warn about capacity checks", () => {
    const result = decideArchitecture(
      "预约服务系统",
      "web",
      ["服务项目", "时间段设置", "预约提交", "容量限制", "取消预约", "后台管理"],
      false,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
    expect(result.needAdmin).toBe(true);
    expect(result.paymentRisk).toBe(false);
    expect(result.aiKeyRisk).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).toMatch(/SQLite|JSON/);
    expect(result.mvpSuggestion).toContain("Session");
    expect(markdown).toContain("容量");
    expect(markdown).toContain("后端");
    expect(markdown).not.toContain("手机号");
    expect(markdown).not.toContain("导出接口");
  });

  it("should route roommate collaboration to lightweight backend without default domain ops", () => {
    const result = decideArchitecture(
      "多人室友任务清单",
      "web",
      ["每天日程展示", "相互安排任务", "对方需要认领", "自己给自己安排直接可用"],
      false,
      "small_team"
    );

    expect(result.pmIntentDecision?.needType).toBe("multi_user_collaboration");
    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
    expect(result.needAdmin).toBe(false);
    expect(result.recommendedDatabase).toContain("SQLite");
    expect(result.mvpSuggestion).toContain("低价公网 VPS");
    expect(result.productionSuggestion).toContain("域名");
  });

  it("should keep agent-assisted gym content sites frontend-only by default", () => {
    const result = decideArchitecture(
      "健身房 GEO 网站",
      "web",
      ["Q&A", "照片", "用户反馈", "促销活动", "教练信息", "不定期维护内容"],
      false,
      "individual"
    );

    expect(result.pmIntentDecision?.needType).toBe("content_marketing_site");
    expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.recommendedDatabase).toContain("无需服务器数据库");
    expect(result.mvpSuggestion).toContain("Agent 更新内容");
  });

  it("should keep agent-assisted xlsx chart sites static by default", () => {
    const result = decideArchitecture(
      "图表网站",
      "web",
      ["每次提供新的 xlsx 文件", "根据新的数据渲染结果"],
      false,
      "individual"
    );

    expect(result.pmIntentDecision?.needType).toBe("data_visualization_site");
    expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(result.canBeFrontendOnly).toBe(true);
    expect(result.needBackend).toBe(false);
    expect(result.mvpSuggestion).toContain("Agent 解析 xlsx");
  });

  it("should keep individual content community MVP lightweight and moderation-aware", () => {
    const result = decideArchitecture(
      "内容社区投稿审核系统",
      "web",
      ["用户注册登录", "发布文章", "文章审核", "评论", "举报评论", "隐藏评论", "下架文章", "管理员后台"],
      false,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.domain).toBe("content_community");
    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(true);
    expect(result.needAdmin).toBe(true);
    expect(result.paymentRisk).toBe(false);
    expect(result.aiKeyRisk).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).toMatch(/SQLite|JSON/);
    expect(result.mvpSuggestion).toContain("Session");
    expect(result.mvpSuggestion).not.toContain("RBAC");
    expect(markdown).toContain("文章审核");
    expect(markdown).toContain("操作追踪");
    expect(markdown).not.toContain("手机号");
    expect(markdown).not.toContain("导出接口");
  });

  it("should not let negated AI or payment text break content community architecture", () => {
    const result = decideArchitecture(
      "内容社区投稿审核系统，MVP 先不做支付，也不接 AI",
      "web",
      ["用户注册登录", "发布文章", "文章审核", "评论", "举报评论", "隐藏评论", "下架文章", "管理员后台", "MVP 不接支付", "MVP 不接 AI"],
      false,
      "individual"
    );

    expect(result.domain).toBe("content_community");
    expect(result.paymentRisk).toBe(false);
    expect(result.aiKeyRisk).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.recommendedDatabase).toMatch(/SQLite|JSON/);
    expect(result.mvpSuggestion).not.toContain("RBAC");
  });

  it("should keep CRM MVP from requiring a full logging or audit module", () => {
    const result = decideArchitecture(
      "轻量 CRM 客户跟进系统，MVP 先不做 AI，不接支付，不需要复杂企业权限",
      "web",
      ["销售登录", "客户录入", "联系人管理", "跟进记录", "负责人分配", "管理员后台"],
      false,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.domain).toBe("crm");
    expect(result.needLogging).toBe(false);
    expect(markdown).toContain("| 需要日志模块 | ❌ 否 |");
    expect(markdown).toContain("负责人分配");
    expect(markdown).not.toContain("审计模块");
    expect(markdown).not.toContain("审计日志");
  });

  it("should downgrade explicit single-user CRM to no auth or admin", () => {
    const result = decideArchitecture(
      "个人轻量 CRM，就我一个人用，没有团队，不需要多角色权限，不需要销售账号",
      "web",
      ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要管理员", "不需要登录"],
      false,
      "individual"
    );
    const markdown = formatArchitectureResult(result);

    expect(result.domain).toBe("crm");
    expect(result.needBackend).toBe(true);
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.needSeparation).toBe(false);
    expect(result.needLogging).toBe(false);
    expect(result.recommendedDatabase).toMatch(/SQLite|JSON/);
    expect(result.mvpSuggestion).toContain("个人单用户");
    expect(result.productionSuggestion).not.toContain("PostgreSQL");
    expect(markdown).toContain("不需要销售账号");
    expect(markdown).not.toContain("管理员鉴权");
    expect(markdown).not.toContain("负责人分配");
    expect(markdown).not.toContain("RBAC");
  });

  it("should downgrade individual CRM when only no-role signals are provided", () => {
    const result = decideArchitecture(
      "轻量 CRM 客户跟进系统",
      "web",
      ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要多角色权限", "不需要销售账号", "不需要管理员"],
      false,
      "individual"
    );

    expect(result.domain).toBe("crm");
    expect(result.needAuth).toBe(false);
    expect(result.needAdmin).toBe(false);
    expect(result.mvpSuggestion).toContain("个人单用户");
    expect(result.mvpSuggestion).not.toContain("customer_assignments");
  });

  it("should keep covered small-team domains from falling back to generic architecture", () => {
    const registration = decideArchitecture(
      "活动报名系统",
      "web",
      ["报名表单", "报名列表", "导出 Excel", "管理员后台"],
      false,
      "small_team"
    );
    const crm = decideArchitecture(
      "轻量 CRM 客户跟进系统",
      "web",
      ["销售登录", "客户录入", "联系人管理", "跟进记录", "负责人分配", "管理员后台"],
      false,
      "small_team"
    );

    expect(registration.domain).toBe("registration");
    expect(registration.needSeparation).toBe(false);
    expect(registration.recommendedDatabase).toBe("SQLite");
    expect(crm.domain).toBe("crm");
    expect(crm.needSeparation).toBe(false);
    expect(crm.recommendedDatabase).toMatch(/SQLite|JSON/);
  });
});
