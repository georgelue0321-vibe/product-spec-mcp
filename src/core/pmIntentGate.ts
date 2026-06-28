import type { TechnicalShape } from "./technicalProfile.js";

export type NeedType =
  | "static_display"
  | "personal_local_tool"
  | "multi_user_collaboration"
  | "content_marketing_site"
  | "data_visualization_site"
  | "transaction_workflow"
  | "content_knowledge"
  | "ai_automation"
  | "unknown";

export type UsageScope = "self" | "fixed_group" | "public_audience" | "unknown";

export type MaintenanceMode =
  | "agent_assisted"
  | "manual_files"
  | "web_admin"
  | "visitor_submission"
  | "runtime_collaboration"
  | "unknown";

export type AccessTopology =
  | "single_device"
  | "lan_only"
  | "internet_ip"
  | "public_domain"
  | "unknown";

export type RecommendedDeployment =
  | "static_only"
  | "local_browser_only"
  | "static_hosting_with_agent_updates"
  | "local_lan_server_sqlite"
  | "cheap_vps_sqlite_by_ip"
  | "vps_domain_https"
  | "unknown";

export interface PmIntentDecision {
  needType: NeedType;
  usageScope: UsageScope;
  maintenanceMode: MaintenanceMode;
  accessTopology: AccessTopology;
  technicalShape: TechnicalShape;
  recommendedDeployment: RecommendedDeployment;
  route: "spec_compile" | "spec_interrogate" | "architecture_decide";
  confidence: "high" | "medium" | "low";
  strongSignals: string[];
  weakSignals: string[];
  coreObjects: string[];
  states: string[];
  actions: string[];
  mustNotUse: string[];
  boundaryQuestionIds: string[];
  defaultAssumptions: string[];
  source: "local_rule" | "online_llm" | "merged";
}

export function decidePmIntent(rawText: string, context: Record<string, unknown> = {}): PmIntentDecision {
  const text = `${rawText} ${JSON.stringify(context)}`;
  const strongSignals = collectSignals(text, strongSignalMap);
  const weakSignals = collectSignals(text, weakSignalMap);
  const usageScope = decideUsageScope(text);
  const preliminaryNeedType = decideNeedType(text, strongSignals);
  const maintenanceMode = decideMaintenanceMode(text, preliminaryNeedType);
  const accessTopology = decideAccessTopology(text, usageScope, maintenanceMode);
  const needType = preliminaryNeedType;
  const technicalShape = decideTechnicalShape(text, needType, maintenanceMode);
  const recommendedDeployment = decideRecommendedDeployment(needType, technicalShape, maintenanceMode, accessTopology);
  const route = decideRoute(needType, technicalShape, maintenanceMode);
  const confidence = decideConfidence(needType, strongSignals, weakSignals);

  return enforceHardRules({
    needType,
    usageScope,
    maintenanceMode,
    accessTopology,
    technicalShape,
    recommendedDeployment,
    route,
    confidence,
    strongSignals,
    weakSignals,
    coreObjects: extractCoreObjects(text, needType),
    states: extractStates(text, needType),
    actions: extractActions(text, needType),
    mustNotUse: buildMustNotUse(needType, maintenanceMode),
    boundaryQuestionIds: buildBoundaryQuestionIds(needType, maintenanceMode, accessTopology),
    defaultAssumptions: buildDefaultAssumptions(needType, usageScope, maintenanceMode, accessTopology, recommendedDeployment),
    source: "local_rule",
  });
}

function decideNeedType(text: string, strongSignals: string[]): NeedType {
  if (hasAny(text, ["AI", "ai", "LLM", "llm", "GPT", "gpt", "大模型", "模型接口", "API Key", "DeepSeek", "OpenAI"]) && !isNegated(text, ["AI", "模型"])) {
    return "ai_automation";
  }
  if (hasAny(text, ["支付", "订单", "售卖", "购买", "报名", "预约", "收款", "导出 Excel", "导出"])) {
    return "transaction_workflow";
  }
  if (hasAny(text, ["多人", "室友", "家人共用", "共用", "共享", "协作", "相互安排", "认领", "分配任务", "团队待办"])) {
    return "multi_user_collaboration";
  }
  if (hasAny(text, ["xlsx", "XLSX", "Excel", "csv", "CSV", "图表", "数据渲染", "可视化", "仪表盘"]) && hasAny(text, ["文件", "数据", "渲染", "图表", "上传", "提供"])) {
    return "data_visualization_site";
  }
  if (hasAny(text, ["健身房", "餐厅", "咖啡店", "工作室", "门店", "本地服务", "GEO", "geo", "SEO", "seo", "促销", "教练", "Q&A", "FAQ", "照片", "用户反馈"])) {
    return "content_marketing_site";
  }
  if (hasAny(text, ["知识库", "文档管理", "资料库", "团队文档"])) {
    return "content_knowledge";
  }
  if (hasAny(text, ["药品", "食材", "读书", "订阅", "植物", "装备", "清单", "记录", "提醒", "库存", "保质期"]) && !strongSignals.includes("多人")) {
    return "personal_local_tool";
  }
  if (hasAny(text, ["作品集", "个人主页", "官网", "介绍页", "公司介绍", "联系方式"]) && !hasAny(text, ["提交", "上传", "编辑", "维护", "数据", "任务", "认领"])) {
    return "static_display";
  }
  return "unknown";
}

function decideUsageScope(text: string): UsageScope {
  if (hasAny(text, ["公开", "访客", "客户", "用户", "会员", "官网", "网站", "门店", "健身房", "餐厅", "工作室"])) return "public_audience";
  if (hasAny(text, ["多人", "室友", "家人", "家庭", "同事", "团队", "共用", "共享"])) return "fixed_group";
  if (hasAny(text, ["自己", "自用", "个人", "我用", "我自己"])) return "self";
  return "unknown";
}

function decideMaintenanceMode(text: string, needType: NeedType): MaintenanceMode {
  if (hasAny(text, ["访客提交", "用户提交", "在线提交", "提交反馈", "提交评论", "预约体验", "报名"])) return "visitor_submission";
  if (hasAny(text, ["认领", "相互安排", "协作", "分配任务", "多人任务", "共享任务"])) return "runtime_collaboration";
  if (hasAny(text, ["后台", "管理后台", "网页里编辑", "网页上传", "上传按钮", "登录后编辑", "CMS", "cms"])) return "web_admin";
  if (hasAny(text, ["data.json", "markdown", "Markdown", "md 文件", "手动改文件"])) return "manual_files";
  if (hasAny(text, ["Agent", "agent", "每次我提供", "我提供新的", "传很多", "不定期维护", "重新部署"])) return "agent_assisted";
  if (needType === "content_marketing_site" || needType === "data_visualization_site" || needType === "static_display") return "agent_assisted";
  return "unknown";
}

function decideAccessTopology(text: string, usageScope: UsageScope, maintenanceMode: MaintenanceMode): AccessTopology {
  if (hasAny(text, ["同一 Wi-Fi", "同一个 Wi-Fi", "局域网", "内网", "家里网络"])) return "lan_only";
  if (hasAny(text, ["外出", "公网 IP", "公网ip", "IP 地址", "服务器", "VPS", "vps"])) return "internet_ip";
  if (hasAny(text, ["域名", "HTTPS", "https", "备案", "公开网站", "官网"])) return "public_domain";
  if (usageScope === "self" && maintenanceMode !== "runtime_collaboration") return "single_device";
  if (usageScope === "public_audience") return "public_domain";
  return "unknown";
}

function decideTechnicalShape(text: string, needType: NeedType, maintenanceMode: MaintenanceMode): TechnicalShape {
  if (needType === "ai_automation") return "full_backend_saas";
  if (needType === "transaction_workflow") return hasAny(text, ["支付", "订单", "收费"]) ? "full_backend_saas" : "light_backend_json_sqlite";
  if (needType === "multi_user_collaboration") return "light_backend_json_sqlite";
  if (needType === "content_marketing_site") {
    return maintenanceMode === "web_admin" || maintenanceMode === "visitor_submission" ? "light_backend_json_sqlite" : "static_json_data_page";
  }
  if (needType === "data_visualization_site") {
    return maintenanceMode === "web_admin" || maintenanceMode === "visitor_submission" ? "light_backend_json_sqlite" : "static_json_data_page";
  }
  if (needType === "content_knowledge") {
    return maintenanceMode === "agent_assisted" || maintenanceMode === "manual_files" ? "static_json_data_page" : "light_backend_json_sqlite";
  }
  if (needType === "personal_local_tool") return "local_storage_tool";
  if (needType === "static_display") return "static_page";
  return "unknown";
}

function decideRecommendedDeployment(
  needType: NeedType,
  technicalShape: TechnicalShape,
  maintenanceMode: MaintenanceMode,
  accessTopology: AccessTopology
): RecommendedDeployment {
  if (technicalShape === "static_page") return "static_only";
  if (technicalShape === "local_storage_tool" || technicalShape === "local_json_import_export") return "local_browser_only";
  if (maintenanceMode === "agent_assisted" && ["content_marketing_site", "data_visualization_site", "content_knowledge"].includes(needType)) {
    return "static_hosting_with_agent_updates";
  }
  if (accessTopology === "lan_only") return "local_lan_server_sqlite";
  if (accessTopology === "internet_ip") return "cheap_vps_sqlite_by_ip";
  if (accessTopology === "public_domain") return "vps_domain_https";
  if (technicalShape === "light_backend_json_sqlite") return "unknown";
  return "unknown";
}

function decideRoute(needType: NeedType, technicalShape: TechnicalShape, maintenanceMode: MaintenanceMode): PmIntentDecision["route"] {
  if (needType === "personal_local_tool") return "spec_compile";
  if (["static_page", "static_json_data_page"].includes(technicalShape) && maintenanceMode === "agent_assisted") return "spec_compile";
  return "spec_interrogate";
}

function decideConfidence(needType: NeedType, strongSignals: string[], weakSignals: string[]): PmIntentDecision["confidence"] {
  if (needType === "unknown") return "low";
  if (strongSignals.length >= 2) return "high";
  if (strongSignals.length === 1 || weakSignals.length >= 2) return "medium";
  return "medium";
}

function enforceHardRules(decision: PmIntentDecision): PmIntentDecision {
  const hasRuntimeCollaboration =
    decision.needType === "multi_user_collaboration" ||
    decision.maintenanceMode === "runtime_collaboration" ||
    decision.strongSignals.some((signal) => ["多人", "共享", "协作", "认领", "相互安排"].includes(signal));

  if (hasRuntimeCollaboration && decision.technicalShape !== "light_backend_json_sqlite") {
    return {
      ...decision,
      needType: "multi_user_collaboration",
      maintenanceMode: "runtime_collaboration",
      technicalShape: "light_backend_json_sqlite",
      recommendedDeployment: recommendedDeploymentForCollaboration(decision.accessTopology),
      route: "spec_interrogate",
      mustNotUse: Array.from(new Set([...decision.mustNotUse, "static_display", "local_storage_only"])),
    };
  }

  return decision;
}

function recommendedDeploymentForCollaboration(accessTopology: AccessTopology): RecommendedDeployment {
  if (accessTopology === "lan_only") return "local_lan_server_sqlite";
  if (accessTopology === "internet_ip") return "cheap_vps_sqlite_by_ip";
  if (accessTopology === "public_domain") return "vps_domain_https";
  return "unknown";
}

function buildMustNotUse(needType: NeedType, maintenanceMode: MaintenanceMode): string[] {
  const items: string[] = [];
  if (needType === "multi_user_collaboration") items.push("static_display", "local_storage_only");
  if (needType === "content_marketing_site" || needType === "data_visualization_site") items.push("admin_backend_by_default", "database_by_default");
  if (maintenanceMode === "agent_assisted") items.push("web_admin_cms_by_default");
  if (needType === "transaction_workflow") items.push("local_storage_only");
  if (needType === "ai_automation") items.push("frontend_api_key");
  return Array.from(new Set(items));
}

function buildBoundaryQuestionIds(needType: NeedType, maintenanceMode: MaintenanceMode, accessTopology: AccessTopology): string[] {
  if (needType === "multi_user_collaboration") {
    return ["access_topology", "public_ip_acceptance", "claim_rule", "time_conflict_rule"];
  }
  if (needType === "content_marketing_site") {
    return ["maintenance_mode", "geo_goal", "visitor_submission", "image_volume"];
  }
  if (needType === "data_visualization_site") {
    return ["data_update_mode", "audience_scope", "history_versions"];
  }
  if (needType === "content_knowledge") {
    return maintenanceMode === "agent_assisted" ? ["maintenance_mode", "visibility_scope"] : ["editor_roles", "permission_rule", "version_history"];
  }
  if (needType === "unknown") return ["usage_scope", "maintenance_mode", "data_flow"];
  if (accessTopology === "unknown" && needType !== "personal_local_tool") return ["access_topology"];
  return [];
}

function buildDefaultAssumptions(
  needType: NeedType,
  usageScope: UsageScope,
  maintenanceMode: MaintenanceMode,
  accessTopology: AccessTopology,
  deployment: RecommendedDeployment
): string[] {
  const items = [`使用范围：${usageScope}`, `维护方式：${maintenanceMode}`, `访问方式：${accessTopology}`, `推荐部署：${deployment}`];
  if (needType === "content_marketing_site" || needType === "data_visualization_site") {
    items.push("内容或数据经常更新时，MVP 默认优先由 Agent 更新内容文件并重新部署，不默认建设网页后台。");
  }
  if (needType === "multi_user_collaboration") {
    items.push("多人协作先确认局域网是否足够；不直接默认公网服务器、域名或备案。");
  }
  return items;
}

function extractCoreObjects(text: string, needType: NeedType): string[] {
  if (needType === "multi_user_collaboration") return ["用户", "任务", "日程项"];
  if (needType === "content_marketing_site") return ["Q&A", "照片", "用户反馈", "促销活动", "教练信息"].filter((item) => text.includes(item.replace("信息", "")) || item === "Q&A");
  if (needType === "data_visualization_site") return ["xlsx 文件", "数据表", "图表配置", "渲染结果"];
  if (needType === "personal_local_tool") {
    if (text.includes("药")) return ["药品"];
    if (text.includes("食材")) return ["食材"];
    return ["记录"];
  }
  return [];
}

function extractStates(text: string, needType: NeedType): string[] {
  const states: string[] = [];
  if (needType === "multi_user_collaboration") states.push("待认领", "已认领", "已完成", "取消");
  if (hasAny(text, ["过期", "临期", "到期"])) states.push("正常", "临期", "已过期");
  return Array.from(new Set(states));
}

function extractActions(text: string, needType: NeedType): string[] {
  if (needType === "multi_user_collaboration") return ["安排任务", "认领任务", "查看日程冲突"];
  if (needType === "content_marketing_site") return ["更新内容", "发布促销", "维护图片和 FAQ"];
  if (needType === "data_visualization_site") return ["解析 xlsx", "更新图表数据", "渲染结果"];
  return [];
}

const strongSignalMap: Record<string, string[]> = {
  多人: ["多人", "室友", "家人共用", "共用", "共享"],
  协作: ["协作", "相互安排", "认领", "分配任务"],
  权限: ["权限", "登录", "后台", "管理员", "审批", "审核"],
  公开提交: ["访客提交", "用户提交", "在线提交", "提交反馈"],
  交易: ["支付", "订单", "售卖", "购买", "报名", "预约"],
  AI: ["AI", "ai", "API Key", "模型接口", "大模型"],
};

const weakSignalMap: Record<string, string[]> = {
  展示: ["展示", "网站", "页面"],
  视觉: ["页面高级", "好看", "美观"],
  管理: ["管理", "维护", "内容多"],
  列表: ["列表", "查看", "筛选", "日程", "状态"],
};

function collectSignals(text: string, map: Record<string, string[]>): string[] {
  return Object.entries(map)
    .filter(([, signals]) => hasAny(text, signals))
    .map(([label]) => label);
}

function hasAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function isNegated(text: string, signals: string[]): boolean {
  return signals.some((signal) => new RegExp(`(不接|不做|不用|无需|不需要|暂不|先不).{0,8}${signal}`, "i").test(text));
}
