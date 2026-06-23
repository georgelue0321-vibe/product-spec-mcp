import { routeIntent } from "./intentRouter.js";
import { calculateReadiness } from "./specReadiness.js";
import { generateClarification } from "./clarificationEngine.js";
import { formatInterrogateResult } from "./markdownFormatter.js";
import { buildInterrogateStructuredOutput } from "./structuredResultBuilder.js";
import { translateUiDescription } from "./uiPromptEngine.js";
import { formatUiTranslateResult } from "./markdownFormatter.js";
import { buildUiTranslateStructuredOutput } from "./structuredResultBuilder.js";
import { generateDebugGuide } from "./debugEngine.js";
import { formatDebugGuideResult } from "./markdownFormatter.js";
import { buildDebugGuideStructuredOutput } from "./structuredResultBuilder.js";
import { decideArchitecture } from "./architectureEngine.js";
import { formatArchitectureResult } from "./markdownFormatter.js";
import { buildArchitectureStructuredOutput } from "./structuredResultBuilder.js";
import { classifyProductDomain } from "./domainClassifier.js";
import { isPersonalLocalFrontendToolContext } from "./contextSignals.js";
import { buildTechnicalProfile, isLocalFirstProfile, type TechnicalProfile } from "./technicalProfile.js";
import type { SpecInterrogateOutput } from "../schemas/outputs/specInterrogate.output.js";
import type { UiTranslateOutput } from "../schemas/outputs/uiTranslate.output.js";
import type { DebugGuideOutput } from "../schemas/outputs/debugGuide.output.js";
import type { ArchitectureDecideOutput } from "../schemas/outputs/architectureDecide.output.js";

export interface QuickQuestion {
  id: string;
  question: string;
  example?: string;
  whyImportant: string;
  priority: "P0" | "P1" | "P2";
  defaultValue: string;
  mapsTo: string[];
  options: Array<{
    label: string;
    value: string;
    recommended?: boolean;
    description?: string;
  }>;
}

export interface AssistResult {
  routedIntent: {
    intent: string;
    scenario: "build_product" | "modify_ui" | "debug" | "launch" | "unknown";
    confidence: number;
  };
  selectedTool: string | null;
  executed: boolean;
  result?: SpecInterrogateOutput | UiTranslateOutput | DebugGuideOutput | ArchitectureDecideOutput | null;
  nextAction: {
    type:
      | "answer_questions"
      | "compile_spec"
      | "translate_ui"
      | "provide_debug_info"
      | "review_launch_readiness"
      | "choose_tool_manually";
    message: string;
    suggestedTool?: string;
  };
  technicalProfile?: TechnicalProfile;
  quickQuestions: QuickQuestion[];
  agentGuidance: string[];
  markdown: string;
}

export function executeAssist(
  message: string,
  knownContext?: Record<string, unknown>,
  preferredPlatform: string = "unknown",
  strictness: string = "normal",
  autoExecute: boolean = true
): AssistResult {
  const routed = routeIntent(message);
  const platform = detectPlatform(message, preferredPlatform);

  switch (routed.scenario) {
    case "build_product":
      return handleBuildProduct(message, knownContext, strictness, autoExecute, routed as typeof routed & { scenario: "build_product" });

    case "modify_ui":
      return handleModifyUi(message, autoExecute, routed as typeof routed & { scenario: "modify_ui" });

    case "debug":
      return handleDebug(message, platform, knownContext, autoExecute, routed as typeof routed & { scenario: "debug" });

    case "launch":
      return handleLaunch(message, knownContext, routed as typeof routed & { scenario: "launch" });

    default:
      return handleUnknown(routed as typeof routed & { scenario: "unknown" });
  }
}

function detectPlatform(message: string, preferred: string): string {
  if (preferred !== "unknown") return preferred;
  if (message.includes("小程序")) return "mini_program";
  if (message.includes("后端") || message.includes("接口") || message.includes("500") || message.includes("API")) return "backend";
  if (message.includes("构建") || message.includes("build") || message.includes("编译")) return "build";
  return "web";
}

function handleBuildProduct(
  message: string,
  knownContext: Record<string, unknown> | undefined,
  strictness: string,
  autoExecute: boolean,
  routed: { intent: string; scenario: "build_product"; confidence: number }
): AssistResult {
  const technicalProfile = buildTechnicalProfile(message, knownContext || {});
  if (isStaticDisplaySite(message)) {
    return handleStaticDisplaySite(message, autoExecute, routed);
  }

  if (!autoExecute) {
    const quickQuestions = buildProductQuickQuestions(message, knownContext);
    return {
      routedIntent: routed,
      selectedTool: "spec_interrogate",
      executed: false,
      nextAction: {
        type: "answer_questions",
        message: "建议先运行需求追问，了解信息完整度",
        suggestedTool: "spec_interrogate",
      },
      technicalProfile,
      quickQuestions,
      agentGuidance: [
        "只展示 quickQuestions 中的选项，不要自行合并或删改问题。",
        "用户回答选项后，应转换为 known_context 再继续 spec_compile。",
      ],
      markdown: `# 识别到场景：产品开发

**置信度：** ${Math.round(routed.confidence * 100)}%

建议先使用 \`spec_interrogate\` 评估需求完整度。`,
    };
  }

  const readiness = calculateReadiness(message, knownContext);
  const clarification = generateClarification(
    message,
    readiness,
    "build_product",
    "unknown",
    strictness,
    knownContext
  );
  const markdown = formatInterrogateResult(readiness, clarification);
  const structured = buildInterrogateStructuredOutput(readiness, clarification, technicalProfile);
  const domainClassification = classifyProductDomain(message, knownContext || {});
  const quickQuestions = buildProductQuickQuestions(message, knownContext);
  const domainPackWarning = domainClassification.domain === "generic"
    ? "\n\n> ⚠️ 当前只识别为产品开发意图，但未命中稳定 domain pack。后续 `spec_compile` 应作为草案处理，不要静默套用报名、电商、预约、内容社区、工单、知识库或 CRM 模板。"
    : "";

  return {
    routedIntent: routed,
    selectedTool: "spec_interrogate",
    executed: true,
    result: structured,
    nextAction: {
      type: structured.recommendation.canProceed ? "compile_spec" : "answer_questions",
      message: structured.recommendation.reason,
      suggestedTool: structured.recommendation.suggestedNextTool,
    },
    technicalProfile,
    quickQuestions,
    agentGuidance: [
      "优先直接展示 quickQuestions，避免二次改写导致选项语义变化。",
      "不要把用户端登录和后台管理员登录合并成同一个字段。",
      "如果用户只需要导出，不要擅自扩展成完整后台管理系统。",
      ...(domainClassification.domain === "generic"
        ? ["未命中稳定 domain pack 时，应先澄清核心业务对象、状态流转和权限边界，不要套用其它 domain 模板。"]
        : []),
    ],
    markdown: `# 识别到场景：产品开发

**置信度：** ${Math.round(routed.confidence * 100)}%
${domainPackWarning}

## 快速确认问题

${formatQuickQuestions(quickQuestions)}

${markdown}`,
  };
}

function handleStaticDisplaySite(
  message: string,
  autoExecute: boolean,
  routed: { intent: string; scenario: "build_product"; confidence: number }
): AssistResult {
  const technicalProfile = buildTechnicalProfile(message, {});
  const quickQuestions = withQuestionExamples(buildStaticDisplayQuickQuestions());
  const agentGuidance = [
    "这是静态展示站场景，不要套用表单、后台、导出、去重等业务系统追问。",
    "默认按纯前端静态网站处理，除非用户明确提出表单、登录、支付或后台。",
    "如需继续生成规格，应把 data_persistence、backend_need、user_roles 显式设为 false。",
    "用户回答 quickQuestions 选项后，先调用 spec_compile 固化规格；不要直接创建项目文件。",
  ];

  if (!autoExecute) {
    return {
      routedIntent: routed,
      selectedTool: "architecture_decide",
      executed: false,
      nextAction: {
        type: "compile_spec",
        message: "这是静态展示站，建议先确认展示内容和视觉风格",
        suggestedTool: "spec_compile",
      },
      technicalProfile,
      quickQuestions,
      agentGuidance,
      markdown: `# 识别到场景：静态展示网站

**置信度：** ${Math.round(routed.confidence * 100)}%

## 快速确认问题

${formatQuickQuestions(quickQuestions)}

## 下一步

用户回答选项后，请先调用 \`spec_compile\` 固化开发规格，不要直接创建项目文件。`,
    };
  }

  const decision = decideArchitecture(
    "个人作品静态展示网站",
    "web",
    ["个人介绍展示", "作品图片展示", "联系方式展示", "响应式设计", "高级视觉设计"],
    false,
    "individual"
  );
  const markdown = formatArchitectureResult(decision);
  const structured = buildArchitectureStructuredOutput(decision);

  return {
    routedIntent: routed,
    selectedTool: "architecture_decide",
    executed: true,
    result: structured,
    nextAction: {
      type: "compile_spec",
      message: "可按纯前端静态网站生成规格；先确认展示内容、联系方式和视觉风格",
      suggestedTool: "spec_compile",
    },
    technicalProfile,
    quickQuestions,
    agentGuidance,
    markdown: `# 识别到场景：静态展示网站

**置信度：** ${Math.round(routed.confidence * 100)}%

## 快速确认问题

${formatQuickQuestions(quickQuestions)}

## 下一步

用户回答选项后，请先调用 \`spec_compile\` 固化开发规格，不要直接创建项目文件。

${markdown}`,
  };
}

function handleModifyUi(
  message: string,
  autoExecute: boolean,
  routed: { intent: string; scenario: "modify_ui"; confidence: number }
): AssistResult {
  if (!autoExecute) {
    return {
      routedIntent: routed,
      selectedTool: "ui_translate",
      executed: false,
      nextAction: {
        type: "translate_ui",
        message: "建议运行 UI 术语翻译",
        suggestedTool: "ui_translate",
      },
      quickQuestions: [],
      agentGuidance: ["只翻译 UI 修改意图，不要擅自改业务需求或创建文件。"],
      markdown: `# 识别到场景：UI 修改

**置信度：** ${Math.round(routed.confidence * 100)}%

建议使用 \`ui_translate\` 将口语描述转换为前端术语。`,
    };
  }

  const translation = translateUiDescription(message);
  const markdown = formatUiTranslateResult(translation);
  const structured = buildUiTranslateStructuredOutput(translation);

  return {
    routedIntent: routed,
    selectedTool: "ui_translate",
    executed: true,
    result: structured,
    nextAction: {
      type: "translate_ui",
      message: "把生成的修改 Prompt 交给代码 Agent 执行",
    },
    quickQuestions: [],
    agentGuidance: [
      "只翻译 UI 修改意图，不要擅自改业务需求或创建文件。",
      "把修改 Prompt 交给代码 Agent 前，应保留原始页面和目标区域信息。",
    ],
    markdown: `# 识别到场景：UI 修改

**置信度：** ${Math.round(routed.confidence * 100)}%

${markdown}`,
  };
}

function handleDebug(
  message: string,
  platform: string,
  knownContext: Record<string, unknown> | undefined,
  autoExecute: boolean,
  routed: { intent: string; scenario: "debug"; confidence: number }
): AssistResult {
  if (!autoExecute) {
    return {
      routedIntent: routed,
      selectedTool: "debug_guide",
      executed: false,
      nextAction: {
        type: "provide_debug_info",
        message: "建议运行 Debug 指引",
        suggestedTool: "debug_guide",
      },
      quickQuestions: [],
      agentGuidance: ["先收集 Console、Network、后端日志等证据，不要凭空猜测原因。"],
      markdown: `# 识别到场景：Debug 排查

**置信度：** ${Math.round(routed.confidence * 100)}%

建议使用 \`debug_guide\` 获取排查清单。`,
    };
  }

  const guide = generateDebugGuide(platform, message, knownContext);
  const markdown = formatDebugGuideResult(guide);
  const structured = buildDebugGuideStructuredOutput(guide);

  return {
    routedIntent: routed,
    selectedTool: "debug_guide",
    executed: true,
    result: structured,
    nextAction: {
      type: "provide_debug_info",
      message: structured.canDiagnoseNow
        ? "信息充足，可以开始排查"
        : "请先补充缺失的排查信息",
    },
    quickQuestions: [],
    agentGuidance: ["先让用户补齐缺失排查信息；没有证据时不要直接改代码。"],
    markdown: `# 识别到场景：Debug 排查

**平台：** ${platform}
**置信度：** ${Math.round(routed.confidence * 100)}%

${markdown}`,
  };
}

function handleLaunch(
  message: string,
  knownContext: Record<string, unknown> | undefined,
  routed: { intent: string; scenario: "launch"; confidence: number }
): AssistResult {
  const quickQuestions = buildLaunchQuickQuestions(message, knownContext);

  return {
    routedIntent: routed,
    selectedTool: null,
    executed: false,
    nextAction: {
      type: "review_launch_readiness",
      message: "上线前需要补充以下信息",
    },
    quickQuestions,
    agentGuidance: [
      "这是咨询式上线检查，不要主动搜索本地文件。",
      "不要创建任务列表或 Markdown 文件，除非用户明确要求。",
      "不要声称上线已就绪；先收集 quickQuestions 中的关键信息。",
      "如果用户明确要求检查当前项目，再读取项目文件并做实际上线审查。",
    ],
    markdown: `# 识别到场景：上线部署

**置信度：** ${Math.round(routed.confidence * 100)}%

## 上线前缺口检查

上线前需要确认以下信息：

${formatQuickQuestions(quickQuestions)}

## Agent 行为边界

- 先回答上线注意事项，不要主动搜索本地文件。
- 不要创建任务列表或 Markdown 文件，除非用户明确要求。
- 不要声称上线已就绪；需要先确认上述问题。
- 如果用户明确说“帮我检查这个项目”，再读取项目文件做真实审查。

建议先使用 \`acceptance_generate\` 生成验收清单，确保所有功能验证通过后再上线。`,
  };
}

function handleUnknown(
  routed: { intent: string; scenario: "unknown"; confidence: number }
): AssistResult {
  return {
    routedIntent: routed,
    selectedTool: null,
    executed: false,
    nextAction: {
      type: "choose_tool_manually",
      message: "无法识别场景，请选择工具或重新描述",
    },
    quickQuestions: [],
    agentGuidance: ["场景不明确时先澄清，不要擅自创建文件或执行项目操作。"],
    markdown: `# 无法识别场景

**置信度：** ${Math.round(routed.confidence * 100)}%

请根据您的需求选择合适的工具：

| 需求 | 推荐工具 |
|------|----------|
| 描述新产品想法 | \`spec_interrogate\` |
| 生成开发规格 | \`spec_compile\` |
| 修改页面 UI | \`ui_translate\` |
| 程序报错排查 | \`debug_guide\` |
| 生成验收标准 | \`acceptance_generate\` |
| 判断架构方案 | \`architecture_decide\` |

或者重新描述您的需求，我会尝试自动识别。`,
  };
}

function buildProductQuickQuestions(message: string, knownContext?: Record<string, unknown>): QuickQuestion[] {
  const contextText = buildContextSearchText(message, knownContext);
  const domain = classifyProductDomain(contextText, knownContext || {}).domain;
  const technicalProfile = buildTechnicalProfile(message, knownContext || {});

  if (domain === "generic" && isLocalFirstProfile(technicalProfile)) {
    return withQuestionExamples(buildLocalFirstQuickQuestions(technicalProfile));
  }

  if (domain === "crm") {
    return withQuestionExamples(buildCrmQuickQuestions());
  }

  if (domain === "knowledge_base") {
    return withQuestionExamples(buildKnowledgeBaseQuickQuestions());
  }

  if (domain === "ticket_workflow") {
    return withQuestionExamples(buildTicketWorkflowQuickQuestions());
  }

  if (domain === "content_community") {
    return withQuestionExamples(buildContentCommunityQuickQuestions());
  }

  if (domain === "appointment") {
    return withQuestionExamples(buildAppointmentQuickQuestions());
  }

  if (domain === "digital_commerce") {
    return withQuestionExamples(buildDigitalCommerceQuickQuestions());
  }

  if (domain === "ai_copywriting") {
    return withQuestionExamples([
      {
        id: "generation_output",
        question: "一次生成几条文案，每条包含什么？",
        whyImportant: "决定生成体验、Token 成本和扣次规则。",
        priority: "P0",
        defaultValue: "three_variants",
        mapsTo: ["generation_output_spec", "core_features"],
        options: [
          { label: "3 条：标题 + 正文 + 标签", value: "three_variants", recommended: true },
          { label: "1 条完整文案", value: "single_copy" },
          { label: "5 条以上批量生成", value: "batch_variants" },
        ],
      },
      {
        id: "llm_provider",
        question: "准备用哪个 AI 模型或 API？",
        whyImportant: "决定后端代理、成本测算、限流和失败重试。",
        priority: "P0",
        defaultValue: "pluggable_provider",
        mapsTo: ["llm_provider", "external_integrations", "backend_need"],
        options: [
          { label: "先做可替换模型接口", value: "pluggable_provider", recommended: true },
          { label: "国内模型", value: "domestic_model" },
          { label: "海外模型", value: "overseas_model" },
        ],
      },
      {
        id: "account_and_auth",
        question: "用户是否需要登录后才能生成？",
        whyImportant: "次数套餐必须绑定账号，否则无法做余额、订单和历史记录。",
        priority: "P0",
        defaultValue: "trial_then_login",
        mapsTo: ["user_roles", "account_and_auth"],
        options: [
          { label: "免登录试用，购买前登录", value: "trial_then_login", recommended: true },
          { label: "必须登录后使用", value: "login_required" },
          { label: "完全免登录", value: "anonymous_only" },
        ],
      },
      {
        id: "payment_and_quota",
        question: "收费和扣次规则怎么设计？",
        whyImportant: "决定订单、套餐、余额、退款和防刷逻辑。",
        priority: "P0",
        defaultValue: "manual_quota_mvp",
        mapsTo: ["payment_and_quota", "external_integrations"],
        options: [
          { label: "先人工收款发放次数", value: "manual_quota_mvp", recommended: true },
          { label: "微信/支付宝在线支付", value: "online_payment" },
          { label: "按次套餐 + 月订阅", value: "package_subscription" },
        ],
      },
      {
        id: "content_safety",
        question: "是否需要小红书内容安全规则？",
        whyImportant: "营销文案容易涉及违禁词、夸大承诺和敏感行业。",
        priority: "P1",
        defaultValue: "basic_safety",
        mapsTo: ["content_safety", "success_criteria"],
        options: [
          { label: "基础敏感词 + 风险提示", value: "basic_safety", recommended: true },
          { label: "内置较完整规则库", value: "full_rule_set" },
          { label: "MVP 先不做", value: "none" },
        ],
      },
    ]);
  }

  const isFormLike = domain === "registration";

  if (!isFormLike) {
    return withQuestionExamples([
      {
        id: "mvp_scope",
        question: "第一版 MVP 只做哪些功能？",
        whyImportant: "控制范围，避免一开始做得过大。",
        priority: "P0",
        defaultValue: "core_only",
        mapsTo: ["core_features", "non_goals"],
        options: [
          { label: "只做核心功能", value: "core_only", recommended: true },
          { label: "包含管理功能", value: "with_admin" },
          { label: "包含商业化功能", value: "with_commercial" },
        ],
      },
      {
        id: "data_storage",
        question: "是否需要保存用户数据？",
        whyImportant: "决定是否需要后端和数据库。",
        priority: "P0",
        defaultValue: "database",
        mapsTo: ["data_persistence", "database"],
        options: [
          { label: "需要数据库", value: "database", recommended: true },
          { label: "本地文件即可", value: "local_file" },
          { label: "不需要保存", value: "none" },
        ],
      },
      {
        id: "primary_platform",
        question: "主要使用场景是什么？",
        whyImportant: "决定页面布局和交互优先级。",
        priority: "P1",
        defaultValue: "mobile_first",
        mapsTo: ["primary_platform", "platform"],
        options: [
          { label: "手机端为主", value: "mobile_first", recommended: true },
          { label: "桌面端为主", value: "desktop_first" },
          { label: "两端都要", value: "responsive" },
        ],
      },
    ]);
  }

  return withQuestionExamples([
    {
      id: "data_storage",
      question: "报名数据怎么保存？",
      whyImportant: "决定是否需要后端、数据库和备份策略。",
      priority: "P0",
      defaultValue: "database",
      mapsTo: ["data_persistence", "database"],
      options: [
        { label: "数据库持久化", value: "database", recommended: true },
        {
          label: "本地文件存储",
          value: "local_file",
          description: "适合单机轻量 MVP；SQLite 也属于本地文件。",
        },
        { label: "不需要保存", value: "none" },
      ],
    },
    {
      id: "user_login",
      question: "报名用户需要登录吗？",
      whyImportant: "决定用户端是否需要账号体系。",
      priority: "P0",
      defaultValue: "none",
      mapsTo: ["user_login", "user_roles"],
      options: [
        { label: "不需要，填表直接提交", value: "none", recommended: true },
        { label: "需要登录/注册", value: "end_user_login" },
      ],
    },
    {
      id: "admin_scope",
      question: "管理员需要什么后台能力？",
      whyImportant: "决定是完整管理后台，还是只做导出入口。",
      priority: "P0",
      defaultValue: "list_filter_export",
      mapsTo: ["backend_need", "admin_scope", "core_features"],
      options: [
        { label: "看列表 + 筛选 + 导出", value: "list_filter_export", recommended: true },
        { label: "只需要导出 Excel", value: "export_only" },
        { label: "暂不需要后台", value: "none" },
      ],
    },
    {
      id: "workflow",
      question: "提交后需要审核吗？",
      whyImportant: "决定是否需要状态流转和审核模块。",
      priority: "P0",
      defaultValue: "submit_complete",
      mapsTo: ["workflow"],
      options: [
        { label: "提交即完成", value: "submit_complete", recommended: true },
        { label: "需要审核通过", value: "review_required" },
        { label: "需要多级审核", value: "multi_step_review" },
      ],
    },
    {
      id: "primary_platform",
      question: "主要使用场景是什么？",
      whyImportant: "决定 UI 布局和响应式策略。",
      priority: "P1",
      defaultValue: "mobile_first",
      mapsTo: ["primary_platform", "platform"],
      options: [
        { label: "手机端为主", value: "mobile_first", recommended: true },
        { label: "桌面端为主", value: "desktop_first" },
        { label: "两端都要", value: "responsive" },
      ],
    },
    {
      id: "dedup_strategy",
      question: "如何防止重复提交？",
      whyImportant: "决定去重逻辑和用户提示。",
      priority: "P1",
      defaultValue: "phone",
      mapsTo: ["dedup_strategy"],
      options: [
        { label: "手机号去重", value: "phone", recommended: true },
        { label: "姓名 + 电话去重", value: "name_phone" },
        { label: "不限制重复", value: "none" },
      ],
    },
    {
      id: "admin_auth",
      question: "导出或后台入口谁能访问？",
      whyImportant: "决定管理员鉴权方案。",
      priority: "P0",
      defaultValue: "admin_login",
      mapsTo: ["admin_access", "admin_auth"],
      options: [
        { label: "管理员登录才能访问", value: "admin_login", recommended: true },
        { label: "有链接就能访问", value: "link_only", description: "简单但不安全" },
        { label: "邀请码/访问密码", value: "access_code" },
      ],
    },
    {
      id: "third_party",
      question: "是否需要第三方服务？",
      whyImportant: "决定支付、短信、微信或 API Key 的安全边界。",
      priority: "P1",
      defaultValue: "none",
      mapsTo: ["external_integrations"],
      options: [
        { label: "都不需要", value: "none", recommended: true },
        { label: "短信通知", value: "sms" },
        { label: "微信登录/支付", value: "wechat" },
        { label: "其他第三方 API", value: "other_api" },
      ],
    },
  ]);
}

function buildLocalFirstQuickQuestions(technicalProfile: TechnicalProfile): QuickQuestion[] {
  const storageDefault = technicalProfile.shape === "static_json_data_page"
    ? "static_json"
    : technicalProfile.shape === "local_json_import_export"
    ? "local_file"
    : "local_storage";

  const questions: QuickQuestion[] = [
    {
      id: "record_object",
      question: "你想记录或展示什么东西？",
      example: "比如食材、药品、游戏、装备、保单，或景点、酒店、美食。",
      whyImportant: "先确认核心对象，避免被扩成后台系统。",
      priority: "P0",
      defaultValue: "personal_records",
      mapsTo: ["core_features", "record_object"],
      options: [
        { label: "个人记录/清单", value: "personal_records", recommended: true },
        { label: "地图或资料列表", value: "static_data_list" },
        { label: "计算/统计工具", value: "calculator_stats" },
      ],
    },
    {
      id: "record_items",
      question: "每条记录要保存哪些信息？",
      example: "比如名称、数量、日期、状态、分类、备注。",
      whyImportant: "决定页面表单、列表列名和本地 JSON 数据结构。",
      priority: "P0",
      defaultValue: "name_date_status_note",
      mapsTo: ["item_fields", "data_model"],
      options: [
        { label: "名称 + 日期 + 状态 + 备注", value: "name_date_status_note", recommended: true },
        { label: "再加数量/金额/分类", value: "with_amount_category" },
        { label: "我会自定义", value: "custom_fields" },
      ],
    },
    {
      id: "data_storage",
      question: "数据保存在哪里？",
      example: "比如只存在浏览器里，或导出一个 JSON 文件备份到电脑。",
      whyImportant: "决定是否需要后端；个人本地小工具默认不需要服务器数据库。",
      priority: "P0",
      defaultValue: "local_file",
      mapsTo: ["data_persistence", "database", "backend_need"],
      options: [
        { label: "浏览器本地保存/localStorage", value: "local_storage", recommended: storageDefault === "local_storage" },
        { label: "导入导出 JSON/CSV 文件", value: "local_file", recommended: storageDefault !== "local_storage" },
        { label: "手写 data.json 展示", value: "static_json" },
      ],
    },
    {
      id: "operations",
      question: "需要哪些操作？",
      example: "比如新增、编辑、删除、搜索、筛选、分类。",
      whyImportant: "决定第一版功能范围和验收标准。",
      priority: "P0",
      defaultValue: "crud_search_filter",
      mapsTo: ["core_features", "success_criteria"],
      options: [
        { label: "新增/编辑/删除 + 搜索筛选", value: "crud_search_filter", recommended: true },
        { label: "只展示和筛选", value: "view_filter_only" },
        { label: "再加提醒/统计", value: "with_reminder_stats" },
      ],
    },
    {
      id: "login_need",
      question: "需要登录、后台或管理员吗？",
      example: "比如完全不用登录，或以后几个人用时再加账号。",
      whyImportant: "决定是否要引入服务器程序、登录和权限校验。",
      priority: "P0",
      defaultValue: "none",
      mapsTo: ["user_roles", "admin_access", "backend_need"],
      options: [
        { label: "不需要，自己本地用", value: "none", recommended: true },
        { label: "只加本地访问密码", value: "local_password" },
        { label: "需要多人账号/后台", value: "multi_user_admin" },
      ],
    },
    {
      id: "sensitive_info",
      question: "会不会保存敏感信息？",
      example: "比如真实密码、身份证、银行卡、完整手机号。",
      whyImportant: "敏感信息不建议明文存在浏览器里，需要提醒风险。",
      priority: "P1",
      defaultValue: "none",
      mapsTo: ["risk_boundaries", "non_goals"],
      options: [
        { label: "不保存敏感信息", value: "none", recommended: true },
        { label: "有少量联系方式", value: "contact_info" },
        { label: "有密码/证件等敏感信息", value: "sensitive" },
      ],
    },
  ];

  if (technicalProfile.shape === "static_json_data_page") {
    questions.splice(2, 0, {
      id: "map_provider",
      question: "需要地图吗？",
      example: "比如高德地图、Google Maps，或 Leaflet/OpenStreetMap。",
      whyImportant: "决定是否需要地图服务、坐标和第三方 key。",
      priority: "P1",
      defaultValue: "leaflet_osm",
      mapsTo: ["map_provider", "external_integrations"],
      options: [
        { label: "Leaflet/OpenStreetMap", value: "leaflet_osm", recommended: true },
        { label: "高德地图", value: "amap" },
        { label: "先不接地图，只做列表", value: "list_only" },
      ],
    });
  }

  return questions;
}

function buildAppointmentQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "service_catalog",
      question: "需要支持哪些服务项目？",
      whyImportant: "决定服务项目表、预约入口和后台可配置内容。",
      priority: "P0",
      defaultValue: "basic_services",
      mapsTo: ["service_catalog", "core_features"],
      options: [
        { label: "名称 + 简介 + 时长 + 可预约状态", value: "basic_services", recommended: true },
        { label: "再加价格/分类/服务人员", value: "with_staff_price" },
        { label: "先固定一个服务", value: "single_service" },
      ],
    },
    {
      id: "time_slot_rule",
      question: "可预约时间段怎么设置？",
      whyImportant: "决定时间段数据模型、后台排班和用户选择方式。",
      priority: "P0",
      defaultValue: "admin_slots",
      mapsTo: ["time_slot_rule", "workflow"],
      options: [
        { label: "管理员设置日期、开始/结束时间", value: "admin_slots", recommended: true },
        { label: "按固定周期自动生成", value: "recurring_slots" },
        { label: "先写死几个时间段", value: "fixed_slots" },
      ],
    },
    {
      id: "capacity_rule",
      question: "每个时间段的人数怎么限制？",
      whyImportant: "容量必须后端校验，否则会出现超卖式重复预约。",
      priority: "P0",
      defaultValue: "slot_capacity",
      mapsTo: ["capacity_rule", "risk_boundaries"],
      options: [
        { label: "每个时间段有最大预约人数", value: "slot_capacity", recommended: true },
        { label: "每个服务单独设置容量", value: "service_slot_capacity" },
        { label: "不限制人数", value: "unlimited" },
      ],
    },
    {
      id: "booking_status",
      question: "预约需要哪些状态？",
      whyImportant: "决定后台筛选、取消预约和后续通知的状态流转。",
      priority: "P0",
      defaultValue: "pending_confirmed_cancelled",
      mapsTo: ["booking_status", "workflow"],
      options: [
        { label: "pending / confirmed / cancelled", value: "pending_confirmed_cancelled", recommended: true },
        { label: "只区分有效/取消", value: "active_cancelled" },
        { label: "再加已完成/爽约", value: "with_completed_no_show" },
      ],
    },
    {
      id: "cancel_rule",
      question: "用户如何取消预约？",
      whyImportant: "取消会影响容量释放、状态变更和用户身份校验。",
      priority: "P0",
      defaultValue: "phone_booking_code",
      mapsTo: ["cancel_rule", "success_criteria"],
      options: [
        { label: "手机号 + 预约号取消", value: "phone_booking_code", recommended: true },
        { label: "登录后在我的预约里取消", value: "login_cancel" },
        { label: "MVP 暂不支持取消", value: "none" },
      ],
    },
    {
      id: "admin_schedule",
      question: "后台需要哪些排班和预约管理能力？",
      whyImportant: "决定管理员后台、鉴权和列表筛选范围。",
      priority: "P0",
      defaultValue: "services_slots_bookings",
      mapsTo: ["admin_features", "backend_need", "has_auth"],
      options: [
        { label: "管理服务 + 时间段 + 预约列表", value: "services_slots_bookings", recommended: true },
        { label: "只管理时间段和预约列表", value: "slots_bookings" },
        { label: "先不做后台", value: "none" },
      ],
    },
    {
      id: "notification",
      question: "预约确认信息怎么通知用户？",
      whyImportant: "决定是否需要短信、微信或邮件等第三方服务。",
      priority: "P1",
      defaultValue: "page_confirmation",
      mapsTo: ["notification", "external_integrations"],
      options: [
        { label: "MVP 先页面提示", value: "page_confirmation", recommended: true },
        { label: "短信通知", value: "sms" },
        { label: "微信/邮件通知", value: "wechat_or_email" },
      ],
    },
  ];
}

function buildDigitalCommerceQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "product_catalog",
      question: "资料包需要哪些商品信息？",
      whyImportant: "决定商品表、详情页、后台上架字段和价格展示。",
      priority: "P0",
      defaultValue: "basic_catalog",
      mapsTo: ["product_catalog", "core_features", "data_persistence"],
      options: [
        { label: "标题 + 简介 + 价格 + 封面 + 文件", value: "basic_catalog", recommended: true },
        { label: "再加分类/标签/库存", value: "catalog_with_taxonomy" },
        { label: "先固定几个资料包", value: "fixed_products" },
      ],
    },
    {
      id: "order_flow",
      question: "购买流程怎么走？",
      whyImportant: "决定订单状态、支付状态和下载权限的状态流转。",
      priority: "P0",
      defaultValue: "order_pay_download",
      mapsTo: ["order_flow", "workflow"],
      options: [
        { label: "下单 -> 支付 -> 下载", value: "order_pay_download", recommended: true },
        { label: "先人工确认付款", value: "manual_confirm" },
        { label: "先只做免费领取", value: "free_download" },
      ],
    },
    {
      id: "payment_provider",
      question: "第一版支付怎么处理？",
      whyImportant: "决定是否接真实支付、是否需要回调验签和订单幂等。",
      priority: "P0",
      defaultValue: "mock_payment",
      mapsTo: ["payment_provider", "external_integrations", "has_payment"],
      options: [
        { label: "MVP 先用 mock 支付", value: "mock_payment", recommended: true },
        { label: "微信/支付宝在线支付", value: "online_payment" },
        { label: "人工收款后发放权限", value: "manual_payment" },
      ],
    },
    {
      id: "payment_confirmation",
      question: "支付成功以什么为准？",
      whyImportant: "不能只靠前端跳转判断支付成功，否则会被绕过。",
      priority: "P0",
      defaultValue: "backend_confirmed",
      mapsTo: ["payment_confirmation", "risk_boundaries"],
      options: [
        { label: "以后端确认/订单查询为准", value: "backend_confirmed", recommended: true },
        { label: "以后端支付回调为准", value: "payment_callback" },
        { label: "暂时 mock 成功", value: "mock_confirmed" },
      ],
    },
    {
      id: "download_permission",
      question: "支付成功后如何开放下载？",
      whyImportant: "决定下载接口权限校验，避免未付款用户直接拿到文件。",
      priority: "P0",
      defaultValue: "paid_order_only",
      mapsTo: ["download_permission", "has_auth"],
      options: [
        { label: "登录用户已支付才可下载", value: "paid_order_only", recommended: true },
        { label: "支付后生成一次性下载链接", value: "signed_url" },
        { label: "人工发送下载链接", value: "manual_delivery" },
      ],
    },
    {
      id: "admin_features",
      question: "管理员需要哪些后台能力？",
      whyImportant: "决定后台页面、管理员鉴权和操作日志范围。",
      priority: "P0",
      defaultValue: "products_orders_downloads",
      mapsTo: ["admin_features", "backend_need", "has_auth"],
      options: [
        { label: "上架资料 + 看订单 + 看下载记录", value: "products_orders_downloads", recommended: true },
        { label: "只看订单和手工发货", value: "orders_manual_delivery" },
        { label: "先不做后台", value: "none" },
      ],
    },
    {
      id: "account_and_auth",
      question: "购买和下载前需要登录吗？",
      whyImportant: "下载权限必须绑定用户或订单，否则无法防止转发绕过。",
      priority: "P0",
      defaultValue: "login_required",
      mapsTo: ["account_and_auth", "user_roles"],
      options: [
        { label: "购买/下载前需要登录", value: "login_required", recommended: true },
        { label: "免登录，用订单号校验", value: "order_code" },
        { label: "完全免登录", value: "anonymous", description: "不建议用于付费资料" },
      ],
    },
  ];
}

function buildContentCommunityQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "user_roles",
      question: "用户和管理员分别能做什么？",
      whyImportant: "决定普通用户权限、管理员后台和服务端鉴权边界。",
      priority: "P0",
      defaultValue: "users_publish_comment_report_admin_moderates",
      mapsTo: ["user_roles", "has_auth", "backend_need"],
      options: [
        { label: "用户发布/评论/举报，管理员审核/隐藏/下架", value: "users_publish_comment_report_admin_moderates", recommended: true },
        { label: "只允许用户投稿，评论后续再做", value: "posts_only" },
        { label: "先不开放注册，只做管理员发布", value: "admin_only_publish" },
      ],
    },
    {
      id: "content_model",
      question: "文章和评论需要哪些字段？",
      whyImportant: "决定 posts、comments 表结构和前后台展示字段。",
      priority: "P0",
      defaultValue: "post_title_body_author_status_comments",
      mapsTo: ["content_model", "data_persistence"],
      options: [
        { label: "文章标题/正文/作者/状态，评论文章ID/作者/内容/状态", value: "post_title_body_author_status_comments", recommended: true },
        { label: "再加封面/分类/标签", value: "with_taxonomy" },
        { label: "先只做文章，不做评论", value: "posts_only" },
      ],
    },
    {
      id: "publish_flow",
      question: "文章发布后如何公开？",
      whyImportant: "决定审核状态流转，避免未审核内容直接公开。",
      priority: "P0",
      defaultValue: "pending_then_approved",
      mapsTo: ["publish_flow", "workflow"],
      options: [
        { label: "提交后 pending，管理员通过后公开", value: "pending_then_approved", recommended: true },
        { label: "可信用户直接公开，普通用户需审核", value: "trusted_user_fast_path" },
        { label: "先全部直接公开", value: "direct_publish" },
      ],
    },
    {
      id: "comment_flow",
      question: "评论如何展示和处理？",
      whyImportant: "决定评论发布权限、隐藏状态和前台可见范围。",
      priority: "P0",
      defaultValue: "login_comment_admin_hide",
      mapsTo: ["comment_flow"],
      options: [
        { label: "登录用户评论，管理员可隐藏", value: "login_comment_admin_hide", recommended: true },
        { label: "评论也需要先审核", value: "comment_pending_review" },
        { label: "MVP 暂不做评论", value: "no_comments" },
      ],
    },
    {
      id: "report_flow",
      question: "举报和违规处理怎么做？",
      whyImportant: "决定 reports、moderation_actions 表和后台处理入口。",
      priority: "P1",
      defaultValue: "users_report_admin_handle",
      mapsTo: ["report_flow", "admin_features"],
      options: [
        { label: "用户举报评论，管理员查看并处理", value: "users_report_admin_handle", recommended: true },
        { label: "只做管理员隐藏，不做举报", value: "admin_hide_only" },
        { label: "MVP 暂不做举报", value: "no_reports" },
      ],
    },
  ];
}

function buildTicketWorkflowQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "user_roles",
      question: "用户、管理员、处理人分别能做什么？",
      whyImportant: "决定工单可见范围、分派权限和服务端鉴权边界。",
      priority: "P0",
      defaultValue: "user_admin_handler",
      mapsTo: ["user_roles", "has_auth", "backend_need"],
      options: [
        { label: "用户提交，管理员分派，处理人处理", value: "user_admin_handler", recommended: true },
        { label: "只有管理员和处理人使用", value: "admin_handler_only" },
        { label: "先不区分处理人", value: "admin_only_process" },
      ],
    },
    {
      id: "ticket_fields",
      question: "工单需要哪些字段？",
      whyImportant: "决定 tickets 表结构、列表筛选和详情页展示。",
      priority: "P0",
      defaultValue: "title_desc_priority_status_due",
      mapsTo: ["ticket_fields", "data_persistence"],
      options: [
        { label: "标题/描述/优先级/状态/截止时间", value: "title_desc_priority_status_due", recommended: true },
        { label: "再加附件/分类/来源", value: "with_attachment_category" },
        { label: "先只保留标题和描述", value: "minimal_ticket" },
      ],
    },
    {
      id: "status_flow",
      question: "工单状态怎么流转？",
      whyImportant: "状态流转必须后端校验，否则前端隐藏按钮挡不住越权操作。",
      priority: "P0",
      defaultValue: "open_assigned_progress_resolved_closed_reopened",
      mapsTo: ["status_flow", "workflow"],
      options: [
        { label: "open/assigned/in_progress/resolved/closed/reopened", value: "open_assigned_progress_resolved_closed_reopened", recommended: true },
        { label: "open/in_progress/done", value: "simple_status" },
        { label: "自定义状态", value: "custom_status" },
      ],
    },
    {
      id: "assignment_flow",
      question: "谁可以分配或改派处理人？",
      whyImportant: "决定管理员权限、处理人可见范围和操作记录。",
      priority: "P0",
      defaultValue: "admin_assigns_handler",
      mapsTo: ["assignment_flow", "admin_features"],
      options: [
        { label: "管理员分配处理人", value: "admin_assigns_handler", recommended: true },
        { label: "处理人可互相转派", value: "handler_transfer" },
        { label: "暂不支持分派", value: "no_assignment" },
      ],
    },
    {
      id: "ticket_comment_flow",
      question: "处理进展和回复怎么记录？",
      whyImportant: "决定评论/处理记录表、时间线和用户通知边界。",
      priority: "P1",
      defaultValue: "comments_with_timestamp",
      mapsTo: ["ticket_comment_flow"],
      options: [
        { label: "用户/处理人/管理员都可留言，按时间展示", value: "comments_with_timestamp", recommended: true },
        { label: "只有处理人可写处理记录", value: "handler_notes_only" },
        { label: "MVP 先不做留言", value: "no_comments" },
      ],
    },
    {
      id: "admin_features",
      question: "后台需要哪些筛选和管理能力？",
      whyImportant: "决定后台列表、筛选条件和权限校验范围。",
      priority: "P1",
      defaultValue: "status_priority_assignee_due",
      mapsTo: ["admin_features"],
      options: [
        { label: "按状态/优先级/处理人/截止时间筛选", value: "status_priority_assignee_due", recommended: true },
        { label: "只按状态筛选", value: "status_only" },
        { label: "再加处理效率统计", value: "with_metrics" },
      ],
    },
  ];
}

function buildKnowledgeBaseQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "document_fields",
      question: "文档需要哪些字段？",
      whyImportant: "决定 documents 表结构、详情页和搜索内容。",
      priority: "P0",
      defaultValue: "title_body_folder_author_status_visibility",
      mapsTo: ["document_fields", "data_persistence"],
      options: [
        { label: "标题/正文/目录/作者/状态/可见范围", value: "title_body_folder_author_status_visibility", recommended: true },
        { label: "再加封面/标签/摘要", value: "with_tags_summary" },
        { label: "先只做标题和正文", value: "minimal_document" },
      ],
    },
    {
      id: "folder_structure",
      question: "目录结构需要多复杂？",
      whyImportant: "决定 folders 表、父子关系和后台目录管理。",
      priority: "P0",
      defaultValue: "tree_folders",
      mapsTo: ["folder_structure"],
      options: [
        { label: "支持树形目录", value: "tree_folders", recommended: true },
        { label: "只支持一级目录", value: "single_level" },
        { label: "MVP 先不做目录", value: "no_folders" },
      ],
    },
    {
      id: "document_status",
      question: "草稿和发布状态怎么定义？",
      whyImportant: "决定文档公开范围，避免 draft 被搜索或公开展示。",
      priority: "P0",
      defaultValue: "draft_published",
      mapsTo: ["document_status", "workflow"],
      options: [
        { label: "draft 仅作者/管理员可见，published 按权限可见", value: "draft_published", recommended: true },
        { label: "再加 archived", value: "with_archived" },
        { label: "不区分状态", value: "no_status" },
      ],
    },
    {
      id: "permission_rule",
      question: "文档权限怎么做？",
      whyImportant: "决定权限表、搜索过滤和后端鉴权边界。",
      priority: "P0",
      defaultValue: "simple_role_visibility",
      mapsTo: ["permission_rule", "has_auth"],
      options: [
        { label: "简单角色 + 文档可见范围", value: "simple_role_visibility", recommended: true },
        { label: "按成员单独授权", value: "member_acl" },
        { label: "复杂团队 RBAC", value: "full_rbac" },
      ],
    },
    {
      id: "search_scope",
      question: "搜索范围如何限制？",
      whyImportant: "搜索最容易泄露无权限文档标题或正文片段。",
      priority: "P0",
      defaultValue: "published_permitted_only",
      mapsTo: ["search_scope"],
      options: [
        { label: "只搜当前用户有权限的已发布文档", value: "published_permitted_only", recommended: true },
        { label: "管理员可搜全部，成员按权限", value: "admin_all_member_permitted" },
        { label: "MVP 先只搜标题", value: "title_only" },
      ],
    },
    {
      id: "version_history",
      question: "是否需要版本历史？",
      whyImportant: "决定是否需要 document_versions 表和回滚能力。",
      priority: "P1",
      defaultValue: "updated_at_only",
      mapsTo: ["version_history"],
      options: [
        { label: "MVP 先只保存更新时间", value: "updated_at_only", recommended: true },
        { label: "保存完整版本历史", value: "full_versions" },
        { label: "支持版本回滚", value: "versions_with_rollback" },
      ],
    },
  ];
}

function buildCrmQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "customer_fields",
      question: "客户需要记录哪些字段？",
      whyImportant: "决定 customers 表结构、列表筛选和详情页展示。",
      priority: "P0",
      defaultValue: "name_source_stage_owner_next_followup",
      mapsTo: ["customer_fields", "data_persistence"],
      options: [
        { label: "名称/来源/阶段/负责人/下次跟进时间", value: "name_source_stage_owner_next_followup", recommended: true },
        { label: "再加标签/预算/地区", value: "with_tags_budget_region" },
        { label: "先只做名称和备注", value: "minimal_customer" },
      ],
    },
    {
      id: "contact_fields",
      question: "联系人需要哪些信息？",
      whyImportant: "决定 contacts 表结构和客户详情页。",
      priority: "P0",
      defaultValue: "name_phone_wechat_position",
      mapsTo: ["contact_fields"],
      options: [
        { label: "姓名/电话/微信/职位/备注", value: "name_phone_wechat_position", recommended: true },
        { label: "再加邮箱/部门", value: "with_email_department" },
        { label: "MVP 先不做联系人", value: "no_contacts" },
      ],
    },
    {
      id: "followup_fields",
      question: "每次跟进记录需要保存什么？",
      whyImportant: "决定 followups 表、时间线和后续复盘能力。",
      priority: "P0",
      defaultValue: "content_method_time_next_followup",
      mapsTo: ["followup_fields"],
      options: [
        { label: "内容/方式/时间/下次跟进时间", value: "content_method_time_next_followup", recommended: true },
        { label: "再加附件/结果", value: "with_attachment_result" },
        { label: "只保存文字记录", value: "text_only" },
      ],
    },
    {
      id: "stage_rule",
      question: "客户阶段怎么定义？",
      whyImportant: "决定阶段筛选、销售看板和阶段更新校验。",
      priority: "P0",
      defaultValue: "new_contacted_interested_proposal_won_lost",
      mapsTo: ["stage_rule", "workflow"],
      options: [
        { label: "new/contacted/interested/proposal/won/lost", value: "new_contacted_interested_proposal_won_lost", recommended: true },
        { label: "只做新客户/跟进中/已成交/已流失", value: "simple_stages" },
        { label: "自定义阶段", value: "custom_stages" },
      ],
    },
    {
      id: "assignment_rule",
      question: "客户负责人如何分配？",
      whyImportant: "决定销售可见范围、管理员权限和越权风险。",
      priority: "P0",
      defaultValue: "admin_assigns_sales",
      mapsTo: ["assignment_rule", "admin_features", "has_auth"],
      options: [
        { label: "管理员分配客户给销售", value: "admin_assigns_sales", recommended: true },
        { label: "销售创建后自动归属自己", value: "creator_owns" },
        { label: "暂不做分配", value: "no_assignment" },
      ],
    },
    {
      id: "reminder_rule",
      question: "下次跟进怎么提醒或筛选？",
      whyImportant: "决定是否需要通知服务，以及列表筛选规则。",
      priority: "P1",
      defaultValue: "filter_only",
      mapsTo: ["reminder_rule", "notification"],
      options: [
        { label: "MVP 先按下次跟进时间筛选", value: "filter_only", recommended: true },
        { label: "站内提醒", value: "in_app_reminder" },
        { label: "短信/邮件提醒", value: "sms_email" },
      ],
    },
  ];
}

function buildStaticDisplayQuickQuestions(): QuickQuestion[] {
  return [
    {
      id: "content_sections",
      question: "第一版需要哪些展示模块？",
      whyImportant: "决定页面结构和内容优先级。",
      priority: "P0",
      defaultValue: "intro_work_contact",
      mapsTo: ["core_features", "content_sections"],
      options: [
        { label: "个人介绍 + 作品图片 + 联系方式", value: "intro_work_contact", recommended: true },
        { label: "再加服务/报价说明", value: "with_services" },
        { label: "再加博客/文章", value: "with_blog" },
      ],
    },
    {
      id: "visual_style",
      question: "希望是什么视觉风格？",
      whyImportant: "决定字体、配色、留白和动效方向。",
      priority: "P0",
      defaultValue: "premium_minimal",
      mapsTo: ["visual_style", "ui_direction"],
      options: [
        { label: "高级极简", value: "premium_minimal", recommended: true },
        { label: "艺术画廊感", value: "gallery_editorial" },
        { label: "科技/设计师感", value: "tech_creative" },
      ],
    },
    {
      id: "contact_method",
      question: "联系方式怎么呈现？",
      whyImportant: "决定是否需要表单和后端。",
      priority: "P0",
      defaultValue: "static_contact",
      mapsTo: ["contact_method", "backend_need"],
      options: [
        { label: "只展示邮箱/微信/社媒链接", value: "static_contact", recommended: true },
        { label: "需要联系表单", value: "contact_form" },
      ],
    },
    {
      id: "primary_platform",
      question: "主要访问场景是什么？",
      whyImportant: "决定响应式和图片排版策略。",
      priority: "P1",
      defaultValue: "mobile_first",
      mapsTo: ["primary_platform", "platform"],
      options: [
        { label: "手机端为主", value: "mobile_first", recommended: true },
        { label: "桌面端为主", value: "desktop_first" },
        { label: "两端都要同样精致", value: "responsive" },
      ],
    },
  ];
}

function buildLaunchQuickQuestions(message: string = "", knownContext?: Record<string, unknown>): QuickQuestion[] {
  const contextText = buildContextSearchText(message, knownContext);
  const isKnownStaticSite =
    hasAnySignal(contextText, ["纯静态", "静态站", "静态页面", "static", "HTML/CSS/JS", "无框架无后端", "无后端"]) &&
    !hasAnySignal(contextText, ["有后端", "with_backend", "backend_need true", "API 服务"]);
  const hasKnownNoSensitiveInteraction =
    isKnownStaticSite ||
    hasAnySignal(contextText, ["无后端", "无数据提交", "没有表单", "只展示", "无登录", "无支付"]);

  const questions: QuickQuestion[] = [
    {
      id: "site_type",
      question: "这个网站是纯静态页面，还是有后端？",
      whyImportant: "决定部署平台、服务器和运维复杂度。",
      priority: "P0",
      defaultValue: "static_site",
      mapsTo: ["site_type", "backend_need"],
      options: [
        { label: "纯静态页面", value: "static_site", recommended: true },
        { label: "有后端/API", value: "with_backend" },
        { label: "不确定", value: "unknown" },
      ],
    },
    {
      id: "domain",
      question: "是否要绑定自己的域名？",
      whyImportant: "决定 DNS 和 HTTPS 配置。",
      priority: "P1",
      defaultValue: "default_domain",
      mapsTo: ["domain", "https"],
      options: [
        { label: "先用平台默认域名", value: "default_domain", recommended: true },
        { label: "绑定自定义域名", value: "custom_domain" },
      ],
    },
    {
      id: "audience_region",
      question: "主要访问用户在哪里？",
      whyImportant: "决定是否要考虑备案、国内访问速度和 CDN。",
      priority: "P0",
      defaultValue: "overseas_or_mixed",
      mapsTo: ["china_mainland", "icp_filing", "cdn"],
      options: [
        { label: "国内为主", value: "china_mainland" },
        { label: "海外为主", value: "overseas" },
        { label: "都有", value: "mixed", recommended: true },
      ],
    },
    {
      id: "interactive_features",
      question: "网站有没有表单、登录、支付或数据提交？",
      whyImportant: "决定是否需要后端、隐私政策和日志监控。",
      priority: "P0",
      defaultValue: "none",
      mapsTo: ["user_data_privacy", "backend_need", "external_integrations"],
      options: [
        { label: "没有，只展示内容", value: "none", recommended: true },
        { label: "有联系表单", value: "contact_form" },
        { label: "有登录/支付/数据提交", value: "sensitive_interaction" },
      ],
    },
    {
      id: "rollback",
      question: "上线后出问题如何回滚？",
      whyImportant: "避免上线失败后无法恢复。",
      priority: "P1",
      defaultValue: "platform_rollback",
      mapsTo: ["rollback_plan"],
      options: [
        { label: "使用托管平台回滚", value: "platform_rollback", recommended: true },
        { label: "保留上一版构建产物", value: "keep_previous_build" },
        { label: "暂不确定", value: "unknown" },
      ],
    },
  ];

  return questions.filter((question) => {
    if (question.id === "site_type" && isKnownStaticSite) return false;
    if (question.id === "interactive_features" && hasKnownNoSensitiveInteraction) return false;
    return true;
  });
}

function isStaticDisplaySite(message: string): boolean {
  const displayKeywords = ["作品", "展示", "个人介绍", "联系方式", "官网", "landing"];
  const businessKeywords = ["报名", "表单", "提交", "后台", "管理", "导出", "登录", "支付", "预约", "审核", "数据"];
  const hasDisplaySignal = displayKeywords.some((kw) => message.includes(kw));
  const hasBusinessSignal = businessKeywords.some((kw) => message.includes(kw));

  return hasDisplaySignal && !hasBusinessSignal;
}

function isAiCopywritingProduct(message: string, knownContext?: Record<string, unknown>): boolean {
  const contextText = buildContextSearchText(message, knownContext);
  const lowerText = contextText.toLowerCase();
  if (isContentCommunityProduct(contextText, knownContext)) return false;
  const aiSignals = ["AI", "文案", "生成", "小红书", "话题标签", "LLM", "大模型"];
  const monetizationSignals = ["收费", "套餐", "次数", "订阅", "余额", "额度"];
  const aiContextKeys = [
    "generation_input_schema",
    "generation_output_spec",
    "llm_provider",
    "account_and_auth",
    "payment_and_quota",
    "history_and_storage",
    "content_safety",
    "admin_metrics",
  ];

  return (
    aiContextKeys.some((key) => knownContext?.[key] !== undefined) ||
    aiSignals.filter((signal) => contextText.includes(signal)).length >= 3 && !hasNegatedAi(contextText) ||
    lowerText.includes("llm") ||
    (contextText.includes("AI") && contextText.includes("文案") && !hasNegatedAi(contextText)) ||
    (contextText.includes("小红书") && contextText.includes("生成"))
  ) && (contextText.includes("工具") || contextText.includes("系统") || monetizationSignals.some((signal) => contextText.includes(signal)) || aiContextKeys.some((key) => knownContext?.[key] !== undefined));
}

function isContentCommunityProduct(message: string, knownContext?: Record<string, unknown>): boolean {
  const contextText = buildContextSearchText(message, knownContext);
  const contentKeys = ["content_model", "publish_flow", "comment_flow", "report_flow", "moderation_status"];
  const hasContent = ["内容社区", "社区", "投稿", "文章", "帖子", "评论"].some((signal) => contextText.includes(signal));
  const hasModeration = ["审核", "举报", "隐藏评论", "下架文章", "违规", "pending", "approved", "rejected", "removed"].some((signal) => contextText.includes(signal));

  return contentKeys.some((key) => knownContext?.[key] !== undefined) || (hasContent && hasModeration);
}

function hasNegatedAi(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,6}(AI|ai|LLM|llm|GPT|gpt|大模型|模型)/.test(text);
}

function isDigitalCommerceProduct(message: string, knownContext?: Record<string, unknown>): boolean {
  const contextText = buildContextSearchText(message, knownContext);
  const commerceSignals = ["售卖", "销售", "购买", "下单", "订单", "商品", "价格", "资料包", "数字资料"];
  const paymentSignals = ["支付", "付款", "收费", "金额", "mock payment", "微信", "支付宝"];
  const deliverySignals = ["下载", "文件", "发货", "交付", "下载权限", "资料文件"];
  const contextKeys = [
    "product_catalog",
    "order_flow",
    "payment_provider",
    "payment_confirmation",
    "price_calculation",
    "download_permission",
  ];

  if (contextKeys.some((key) => knownContext?.[key] !== undefined)) return true;

  return commerceSignals.some((signal) => contextText.includes(signal)) &&
    paymentSignals.some((signal) => contextText.includes(signal)) &&
    deliverySignals.some((signal) => contextText.includes(signal));
}

function isAppointmentProduct(message: string, knownContext?: Record<string, unknown>): boolean {
  const contextText = buildContextSearchText(message, knownContext);
  const appointmentKeys = [
    "service_catalog",
    "time_slot_rule",
    "booking_flow",
    "capacity_rule",
    "booking_status",
    "cancel_rule",
  ];
  const hasAppointment = ["预约", "约时间", "排班", "时间段", "档期"].some((signal) => contextText.includes(signal));
  const hasServiceOrCapacity = ["服务项目", "可预约", "容量", "人数", "取消预约", "满员"].some((signal) => contextText.includes(signal));

  return appointmentKeys.some((key) => knownContext?.[key] !== undefined) || (hasAppointment && hasServiceOrCapacity);
}

function isRegistrationProduct(message: string, knownContext?: Record<string, unknown>): boolean {
  const contextText = buildContextSearchText(message, knownContext);
  if (isContentCommunityProduct(contextText, knownContext) || isAppointmentProduct(contextText, knownContext) || isDigitalCommerceProduct(contextText, knownContext)) return false;
  const registrationKeys = ["form_fields", "dedup_strategy", "export_format"];
  const hasRegistrationSignal = ["报名", "活动报名", "参会", "参赛", "登记"].some((signal) => contextText.includes(signal));
  const hasRegistrationContext = registrationKeys.some((key) => knownContext?.[key] !== undefined);

  return hasRegistrationSignal || hasRegistrationContext;
}

function buildContextSearchText(message: string, knownContext?: Record<string, unknown>): string {
  if (!knownContext) return message;
  return `${message} ${JSON.stringify(knownContext)}`;
}

function hasAnySignal(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function formatQuickQuestions(questions: QuickQuestion[]): string {
  if (questions.length === 0) return "暂无需要补充的问题。";

  return questions
    .map((q, index) => {
      const options = q.options
        .map((option) => {
          const suffix = option.recommended ? "（推荐）" : "";
          return `  - ${option.label}${suffix}`;
        })
        .join("\n");
      const example = q.example ? `\n   - 例子：${q.example}` : "";
      return `${index + 1}. **${q.question}**${example}\n   - 为什么问：${q.whyImportant}\n${options}`;
    })
    .join("\n\n");
}

function withQuestionExamples(questions: QuickQuestion[]): QuickQuestion[] {
  return questions.map((question) => ({
    ...question,
    example: question.example || quickQuestionExample(question.id, question.question),
  }));
}

function quickQuestionExample(id: string, question: string): string {
  const examples: Record<string, string> = {
    data_storage: "比如只存在浏览器里、导出 JSON 文件、或多人共享到服务器。",
    login_need: "比如完全不用登录、只有管理员登录、普通用户和管理员都登录。",
    user_login: "比如报名用户不用登录，填表直接提交。",
    admin_scope: "比如只看列表，或能筛选、搜索、导出。",
    admin_auth: "比如管理员账号密码登录，或临时访问码。",
    third_party: "比如地图、AI、微信支付、短信通知。",
    llm_provider: "比如 OpenAI、DeepSeek，或先做可替换模型接口。",
    payment_and_quota: "比如人工收款发放 100 次，或微信支付后自动加次数。",
    content_safety: "比如违禁词提示、敏感行业提醒。",
    product_catalog: "比如标题、简介、价格、封面、文件。",
    service_catalog: "比如名称、简介、时长、是否可预约。",
    time_slot_rule: "比如 6 月 25 日 14:00-15:00，最多 5 人。",
    visual_style: "比如高级极简、艺术画廊感、科技设计师感。",
    contact_method: "比如只展示邮箱微信，或需要联系表单。",
  };
  return examples[id] || `比如：${question.replace(/[？?]$/, "")}可以先按最简单版本回答。`;
}
