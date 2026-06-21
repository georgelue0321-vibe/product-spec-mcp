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
import type { SpecInterrogateOutput } from "../schemas/outputs/specInterrogate.output.js";
import type { UiTranslateOutput } from "../schemas/outputs/uiTranslate.output.js";
import type { DebugGuideOutput } from "../schemas/outputs/debugGuide.output.js";
import type { ArchitectureDecideOutput } from "../schemas/outputs/architectureDecide.output.js";

export interface QuickQuestion {
  id: string;
  question: string;
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
  if (isStaticDisplaySite(message)) {
    return handleStaticDisplaySite(message, autoExecute, routed);
  }

  if (!autoExecute) {
    return {
      routedIntent: routed,
      selectedTool: "spec_interrogate",
      executed: false,
      nextAction: {
        type: "answer_questions",
        message: "建议先运行需求追问，了解信息完整度",
        suggestedTool: "spec_interrogate",
      },
      quickQuestions: buildProductQuickQuestions(message),
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
  const structured = buildInterrogateStructuredOutput(readiness, clarification);

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
    quickQuestions: buildProductQuickQuestions(message),
    agentGuidance: [
      "优先直接展示 quickQuestions，避免二次改写导致选项语义变化。",
      "不要把用户端登录和后台管理员登录合并成同一个字段。",
      "如果用户只需要导出，不要擅自扩展成完整后台管理系统。",
    ],
    markdown: `# 识别到场景：产品开发

**置信度：** ${Math.round(routed.confidence * 100)}%

## 快速确认问题

${formatQuickQuestions(buildProductQuickQuestions(message))}

${markdown}`,
  };
}

function handleStaticDisplaySite(
  message: string,
  autoExecute: boolean,
  routed: { intent: string; scenario: "build_product"; confidence: number }
): AssistResult {
  const quickQuestions = buildStaticDisplayQuickQuestions();
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

function buildProductQuickQuestions(message: string): QuickQuestion[] {
  const isFormLike = ["报名", "表单", "提交", "预约", "导出", "后台"].some((kw) =>
    message.includes(kw)
  );

  if (!isFormLike) {
    return [
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
    ];
  }

  return [
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
      return `${index + 1}. **${q.question}**\n${options}`;
    })
    .join("\n\n");
}
