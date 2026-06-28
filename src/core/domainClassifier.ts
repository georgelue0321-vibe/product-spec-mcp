import { isPersonalLocalFrontendToolContext } from "./contextSignals.js";

export type ProductDomain =
  | "registration"
  | "digital_commerce"
  | "appointment"
  | "content_community"
  | "ai_copywriting"
  | "ticket_workflow"
  | "knowledge_base"
  | "crm"
  | "generic";

export interface DomainClassification {
  domain: ProductDomain;
  confidence: "high" | "medium" | "low";
  scores: Record<ProductDomain, number>;
}

const domainAnswerKeys: Record<Exclude<ProductDomain, "generic">, string[]> = {
  registration: ["form_fields", "dedup_strategy", "export_format"],
  digital_commerce: [
    "product_catalog",
    "order_flow",
    "payment_provider",
    "payment_confirmation",
    "price_calculation",
    "download_permission",
  ],
  appointment: ["service_catalog", "time_slot_rule", "booking_flow", "capacity_rule", "booking_status", "cancel_rule"],
  content_community: ["content_model", "publish_flow", "comment_flow", "report_flow", "moderation_status"],
  ai_copywriting: [
    "generation_input_schema",
    "generation_output_spec",
    "llm_provider",
    "account_and_auth",
    "payment_and_quota",
    "history_and_storage",
    "content_safety",
    "admin_metrics",
  ],
  ticket_workflow: [
    "ticket_fields",
    "status_flow",
    "assignment_flow",
    "ticket_comment_flow",
    "sla_rule",
  ],
  knowledge_base: [
    "document_fields",
    "folder_structure",
    "document_status",
    "permission_rule",
    "search_scope",
    "version_history",
  ],
  crm: [
    "customer_fields",
    "contact_fields",
    "followup_fields",
    "stage_rule",
    "assignment_rule",
    "reminder_rule",
  ],
};

export function classifyProductDomain(rawIdea: string, context: Record<string, any> = {}): DomainClassification {
  const text = `${rawIdea} ${JSON.stringify(context)}`;
  const personalLocalTool = isPersonalLocalFrontendToolContext(rawIdea, context);
  const explicitKnowledgeAnchor = hasExplicitKnowledgeBaseAnchor(text);
  const explicitCrmAnchor = hasExplicitCrmAnchor(text);
  const negatedRegistration = hasNegatedRegistration(text);
  const negatedTicket = hasNegatedTicket(text);
  const negatedKnowledge = hasNegatedKnowledgeBase(text);
  const scores: Record<ProductDomain, number> = {
    registration: 0,
    digital_commerce: 0,
    appointment: 0,
    content_community: 0,
    ai_copywriting: 0,
    ticket_workflow: 0,
    knowledge_base: 0,
    crm: 0,
    generic: 1,
  };

  for (const [domain, keys] of Object.entries(domainAnswerKeys) as Array<[Exclude<ProductDomain, "generic">, string[]]>) {
    const keyHits = keys.filter((key) => context[key] !== undefined && !isNegatedValue(context[key])).length;
    if (domain === "knowledge_base" && !explicitKnowledgeAnchor) {
      scores[domain] += keyHits * 2;
    } else if (domain === "crm" && !explicitCrmAnchor) {
      scores[domain] += keyHits * 2;
    } else {
      scores[domain] += keyHits * 6;
    }
  }

  const registration = hasAny(text, ["活动报名", "报名系统", "报名表", "报名用户", "报名数据", "报名列表", "用户报名表单", "参会", "参赛"]) && !negatedRegistration;
  if (registration) scores.registration += 7;
  if (registration && hasAny(text, ["导出", "Excel", "手机号", "报名列表"])) scores.registration += 3;

  const commerce = hasAny(text, ["数字资料", "资料包", "售卖", "购买", "下单", "订单", "商品", "价格"]);
  const payment = hasAny(text, ["支付", "付款", "收费", "金额", "mock payment", "微信", "支付宝"]) && !hasNegatedPayment(text);
  const download = hasAny(text, ["下载", "下载权限", "资料文件", "文件交付", "发货"]);
  if (commerce) scores.digital_commerce += 4;
  if (commerce && (payment || download)) scores.digital_commerce += 5;
  if (payment && download) scores.digital_commerce += 3;

  const appointment = hasAny(text, ["预约", "约时间", "时间段", "可预约", "档期"]);
  const capacity = hasAny(text, ["服务项目", "容量", "满员", "取消预约", "排班", "最大预约人数"]);
  if (appointment) scores.appointment += 5;
  if (appointment && capacity) scores.appointment += 5;

  const contentEntity = hasAny(text, ["内容社区", "投稿", "文章", "帖子", "博客"]);
  const moderation = hasAny(text, ["文章审核", "投稿审核", "举报评论", "隐藏评论", "下架文章", "违规内容", "moderation"]);
  const statusModeration = hasAny(text, ["pending", "approved", "rejected", "removed"]);
  if (contentEntity) scores.content_community += 4;
  if (contentEntity && (moderation || statusModeration)) scores.content_community += 6;

  const aiCore = hasAny(text, ["AI", "ai", "LLM", "llm", "GPT", "gpt", "大模型", "模型接口", "API Key", "DeepSeek", "OpenAI"]) && !hasNegatedAi(text);
  const copywriting = hasAny(text, ["文案", "小红书", "营销内容", "生成标题", "生成正文", "推荐标签"]);
  if (aiCore && copywriting) scores.ai_copywriting += 8;
  if (copywriting && hasAny(text, ["次数", "套餐", "扣次", "余额"])) scores.ai_copywriting += 3;

  const ticket = hasAny(text, ["工单", "ticket", "问题单", "任务协作"]) && !negatedTicket;
  const assignment = hasAny(text, ["分配", "处理人", "指派", "assignee", "assigned"]);
  const workflow = hasAny(text, ["状态流转", "open", "in_progress", "resolved", "closed", "reopened", "优先级", "截止时间"]);
  if (ticket) scores.ticket_workflow += 7;
  if (assignment) scores.ticket_workflow += 4;
  if (workflow) scores.ticket_workflow += 4;
  if (ticket && hasAny(text, ["评论", "留言", "回复", "处理进展"])) scores.ticket_workflow += 2;

  const knowledge = explicitKnowledgeAnchor && !negatedKnowledge;
  const documents = hasAny(text, ["文档", "目录", "文件夹", "草稿", "已发布", "published", "draft"]);
  const docPermission = hasAny(text, ["文档权限", "可见范围", "成员", "目录管理", "发布文档", "撤回文档", "搜索文档"]);
  if (knowledge) scores.knowledge_base += 7;
  if (documents && docPermission) scores.knowledge_base += 5;
  if (knowledge && hasAny(text, ["搜索", "权限", "发布", "目录"])) scores.knowledge_base += 3;

  const crm = explicitCrmAnchor;
  const customer = hasAny(text, ["客户", "联系人", "跟进记录", "跟进内容", "负责人", "销售"]);
  const salesFlow = hasAny(text, ["客户阶段", "阶段", "下次跟进", "分配客户", "负责人筛选", "销售账号"]);
  if (crm) scores.crm += 8;
  if (customer && salesFlow) scores.crm += 5;
  if (crm && hasAny(text, ["联系人", "跟进", "分配", "阶段", "筛选"])) scores.crm += 3;

  // Strong domain signals should prevent broad content/community or form fallbacks from absorbing unrelated products.
  if (scores.digital_commerce >= 8) scores.content_community = Math.min(scores.content_community, 4);
  if (scores.appointment >= 8) scores.content_community = Math.min(scores.content_community, 4);
  if (scores.ticket_workflow >= 8) {
    scores.content_community = Math.min(scores.content_community, 4);
    scores.registration = Math.min(scores.registration, 4);
  }
  if (scores.knowledge_base >= 8) {
    scores.content_community = Math.min(scores.content_community, 4);
    scores.registration = Math.min(scores.registration, 4);
    scores.ai_copywriting = Math.min(scores.ai_copywriting, 4);
    scores.ticket_workflow = Math.min(scores.ticket_workflow, 4);
  }
  if (scores.crm >= 8) {
    scores.registration = Math.min(scores.registration, 4);
    scores.content_community = Math.min(scores.content_community, 4);
    scores.ai_copywriting = Math.min(scores.ai_copywriting, 4);
    scores.ticket_workflow = Math.min(scores.ticket_workflow, 4);
    scores.knowledge_base = Math.min(scores.knowledge_base, 4);
  }
  if (scores.content_community >= 8) {
    scores.registration = Math.min(scores.registration, 4);
    scores.ai_copywriting = Math.min(scores.ai_copywriting, 4);
  }
  if (personalLocalTool) {
    if (!knowledge) scores.knowledge_base = Math.min(scores.knowledge_base, 4);
    if (!explicitCrmAnchor) scores.crm = Math.min(scores.crm, 4);
    if (!registration) scores.registration = Math.min(scores.registration, 4);
    if (!hasAny(text, ["数字资料", "资料包", "售卖", "购买", "下单", "订单", "商品"])) scores.digital_commerce = Math.min(scores.digital_commerce, 4);
    if (!hasAny(text, ["预约", "约时间", "时间段", "可预约", "档期"])) scores.appointment = Math.min(scores.appointment, 4);
    if (!ticket) scores.ticket_workflow = Math.min(scores.ticket_workflow, 4);
  }
  if (isPetReminderTool(text)) scores.crm = Math.min(scores.crm, 4);
  if (isLearningNavigationTool(text)) scores.knowledge_base = Math.min(scores.knowledge_base, 4);
  if (isBookListTool(text)) scores.knowledge_base = Math.min(scores.knowledge_base, 4);
  if (isPlantCareTool(text)) scores.ticket_workflow = Math.min(scores.ticket_workflow, 4);
  if (negatedRegistration) scores.registration = Math.min(scores.registration, 4);
  if (negatedTicket) scores.ticket_workflow = Math.min(scores.ticket_workflow, 4);
  if (negatedKnowledge) scores.knowledge_base = Math.min(scores.knowledge_base, 4);

  const ranked = (Object.entries(scores) as Array<[ProductDomain, number]>)
    .filter(([domain]) => domain !== "generic")
    .sort((a, b) => b[1] - a[1]);
  const [domain, score] = ranked[0];
  const winningDomain = score >= 5 ? domain : "generic";
  const confidence = score >= 10 ? "high" : score >= 5 ? "medium" : "low";

  return {
    domain: winningDomain,
    confidence: winningDomain === "generic" ? "low" : confidence,
    scores,
  };
}

export function hasNegatedAi(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(AI|ai|LLM|llm|GPT|gpt|大模型|模型)/.test(text);
}

export function hasNegatedPayment(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(支付|付款|收费|订单|退款)/.test(text);
}

function hasAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function hasExplicitKnowledgeBaseAnchor(text: string): boolean {
  return hasAny(text, ["知识库", "文档管理", "团队文档", "文档系统", "knowledge base"]);
}

function hasExplicitCrmAnchor(text: string): boolean {
  return hasAny(text, ["CRM", "crm", "客户跟进", "客户管理", "销售跟进"]);
}

function isPetReminderTool(text: string): boolean {
  return hasAny(text, ["宠物", "猫", "狗", "疫苗", "驱虫", "体检"]) && hasAny(text, ["提醒", "到期", "记录"]);
}

function isLearningNavigationTool(text: string): boolean {
  return hasAny(text, ["学习导航", "学习资源", "资源导航", "课程导航", "收藏链接"]) && hasAny(text, ["个人", "本地", "不登录", "分类", "搜索"]);
}

function isBookListTool(text: string): boolean {
  return hasAny(text, ["读书清单", "书单", "想读", "摘录", "评分"]) && hasAny(text, ["个人", "本地", "不登录", "标签", "状态"]);
}

function isPlantCareTool(text: string): boolean {
  return hasAny(text, ["植物", "浇水", "施肥", "养护"]) && hasAny(text, ["提醒", "周期", "今天", "待办"]);
}

function hasNegatedRegistration(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不|不是|不要).{0,4}(报名|报名系统|报名表|手机号|导出 Excel|导出Excel)/.test(text);
}

function hasNegatedTicket(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不|不是|不要).{0,8}(工单|ticket|任务协作|分派|处理人)/i.test(text);
}

function hasNegatedKnowledgeBase(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不|不是|不要).{0,8}(知识库|文档管理|团队文档|文档系统)/.test(text);
}

function isNegatedValue(value: unknown): boolean {
  if (typeof value === "boolean") return value === false;
  if (value === null || value === undefined) return true;
  const text = String(value);
  return /(不需要|无需|不涉及|不要|没有|暂不|先不|none|false)/i.test(text);
}
