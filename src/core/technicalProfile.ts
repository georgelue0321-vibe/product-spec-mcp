export type TechnicalShape =
  | "static_page"
  | "local_storage_tool"
  | "local_json_import_export"
  | "static_json_data_page"
  | "light_backend_json_sqlite"
  | "full_backend_saas"
  | "unknown";

export interface TechnicalProfileQuestion {
  question: string;
  example: string;
  why: string;
}

export interface TechnicalProfile {
  shape: TechnicalShape;
  confidence: "high" | "medium" | "low";
  frontendOnly: boolean;
  needsBackend: boolean;
  needsAuth: boolean;
  needsAdmin: boolean;
  suggestedStorage:
    | "none"
    | "localStorage"
    | "indexedDB"
    | "static_json"
    | "json_file"
    | "sqlite"
    | "postgresql";
  evidence: string[];
  blockers: string[];
  nextQuestions: TechnicalProfileQuestion[];
}

export function buildTechnicalProfile(
  rawText: string,
  context: Record<string, unknown> = {}
): TechnicalProfile {
  const text = `${rawText} ${buildContextText(context)}`;
  const evidence: string[] = [];
  const blockers: string[] = [];

  const localFirst = hasLocalFirstSignal(text, context);
  const staticDisplay = hasStaticDisplaySignal(text) && !hasStrongBackendSignal(text, context);
  const staticJson = hasStaticJsonDataSignal(text);
  const localImportExport = hasLocalImportExportSignal(text);
  const localTool = hasLocalToolSignal(text) || localFirst;
  const aiRisk = hasAiRisk(text, context);
  const paymentRisk = hasPaymentRisk(text, context);
  const lightBackend = hasLightBackendSignal(text, context);
  const fullBackend = aiRisk || paymentRisk || hasSaasSignal(text, context);

  if (localFirst) evidence.push("用户表达了本地/浏览器保存、不登录或自己用");
  if (staticDisplay) evidence.push("需求主要是静态展示页面");
  if (staticJson) evidence.push("需求包含静态 JSON 数据、地图点位或数据列表展示");
  if (localImportExport) evidence.push("需求包含 JSON/CSV 导入导出或备份迁移");
  if (localTool) evidence.push("需求像个人清单、记录、台账、提醒或收藏工具");
  if (aiRisk) blockers.push("涉及 AI 或第三方模型密钥，需要后端保护密钥");
  if (paymentRisk) blockers.push("涉及支付、订单或收款，需要后端确认金额和状态");

  if (fullBackend && !isNegatedBackend(text)) {
    return profile("full_backend_saas", "high", false, true, true, true, "postgresql", evidence, blockers);
  }

  if (lightBackend && !localFirst) {
    return profile("light_backend_json_sqlite", "high", false, true, true, true, "sqlite", evidence, blockers);
  }

  if (staticJson) {
    return profile("static_json_data_page", localFirst ? "high" : "medium", true, false, false, false, "static_json", evidence, blockers);
  }

  if (localImportExport) {
    return profile("local_json_import_export", "high", true, false, false, false, "json_file", evidence, blockers);
  }

  if (staticDisplay) {
    return profile("static_page", "high", true, false, false, false, "none", evidence, blockers);
  }

  if (localTool) {
    return profile("local_storage_tool", localFirst ? "high" : "medium", true, false, false, false, "localStorage", evidence, blockers);
  }

  return profile("unknown", "low", false, false, false, false, "none", evidence, blockers);
}

export function isLocalFirstProfile(profile: TechnicalProfile): boolean {
  return [
    "static_page",
    "local_storage_tool",
    "local_json_import_export",
    "static_json_data_page",
  ].includes(profile.shape);
}

function profile(
  shape: TechnicalShape,
  confidence: TechnicalProfile["confidence"],
  frontendOnly: boolean,
  needsBackend: boolean,
  needsAuth: boolean,
  needsAdmin: boolean,
  suggestedStorage: TechnicalProfile["suggestedStorage"],
  evidence: string[],
  blockers: string[]
): TechnicalProfile {
  return {
    shape,
    confidence,
    frontendOnly,
    needsBackend,
    needsAuth,
    needsAdmin,
    suggestedStorage,
    evidence,
    blockers,
    nextQuestions: buildNextQuestions(shape),
  };
}

function buildNextQuestions(shape: TechnicalShape): TechnicalProfileQuestion[] {
  if (shape === "static_json_data_page") {
    return [
      {
        question: "页面要展示什么数据？",
        example: "比如景点、酒店、美食、课程、资源链接。",
        why: "决定 data.json 里每条数据要保存哪些信息。",
      },
      {
        question: "需要地图吗？",
        example: "比如高德地图、Google Maps，或 Leaflet/OpenStreetMap。",
        why: "决定是否需要地图服务和点位坐标。",
      },
    ];
  }

  if (shape === "local_storage_tool" || shape === "local_json_import_export") {
    return [
      {
        question: "你想记录什么东西？",
        example: "比如食材、药品、游戏、装备、保单。",
        why: "先确认这个小工具管理的核心对象。",
      },
      {
        question: "每条记录要保存哪些信息？",
        example: "比如名称、数量、日期、状态、备注。",
        why: "决定页面表单、列表和本地 JSON 数据结构。",
      },
      {
        question: "需要哪些操作？",
        example: "比如新增、编辑、删除、搜索、筛选、分类。",
        why: "决定第一版功能范围，避免扩成后台系统。",
      },
    ];
  }

  if (shape === "light_backend_json_sqlite" || shape === "full_backend_saas") {
    return [
      {
        question: "是否需要多人使用？",
        example: "比如只有你自己、几个人内部用、公开给用户用。",
        why: "决定是否需要登录、权限和服务器保存数据。",
      },
      {
        question: "是否涉及第三方服务？",
        example: "比如微信支付、支付宝、OpenAI、DeepSeek、地图 Key。",
        why: "这些密钥和支付状态通常不能放在前端代码里。",
      },
    ];
  }

  return [
    {
      question: "这个项目主要是展示内容，还是要保存数据？",
      example: "比如作品展示页，或一个能新增/编辑记录的小工具。",
      why: "决定用纯静态页面、本地存储，还是需要服务器。",
    },
  ];
}

function hasLocalFirstSignal(text: string, context: Record<string, unknown>): boolean {
  if (isExplicitLocalContext(context)) return true;
  return /(自己用|个人用|我一个人|就我一人|不登录|无需登录|不需要登录|不需要账号|无需账号|不需要后台|无需后台|不需要管理员|纯前端|静态|本地保存|本地存储|浏览器保存|浏览器里|存在浏览器|存到浏览器|localStorage|IndexedDB|单机|离线)/i.test(text);
}

function buildContextText(context: Record<string, unknown>): string {
  return Object.entries(context)
    .filter(([, value]) => value !== false && value !== undefined && value !== null)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(" ");
}

function isExplicitLocalContext(context: Record<string, unknown>): boolean {
  const text = buildContextText(context);
  return /(纯前端|静态|本地保存|本地存储|浏览器保存|浏览器里|localStorage|IndexedDB|单机|离线|自己用|个人用|不登录|无需登录|不需要登录|不需要账号|无需账号|不需要后台|无需后台)/i.test(text);
}

function hasLocalToolSignal(text: string): boolean {
  return /(清单|列表|收藏|进度|台账|记录|提醒|记账|药箱|冰箱|装备|保单|订阅|续费|读书|植物|游戏|预算|密码提示|抽签|分组|计算器|小工具|管理工具)/.test(text);
}

function hasLocalImportExportSignal(text: string): boolean {
  if (/(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(导入|导出|JSON|json|CSV|csv|备份)/.test(text)) return false;
  return /(导入导出|导入|导出|JSON|json|CSV|csv|备份|迁移|分享数据)/.test(text) && !hasPaymentRisk(text, {});
}

function hasStaticJsonDataSignal(text: string): boolean {
  return /(data\.json|静态 JSON|静态数据|地图|点位|坐标|景点|酒店|美食|旅行攻略|课程导航|资源导航|列表页)/i.test(text);
}

function hasStaticDisplaySignal(text: string): boolean {
  return /(展示页|展示网站|作品集|个人作品|官网|landing|介绍页|活动介绍|静态页面|纯静态)/i.test(text);
}

function hasLightBackendSignal(text: string, context: Record<string, unknown>): boolean {
  if (context.has_auth === true || context.need_backend === true || context.backend_need === true) return true;
  return /(后台|管理员|登录|注册|多人|团队|审核|权限|服务端|服务器|数据库|报名|预约|容量|满员|提交到服务器|公开给用户)/.test(text) && !isNegatedBackend(text);
}

function hasSaasSignal(text: string, context: Record<string, unknown>): boolean {
  return context.commercial_intent === true || /(SaaS|商业化|套餐|订阅收费|按次数|扣次|余额|多租户)/i.test(text);
}

function hasAiRisk(text: string, context: Record<string, unknown>): boolean {
  if (context.has_ai === true) return true;
  if (/(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(AI|ai|LLM|llm|GPT|gpt|大模型|模型)/.test(text)) return false;
  return /(AI|ai|LLM|llm|GPT|gpt|OpenAI|DeepSeek|Claude|大模型|API Key|模型接口|文案生成)/.test(text);
}

function hasPaymentRisk(text: string, context: Record<string, unknown>): boolean {
  if (context.has_payment === true) return true;
  if (/(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(支付|付款|收费|订单|收款|购买)/.test(text)) return false;
  return /(支付|付款|收款|退款|微信支付|支付宝|在线支付|订单支付|付费套餐|套餐购买)/.test(text);
}

function hasStrongBackendSignal(text: string, context: Record<string, unknown>): boolean {
  return hasAiRisk(text, context) || hasPaymentRisk(text, context) || hasLightBackendSignal(text, context);
}

function isNegatedBackend(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,8}(后端|后台|登录|账号|权限|管理员|数据库|服务器)/.test(text);
}
