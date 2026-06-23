import { classifyProductDomain, hasNegatedAi } from "./domainClassifier.js";

export interface ReadinessResult {
  score: number;
  status: "Not Ready" | "Draft Ready" | "Build Ready";
  fields: Record<string, { weight: number; present: boolean; value?: string }>;
}

const FIELD_WEIGHTS: Record<string, number> = {
  product_goal: 10,
  target_user: 10,
  platform: 10,
  core_features: 10,
  data_persistence: 10,
  user_roles: 5,
  workflow: 10,
  backend_need: 5,
  external_integrations: 5,
  success_criteria: 5,
  non_goals: 5,
  form_fields: 5,
  primary_platform: 5,
  export_format: 3,
  dedup_strategy: 3,
  admin_access: 4,
  ticket_fields: 5,
  status_flow: 8,
  assignment_flow: 7,
  ticket_comment_flow: 5,
  document_fields: 5,
  folder_structure: 5,
  document_status: 8,
  permission_rule: 8,
  search_scope: 5,
  version_history: 3,
  customer_fields: 5,
  contact_fields: 5,
  followup_fields: 7,
  stage_rule: 7,
  assignment_rule: 7,
  reminder_rule: 4,
};

const FIELD_KEYWORDS: Record<string, string[]> = {
  product_goal: ["做", "开发", "创建", "实现", "搭建", "系统", "平台", "工具", "应用"],
  target_user: ["用户", "客户", "玩家", "学生", "家长", "老师", "管理员", "企业", "个人"],
  platform: ["web", "网页", "小程序", "app", "移动端", "后台", "前端", "后端"],
  core_features: ["功能", "特性", "模块", "页面", "表单", "提交", "查看", "管理", "支付", "登录"],
  data_persistence: ["保存", "记录", "存储", "数据库", "历史", "持久化"],
  user_roles: ["登录", "注册", "权限", "管理员", "角色", "用户中心", "多角色"],
  workflow: ["流程", "步骤", "先", "然后", "最后", "审核", "审批", "提交"],
  backend_need: ["后台", "服务端", "API", "接口", "服务器", "后端"],
  external_integrations: ["支付", "短信", "微信", "支付宝", "AI", "第三方", "API调用"],
  success_criteria: ["验收", "完成", "成功", "标准", "测试"],
  non_goals: ["不做", "不包含", "排除", "不需要", "暂不"],
  form_fields: ["字段", "姓名", "电话", "邮箱", "地址", "采集", "表单", "报名"],
  primary_platform: ["手机", "移动端", "H5", "扫码", "微信", "桌面", "电脑"],
  export_format: ["导出", "Excel", "下载", "表格", "xlsx", "CSV", "PDF"],
  dedup_strategy: ["重复", "去重", "防刷", "唯一", "防重复"],
  admin_access: ["后台", "管理员", "访问", "权限", "登录"],
  ticket_fields: ["工单", "标题", "描述", "优先级", "截止时间"],
  status_flow: ["状态", "流转", "open", "assigned", "in_progress", "resolved", "closed", "reopened"],
  assignment_flow: ["分配", "指派", "处理人", "assignee"],
  ticket_comment_flow: ["回复", "留言", "处理进展", "评论"],
  document_fields: ["文档", "标题", "正文", "作者", "可见范围"],
  folder_structure: ["目录", "文件夹", "树形", "层级"],
  document_status: ["草稿", "已发布", "draft", "published", "发布", "撤回"],
  permission_rule: ["权限", "可见范围", "成员", "管理员", "role"],
  search_scope: ["搜索", "检索", "全文"],
  version_history: ["版本", "历史", "更新时间"],
  customer_fields: ["客户", "客户名称", "来源", "负责人", "下次跟进"],
  contact_fields: ["联系人", "电话", "微信", "职位"],
  followup_fields: ["跟进", "跟进记录", "跟进内容", "跟进方式"],
  stage_rule: ["阶段", "new", "contacted", "interested", "proposal", "won", "lost"],
  assignment_rule: ["分配", "负责人", "销售", "owner"],
  reminder_rule: ["下次跟进", "提醒", "即将跟进"],
};

export function calculateReadiness(
  rawIdea: string,
  knownContext?: Record<string, any>
): ReadinessResult {
  let score = 0;
  const fields: Record<string, { weight: number; present: boolean; value?: string }> = {};
  const matchedKeywords = new Set<string>();
  const effectiveContext = enrichAppointmentContext(
    rawIdea,
    enrichDigitalCommerceContext(
      rawIdea,
      enrichAiCopywritingContext(
        rawIdea,
        enrichContentCommunityContext(rawIdea, enrichTicketWorkflowContext(rawIdea, enrichKnowledgeBaseContext(rawIdea, enrichCrmContext(rawIdea, knownContext))))
      )
    )
  );

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const keywords = FIELD_KEYWORDS[field] || [];
    const hasContext = effectiveContext && effectiveContext[field] !== undefined;
    const keywordMatch = keywords.some(kw => {
      if (matchedKeywords.has(kw)) return false;
      if (rawIdea.includes(kw)) {
        matchedKeywords.add(kw);
        return true;
      }
      return false;
    });
    const present = keywordMatch || hasContext;

    if (present) {
      score += weight;
    }

    fields[field] = {
      weight,
      present: present ?? false,
      value: effectiveContext?.[field]?.toString(),
    };
  }

  let status: ReadinessResult["status"];
  if (score < 60) {
    status = "Not Ready";
  } else if (score < 80) {
    status = "Draft Ready";
  } else {
    status = "Build Ready";
  }

  const clampedScore = Math.min(score, 100);
  if (clampedScore !== score) {
    if (score >= 80) status = "Build Ready";
  }

  return { score: clampedScore, status, fields };
}

function enrichKnowledgeBaseContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && classifyProductDomain(rawIdea, {}).domain !== "knowledge_base") return knownContext;
  const context = knownContext || {};
  if (classifyProductDomain(rawIdea, context).domain !== "knowledge_base") return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "团队知识库文档管理系统",
    target_user: context.target_user ?? "团队成员和管理员",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "成员登录",
        "文档创建和编辑",
        "目录管理",
        "草稿和发布状态",
        "文档权限",
        "搜索文档",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "成员创建 draft 文档 -> 管理员发布 -> 有权限成员搜索和查看",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? false,
    success_criteria: context.success_criteria ?? "draft 不公开、published 按权限可见、搜索不泄露无权限文档",
    primary_platform: context.primary_platform ?? "桌面优先的响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后管理成员、目录和文档权限",
  };
}

function enrichCrmContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && classifyProductDomain(rawIdea, {}).domain !== "crm") return knownContext;
  const context = knownContext || {};
  if (classifyProductDomain(rawIdea, context).domain !== "crm") return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "轻量 CRM 客户跟进系统",
    target_user: context.target_user ?? "销售人员和管理员",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "客户录入",
        "联系人管理",
        "跟进记录",
        "客户阶段",
        "负责人分配",
        "下次跟进筛选",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "销售创建客户 -> 记录跟进 -> 更新阶段和下次跟进时间 -> 管理员分配和筛选",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? false,
    success_criteria: context.success_criteria ?? "销售只能看自己客户、管理员可分配、跟进记录和阶段筛选可验证",
    primary_platform: context.primary_platform ?? "桌面优先的响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后查看全部客户并分配销售",
  };
}

function enrichTicketWorkflowContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && classifyProductDomain(rawIdea, {}).domain !== "ticket_workflow") return knownContext;
  const context = knownContext || {};
  if (classifyProductDomain(rawIdea, context).domain !== "ticket_workflow") return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "工单任务协作系统",
    target_user: context.target_user ?? "提交工单的用户、管理员和处理人",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "用户提交工单",
        "管理员分配处理人",
        "处理人更新状态",
        "工单评论",
        "状态筛选",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "用户提交工单 -> 管理员分派 -> 处理人处理 -> 用户确认关闭或重开",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? false,
    success_criteria: context.success_criteria ?? "权限隔离、状态流转、分派记录和评论记录可验证",
    primary_platform: context.primary_platform ?? "响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后访问工单后台",
  };
}

function enrichAiCopywritingContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext || !isAiCopywritingContext(rawIdea, knownContext)) return knownContext;

  return {
    ...knownContext,
    product_goal: knownContext.product_goal ?? "AI 小红书文案生成工具",
    target_user: knownContext.target_user ?? "小红书博主、电商卖家、品牌运营",
    platform: knownContext.platform ?? knownContext.target_platform ?? "web",
    core_features:
      knownContext.core_features ??
      [
        "产品信息输入",
        "AI 文案生成",
        "标题/正文/标签生成",
        "次数套餐扣减",
        "生成历史",
        "管理后台",
      ],
    data_persistence: knownContext.data_persistence ?? true,
    user_roles: knownContext.user_roles ?? true,
    workflow: knownContext.workflow ?? "用户输入产品信息 -> AI 生成文案 -> 扣减次数 -> 保存历史",
    backend_need: knownContext.backend_need ?? true,
    external_integrations: knownContext.external_integrations ?? true,
    success_criteria: knownContext.success_criteria ?? "生成结果可复制、扣次准确、历史可查、API Key 不外露",
    primary_platform: knownContext.primary_platform ?? "移动端优先的响应式 Web",
    admin_access: knownContext.admin_access ?? "管理员登录后访问",
  };
}

function enrichContentCommunityContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && !isContentCommunityContext(rawIdea, {})) return knownContext;
  const context = knownContext || {};
  if (!isContentCommunityContext(rawIdea, context)) return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "内容社区投稿审核系统",
    target_user: context.target_user ?? "内容发布用户、评论用户和管理员",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "用户注册登录",
        "文章发布",
        "文章审核",
        "评论",
        "举报评论",
        "管理员后台",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "用户提交文章 -> 管理员审核 -> 公开展示；用户评论和举报 -> 管理员处理",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? false,
    success_criteria: context.success_criteria ?? "pending 不公开、approved 公开、隐藏评论不展示、举报可处理",
    primary_platform: context.primary_platform ?? "响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后访问审核后台",
  };
}

function enrichDigitalCommerceContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && !isDigitalCommerceContext(rawIdea, {})) return knownContext;
  const context = knownContext || {};
  if (!isDigitalCommerceContext(rawIdea, context)) return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "数字资料售卖网站",
    target_user: context.target_user ?? "资料购买用户和管理员",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "资料包浏览",
        "订单创建",
        "支付确认",
        "下载权限",
        "管理后台",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "用户浏览资料包 -> 下单支付 -> 支付成功后下载文件",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? true,
    success_criteria: context.success_criteria ?? "金额后端计算、支付后端确认、未支付不能下载、后台可管理资料和订单",
    primary_platform: context.primary_platform ?? "响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后访问",
  };
}

function enrichAppointmentContext(
  rawIdea: string,
  knownContext?: Record<string, any>
): Record<string, any> | undefined {
  if (!knownContext && !isAppointmentContext(rawIdea, {})) return knownContext;
  const context = knownContext || {};
  if (!isAppointmentContext(rawIdea, context)) return knownContext;

  return {
    ...context,
    product_goal: context.product_goal ?? "预约服务系统",
    target_user: context.target_user ?? "预约用户和管理员",
    platform: context.platform ?? context.target_platform ?? "web",
    core_features:
      context.core_features ??
      [
        "服务项目",
        "可预约时间段",
        "预约提交",
        "容量限制",
        "取消预约",
        "后台排班",
      ],
    data_persistence: context.data_persistence ?? true,
    user_roles: context.user_roles ?? true,
    workflow: context.workflow ?? "用户选择服务项目和时间段 -> 提交预约 -> 后台查看和管理",
    backend_need: context.backend_need ?? true,
    external_integrations: context.external_integrations ?? false,
    success_criteria: context.success_criteria ?? "满员不能预约、取消释放容量、后台可管理时间段和预约状态",
    primary_platform: context.primary_platform ?? "移动端优先的响应式 Web",
    admin_access: context.admin_access ?? "管理员登录后访问",
  };
}

function isAiCopywritingContext(rawIdea: string, knownContext: Record<string, any>): boolean {
  const text = `${rawIdea} ${JSON.stringify(knownContext)}`.toLowerCase();
  if (classifyProductDomain(rawIdea, knownContext).domain === "content_community") return false;
  const aiAnswerKeys = [
    "generation_input_schema",
    "generation_output_spec",
    "llm_provider",
    "account_and_auth",
    "payment_and_quota",
    "history_and_storage",
    "content_safety",
    "admin_metrics",
  ];
  const hasAiCore = /ai|llm|gpt|大模型|模型接口|api key|deepseek|openai/.test(text) && !hasNegatedAi(text);
  const hasCopywriting = /文案|小红书|营销内容|生成标题|生成正文|推荐标签/.test(text);

  return (
    aiAnswerKeys.some((key) => knownContext[key] !== undefined) ||
    (hasAiCore && hasCopywriting)
  );
}

function isContentCommunityContext(rawIdea: string, knownContext: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, knownContext).domain === "content_community";
}

function isDigitalCommerceContext(rawIdea: string, knownContext: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, knownContext).domain === "digital_commerce";
}

function isAppointmentContext(rawIdea: string, knownContext: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, knownContext).domain === "appointment";
}
