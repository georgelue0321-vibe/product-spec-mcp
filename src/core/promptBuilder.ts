import { isPersonalLocalFrontendToolContext, isSingleUserCrmContext } from "./contextSignals.js";
import { classifyProductDomain, hasNegatedAi } from "./domainClassifier.js";
import { buildLocalToolSignalProfile } from "./localToolSignals.js";
import { decidePmIntent, type PmIntentDecision } from "./pmIntentGate.js";
import { buildTechnicalProfile, isLocalFirstProfile, type TechnicalProfile } from "./technicalProfile.js";

export interface SpecResult {
  readinessScore: number;
  readinessStatus: string;
  isActionable: boolean;
  productGoal: string;
  targetUser: string;
  platform: string;
  coreFeatures: string[];
  dataModel: string;
  architecture: string;
  apiDesign: string;
  riskBoundaries: string[];
  nonGoals: string[];
  successCriteria: string[];
  assumptions: string[];
  technicalProfile?: TechnicalProfile;
  pmIntentDecision?: PmIntentDecision;
  inputConsumption?: {
    consumedAnswers: string[];
    unusedAnswers: string[];
    matchedDomain: string;
    confidence: "high" | "medium" | "low";
  };
}

export function buildSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const assumptions: string[] = [];
  
  // Normalize Chinese answer keys to English keys
  const normalizedContext = normalizeContext(context);
  const technicalProfile = buildTechnicalProfile(rawIdea, normalizedContext);
  const pmIntentDecision = decidePmIntent(rawIdea, normalizedContext);
  const classification = classifyProductDomain(rawIdea, normalizedContext);
  const shouldUseDomainPack =
    classification.domain !== "generic" &&
    !(isLocalFirstProfile(technicalProfile) && ["knowledge_base", "ticket_workflow"].includes(classification.domain));

  if (shouldUseDomainPack && classification.domain === "crm") {
    return withTechnicalProfile(buildCrmSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "knowledge_base") {
    return withTechnicalProfile(buildKnowledgeBaseSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "ticket_workflow") {
    return withTechnicalProfile(buildTicketWorkflowSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "content_community") {
    return withTechnicalProfile(buildContentCommunitySpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "appointment") {
    return withTechnicalProfile(buildAppointmentSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "digital_commerce") {
    return withTechnicalProfile(buildDigitalCommerceSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "ai_copywriting") {
    return withTechnicalProfile(buildAiCopywritingSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (shouldUseDomainPack && classification.domain === "registration") {
    return withTechnicalProfile(buildRegistrationSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (classification.domain === "generic" && isOperationalOrderWorkflowContext(rawIdea, normalizedContext)) {
    return withTechnicalProfile(buildOperationalOrderWorkflowSpec(rawIdea, normalizedContext, readiness), technicalProfile);
  }

  if (classification.domain === "generic" && shouldUsePmGateSpec(pmIntentDecision)) {
    return withTechnicalProfile(buildPmGateSpec(rawIdea, normalizedContext, readiness, pmIntentDecision), technicalProfile);
  }

  const hasStructuredAnswers = hasUnsupportedStructuredAnswers(normalizedContext);
  const personalLocalTool = isLocalFirstProfile(technicalProfile) || isPersonalLocalFrontendToolContext(rawIdea, normalizedContext);
  const localSignalProfile = personalLocalTool ? buildLocalToolSignalProfile(rawIdea) : undefined;
  const hasLocalSignals = Boolean(localSignalProfile && (localSignalProfile.featureHints.length > 0 || localSignalProfile.recordObject !== "记录"));
  const genericReadinessScore = hasStructuredAnswers
    ? Math.min(Math.max(readiness.score, 60), 79)
    : hasLocalSignals
    ? Math.max(readiness.score, 60)
    : readiness.score;
  const genericReadinessStatus = readinessStatusFromScore(genericReadinessScore);
  const isActionable = !hasStructuredAnswers && genericReadinessScore >= 70;
  const productGoal =
    normalizedContext.product_goal || extractGoal(rawIdea) || (hasLocalSignals && localSignalProfile ? `${localSignalProfile.recordObject}管理工具` : "");
  if (!productGoal) {
    assumptions.push("产品目标：未明确，需要用户确认");
  }

  const targetUser =
    normalizedContext.target_user || (hasLocalSignals ? inferLocalFirstTargetUser(rawIdea) : extractTargetUser(rawIdea));
  if (!targetUser) {
    assumptions.push("目标用户：默认为个人用户");
  }

  const platform = normalizedContext.platform || extractPlatform(rawIdea) || "web";
  const extractedFeatures = personalLocalTool
    ? buildLocalFirstExtractedFeatures(rawIdea)
    : extractFeatures(rawIdea);
  const coreFeatures = hasStructuredAnswers
    ? buildGenericCoreFeatures(normalizedContext, extractedFeatures)
    : toArray(normalizedContext.core_features, extractedFeatures);

  const isGenericFeatures = coreFeatures.length === 1 && coreFeatures[0] === "核心功能";
  if (isGenericFeatures) {
    assumptions.push("核心功能：未识别到具体功能，需要用户补充");
  }
  if (hasStructuredAnswers) {
    assumptions.push("当前输入包含多个结构化答案，但未匹配到稳定 domain pack；不要把它套入报名、电商、预约、内容社区、工单或知识库模板。");
  }
  if (personalLocalTool) {
    assumptions.push(
      "数据默认保存在当前浏览器 localStorage 中，刷新后保留，但不做跨设备同步。",
      "第一版默认不需要登录、注册、后台管理或管理员角色。",
      "页面高级感只作为 UI 风格和响应式验收要求，不作为后端或服务器数据库信号。"
    );
  }

  const needsBackend = technicalProfile.needsBackend || normalizedContext.need_backend === true ||
    normalizedContext.data_persistence === true ||
    normalizedContext.user_roles === true ||
    normalizedContext.backend_need === true;
  const dataModel = buildDataModel(normalizedContext, needsBackend, technicalProfile, rawIdea);
  const successCriteria = personalLocalTool
    ? buildLocalFirstSuccessCriteria(rawIdea)
    : ["核心功能可用", "无明显 Bug", "用户体验流畅"];
  const nonGoals = personalLocalTool
    ? ["暂不包含登录/注册", "暂不包含后台管理系统", "暂不包含多人多设备同步"]
    : ["暂不包含高级功能", "暂不包含移动端 App"];

  return {
    readinessScore: genericReadinessScore,
    readinessStatus: genericReadinessStatus,
    isActionable,
    productGoal: productGoal || "待用户确认",
    targetUser: targetUser || "待用户确认",
    platform,
    coreFeatures: isGenericFeatures ? ["待用户补充具体功能"] : coreFeatures,
    dataModel,
    architecture: buildArchitectureRecommendation(normalizedContext, needsBackend, technicalProfile),
    apiDesign: personalLocalTool
      ? buildLocalFirstApiDesign(technicalProfile)
      : hasStructuredAnswers
      ? "未匹配到稳定 domain，暂不生成正式 API；请先补充核心业务对象、状态流转、权限边界后再编译。"
      : needsBackend ? buildApiDesign(normalizedContext, coreFeatures) : "纯前端项目，无需 API",
    riskBoundaries: hasStructuredAnswers
      ? ["未命中稳定 domain pack，当前规格仅可作为草案；禁止静默复用其它业务模板。"]
      : buildRiskBoundaries(normalizedContext),
    nonGoals: toArray(normalizedContext.non_goals, nonGoals),
    successCriteria: toArray(normalizedContext.success_criteria, successCriteria),
    assumptions,
    technicalProfile,
    pmIntentDecision,
    inputConsumption: buildInputConsumption(normalizedContext, Object.keys(normalizedContext), "generic", "low"),
  };
}

function withTechnicalProfile(spec: SpecResult, technicalProfile: TechnicalProfile): SpecResult {
  return { ...spec, technicalProfile };
}

function shouldUsePmGateSpec(decision: PmIntentDecision): boolean {
  return [
    "multi_user_collaboration",
    "content_marketing_site",
    "data_visualization_site",
  ].includes(decision.needType);
}

function buildPmGateSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> },
  decision: PmIntentDecision
): SpecResult {
  const score = Math.min(Math.max(readiness.score, 60), 79);
  const productGoal = context.product_goal || pmGateProductGoal(decision);
  const targetUser = context.target_user || pmGateTargetUser(decision);
  const assumptions = [...decision.defaultAssumptions];

  return {
    readinessScore: score,
    readinessStatus: readinessStatusFromScore(score),
    isActionable: false,
    productGoal,
    targetUser,
    platform: context.platform || "web",
    coreFeatures: pmGateCoreFeatures(decision),
    dataModel: pmGateDataModel(decision),
    architecture: pmGateArchitecture(decision),
    apiDesign: pmGateApiDesign(decision),
    riskBoundaries: pmGateRiskBoundaries(decision),
    nonGoals: pmGateNonGoals(decision),
    successCriteria: pmGateSuccessCriteria(decision),
    assumptions,
    pmIntentDecision: decision,
    inputConsumption: buildInputConsumption(context, Object.keys(context), "generic", decision.confidence),
  };
}

function pmGateProductGoal(decision: PmIntentDecision): string {
  if (decision.needType === "multi_user_collaboration") return "多人共享任务日程工具";
  if (decision.needType === "content_marketing_site") return "内容营销网站";
  if (decision.needType === "data_visualization_site") return "数据图表展示网站";
  return "产品 MVP";
}

function pmGateTargetUser(decision: PmIntentDecision): string {
  if (decision.usageScope === "fixed_group") return "固定小范围成员";
  if (decision.usageScope === "public_audience") return "公开访问用户和站点维护者";
  if (decision.usageScope === "self") return "个人使用者";
  return "待用户确认";
}

function pmGateCoreFeatures(decision: PmIntentDecision): string[] {
  if (decision.needType === "multi_user_collaboration") {
    return [
      "成员任务日程展示",
      "自己给自己安排任务直接生效",
      "给别人安排任务进入待认领",
      "任务认领和完成状态流转",
      "同一时间任务并排展示或高亮冲突",
    ];
  }
  if (decision.needType === "content_marketing_site") {
    return [
      "健身房基础信息展示",
      "Q&A/FAQ 内容页",
      "照片和用户反馈展示",
      "近期促销活动展示",
      "教练信息展示",
      "GEO/SEO 结构化内容",
    ];
  }
  if (decision.needType === "data_visualization_site") {
    return [
      "xlsx 数据解析流程",
      "图表数据 JSON 生成",
      "图表页面渲染",
      "最新数据结果展示",
    ];
  }
  return ["核心功能待确认"];
}

function pmGateDataModel(decision: PmIntentDecision): string {
  if (decision.needType === "multi_user_collaboration") {
    return [
      "SQLite（MVP）",
      "users(id, name, access_code, created_at)",
      "tasks(id, title, description, start_at, end_at, creator_id, assignee_id, status, created_at, updated_at)",
      "task_events(id, task_id, actor_id, action, note, created_at)",
      "status 建议：self_active / pending_claim / claimed / done / cancelled",
    ].join("\n");
  }
  if (decision.needType === "content_marketing_site") {
    return [
      "静态内容文件：data/site.json + markdown 内容 + assets 图片目录",
      "site_profile(name, address, hours, phone, geo_keywords)",
      "faqs(question, answer, category)",
      "coaches(name, title, specialties, bio, photo)",
      "promotions(title, description, start_date, end_date, status)",
      "testimonials(author_label, content, source, status)",
      "默认由 Agent 更新内容文件并重新部署，不默认建设 CMS 后台。",
    ].join("\n");
  }
  if (decision.needType === "data_visualization_site") {
    return [
      "静态数据文件：data/chart-data.json",
      "Agent 从 xlsx 解析出 rows、columns、metrics、chart_config",
      "页面读取 chart-data.json 渲染图表；默认只展示最新结果。",
      "如改为网页上传且所有访客看最新结果，再升级上传接口和服务器存储。",
    ].join("\n");
  }
  return "待确认数据模型";
}

function pmGateArchitecture(decision: PmIntentDecision): string {
  if (decision.needType === "multi_user_collaboration") {
    return decision.accessTopology === "lan_only"
      ? "局域网轻后端：一台本机/NAS 运行 Node + SQLite，成员通过局域网 IP 访问。"
      : "轻后端 MVP：Node + SQLite；固定几人外出访问时可用低价公网 VPS + IP 地址先跑通。";
  }
  if (decision.needType === "content_marketing_site") {
    return "静态内容营销站：HTML/CSS/JS + 静态内容文件 + 图片资源；由 Agent 维护内容并重新部署。";
  }
  if (decision.needType === "data_visualization_site") {
    return "静态数据图表站：Agent 解析 xlsx 生成 JSON，前端读取 JSON 并渲染图表；不默认后台或数据库。";
  }
  return "待确认架构";
}

function pmGateApiDesign(decision: PmIntentDecision): string {
  if (decision.needType === "multi_user_collaboration") {
    return [
      "GET /api/schedule?date=YYYY-MM-DD",
      "POST /api/tasks",
      "POST /api/tasks/:id/claim",
      "POST /api/tasks/:id/complete",
      "PATCH /api/tasks/:id",
    ].join("\n");
  }
  return "无需 REST API；由 Agent 更新静态内容/数据文件后重新部署。";
}

function pmGateRiskBoundaries(decision: PmIntentDecision): string[] {
  if (decision.needType === "multi_user_collaboration") {
    return ["多人运行时数据需要统一数据源，不能用每人各自 localStorage 解决。", "公网访问时要确认是否接受 IP 访问，域名和 HTTPS 可作为正式化阶段。"];
  }
  if (decision.needType === "content_marketing_site") {
    return ["内容经常改不等于必须建设后台；只有网页编辑、多人维护或访客提交才升级后端。"];
  }
  if (decision.needType === "data_visualization_site") {
    return ["每次提供 xlsx 可由 Agent 更新静态数据；只有网页上传、统一最新数据或历史版本才升级后端。"];
  }
  return [];
}

function pmGateNonGoals(decision: PmIntentDecision): string[] {
  if (decision.needType === "multi_user_collaboration") return ["暂不默认做域名/备案/完整公网运维", "暂不做复杂 RBAC"];
  if (decision.needType === "content_marketing_site") return ["暂不默认做 CMS 后台", "暂不默认开放访客提交"];
  if (decision.needType === "data_visualization_site") return ["暂不默认做网页上传后台", "暂不默认保存历史版本"];
  return ["暂不包含高级功能"];
}

function pmGateSuccessCriteria(decision: PmIntentDecision): string[] {
  if (decision.needType === "multi_user_collaboration") {
    return [
      "自己给自己安排的任务保存后立即出现在自己的日程中",
      "安排给别人时任务进入待认领状态",
      "对方认领后任务进入对方日程",
      "同一时间任务能并排展示或高亮冲突",
      "刷新后任务状态保持一致",
    ];
  }
  if (decision.needType === "content_marketing_site") {
    return [
      "FAQ、照片、促销活动、教练信息能从内容文件渲染",
      "Agent 更新内容文件并重新部署后，页面展示最新内容",
      "页面包含基础 GEO/SEO 结构化信息、sitemap 或可索引内容",
      "不出现需要后台登录才能维护的默认流程",
    ];
  }
  if (decision.needType === "data_visualization_site") {
    return [
      "Agent 能从新的 xlsx 生成图表数据文件",
      "页面读取最新数据文件并渲染图表",
      "替换数据后重新部署能看到最新结果",
      "不默认要求后台上传或数据库",
    ];
  }
  return ["核心功能按确认边界实现"];
}

function buildRegistrationSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const formFields = parseListLike(context.form_fields, ["姓名", "手机号", "报名人数", "备注"]);
  const hasPhone = formFields.some((field) => field.includes("手机") || field.includes("电话"));
  const dedup = context.dedup_strategy || (hasPhone ? "手机号去重" : "按唯一联系方式去重");
  const exportFormat = context.export_format || "Excel";
  const adminFeatures = context.admin_features || context.admin_scope || "报名列表、手机号搜索、导出 Excel";
  const userAuth = context.user_auth || context.user_login || "报名用户不需要登录，填表直接提交";
  const adminAuth = context.admin_access || context.admin_auth || "管理员登录后访问后台";
  const workflow = context.workflow || context.approval_flow || "提交即完成，不需要审核";
  const platform = context.platform || context.target_platform || context.primary_platform || "web";
  const database = context.database || "SQLite";

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "活动报名系统",
    targetUser: context.target_user || "报名用户和管理员",
    platform,
    coreFeatures: [
      `用户报名表单：${formFields.join("、")}`,
      `提交报名：${workflow}`,
      `数据保存：报名数据持久化到 ${database}`,
      `防重复：${dedup}`,
      `字段校验：姓名和手机号必填，手机号格式校验，报名人数为正整数`,
      `管理员登录：${adminAuth}`,
      `管理后台：${adminFeatures}`,
      `导出数据：按当前筛选条件导出 ${exportFormat}`,
      `用户登录策略：${userAuth}`,
    ],
    dataModel: buildRegistrationDataModel(formFields, database, dedup),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "报名用户无需登录；管理员后台需要登录鉴权。",
      "后台列表、搜索和导出接口必须在后端校验管理员权限。",
    ].join("\n"),
    apiDesign: [
      "POST /api/registrations - 提交报名；body: { name, phone, attendees, note }；校验必填、手机号格式、报名人数和去重",
      "POST /api/admin/login - 管理员登录；body: { username, password }；成功后写入 session",
      "POST /api/admin/logout - 管理员退出登录；销毁 session",
      "GET /api/admin/session - 检查管理员登录状态",
      "GET /api/admin/registrations?phone=&page=&pageSize= - 查询报名列表，支持手机号搜索和分页；需要管理员登录",
      "GET /api/admin/registrations/export?phone= - 按当前筛选条件导出 Excel；需要管理员登录",
    ].join("\n"),
    riskBoundaries: [
      "报名手机号属于个人信息，列表和导出必须仅管理员可访问",
      "管理员密码不能硬编码到前端；生产环境应使用环境变量和密码哈希",
      "导出的 Excel 包含手机号，下载入口必须鉴权，并避免公开缓存",
      "手机号去重必须有数据库唯一约束兜底，不能只靠前端判断",
      "表单提交失败必须返回明确错误，避免用户重复提交",
    ],
    nonGoals: [
      "MVP 暂不接入支付、短信和微信登录",
      "MVP 暂不做多角色 RBAC",
      "MVP 暂不做复杂 CMS 或活动配置后台",
      "MVP 暂不做移动端原生 App",
    ],
    successCriteria: [
      "用户可以填写姓名、手机号、报名人数和备注并成功提交",
      "手机号格式错误、必填缺失、报名人数小于 1 时有明确错误提示",
      "同一手机号重复报名会被拦截",
      "管理员登录后可以查看报名列表并按手机号搜索",
      "管理员可以导出当前筛选条件下的 Excel 文件",
      "未登录用户不能访问后台列表、搜索和导出接口",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(
      context,
      ["form_fields", "dedup_strategy", "export_format", "admin_features", "admin_scope", "admin_access", "admin_auth", "user_auth", "user_login", "workflow", "approval_flow", "data_persistence", "database", "platform", "target_platform", "primary_platform"],
      "registration",
      "high"
    ),
  };
}

function buildAiCopywritingSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const generationInput = context.generation_input_schema || "产品名称、产品介绍、目标人群、核心卖点";
  const generationOutput = context.generation_output_spec || "一次生成 3 条小红书文案，每条包含标题、正文、标签";
  const llmProvider = context.llm_provider || "后端可替换模型接口";
  const auth = context.account_and_auth || "免登录试用 1 次，购买前必须登录";
  const quota = context.payment_and_quota || "MVP 先按次套餐，后台人工发放次数";
  const history = context.history_and_storage || "保存最近生成历史和扣次记录";
  const safety = context.content_safety || "基础敏感词和营销风险提示";
  const admin = context.admin_metrics || "用户、订单、剩余次数和生成消耗统计";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "AI 小红书文案生成工具",
    targetUser: context.target_user || "小红书博主、电商卖家、品牌运营",
    platform,
    coreFeatures: [
      `文案生成表单：${generationInput}`,
      `AI 生成结果：${generationOutput}`,
      `模型调用层：${llmProvider}`,
      `账号与试用：${auth}`,
      `套餐与扣次：${quota}`,
      `生成历史：${history}`,
      `内容安全：${safety}`,
      `管理后台：${admin}`,
    ],
    dataModel: [
      "users(id, phone/email/open_id, trial_used, created_at)",
      "credit_accounts(user_id, remaining_credits, total_purchased, total_used)",
      "credit_transactions(id, user_id, type, amount, reason, operator_id, created_at)",
      "generation_jobs(id, user_id, input_snapshot, outputs_json, model_provider, token_usage, risk_flags, created_at)",
      "packages(id, name, credits, price, status)",
      "admin_users(id, account, role, created_at)",
    ].join("\n"),
    architecture: "前后端分离架构：Web 前端 + 后端 API + PostgreSQL + 可替换 LLM Provider。AI API Key、扣次、订单和后台权限必须在后端处理。",
    apiDesign: [
      "POST /api/generations - 创建小红书文案生成任务，校验输入、检查次数、调用 LLM、保存结果并扣次",
      "GET /api/generations - 查询当前用户生成历史",
      "GET /api/generations/:id - 查看单次生成详情",
      "GET /api/credits - 查询当前用户剩余次数",
      "POST /api/auth/trial - 记录免登录试用状态",
      "POST /api/auth/login - 登录或注册用户",
      "GET /api/admin/users - 管理员查看用户和剩余次数",
      "POST /api/admin/credits/grant - 管理员人工发放套餐次数",
      "GET /api/admin/metrics - 查看用户、订单、生成次数和模型成本统计",
    ].join("\n"),
    riskBoundaries: [
      "AI API Key 不能暴露在前端，必须通过后端代理调用",
      "扣次必须在服务端事务内完成，避免并发重复消费或绕过扣次",
      "人工发放次数需要操作日志，避免订单和余额对不上",
      "小红书文案存在违禁词、夸大宣传和敏感行业风险，需要给出风险提示",
      "生成历史包含用户输入的产品信息，需要明确保存范围和删除策略",
    ],
    nonGoals: [
      "MVP 暂不接入自动在线支付回调",
      "MVP 暂不做批量商品导入",
      "MVP 暂不做团队协作和多成员权限",
      "MVP 暂不做移动端原生 App",
    ],
    successCriteria: [
      "用户填写产品信息后可以稳定生成 3 条标题、正文、标签完整的小红书文案",
      "未登录用户只能试用 1 次，登录后根据剩余次数生成",
      "每次生成后服务端准确扣减 1 次并保存扣次日志",
      "管理员可以人工发放次数并查看用户剩余次数",
      "敏感词或营销风险命中时能在结果中提示用户",
      "LLM 调用失败时不扣次，并返回可理解的错误提示",
    ],
    assumptions: [],
  };
}

function buildDigitalCommerceSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const productCatalog = context.product_catalog || "标题、简介、价格、封面、文件路径、上下架状态";
  const orderFlow = context.order_flow || "用户选择资料包 -> 创建待支付订单 -> mock 支付成功 -> 获得下载权限";
  const paymentProvider = context.payment_provider || "MVP 使用 mock payment provider，后续可替换微信/支付宝";
  const paymentConfirmation = context.payment_confirmation || "支付状态必须由后端确认，不能只看前端跳转";
  const priceCalculation = context.price_calculation || "订单金额必须由后端根据商品价格计算";
  const downloadPermission = context.download_permission || "只有已登录且已支付该订单的用户可以下载对应文件";
  const adminFeatures = context.admin_features || "管理员可以新增、编辑、上下架资料包，查看订单和下载记录";
  const auth = context.account_and_auth || "购买和下载前需要用户登录，后台需要管理员登录";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "product_catalog",
    "order_flow",
    "payment_provider",
    "payment_confirmation",
    "price_calculation",
    "download_permission",
    "admin_features",
    "account_and_auth",
    "data_persistence",
    "target_platform",
  ];

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "数字资料售卖网站",
    targetUser: context.target_user || "资料购买用户和管理员",
    platform,
    coreFeatures: [
      `资料包展示：${productCatalog}`,
      `购买流程：${orderFlow}`,
      `支付方式：${paymentProvider}`,
      `支付确认：${paymentConfirmation}`,
      `金额计算：${priceCalculation}`,
      `下载权限：${downloadPermission}`,
      `账号与权限：${auth}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildDigitalCommerceDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + Mock Payment Provider。`,
      "商品价格、订单金额、支付状态和下载权限必须在后端处理。",
      "生产环境可替换为 PostgreSQL + 微信/支付宝支付回调 + 对象存储签名下载。",
    ].join("\n"),
    apiDesign: [
      "GET /api/products - 查询已上架资料包列表",
      "GET /api/products/:id - 查询资料包详情",
      "POST /api/auth/register - 用户注册",
      "POST /api/auth/login - 用户登录",
      "POST /api/auth/logout - 用户退出登录",
      "POST /api/orders - 创建待支付订单；后端根据 product_id 计算 amount_cents",
      "GET /api/orders - 查询当前用户订单列表",
      "POST /api/orders/:id/pay - mock 支付或支付结果确认；后端校验订单金额并幂等更新状态",
      "GET /api/downloads/:productId - 下载资料文件；后端校验登录、订单归属和 paid 状态",
      "GET /api/admin/products - 管理员查询资料包",
      "POST /api/admin/products - 管理员新增资料包",
      "PATCH /api/admin/products/:id - 管理员编辑、上架或下架资料包",
      "GET /api/admin/orders - 管理员查询订单",
      "GET /api/admin/downloads - 管理员查询下载记录",
    ].join("\n"),
    riskBoundaries: [
      "订单金额必须由后端根据商品价格计算，不能相信前端传入金额",
      "支付成功必须以后端确认、支付回调或订单查询为准，不能只看前端跳转",
      "支付状态更新必须幂等，避免重复回调或重复点击导致订单异常",
      "未支付订单不能下载资料文件；下载接口必须校验登录、订单归属和支付状态",
      "资料真实文件路径不能直接暴露给前端，避免绕过权限访问",
      "管理员后台和下载记录属于敏感数据，必须做服务端鉴权",
    ],
    nonGoals: [
      "MVP 暂不接真实微信/支付宝支付",
      "MVP 暂不做退款流程",
      "MVP 暂不做复杂优惠券和分销",
      "MVP 暂不做移动端原生 App",
    ],
    successCriteria: [
      "用户可以浏览资料包列表和详情",
      "用户登录后可以创建订单，订单金额由后端按资料包价格计算",
      "mock 支付成功后订单变为 paid，重复支付请求不会产生重复扣款或异常状态",
      "未支付订单不能下载资料文件",
      "支付成功后才能下载对应资料，下载记录包含用户、资料、订单和时间",
      "管理员可以新增、编辑、上下架资料包，并查看订单和下载记录",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "digital_commerce", "high"),
  };
}

function buildOperationalOrderWorkflowSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite";
  const domainKeys = ["order_flow", "admin_features", "data_persistence", "target_platform"];

  return {
    readinessScore: Math.max(readiness.score, 60),
    readinessStatus: "Draft Ready",
    isActionable: false,
    productGoal: context.product_goal || "扫码点餐订单系统",
    targetUser: context.target_user || "顾客、后厨人员和店铺管理员",
    platform,
    coreFeatures: [
      "顾客扫码进入桌台点餐页",
      "菜单和菜品展示：分类、名称、价格、上下架状态",
      "购物车和下单：选择菜品、数量、备注并创建订单",
      "订单状态流：pending -> accepted -> cooking -> ready -> completed/cancelled",
      "后厨订单看板：查看新订单并更新制作状态",
      "老板后台：维护菜品、分类、价格和上下架状态",
    ],
    dataModel: buildOperationalOrderDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session。`,
      "顾客下单、后厨状态和老板维护菜品都需要统一后端状态源，不能只放在浏览器 localStorage。",
      "价格必须以后端菜品表为准，前端传入金额只能作为展示参考。",
    ].join("\n"),
    apiDesign: [
      "GET /api/menus - 查询可展示菜单分类和已上架菜品",
      "POST /api/orders - 顾客创建订单；body: { tableCode, items, note }；后端按菜品表计算金额并写入 pending 状态",
      "GET /api/orders/:id - 查询订单详情和当前状态",
      "GET /api/kitchen/orders?status= - 后厨查询待处理和制作中订单；需要后厨或管理员登录",
      "PATCH /api/kitchen/orders/:id/status - 后厨更新订单状态；只允许按状态机流转",
      "POST /api/admin/login - 老板或管理员登录",
      "GET /api/admin/dishes - 查询菜品列表",
      "POST /api/admin/dishes - 新增菜品",
      "PATCH /api/admin/dishes/:id - 编辑菜品名称、价格、分类或上下架状态",
      "GET /api/admin/orders - 老板查询订单列表和状态",
    ].join("\n"),
    riskBoundaries: [
      "订单金额必须由后端根据菜品价格计算，不能信任前端传入金额",
      "后厨状态流转必须在后端校验，避免订单被跳过或重复完成",
      "老板后台和后厨看板必须服务端鉴权",
      "同一桌台短时间重复提交需要幂等或明确防重复提示",
    ],
    nonGoals: [
      "MVP 暂不接真实支付",
      "MVP 暂不做复杂库存、会员和优惠券",
      "MVP 暂不做多门店和复杂权限",
    ],
    successCriteria: [
      "顾客扫码后可以看到已上架菜品并创建订单",
      "订单创建后，后厨看板能看到新订单和菜品明细",
      "后厨更新状态后，顾客订单详情能看到最新状态",
      "老板可以新增、编辑、下架菜品，且下架菜品不能再被下单",
      "订单金额以后端菜品价格计算，修改前端金额不会影响实际订单金额",
    ],
    assumptions: [
      "MVP 默认每张桌子使用一个 tableCode 或二维码参数识别来源。",
      "MVP 默认后厨和老板使用简单账号登录，不做复杂 RBAC。",
    ],
    inputConsumption: buildInputConsumption(context, domainKeys, "generic", "medium"),
  };
}

function buildAppointmentSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const serviceCatalog = context.service_catalog || "服务项目包含名称、简介、时长、可预约状态";
  const timeSlotRule = context.time_slot_rule || "管理员可以设置日期、开始时间、结束时间、最大预约人数";
  const bookingFlow = context.booking_flow || "用户选择服务项目和时间段 -> 填写姓名手机号 -> 提交预约 -> 后台可查看";
  const capacityRule = context.capacity_rule || "每个时间段达到最大人数后不能继续预约";
  const bookingStatus = context.booking_status || "预约状态包含 pending、confirmed、cancelled";
  const cancelRule = context.cancel_rule || "用户可以通过手机号和预约号取消预约";
  const adminFeatures = context.admin_features || "管理员可以管理服务项目、设置时间段、查看预约列表、筛选状态";
  const notification = context.notification || "MVP 先页面提示确认信息，不接短信";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "service_catalog",
    "time_slot_rule",
    "booking_flow",
    "capacity_rule",
    "booking_status",
    "cancel_rule",
    "admin_features",
    "notification",
    "payment",
    "data_persistence",
    "target_platform",
  ];

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "预约服务系统",
    targetUser: context.target_user || "预约用户和管理员",
    platform,
    coreFeatures: [
      `服务项目：${serviceCatalog}`,
      `时间段设置：${timeSlotRule}`,
      `预约流程：${bookingFlow}`,
      `容量限制：${capacityRule}`,
      `预约状态：${bookingStatus}`,
      `取消预约：${cancelRule}`,
      `确认通知：${notification}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildAppointmentDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "容量限制、取消预约和后台时间段管理必须在后端处理。",
      "容量扣减/释放建议在同一次后端写入中完成，避免并发预约导致超过最大人数。",
    ].join("\n"),
    apiDesign: [
      "GET /api/services - 查询可预约服务项目",
      "GET /api/time-slots?serviceId=&date= - 查询可预约时间段和剩余容量",
      "POST /api/bookings - 创建预约；body: { serviceId, timeSlotId, name, phone }；后端校验容量并写入状态",
      "GET /api/bookings/:id - 查询预约详情",
      "POST /api/bookings/:id/cancel - 取消预约；校验手机号/预约号或登录态，状态改为 cancelled 并释放容量",
      "POST /api/admin/login - 管理员登录",
      "POST /api/admin/logout - 管理员退出登录",
      "GET /api/admin/services - 管理员查询服务项目",
      "POST /api/admin/services - 管理员新增服务项目",
      "PATCH /api/admin/services/:id - 管理员编辑或停用服务项目",
      "GET /api/admin/time-slots - 管理员查询时间段",
      "POST /api/admin/time-slots - 管理员新增可预约时间段",
      "PATCH /api/admin/time-slots/:id - 管理员编辑、停用时间段或调整最大预约人数",
      "GET /api/admin/bookings?status=&date=&serviceId= - 管理员查询预约列表并按状态/日期/服务筛选",
    ].join("\n"),
    riskBoundaries: [
      "容量限制必须在后端校验，不能只靠前端隐藏满员时间段",
      "创建预约必须防重复提交，并在后端保证同一时间段不会超过最大预约人数",
      "取消预约必须校验用户身份或预约凭证，取消后释放对应时间段容量",
      "后台服务项目、时间段和预约列表接口必须管理员鉴权",
      "手机号属于个人信息，预约列表和查询接口不能公开暴露",
    ],
    nonGoals: [
      "MVP 暂不接入支付",
      "MVP 暂不接入短信或微信通知",
      "MVP 暂不做复杂员工排班",
      "MVP 暂不做移动端原生 App",
    ],
    successCriteria: [
      "用户可以查看可预约服务项目和时间段",
      "用户可以提交预约并看到确认信息",
      "满员时间段不能继续预约",
      "重复点击提交不会产生重复预约或超过容量",
      "用户可以按规则取消预约，取消后释放对应时间段容量",
      "管理员可以新增、编辑和停用服务项目与时间段",
      "管理员可以查看预约列表并按状态筛选",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "appointment", "high"),
  };
}

function buildContentCommunitySpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const userRoles = textOrFallback(context.user_roles, "普通用户注册登录后发布文章、评论和举报；管理员审核文章、隐藏评论和下架文章");
  const contentModel = context.content_model || "文章包含标题、正文、作者、状态、发布时间；评论包含文章ID、作者、内容、状态";
  const publishFlow = context.publish_flow || "用户提交文章 -> 状态为 pending -> 管理员审核 -> approved 后公开展示，rejected 不公开";
  const commentFlow = context.comment_flow || "登录用户可以评论已公开文章；管理员可以隐藏违规评论";
  const reportFlow = context.report_flow || "用户可以举报评论，管理员在后台查看举报并处理";
  const moderationStatus = context.moderation_status || "文章状态包含 draft、pending、approved、rejected、removed；评论状态包含 visible、hidden";
  const adminFeatures = context.admin_features || "管理员可以查看待审文章、通过/拒绝文章、下架文章、查看举报、隐藏评论";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "user_roles",
    "content_model",
    "publish_flow",
    "comment_flow",
    "report_flow",
    "moderation_status",
    "admin_features",
    "data_persistence",
    "notification",
    "payment",
    "ai",
    "target_platform",
  ];

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "内容社区投稿审核系统",
    targetUser: context.target_user || "内容发布用户、评论用户和管理员",
    platform,
    coreFeatures: [
      `用户角色：${userRoles}`,
      `内容模型：${contentModel}`,
      `发布审核流：${publishFlow}`,
      `评论规则：${commentFlow}`,
      `举报处理：${reportFlow}`,
      `状态模型：${moderationStatus}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildContentCommunityDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "文章发布、审核状态、评论隐藏、举报处理和管理员操作必须在后端校验。",
      "公开列表只能读取 approved 文章和 visible 评论，不能只靠前端隐藏 pending/rejected/removed 内容。",
    ].join("\n"),
    apiDesign: [
      "POST /api/auth/register - 普通用户注册",
      "POST /api/auth/login - 普通用户登录",
      "POST /api/auth/logout - 普通用户退出登录",
      "GET /api/posts - 查询公开文章列表，仅返回 approved 状态文章",
      "POST /api/posts - 登录用户提交文章，默认进入 pending 状态",
      "GET /api/posts/:id - 查询公开文章详情和 visible 评论",
      "POST /api/posts/:id/comments - 登录用户评论 approved 文章",
      "POST /api/comments/:id/report - 登录用户举报评论",
      "POST /api/admin/login - 管理员登录",
      "POST /api/admin/logout - 管理员退出登录",
      "GET /api/admin/posts?status=pending - 管理员查看文章列表并按状态筛选",
      "POST /api/admin/posts/:id/approve - 管理员通过文章，状态改为 approved",
      "POST /api/admin/posts/:id/reject - 管理员拒绝文章，状态改为 rejected",
      "POST /api/admin/posts/:id/remove - 管理员下架文章，状态改为 removed",
      "POST /api/admin/comments/:id/hide - 管理员隐藏评论，状态改为 hidden",
      "GET /api/admin/reports - 管理员查看举报列表",
    ].join("\n"),
    riskBoundaries: [
      "pending、rejected、removed 文章不能出现在公开列表和详情接口中",
      "hidden 评论不能出现在前台评论列表中",
      "发布文章、评论和举报必须校验普通用户登录态",
      "审核文章、隐藏评论、下架文章和处理举报必须校验管理员登录态",
      "管理员审核和隐藏操作建议记录 moderation_actions，便于追踪误操作和违规处理",
      "用户提交内容需要基础长度、空内容和状态校验，避免垃圾数据进入审核流",
    ],
    nonGoals: [
      "MVP 暂不接入支付",
      "MVP 暂不接入 AI 内容审核",
      "MVP 暂不做实时通知",
      "MVP 暂不做复杂推荐算法",
    ],
    successCriteria: [
      "用户可以注册、登录并提交文章，提交后文章进入 pending 状态",
      "pending 文章不会公开展示，管理员通过后才进入公开列表",
      "管理员拒绝或下架文章后，文章不会公开展示",
      "登录用户可以评论已公开文章，隐藏评论不会在前台展示",
      "登录用户可以举报评论，管理员可以查看举报并隐藏违规评论",
      "未登录用户不能发布、评论或举报；未登录管理员不能访问审核后台",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "content_community", "high"),
  };
}

function buildTicketWorkflowSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const userRoles = textOrFallback(context.user_roles, "普通用户提交并查看自己的工单；管理员查看全部工单并分配处理人；处理人更新分配给自己的工单");
  const ticketFields = context.ticket_fields || "标题、描述、提交人、处理人、优先级、状态、截止时间、创建时间、更新时间";
  const statusFlow = context.status_flow || "open -> assigned -> in_progress -> resolved -> closed；用户不满意可 reopened";
  const assignmentFlow = context.assignment_flow || "管理员把工单分配给处理人；处理人只能处理分配给自己的工单";
  const commentFlow = context.ticket_comment_flow || context.comment_flow || "用户、管理员、处理人都可以在工单下留言，处理进展按时间保存";
  const adminFeatures = context.admin_features || "按状态、优先级、处理人、截止时间筛选工单，查看处理记录";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "user_roles",
    "ticket_fields",
    "status_flow",
    "assignment_flow",
    "ticket_comment_flow",
    "comment_flow",
    "admin_features",
    "data_persistence",
    "notification",
    "payment",
    "ai",
    "target_platform",
  ];

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "工单任务协作系统",
    targetUser: context.target_user || "提交工单的用户、管理员和处理人",
    platform,
    coreFeatures: [
      `用户角色：${userRoles}`,
      `工单字段：${ticketFields}`,
      `状态流转：${statusFlow}`,
      `分派规则：${assignmentFlow}`,
      `评论与处理记录：${commentFlow}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildTicketWorkflowDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "工单分派、状态流转、处理人权限和后台筛选必须在后端校验。",
      "状态变更和分派操作建议写入 status_history，便于追踪处理过程和误操作。",
    ].join("\n"),
    apiDesign: [
      "POST /api/auth/register - 普通用户注册",
      "POST /api/auth/login - 用户、处理人或管理员登录",
      "POST /api/auth/logout - 退出登录",
      "POST /api/tickets - 登录用户提交工单，默认状态 open",
      "GET /api/tickets - 当前用户查询自己的工单列表",
      "GET /api/tickets/:id - 查看有权限访问的工单详情、评论和状态记录",
      "POST /api/tickets/:id/comments - 对工单留言或回复处理进展",
      "GET /api/handler/tickets?status=&priority= - 处理人查看分配给自己的工单",
      "PATCH /api/handler/tickets/:id/status - 处理人按允许流程更新工单状态",
      "GET /api/admin/tickets?status=&assignee=&priority=&dueBefore= - 管理员筛选全部工单",
      "PATCH /api/admin/tickets/:id/assign - 管理员分配处理人",
      "PATCH /api/admin/tickets/:id/status - 管理员按允许流程更新状态",
    ].join("\n"),
    riskBoundaries: [
      "用户只能查看和评论自己的工单，处理人只能处理分配给自己的工单",
      "分配处理人、修改优先级和查看全部工单必须校验管理员登录态",
      "状态流转必须在后端校验，不能只靠前端按钮控制",
      "工单评论和处理记录需要保存创建人、角色和时间，便于追踪",
      "截止时间和优先级影响筛选与提醒，字段格式必须服务端校验",
    ],
    nonGoals: [
      "MVP 暂不接入支付",
      "MVP 暂不接入 AI",
      "MVP 暂不做复杂团队 RBAC",
      "MVP 暂不做邮件、短信或企业微信通知",
    ],
    successCriteria: [
      "用户登录后可以提交工单并查看自己的工单",
      "管理员可以查看全部工单并按状态、优先级、处理人筛选",
      "管理员可以把工单分配给处理人",
      "处理人只能查看和处理分配给自己的工单",
      "工单状态只能按 open/assigned/in_progress/resolved/closed/reopened 的允许流程流转",
      "评论和处理进展能保存并按时间展示",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "ticket_workflow", "high"),
  };
}

function buildKnowledgeBaseSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const userRoles = textOrFallback(context.user_roles, "成员登录后创建、编辑有权限的文档并搜索已发布文档；管理员管理成员、目录、文档权限和发布状态");
  const documentFields = context.document_fields || "标题、正文、目录ID、作者、状态、可见范围、创建时间、更新时间";
  const folderStructure = context.folder_structure || "MVP 支持树形目录或一级目录";
  const documentStatus = context.document_status || "draft 仅作者和管理员可见，published 对有权限成员可见";
  const permissionRule = context.permission_rule || "MVP 使用 member/admin 简单角色和文档可见范围，不做复杂 RBAC";
  const searchScope = context.search_scope || "成员只搜索有权限查看的 published 文档；管理员可搜索全部文档";
  const versionHistory = context.version_history || "MVP 先保存更新时间，不做完整版本历史";
  const includeVersionHistory = wantsKnowledgeBaseVersionHistory(versionHistory);
  const adminFeatures = context.admin_features || "管理员管理成员、目录、文档权限、发布和撤回文档";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "user_roles",
    "document_fields",
    "folder_structure",
    "document_status",
    "permission_rule",
    "search_scope",
    "version_history",
    "admin_features",
    "data_persistence",
    "notification",
    "payment",
    "ai",
    "target_platform",
  ];

  return {
    readinessScore: Math.min(readiness.score, 100),
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "团队知识库文档管理系统",
    targetUser: context.target_user || "团队成员和管理员",
    platform,
    coreFeatures: [
      `用户角色：${userRoles}`,
      `文档字段：${documentFields}`,
      `目录结构：${folderStructure}`,
      `文档状态：${documentStatus}`,
      `权限规则：${permissionRule}`,
      `搜索范围：${searchScope}`,
      `版本历史：${versionHistory}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildKnowledgeBaseDataModel(database, includeVersionHistory),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "草稿、发布状态、文档可见范围和搜索结果必须在后端校验。",
      "MVP 使用简单 role + document_permissions/visibility，不建议一开始做复杂企业 RBAC。",
    ].join("\n"),
    apiDesign: [
      "POST /api/auth/register - 成员注册",
      "POST /api/auth/login - 成员或管理员登录",
      "POST /api/auth/logout - 退出登录",
      "GET /api/folders - 查询当前用户可见目录",
      "POST /api/folders - 管理员创建目录",
      "PATCH /api/folders/:id - 管理员编辑目录名称或父级目录",
      "POST /api/documents - 登录成员创建 draft 文档",
      "GET /api/documents?folderId=&status= - 查询当前用户有权限查看的文档列表",
      "GET /api/documents/:id - 查看有权限访问的文档详情",
      "PATCH /api/documents/:id - 作者或管理员编辑文档",
      "GET /api/search?q= - 搜索当前用户有权限查看的 published 文档",
      "GET /api/admin/users - 管理员查看成员列表",
      "GET /api/admin/documents?status=&folderId= - 管理员查看全部文档并筛选",
      "PATCH /api/admin/documents/:id/publish - 管理员发布文档",
      "PATCH /api/admin/documents/:id/unpublish - 管理员撤回文档为 draft",
      "PATCH /api/admin/documents/:id/permissions - 管理员设置文档可见范围或成员权限",
    ].join("\n"),
    riskBoundaries: [
      "draft 文档不能出现在普通成员公开列表、搜索结果或无权限详情接口中",
      "published 文档也必须按文档权限和可见范围过滤",
      "文档编辑、发布、撤回和权限设置必须后端鉴权，不能只靠前端隐藏按钮",
      "搜索接口必须复用权限过滤，避免泄露无权限文档标题或正文片段",
      "管理员管理成员、目录和权限的接口必须校验管理员登录态",
    ],
    nonGoals: [
      "MVP 暂不接入 AI",
      "MVP 暂不接入支付",
      "MVP 暂不做复杂企业 RBAC",
      includeVersionHistory ? "MVP 暂不做实时协作编辑" : "MVP 暂不做完整版本历史和实时协作编辑",
    ],
    successCriteria: [
      "成员登录后可以创建 draft 文档并编辑自己有权限的文档",
      "draft 文档仅作者和管理员可见，不出现在普通成员列表和搜索结果中",
      "管理员可以发布、撤回文档并设置文档可见范围",
      "有权限成员可以查看 published 文档，无权限成员不能查看受限文档详情",
      "搜索结果只返回当前用户有权限查看的 published 文档",
      "管理员可以管理成员、目录和全部文档",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "knowledge_base", "high"),
  };
}

function buildCrmSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  if (isSingleUserCrmContext(rawIdea, context)) {
    return buildSingleUserCrmSpec(rawIdea, context, readiness);
  }

  const userRoles = textOrFallback(context.user_roles, "销售登录后创建并维护自己负责的客户；管理员查看全部客户、分配客户和管理销售账号");
  const customerFields = context.customer_fields || "名称、来源、阶段、负责人、备注、下次跟进时间、创建时间、更新时间";
  const contactFields = context.contact_fields || "客户ID、姓名、电话、微信、职位、备注";
  const followupFields = context.followup_fields || "客户ID、跟进人、内容、跟进方式、跟进时间、下次跟进时间";
  const stageRule = context.stage_rule || "客户阶段包含 new、contacted、interested、proposal、won、lost，销售按规则手动更新";
  const assignmentRule = context.assignment_rule || "管理员分配客户给销售；销售只能查看和编辑自己负责的客户";
  const reminderRule = context.reminder_rule || "MVP 先不做通知，只按下次跟进时间筛选即将跟进客户";
  const adminFeatures = context.admin_features || "管理员查看所有客户、按阶段和负责人筛选、分配客户、管理销售账号";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "user_roles",
    "customer_fields",
    "contact_fields",
    "followup_fields",
    "stage_rule",
    "assignment_rule",
    "reminder_rule",
    "admin_features",
    "data_persistence",
    "notification",
    "payment",
    "ai",
    "target_platform",
  ];

  return {
    readinessScore: Math.min(readiness.score, 100),
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "轻量 CRM 客户跟进系统",
    targetUser: context.target_user || "销售人员和管理员",
    platform,
    coreFeatures: [
      `用户角色：${userRoles}`,
      `客户字段：${customerFields}`,
      `联系人字段：${contactFields}`,
      `跟进记录：${followupFields}`,
      `客户阶段：${stageRule}`,
      `负责人分配：${assignmentRule}`,
      `下次跟进：${reminderRule}`,
      `管理后台：${adminFeatures}`,
    ],
    dataModel: buildCrmDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 服务端 Session + 原生 HTML/CSS/JS。`,
      "客户归属、销售可见范围、阶段更新、跟进记录和管理员分配必须在后端校验。",
      "MVP 使用简单 role + owner_id/customer_assignments，不建议一开始做复杂企业 RBAC。",
    ].join("\n"),
    apiDesign: [
      "POST /api/auth/register - 销售注册",
      "POST /api/auth/login - 销售或管理员登录",
      "POST /api/auth/logout - 退出登录",
      "POST /api/customers - 销售创建客户，默认 owner_id 为当前销售",
      "GET /api/customers?stage=&nextFollowupBefore= - 销售查询自己负责的客户",
      "GET /api/customers/:id - 查看有权限访问的客户详情、联系人和跟进记录",
      "PATCH /api/customers/:id - 销售编辑自己负责的客户基础信息、阶段和下次跟进时间",
      "POST /api/customers/:id/contacts - 给有权限的客户新增联系人",
      "POST /api/customers/:id/followups - 给有权限的客户新增跟进记录并可更新下次跟进时间",
      "GET /api/admin/customers?stage=&owner= - 管理员查询全部客户并按阶段和负责人筛选",
      "PATCH /api/admin/customers/:id/assign - 管理员分配客户给销售",
      "GET /api/admin/users - 管理员查看销售账号列表",
    ].join("\n"),
    riskBoundaries: [
      "销售只能查看和编辑自己负责的客户，不能通过客户 ID 越权访问他人客户",
      "管理员分配客户、查看全部客户和管理销售账号必须后端鉴权",
      "客户阶段更新、负责人变更和下次跟进时间必须服务端校验",
      "跟进记录必须保存跟进人、内容、方式和时间，不能被前端伪造归属",
      "客户列表筛选必须按当前用户权限过滤，避免泄露无权限客户",
    ],
    nonGoals: [
      "MVP 暂不接入支付",
      "MVP 暂不接入 AI",
      "MVP 暂不做复杂企业 RBAC",
      "MVP 暂不做短信、邮件或企业微信提醒",
    ],
    successCriteria: [
      "销售登录后可以创建客户并查看自己负责的客户",
      "销售不能查看或编辑其他销售负责的客户",
      "管理员可以查看全部客户并分配客户给销售",
      "客户联系人和跟进记录可以新增并按时间展示",
      "客户阶段和下次跟进时间可以保存和筛选",
      "普通销售不能访问管理员接口",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "crm", "high"),
  };
}

function buildSingleUserCrmSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const customerFields = context.customer_fields || "名称、来源、阶段、备注、下次跟进时间、创建时间、更新时间";
  const contactFields = context.contact_fields || "客户ID、姓名、电话、微信、职位、备注";
  const followupFields = context.followup_fields || "客户ID、内容、跟进方式、跟进时间、下次跟进时间";
  const stageRule = context.stage_rule || "客户阶段包含 new、contacted、interested、proposal、won、lost，可手动更新";
  const reminderRule = context.reminder_rule || "MVP 先不做通知，只按下次跟进时间筛选即将跟进客户";
  const platform = context.platform || context.target_platform || extractPlatform(rawIdea) || "web";
  const database = context.database || "SQLite 或 JSON 文件存储";
  const domainKeys = [
    "user_roles",
    "customer_fields",
    "contact_fields",
    "followup_fields",
    "stage_rule",
    "assignment_rule",
    "reminder_rule",
    "admin_features",
    "data_persistence",
    "notification",
    "payment",
    "ai",
    "target_platform",
    "has_auth",
  ];

  return {
    readinessScore: Math.min(readiness.score, 100),
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable: readiness.score >= 60,
    productGoal: context.product_goal || "个人轻量 CRM 客户跟进工具",
    targetUser: context.target_user || "个人使用者",
    platform,
    coreFeatures: [
      "使用方式：个人单用户使用，不需要销售账号、管理员分配或多角色权限",
      `客户字段：${customerFields}`,
      `联系人字段：${contactFields}`,
      `跟进记录：${followupFields}`,
      `客户阶段：${stageRule}`,
      `下次跟进：${reminderRule}`,
    ],
    dataModel: buildSingleUserCrmDataModel(database),
    architecture: [
      `MVP 推荐单体 Web 后端架构：Node.js/Express + ${database} + 原生 HTML/CSS/JS。`,
      "个人单用户场景默认不需要注册登录、销售账号、管理员后台或客户分配流程。",
      "客户阶段、下次跟进时间和跟进记录仍应在后端或本地持久化层校验，避免数据格式混乱。",
    ].join("\n"),
    apiDesign: [
      "GET /api/customers?stage=&nextFollowupBefore= - 查询客户列表，支持阶段和下次跟进时间筛选",
      "POST /api/customers - 新增客户",
      "GET /api/customers/:id - 查看客户详情、联系人和跟进记录",
      "PATCH /api/customers/:id - 编辑客户基础信息、阶段和下次跟进时间",
      "POST /api/customers/:id/contacts - 新增联系人",
      "POST /api/customers/:id/followups - 新增跟进记录并可更新下次跟进时间",
      "DELETE /api/customers/:id - 删除客户或标记归档",
    ].join("\n"),
    riskBoundaries: [
      "个人单用户版本不要引入销售/管理员多角色模型，避免把轻量工具做成团队系统",
      "客户阶段、联系人电话、下次跟进时间和跟进内容必须做服务端或本地持久化层校验",
      "如果后续部署到公网或多人共用，再补登录、权限和客户归属隔离",
      "删除客户建议优先做归档或二次确认，避免误删跟进记录",
    ],
    nonGoals: [
      "MVP 暂不做销售账号",
      "MVP 暂不做管理员后台和客户分配",
      "MVP 暂不做复杂企业 RBAC",
      "MVP 暂不接入支付、AI 或消息通知",
    ],
    successCriteria: [
      "个人用户可以新增、查看、编辑和删除或归档客户",
      "客户可以保存联系人和多条跟进记录",
      "客户阶段和下次跟进时间可以保存并用于筛选",
      "系统不出现销售账号、管理员分配、客户归属隔离等多角色功能",
      "输入为空、电话格式异常或日期格式异常时有明确提示",
    ],
    assumptions: [],
    inputConsumption: buildInputConsumption(context, domainKeys, "crm", "high"),
  };
}

function normalizeContext(context: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  
  // Positive indicators for boolean fields
  const positiveWords = ["需要", "是", "有", "要", "必须", "true"];
  const negativeWords = ["不需要", "否", "没有", "不要", "false", "都不"];
  
  // Map Chinese answer keys to English keys
  const keyMap: Record<string, string> = {
    "活动数量": "core_features",
    "报名字段": "form_fields",
    "数据存储": "data_persistence",
    "权限": "user_roles",
    "登录": "user_roles",
    "后台": "backend_need",
    "管理": "backend_need",
    "admin_scope": "backend_need",
    "admin_auth": "has_auth",
    "admin_access": "has_auth",
    "支付": "has_payment",
    "第三方": "external_integrations",
  };
  
  // Boolean fields that should be converted from string to boolean
  const booleanFields = ["data_persistence", "user_roles", "backend_need", "need_backend", "has_payment", "has_auth"];
  
  for (const [key, value] of Object.entries(context)) {
    let mappedKey = keyMap[key] || key;
    let mappedValue = value;
    
    // Convert string values to boolean for boolean fields
    if (booleanFields.includes(mappedKey) && typeof value === "string") {
      const lower = value.toLowerCase();
      if (isNegativeBooleanText(lower)) {
        mappedValue = false;
      } else if (positiveWords.some(w => lower.includes(w)) || impliesTrueForField(mappedKey, lower)) {
        mappedValue = true;
      }
    }
    
    normalized[mappedKey] = mappedValue;
  }
  
  // Special handling for specific values
  if (normalized.core_features === "支持多个活动") {
    normalized.core_features = ["活动管理", "报名表单", "数据查看", "Excel导出"];
  }

  const personalLocalTool = isPersonalLocalFrontendToolContext("", normalized);
  const classification = personalLocalTool
    ? { domain: "generic" as const }
    : classifyProductDomain("", normalized);

  if (classification.domain === "content_community") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = false;
  }

  if (classification.domain === "ai_copywriting") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.external_integrations = normalized.external_integrations ?? true;
    normalized.has_ai = true;
    if (normalized.payment_and_quota) normalized.has_payment = true;
  }

  if (classification.domain === "digital_commerce") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = normalized.has_payment ?? true;
  }

  if (classification.domain === "appointment") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = false;
  }

  if (classification.domain === "ticket_workflow") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = false;
  }

  if (classification.domain === "knowledge_base") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = false;
  }

  if (classification.domain === "crm") {
    normalized.need_backend = true;
    normalized.data_persistence = normalized.data_persistence ?? true;
    normalized.user_roles = normalized.user_roles ?? true;
    normalized.backend_need = normalized.backend_need ?? true;
    normalized.has_auth = normalized.has_auth ?? true;
    normalized.has_payment = false;
  }
  
  // Set need_backend if any backend-related field is true
  if (normalized.backend_need === true || normalized.data_persistence === true || normalized.user_roles === true) {
    normalized.need_backend = true;
  }

  if (typeof context.admin_scope === "string" && /后台|列表|筛选|导出|管理/.test(context.admin_scope)) {
    normalized.backend_need = true;
    normalized.need_backend = true;
    normalized.admin_features = context.admin_scope;
  }

  if (typeof context.admin_auth === "string" && /登录|管理员|鉴权|权限/.test(context.admin_auth) && !isNegativeBooleanText(context.admin_auth)) {
    normalized.has_auth = true;
    normalized.user_roles = true;
    normalized.need_backend = true;
  }

  if (typeof context.admin_access === "string" && /登录|管理员|鉴权|权限/.test(context.admin_access) && !isNegativeBooleanText(context.admin_access)) {
    normalized.has_auth = true;
    normalized.user_roles = true;
    normalized.need_backend = true;
  }
  
  return normalized;
}

function isNegativeBooleanText(text: string): boolean {
  return ["不需要", "否", "没有", "不要", "false", "都不"].some((w) => text.includes(w));
}

function impliesTrueForField(field: string, text: string): boolean {
  if (field === "data_persistence") {
    return /保存|存储|本地文件|sqlite|数据库|持久/.test(text);
  }

  if (field === "backend_need") {
    return /后台|管理|列表|筛选|导出|接口|服务端|后端/.test(text);
  }

  if (field === "has_auth" || field === "user_roles") {
    return /登录|鉴权|权限|管理员/.test(text);
  }

  if (field === "has_payment") {
    return /支付|收费|套餐|订单|扣次/.test(text);
  }

  return false;
}

function isAiCopywritingContext(rawIdea: string, context: Record<string, any>): boolean {
  const text = `${rawIdea} ${JSON.stringify(context)}`.toLowerCase();
  if (classifyProductDomain(rawIdea, context).domain === "content_community") return false;
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
  const hasAiCore = /ai|llm|gpt|大模型|模型接口|模型 api|api key|deepseek|openai/.test(text) && !hasNegatedAi(text);
  const hasCopywriting = /文案|小红书|营销内容|生成标题|生成正文|推荐标签/.test(text);

  return aiAnswerKeys.some((key) => context[key] !== undefined) || (hasAiCore && hasCopywriting);
}

function isContentCommunityContext(rawIdea: string, context: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, context).domain === "content_community";
}

function isDigitalCommerceContext(rawIdea: string, context: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, context).domain === "digital_commerce";
}

function isOperationalOrderWorkflowContext(rawIdea: string, context: Record<string, any>): boolean {
  const text = `${rawIdea} ${JSON.stringify(context)}`;
  if (classifyProductDomain(rawIdea, context).domain !== "generic") return false;
  if (/(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(订单|下单|后厨|扫码点餐|菜品)/.test(text)) return false;
  return /(扫码点餐|扫码下单|后厨|菜品|菜单|桌号|订单状态|维护菜品|顾客.{0,6}下单|下单.{0,12}(后厨|订单状态)|后厨.{0,12}(订单|状态))/.test(text);
}

function isAppointmentContext(rawIdea: string, context: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, context).domain === "appointment";
}

function isRegistrationContext(rawIdea: string, context: Record<string, any>): boolean {
  const text = `${rawIdea} ${JSON.stringify(context)}`.toLowerCase();
  if (classifyProductDomain(rawIdea, context).domain !== "registration") return false;
  const explicitlyStatic =
    /作品|作品集|展示|portfolio|静态/.test(text) &&
    (/不需要表单|不需要导出|不需要后台|不需要保存|纯静态/.test(text) ||
      context.need_backend === false ||
      context.backend_need === false ||
      context.data_persistence === false);
  if (explicitlyStatic) return false;

  const hasRegistration = /报名|参会|参赛|登记/.test(text);
  const hasAdminData = /后台|管理员|列表|搜索|筛选/.test(text) || /导出|excel|xlsx/.test(text) && !/不需要导出|无需导出/.test(text);
  return hasRegistration && hasAdminData;
}

function parseListLike(value: unknown, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  const items = String(value)
    .split(/[、,，+＋\/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

function buildRegistrationDataModel(fields: string[], database: string, dedup: string): string {
  const hasName = fields.some((field) => field.includes("姓名") || field.includes("名字"));
  const hasPhone = fields.some((field) => field.includes("手机") || field.includes("电话"));
  const hasAttendees = fields.some((field) => field.includes("人数") || field.includes("数量"));
  const hasNote = fields.some((field) => field.includes("备注") || field.includes("说明"));
  const phoneUnique = /手机|电话/.test(dedup);

  const registrationColumns = [
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
    hasName ? "name TEXT NOT NULL" : "name TEXT",
    hasPhone ? `phone TEXT NOT NULL${phoneUnique ? " UNIQUE" : ""}` : "contact TEXT",
    hasAttendees ? "attendees INTEGER NOT NULL DEFAULT 1 CHECK(attendees >= 1)" : "attendees INTEGER NOT NULL DEFAULT 1",
    hasNote ? "note TEXT DEFAULT ''" : "note TEXT DEFAULT ''",
    "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
  ];

  return [
    `数据库：${database}`,
    `registrations(${registrationColumns.join(", ")})`,
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_registrations_phone(phone)，用于手机号搜索；手机号去重使用 UNIQUE 约束兜底",
  ].join("\n");
}

function buildDigitalCommerceDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "products(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL CHECK(price_cents >= 0), cover_url TEXT, file_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "orders(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payment_provider TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "payments(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE, provider TEXT NOT NULL, provider_trade_no TEXT, amount_cents INTEGER NOT NULL, status TEXT NOT NULL, raw_payload TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "downloads(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, order_id INTEGER NOT NULL, downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ip TEXT)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_orders_user(user_id)，idx_orders_product(product_id)，idx_downloads_user(user_id)，idx_downloads_order(order_id)",
  ].join("\n");
}

function buildOperationalOrderDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "menus(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active')",
    "dishes(id INTEGER PRIMARY KEY AUTOINCREMENT, menu_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL CHECK(price_cents >= 0), status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "orders(id INTEGER PRIMARY KEY AUTOINCREMENT, table_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', total_cents INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "order_items(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, dish_id INTEGER NOT NULL, dish_name TEXT NOT NULL, unit_price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 1), note TEXT DEFAULT '')",
    "staff_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'kitchen', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_orders_status(status)，idx_orders_table(table_code)，idx_order_items_order(order_id)，用于后厨看板和订单详情查询",
  ].join("\n");
}

function buildAppointmentDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "services(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "time_slots(id INTEGER PRIMARY KEY AUTOINCREMENT, service_id INTEGER NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, max_capacity INTEGER NOT NULL CHECK(max_capacity >= 1), status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "bookings(id INTEGER PRIMARY KEY AUTOINCREMENT, booking_code TEXT NOT NULL UNIQUE, service_id INTEGER NOT NULL, time_slot_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_time_slots_service_date(service_id, date)，idx_bookings_slot_status(time_slot_id, status)，用于容量统计和状态筛选",
  ].join("\n");
}

function buildContentCommunityDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "posts(id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', published_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "comments(id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author_id INTEGER NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "reports(id INTEGER PRIMARY KEY AUTOINCREMENT, comment_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, handled_at TEXT)",
    "moderation_actions(id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, action TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_posts_status(status)，idx_posts_author(author_id)，idx_comments_post_status(post_id, status)，idx_reports_status(status)，用于公开内容过滤、后台审核和举报处理",
  ].join("\n");
}

function buildTicketWorkflowDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "tickets(id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL, assignee_id INTEGER, title TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open', due_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "ticket_comments(id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, author_id INTEGER NOT NULL, author_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "ticket_assignments(id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, assignee_id INTEGER NOT NULL, assigned_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "status_history(id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, from_status TEXT, to_status TEXT NOT NULL, actor_id INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_tickets_requester(requester_id)，idx_tickets_assignee_status(assignee_id, status)，idx_tickets_status_priority(status, priority)，idx_ticket_comments_ticket(ticket_id)",
  ].join("\n");
}

function buildKnowledgeBaseDataModel(database: string, includeVersionHistory = false): string {
  const tables = [
    `数据库：${database}`,
    "users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "folders(id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER, name TEXT NOT NULL, created_by INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "documents(id INTEGER PRIMARY KEY AUTOINCREMENT, folder_id INTEGER, author_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', visibility TEXT NOT NULL DEFAULT 'team', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT)",
    "document_permissions(id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, user_id INTEGER, role TEXT, permission TEXT NOT NULL DEFAULT 'read', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  ];
  if (includeVersionHistory) {
    tables.push("document_versions(id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, editor_id INTEGER NOT NULL, title_snapshot TEXT NOT NULL, body_snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  }
  tables.push(
    includeVersionHistory
      ? "建议索引：idx_documents_status(status)，idx_documents_folder(folder_id)，idx_documents_author(author_id)，idx_document_permissions_doc(document_id)，idx_document_versions_doc(document_id)"
      : "建议索引：idx_documents_status(status)，idx_documents_folder(folder_id)，idx_documents_author(author_id)，idx_document_permissions_doc(document_id)，用于权限过滤、目录列表和搜索"
  );
  return tables.join("\n");
}

function buildCrmDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sales', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "customers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, source TEXT, stage TEXT NOT NULL DEFAULT 'new', owner_id INTEGER NOT NULL, note TEXT, next_followup_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "contacts(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, wechat TEXT, position TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "followups(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, user_id INTEGER NOT NULL, content TEXT NOT NULL, method TEXT, followed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, next_followup_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "customer_assignments(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, assigned_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "admin_users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_customers_owner(owner_id)，idx_customers_stage(stage)，idx_customers_next_followup(next_followup_at)，idx_contacts_customer(customer_id)，idx_followups_customer_time(customer_id, followed_at)",
  ].join("\n");
}

function buildSingleUserCrmDataModel(database: string): string {
  return [
    `数据库：${database}`,
    "customers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, source TEXT, stage TEXT NOT NULL DEFAULT 'new', note TEXT, next_followup_at TEXT, archived_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "contacts(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, wechat TEXT, position TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "followups(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, content TEXT NOT NULL, method TEXT, followed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, next_followup_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "建议索引：idx_customers_stage(stage)，idx_customers_next_followup(next_followup_at)，idx_contacts_customer(customer_id)，idx_followups_customer_time(customer_id, followed_at)",
  ].join("\n");
}

function buildInputConsumption(
  context: Record<string, any>,
  domainKeys: string[],
  matchedDomain: string,
  confidence: "high" | "medium" | "low"
): SpecResult["inputConsumption"] {
  const contextKeys = Object.keys(context);
  const consumedAnswers = contextKeys.filter((key) => domainKeys.includes(key));
  const unusedAnswers = contextKeys.filter((key) => !domainKeys.includes(key));

  return {
    consumedAnswers,
    unusedAnswers,
    matchedDomain,
    confidence,
  };
}

function toArray(value: unknown, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  return [String(value)];
}

function buildGenericCoreFeatures(context: Record<string, any>, fallback: string[]): string[] {
  const excluded = new Set([
    "data_persistence",
    "backend_need",
    "need_backend",
    "has_payment",
    "has_auth",
    "external_integrations",
    "payment",
    "ai",
    "target_platform",
    "platform",
  ]);
  const items = Object.entries(context)
    .filter(([key, value]) => !excluded.has(key) && !isNegativeBooleanText(String(value)))
    .map(([key, value]) => `${key}: ${formatAnswerValue(value)}`);

  return items.length > 0 ? items : fallback;
}

function formatAnswerValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join("、");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function wantsKnowledgeBaseVersionHistory(value: unknown): boolean {
  const text = String(value);
  if (/不做|暂不|先不|无需|不需要/.test(text)) return false;
  return /完整版本|版本历史|版本表|回滚|document_versions|保存版本/.test(text);
}

function textOrFallback(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0) return value.map(String).join("、");
  return fallback;
}

function extractGoal(text: string): string {
  const patterns = [
    /(?:想|要|需要|打算)(?:做|开发|创建|实现)(?:一个|一套)?(.+?)(?:系统|平台|工具|应用|网站|页面)/,
    /(.+?)(?:系统|平台|工具|应用|网站)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function extractTargetUser(text: string): string {
  const userKeywords = ["用户", "客户", "学生", "家长", "老师", "管理员", "企业", "参加者", "参与者"];
  for (const kw of userKeywords) {
    if (text.includes(kw)) return kw;
  }
  return "";
}

function inferLocalFirstTargetUser(text: string): string {
  if (/家庭|家里|父母|老人|孩子|家人/.test(text)) return "家庭自用用户";
  if (/个人|自己用|自用|我的/.test(text)) return "个人使用者";
  return "个人使用者";
}

function extractPlatform(text: string): string {
  if (text.includes("小程序")) return "mini_program";
  if (text.includes("app") || text.includes("App")) return "app";
  if (text.includes("后台") && !isNegatedKeyword(text, "后台")) return "backend";
  return "web";
}

function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const featureKeywords = [
    "登录", "注册", "提交", "查看", "管理", "编辑", "删除",
    "搜索", "筛选", "支付", "上传", "下载", "导出", "导入",
    "报名", "表单", "列表", "详情", "审核", "统计", "图表",
    "文章", "帖子", "评论", "举报", "隐藏评论", "下架文章",
    "个人介绍", "作品", "图片", "联系方式", "响应式", "画廊", "展示",
    "资料包", "商品", "订单", "购买", "价格", "文件", "上架", "下架",
    "服务项目", "时间段", "预约", "容量", "取消预约", "排班",
    "名单", "抽签", "分组", "随机", "保存结果",
  ];
  for (const kw of featureKeywords) {
    if (text.includes(kw) && !isNegatedKeyword(text, kw)) features.push(kw);
  }
  return features.length > 0 ? features : ["核心功能"];
}

function buildLocalFirstExtractedFeatures(text: string): string[] {
  const genericFeatures = extractFeatures(text).filter((feature) => feature !== "核心功能" && feature !== "管理");
  const signalProfile = buildLocalToolSignalProfile(text);
  const features = [...genericFeatures, ...signalProfile.featureHints];
  return features.length > 0 ? Array.from(new Set(features)) : ["核心功能"];
}

function isNegatedKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(不接|不做|不用|无需|不需要|暂不|先不|不要|没有).{0,8}${escaped}`, "i").test(text);
}

function buildDataModel(context: Record<string, any>, needsBackend = true, technicalProfile?: TechnicalProfile, rawIdea = ""): string {
  if (technicalProfile?.shape === "static_page") return "无需数据持久化；纯 HTML/CSS/JS 静态展示。";
  if (technicalProfile?.shape === "static_json_data_page") {
    return [
      "静态数据文件：data.json",
      "示例数据：[{ \"id\": \"spot-1\", \"name\": \"示例景点\", \"type\": \"景点\", \"address\": \"示例地址\", \"tags\": [\"亲子\"], \"lat\": 31.2304, \"lng\": 121.4737, \"note\": \"适合半天游览\" }]",
      "前端读取 data.json 后在列表、筛选和地图点位中展示；无需服务器数据库。",
    ].join("\n");
  }
  if (technicalProfile?.shape === "local_json_import_export") {
    const signalProfile = buildLocalToolSignalProfile(rawIdea);
    return [
      "浏览器本地存储 + JSON 文件导入导出",
      "localStorage key 示例：local_tool_records",
      `字段建议：${signalProfile.fieldExample}`,
      `JSON 示例：${buildLocalRecordJsonExample(signalProfile.recordObject, signalProfile.fieldExample)}`,
    ].join("\n");
  }
  if (technicalProfile?.shape === "local_storage_tool") {
    const signalProfile = buildLocalToolSignalProfile(rawIdea);
    return [
      "浏览器本地存储：localStorage",
      "localStorage key 示例：personal_tool_records",
      `字段建议：${signalProfile.fieldExample}`,
      `记录示例：${buildLocalRecordJsonExample(signalProfile.recordObject, signalProfile.fieldExample)}`,
      "无需服务器数据库；后续如数据量较大可升级 IndexedDB。",
    ].join("\n");
  }
  if (context.data_persistence === false) return "无需数据持久化";
  if (isPersonalLocalFrontendToolContext("", context)) return "浏览器本地存储：localStorage 或单个 JSON 文件；无需服务器数据库";
  if (context.database) return `数据库: ${context.database}`;
  if (context.need_backend === false) return "无需数据库";
  if (!needsBackend) return "浏览器本地存储：localStorage 或单个 JSON 文件；无需服务器数据库";
  return "待确认：建议 SQLite（MVP）或 PostgreSQL（生产）";
}

function buildLocalRecordJsonExample(recordObject: string, fieldExample: string): string {
  const labels = fieldExample.split("、").map((item) => item.trim()).filter(Boolean);
  const record: Record<string, string | number | Array<Record<string, string | number>>> = {
    id: "item-1",
  };

  for (const label of labels) {
    if (label.includes("名")) record.name = `示例${recordObject}`;
    else if (label.includes("参与人")) record.participants = [{ id: "p1", name: "张三" }, { id: "p2", name: "李四" }];
    else if (label.includes("付款记录")) record.payments = [{ payerId: "p1", amount: 120, note: "晚餐" }];
    else if (label.includes("应付金额")) record.shareAmount = 60;
    else if (label.includes("转账建议")) record.settlements = [{ from: "p2", to: "p1", amount: 60 }];
    else if (label.includes("数量") || label.includes("库存")) record.quantity = 1;
    else if (label.includes("有效期") || label.includes("到期")) record.expireDate = "2026-12-31";
    else if (label.includes("分类")) record.category = "默认分类";
    else if (label.includes("位置") || label.includes("地点") || label.includes("地址")) record.location = "默认位置";
    else if (label.includes("状态")) record.status = "normal";
    else if (label.includes("金额") || label.includes("价格")) record.amount = 0;
    else if (label.includes("链接")) record.url = "";
    else if (label.includes("备注")) record.note = "备注";
  }

  record.updatedAt = "2026-06-23T00:00:00.000Z";
  return JSON.stringify(record);
}

function buildLocalFirstSuccessCriteria(text: string): string[] {
  const signalProfile = buildLocalToolSignalProfile(text);
  const items = [...signalProfile.acceptanceItems];

  if (signalProfile.featureHints.includes("新增/编辑/删除")) {
    items.push(`${signalProfile.recordObject}记录支持新增、编辑、删除，操作后列表立即更新`);
  }

  if (signalProfile.featureHints.includes("搜索/筛选/分类")) {
    items.push("搜索、分类或状态筛选能准确缩小列表，清空筛选后恢复全部记录");
  }

  items.push("刷新页面后，已保存记录仍能从 localStorage 恢复");

  return Array.from(new Set(items));
}

function buildArchitectureRecommendation(context: Record<string, any>, needsBackend: boolean, technicalProfile?: TechnicalProfile): string {
  if (technicalProfile?.shape === "static_page") return "纯前端架构";
  if (technicalProfile?.shape === "local_storage_tool") return "纯前端本地工具：HTML/CSS/JS + localStorage；适合个人记录、清单、提醒和台账。";
  if (technicalProfile?.shape === "local_json_import_export") return "纯前端本地工具：HTML/CSS/JS + localStorage + JSON/CSV 导入导出；用于备份和迁移数据。";
  if (technicalProfile?.shape === "static_json_data_page") return "静态数据页：HTML/CSS/JS + data.json；如接地图，需要确认地图 provider 和 key 的使用方式。";
  if (context.need_backend === false) return "纯前端架构";
  if (context.backend_need === false) return "纯前端架构";
  if (!needsBackend) return "纯前端架构";
  if (context.need_separation) return "前后分离架构";
  return "建议后端架构";
}

function buildLocalFirstApiDesign(technicalProfile: TechnicalProfile): string {
  if (technicalProfile.shape === "static_json_data_page") {
    return "无需 API（无 REST API）；前端通过 fetch('./data.json') 读取静态数据，并在浏览器内完成搜索、筛选、分类和地图点位展示。";
  }
  if (technicalProfile.shape === "local_json_import_export") {
    return "无需 API（无 REST API）；新增/编辑/删除写入 localStorage，导入导出使用浏览器 File API 读写 JSON/CSV 文件。";
  }
  if (technicalProfile.shape === "static_page") {
    return "无需 API；页面只加载 HTML、CSS、JS 和图片等静态资源。";
  }
  return "无需 API（无 REST API）；数据读写通过 localStorage 完成，例如 personal_tool_records 保存记录数组。";
}

function buildApiDesign(context: Record<string, any>, features: string[]): string {
  if (context.need_backend === false) return "无需 API";
  if (isPersonalLocalFrontendToolContext("", context)) return "纯前端本地工具，无需 API；数据读写通过 localStorage、静态 JSON 或浏览器文件导入导出完成";
  const hasRealFeatures = features.some((f) => f !== "核心功能" && f !== "待用户补充具体功能");
  if (!hasRealFeatures) return "待用户补充具体功能后生成 API 设计";
  return "通用草案不生成正式 API；请先明确英文业务对象后再设计 REST 路径，禁止使用中文 API 路径。";
}

function buildRiskBoundaries(context: Record<string, any>): string[] {
  const risks: string[] = [];
  if (context.has_payment) risks.push("支付回调必须后端处理");
  if (context.has_ai) risks.push("AI API Key 不能暴露在前端");
  if (context.has_auth) risks.push("权限校验不能只靠前端");
  return risks;
}

function hasUnsupportedStructuredAnswers(context: Record<string, any>): boolean {
  const genericKeys = new Set([
    "product_goal",
    "target_user",
    "platform",
    "target_platform",
    "core_features",
    "data_persistence",
    "user_roles",
    "workflow",
    "backend_need",
    "need_backend",
    "external_integrations",
    "success_criteria",
    "non_goals",
    "primary_platform",
    "has_payment",
    "has_auth",
  ]);
  const meaningfulKeys = Object.keys(context).filter((key) => !genericKeys.has(key) && !isNegativeBooleanText(String(context[key])));
  return meaningfulKeys.length >= 3;
}

function readinessStatusFromScore(score: number): SpecResult["readinessStatus"] {
  if (score < 60) return "Not Ready";
  if (score < 80) return "Draft Ready";
  return "Build Ready";
}
