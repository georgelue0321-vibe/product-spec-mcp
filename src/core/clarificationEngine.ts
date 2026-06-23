import type { ReadinessResult } from "./specReadiness.js";
import clarificationQuestions from "../rules/clarificationQuestions.json";
import { classifyProductDomain, hasNegatedAi } from "./domainClassifier.js";
import { buildTechnicalProfile, isLocalFirstProfile } from "./technicalProfile.js";

export interface ClarificationQuestion {
  field: string;
  question: string;
  example?: string;
  whyImportant: string;
  options: string[];
  defaultAssumption: string;
  priority: string;
}

export interface ClarificationResult {
  missingFields: string[];
  questions: ClarificationQuestion[];
  defaultAssumptions: Record<string, string>;
}

export function generateClarification(
  rawIdea: string,
  readiness: ReadinessResult,
  scenario: string,
  platform: string,
  strictness: string,
  knownContext?: Record<string, any>
): ClarificationResult {
  const questions: ClarificationQuestion[] = [];
  const defaultAssumptions: Record<string, string> = {};
  const missingFields: string[] = [];

  const domain = classifyProductDomain(rawIdea, knownContext || {}).domain;
  const technicalProfile = buildTechnicalProfile(rawIdea, knownContext || {});

  if (scenario === "build_product" && domain === "generic" && isLocalFirstProfile(technicalProfile)) {
    const localQuestions = buildTechnicalProfileQuestions(technicalProfile.shape);
    return {
      missingFields: localQuestions.map((q) => q.field),
      questions: localQuestions,
      defaultAssumptions: Object.fromEntries(localQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "crm") {
    const crmQuestions = buildCrmQuestions(rawIdea, knownContext);
    return {
      missingFields: crmQuestions.map((q) => q.field),
      questions: crmQuestions,
      defaultAssumptions: Object.fromEntries(crmQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "knowledge_base") {
    const knowledgeQuestions = buildKnowledgeBaseQuestions(rawIdea, knownContext);
    return {
      missingFields: knowledgeQuestions.map((q) => q.field),
      questions: knowledgeQuestions,
      defaultAssumptions: Object.fromEntries(knowledgeQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "ticket_workflow") {
    const ticketQuestions = buildTicketWorkflowQuestions(rawIdea, knownContext);
    return {
      missingFields: ticketQuestions.map((q) => q.field),
      questions: ticketQuestions,
      defaultAssumptions: Object.fromEntries(ticketQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "content_community") {
    const contentQuestions = buildContentCommunityQuestions(rawIdea, knownContext);
    return {
      missingFields: contentQuestions.map((q) => q.field),
      questions: contentQuestions,
      defaultAssumptions: Object.fromEntries(contentQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "ai_copywriting") {
    const aiQuestions = buildAiCopywritingQuestions(rawIdea, knownContext);
    return {
      missingFields: aiQuestions.map((q) => q.field),
      questions: aiQuestions,
      defaultAssumptions: Object.fromEntries(aiQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "digital_commerce") {
    const commerceQuestions = buildDigitalCommerceQuestions(rawIdea, knownContext);
    return {
      missingFields: commerceQuestions.map((q) => q.field),
      questions: commerceQuestions,
      defaultAssumptions: Object.fromEntries(commerceQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  if (scenario === "build_product" && domain === "appointment") {
    const appointmentQuestions = buildAppointmentQuestions(rawIdea, knownContext);
    return {
      missingFields: appointmentQuestions.map((q) => q.field),
      questions: appointmentQuestions,
      defaultAssumptions: Object.fromEntries(appointmentQuestions.map((q) => [q.field, q.defaultAssumption])),
    };
  }

  const scenarioQuestions =
    clarificationQuestions[scenario as keyof typeof clarificationQuestions] ||
    clarificationQuestions.build_product;

  for (const field of Object.entries(readiness.fields)) {
    const [fieldName, fieldInfo] = field;
    if (!fieldInfo.present && shouldIncludeMissingField(fieldName, domain)) {
      missingFields.push(fieldName);
    }
  }

  for (const sq of scenarioQuestions) {
    const fieldInfo = readiness.fields[sq.field];
    if (!fieldInfo || !fieldInfo.present) {
      questions.push({
        field: sq.field,
        question: sq.question,
        example: exampleForQuestion(sq.field, sq.question),
        whyImportant: sq.why_important,
        options: sq.options,
        defaultAssumption: sq.default_assumption,
        priority: sq.priority,
      });
      defaultAssumptions[sq.field] = sq.default_assumption;
    }
  }

  if (strictness === "grill") {
    for (const field of Object.entries(readiness.fields)) {
      const [fieldName, fieldInfo] = field;
      if (!fieldInfo.present && shouldIncludeMissingField(fieldName, domain) && !questions.find((q) => q.field === fieldName)) {
        const allQuestions = Object.values(clarificationQuestions).flat();
        const matchingQ = allQuestions.find((q) => q.field === fieldName);
        if (matchingQ) {
          questions.push({
            field: matchingQ.field,
            question: matchingQ.question,
            example: exampleForQuestion(matchingQ.field, matchingQ.question),
            whyImportant: matchingQ.why_important,
            options: matchingQ.options,
            defaultAssumption: matchingQ.default_assumption,
            priority: matchingQ.priority,
          });
          defaultAssumptions[matchingQ.field] = matchingQ.default_assumption;
        }
      }
    }
  }

  return { missingFields, questions, defaultAssumptions };
}

function buildPersonalLocalToolQuestions(): ClarificationQuestion[] {
  return [
    {
      field: "core_features",
      question: "第一版这个小工具只做哪些核心功能？",
      example: "比如新增一条食材、编辑保质期、删除已用完的药品、按分类筛选装备。",
      whyImportant: "先锁定核心对象和操作，避免扩成后台系统。",
      options: ["新增/编辑/删除 + 本地保存", "再加搜索/筛选/分类", "再加提醒/统计/导入导出"],
      defaultAssumption: "新增/编辑/删除 + 本地保存",
      priority: "P0",
    },
    {
      field: "data_persistence",
      question: "数据保存在哪里？",
      example: "比如只存在浏览器里，或导出一个 JSON 文件备份到电脑。",
      whyImportant: "个人本地工具通常不需要服务器数据库。",
      options: ["浏览器 localStorage", "导入导出 JSON/CSV 文件", "以后再考虑多人共享数据库"],
      defaultAssumption: "浏览器 localStorage 或本地 JSON 文件",
      priority: "P0",
    },
    {
      field: "user_roles",
      question: "需要登录、后台或管理员吗？",
      example: "比如完全不用登录，或以后几个人用时再加账号。",
      whyImportant: "决定是否引入鉴权和后端接口。",
      options: ["不需要，自己本地用", "只加本地访问密码", "需要多人账号/后台"],
      defaultAssumption: "不需要登录、后台或管理员",
      priority: "P0",
    },
    {
      field: "success_criteria",
      question: "怎样算第一版可用？",
      example: "比如刷新页面后数据还在，搜索能找到记录，到期提醒日期正确。",
      whyImportant: "方便后续让 Agent 写测试和验收。",
      options: ["刷新后数据还在", "搜索/筛选结果准确", "提醒/状态计算正确"],
      defaultAssumption: "核心记录可增删改查，刷新后数据保留",
      priority: "P1",
    },
  ];
}

function buildTechnicalProfileQuestions(shape: string): ClarificationQuestion[] {
  if (shape === "static_json_data_page") {
    return [
      {
        field: "data_items",
        question: "页面要展示什么数据？",
        example: "比如景点、酒店、美食、课程、资源链接。",
        whyImportant: "决定 data.json 里每条数据要保存哪些信息。",
        options: ["景点/酒店/美食", "课程/资源链接", "自定义数据列表"],
        defaultAssumption: "使用一个 data.json 保存列表数据",
        priority: "P0",
      },
      {
        field: "item_fields",
        question: "每个条目要保存哪些信息？",
        example: "比如名称、地址、标签、评分、图片、备注。",
        whyImportant: "决定列表、详情和筛选条件。",
        options: ["名称+地址+标签+备注", "再加评分/图片/坐标", "只保留名称和链接"],
        defaultAssumption: "名称、地址或链接、标签、备注",
        priority: "P0",
      },
      {
        field: "map_provider",
        question: "需要地图吗？",
        example: "比如高德地图、Google Maps，或 Leaflet/OpenStreetMap。",
        whyImportant: "决定是否需要地图服务、坐标和第三方 key。",
        options: ["Leaflet/OpenStreetMap", "高德地图", "先不接地图，只做列表"],
        defaultAssumption: "优先用 Leaflet/OpenStreetMap 做轻量地图",
        priority: "P1",
      },
    ];
  }

  if (shape === "local_json_import_export") {
    return [
      ...buildPersonalLocalToolQuestions(),
      {
        field: "import_export",
        question: "导入导出要支持哪种文件？",
        example: "比如导出 JSON 备份，或导出 CSV 给 Excel 打开。",
        whyImportant: "决定文件格式、异常提示和备份恢复流程。",
        options: ["JSON 导入导出", "CSV 导出", "JSON + CSV 都要"],
        defaultAssumption: "JSON 导入导出，CSV 后续再加",
        priority: "P1",
      },
    ];
  }

  return buildPersonalLocalToolQuestions();
}

function exampleForQuestion(field: string, question: string): string {
  const examples: Record<string, string> = {
    data_persistence: "比如只存在浏览器里、导出 JSON 文件、或多人共享到服务器。",
    user_roles: "比如完全不用登录、只有管理员登录、普通用户和管理员都登录。",
    backend_need: "比如只做 HTML 页面，或需要服务器保存多人提交的数据。",
    external_integrations: "比如地图、AI、微信支付、短信通知。",
    form_fields: "比如姓名、电话、报名人数、备注。",
    admin_access: "比如只有你自己能看，或管理员账号登录后才能看。",
  };
  return examples[field] || `比如：${question.replace(/[？?]$/, "")}可以先按最简单版本回答。`;
}

function shouldIncludeMissingField(fieldName: string, domain: string): boolean {
  const ticketFields = new Set(["ticket_fields", "status_flow", "assignment_flow", "ticket_comment_flow"]);
  const knowledgeFields = new Set(["document_fields", "folder_structure", "document_status", "permission_rule", "search_scope", "version_history"]);
  const crmFields = new Set(["customer_fields", "contact_fields", "followup_fields", "stage_rule", "assignment_rule", "reminder_rule"]);

  if (ticketFields.has(fieldName)) return domain === "ticket_workflow";
  if (knowledgeFields.has(fieldName)) return domain === "knowledge_base";
  if (crmFields.has(fieldName)) return domain === "crm";
  return true;
}

function isAiCopywritingProduct(rawIdea: string, knownContext?: Record<string, any>): boolean {
  const text = buildContextText(rawIdea, knownContext);
  if (isContentCommunityProduct(rawIdea, knownContext)) return false;
  const aiSignals = ["AI", "文案", "生成", "小红书", "话题标签", "LLM", "大模型"];
  const monetizationSignals = ["收费", "套餐", "次数", "订阅", "余额", "额度"];
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

  return (
    aiAnswerKeys.some((key) => knownContext?.[key] !== undefined) ||
    aiSignals.filter((signal) => text.includes(signal)).length >= 3 && !hasNegatedAi(text) ||
    (text.includes("AI") && text.includes("文案") && !hasNegatedAi(text)) ||
    (text.includes("小红书") && text.includes("生成"))
  ) && (text.includes("工具") || text.includes("系统") || monetizationSignals.some((signal) => text.includes(signal)) || aiAnswerKeys.some((key) => knownContext?.[key] !== undefined));
}

function buildAiCopywritingQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "generation_input_schema",
      question: "生成前用户需要填写哪些输入项？",
      whyImportant: "决定表单结构、Prompt 模板和生成质量。",
      options: ["产品名称+产品介绍+目标人群", "再加卖点/语气/字数/禁用词", "支持自定义高级参数"],
      defaultAssumption: "产品名称+产品介绍+目标人群+卖点",
      priority: "P0",
    },
    {
      field: "generation_output_spec",
      question: "一次生成几条结果，每条包含哪些内容？",
      whyImportant: "直接影响用户体验、Token 成本和计费扣次规则。",
      options: ["1条：标题+正文+标签", "3条不同风格", "5条以上批量生成"],
      defaultAssumption: "一次生成 3 条，包含标题、正文、标签",
      priority: "P0",
    },
    {
      field: "llm_provider",
      question: "准备用哪个 AI 模型或 API？",
      whyImportant: "决定后端代理、成本测算、限流和失败重试策略。",
      options: ["OpenAI/Claude 等海外模型", "通义/豆包/DeepSeek 等国内模型", "先做可替换模型接口"],
      defaultAssumption: "先做可替换模型接口",
      priority: "P0",
    },
    {
      field: "account_and_auth",
      question: "用户是否需要登录后才能生成？",
      whyImportant: "次数套餐必须绑定账号，否则无法做余额、订单和历史记录。",
      options: ["必须登录", "免登录试用后登录购买", "完全免登录"],
      defaultAssumption: "免登录试用 1 次，购买前必须登录",
      priority: "P0",
    },
    {
      field: "payment_and_quota",
      question: "收费和扣次规则怎么设计？",
      whyImportant: "决定订单、套餐、余额、退款和防刷逻辑。",
      options: ["按次套餐", "月订阅", "按次套餐+月订阅", "先人工收款发放次数"],
      defaultAssumption: "MVP 先按次套餐，后台人工发放次数",
      priority: "P0",
    },
    {
      field: "history_and_storage",
      question: "是否保存生成历史？",
      whyImportant: "决定数据库表、用户中心和隐私合规范围。",
      options: ["保存全部历史", "只保存最近记录", "不保存正文，只保存扣次记录"],
      defaultAssumption: "保存最近生成历史和扣次记录",
      priority: "P1",
    },
    {
      field: "content_safety",
      question: "是否需要内容安全和平台规则约束？",
      whyImportant: "小红书文案涉及营销承诺、违禁词和敏感行业，必须控制输出风险。",
      options: ["内置小红书违禁词/风险提示", "只做基础敏感词过滤", "先不做"],
      defaultAssumption: "内置基础敏感词和营销风险提示",
      priority: "P1",
    },
    {
      field: "admin_metrics",
      question: "管理员需要看哪些运营数据？",
      whyImportant: "决定是否需要后台，以及要统计用户、订单、消耗和模型成本。",
      options: ["用户+订单+剩余次数", "再加生成日志和模型成本", "MVP 暂不做后台"],
      defaultAssumption: "MVP 至少看用户、订单和剩余次数",
      priority: "P1",
    },
  ];

  return questions.filter((question) => {
    if (question.field === "payment_and_quota" && hasAnySignal(text, ["按次数", "卖套餐", "月订阅", "订阅"])) {
      return true;
    }
    return !hasAnySignal(text, fieldCoverageSignals[question.field] || []);
  });
}

function isDigitalCommerceProduct(rawIdea: string, knownContext?: Record<string, any>): boolean {
  const text = buildContextText(rawIdea, knownContext);
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

  return (
    contextKeys.some((key) => knownContext?.[key] !== undefined) ||
    commerceSignals.some((signal) => text.includes(signal)) &&
      paymentSignals.some((signal) => text.includes(signal)) &&
      deliverySignals.some((signal) => text.includes(signal))
  );
}

function buildDigitalCommerceQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "product_catalog",
      question: "资料包需要哪些商品信息？",
      whyImportant: "决定商品表、资料详情页和后台上架字段。",
      options: ["标题+简介+价格+封面+文件", "再加分类/标签/库存", "先固定几个资料包"],
      defaultAssumption: "标题、简介、价格、封面、文件路径、上下架状态",
      priority: "P0",
    },
    {
      field: "order_flow",
      question: "下单、支付、下载的完整流程是什么？",
      whyImportant: "决定订单状态、支付状态和下载权限的状态机。",
      options: ["下单->支付->下载", "人工确认付款后开放下载", "先只做免费领取"],
      defaultAssumption: "用户选择资料包 -> 创建待支付订单 -> 支付成功 -> 获得下载权限",
      priority: "P0",
    },
    {
      field: "payment_provider",
      question: "第一版使用哪种支付方式？",
      whyImportant: "决定是否需要真实支付回调、验签和订单幂等。",
      options: ["MVP 先用 mock 支付", "微信/支付宝在线支付", "人工收款"],
      defaultAssumption: "MVP 先用 mock payment provider，后续替换真实支付",
      priority: "P0",
    },
    {
      field: "payment_confirmation",
      question: "支付成功以什么为准？",
      whyImportant: "不能只靠前端跳转判断支付成功，否则会被绕过。",
      options: ["后端回调/订单查询", "mock 后端确认", "人工确认"],
      defaultAssumption: "支付状态必须由后端确认",
      priority: "P0",
    },
    {
      field: "download_permission",
      question: "下载权限如何校验？",
      whyImportant: "决定用户是否能绕过前端直接下载付费文件。",
      options: ["登录且订单已支付", "一次性签名下载链接", "人工发送下载链接"],
      defaultAssumption: "只有已登录且已支付该订单的用户可以下载对应文件",
      priority: "P0",
    },
    {
      field: "admin_features",
      question: "管理员后台需要哪些能力？",
      whyImportant: "决定资料、订单、下载记录和后台鉴权范围。",
      options: ["上架资料+看订单+看下载记录", "只看订单并人工发货", "暂不做后台"],
      defaultAssumption: "管理员可以新增/编辑/上下架资料包，查看订单和下载记录",
      priority: "P0",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

function isAppointmentProduct(rawIdea: string, knownContext?: Record<string, any>): boolean {
  const text = buildContextText(rawIdea, knownContext);
  const appointmentKeys = [
    "service_catalog",
    "time_slot_rule",
    "booking_flow",
    "capacity_rule",
    "booking_status",
    "cancel_rule",
  ];
  const hasAppointment = /预约|约时间|排班|时间段|档期/.test(text);
  const hasServiceOrCapacity = /服务项目|可预约|容量|人数|满员|取消预约/.test(text);

  return appointmentKeys.some((key) => knownContext?.[key] !== undefined) || (hasAppointment && hasServiceOrCapacity);
}

function buildAppointmentQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "service_catalog",
      question: "服务项目需要包含哪些信息？",
      whyImportant: "决定服务项目表、预约入口和后台配置字段。",
      options: ["名称+简介+时长+可预约状态", "再加价格/分类/服务人员", "先固定一个服务"],
      defaultAssumption: "服务项目包含名称、简介、时长、可预约状态",
      priority: "P0",
    },
    {
      field: "time_slot_rule",
      question: "可预约时间段如何设置？",
      whyImportant: "决定时间段表、后台排班和前台时间选择。",
      options: ["管理员设置日期和开始/结束时间", "固定周期自动生成", "先固定几个时间段"],
      defaultAssumption: "管理员可以设置日期、开始时间、结束时间、最大预约人数",
      priority: "P0",
    },
    {
      field: "capacity_rule",
      question: "每个时间段的人数容量怎么限制？",
      whyImportant: "容量限制必须服务端校验，避免并发提交导致超额预约。",
      options: ["每个时间段设置最大人数", "每个服务+时间段设置容量", "不限制人数"],
      defaultAssumption: "每个时间段达到最大人数后不能继续预约",
      priority: "P0",
    },
    {
      field: "booking_status",
      question: "预约状态有哪些？",
      whyImportant: "决定后台筛选、取消预约和状态流转。",
      options: ["pending/confirmed/cancelled", "active/cancelled", "再加 completed/no_show"],
      defaultAssumption: "预约状态包含 pending、confirmed、cancelled",
      priority: "P0",
    },
    {
      field: "cancel_rule",
      question: "用户如何取消预约？",
      whyImportant: "取消规则决定容量是否释放、身份如何校验。",
      options: ["手机号+预约号取消", "登录后取消", "MVP 暂不支持取消"],
      defaultAssumption: "用户可以通过手机号和预约号取消预约",
      priority: "P0",
    },
    {
      field: "admin_features",
      question: "后台需要哪些预约管理能力？",
      whyImportant: "决定后台页面、管理员鉴权和排班管理范围。",
      options: ["管理服务项目+时间段+预约列表", "只管理时间段和预约列表", "暂不做后台"],
      defaultAssumption: "管理员可以管理服务项目、设置时间段、查看预约列表、筛选状态",
      priority: "P0",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

function isContentCommunityProduct(rawIdea: string, knownContext?: Record<string, any>): boolean {
  return classifyProductDomain(rawIdea, knownContext || {}).domain === "content_community";
}

function buildKnowledgeBaseQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "document_fields",
      question: "文档需要哪些字段？",
      whyImportant: "决定 documents 表结构、详情页和搜索内容。",
      options: ["标题/正文/目录/作者/状态/可见范围", "再加标签/摘要/封面", "先只做标题和正文"],
      defaultAssumption: "文档包含标题、正文、目录ID、作者、状态、可见范围、创建时间、更新时间",
      priority: "P0",
    },
    {
      field: "folder_structure",
      question: "目录结构怎么设计？",
      whyImportant: "决定 folders 表、父子关系和后台目录管理。",
      options: ["支持树形目录", "只支持一级目录", "MVP 先不做目录"],
      defaultAssumption: "目录支持一级或多级目录，MVP 可以先支持树形目录",
      priority: "P0",
    },
    {
      field: "document_status",
      question: "草稿和发布状态怎么定义？",
      whyImportant: "决定公开列表和搜索结果，避免 draft 文档泄露。",
      options: ["draft 仅作者/管理员可见，published 按权限可见", "再加 archived", "不区分状态"],
      defaultAssumption: "文档状态包含 draft 和 published。draft 只有作者和管理员可见，published 对有权限的成员可见",
      priority: "P0",
    },
    {
      field: "permission_rule",
      question: "文档权限怎么做？",
      whyImportant: "决定权限表、搜索过滤和后端鉴权边界。",
      options: ["简单角色 + 文档可见范围", "按成员单独授权", "复杂企业 RBAC"],
      defaultAssumption: "MVP 先做简单权限：成员、管理员，以及文档可见范围；不做复杂企业 RBAC",
      priority: "P0",
    },
    {
      field: "search_scope",
      question: "成员可以搜索哪些文档？",
      whyImportant: "搜索接口必须按权限过滤，不能泄露无权限文档标题和正文。",
      options: ["只搜有权限的已发布文档", "管理员搜全部，成员按权限", "MVP 先只搜标题"],
      defaultAssumption: "成员可以搜索自己有权限查看的已发布文档，管理员可以搜索全部文档",
      priority: "P0",
    },
    {
      field: "version_history",
      question: "是否需要版本历史？",
      whyImportant: "决定是否需要版本表、回滚和编辑审计。",
      options: ["MVP 先只保存更新时间", "保存完整版本历史", "支持版本回滚"],
      defaultAssumption: "MVP 先保存更新时间，不做完整版本历史",
      priority: "P1",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

function buildCrmQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "customer_fields",
      question: "客户需要记录哪些字段？",
      whyImportant: "决定 customers 表结构、列表筛选和详情页展示。",
      options: ["名称/来源/阶段/负责人/下次跟进时间", "再加标签/预算/地区", "先只做名称和备注"],
      defaultAssumption: "客户包含名称、来源、阶段、负责人、备注、下次跟进时间、创建时间、更新时间",
      priority: "P0",
    },
    {
      field: "contact_fields",
      question: "联系人需要哪些信息？",
      whyImportant: "决定 contacts 表结构和客户详情页。",
      options: ["姓名/电话/微信/职位/备注", "再加邮箱/部门", "MVP 先不做联系人"],
      defaultAssumption: "联系人包含客户ID、姓名、电话、微信、职位、备注",
      priority: "P0",
    },
    {
      field: "followup_fields",
      question: "每次跟进记录需要保存什么？",
      whyImportant: "决定 followups 表、时间线和后续复盘能力。",
      options: ["内容/方式/时间/下次跟进时间", "再加附件/结果", "只保存文字记录"],
      defaultAssumption: "跟进记录包含客户ID、跟进人、内容、跟进方式、跟进时间、下次跟进时间",
      priority: "P0",
    },
    {
      field: "stage_rule",
      question: "客户阶段怎么定义？",
      whyImportant: "决定阶段筛选、销售看板和阶段更新校验。",
      options: ["new/contacted/interested/proposal/won/lost", "新客户/跟进中/已成交/已流失", "自定义阶段"],
      defaultAssumption: "客户阶段包含 new、contacted、interested、proposal、won、lost。MVP 允许销售按规则手动更新阶段",
      priority: "P0",
    },
    {
      field: "assignment_rule",
      question: "客户负责人如何分配？",
      whyImportant: "决定销售可见范围、管理员权限和越权风险。",
      options: ["管理员分配客户给销售", "销售创建后自动归属自己", "暂不做分配"],
      defaultAssumption: "管理员可以把客户分配给销售；销售只能查看和编辑自己负责的客户",
      priority: "P0",
    },
    {
      field: "reminder_rule",
      question: "下次跟进怎么提醒或筛选？",
      whyImportant: "决定是否需要通知服务，以及列表筛选规则。",
      options: ["MVP 先按下次跟进时间筛选", "站内提醒", "短信/邮件提醒"],
      defaultAssumption: "MVP 先不做消息通知，只在列表里按下次跟进时间筛选即将跟进客户",
      priority: "P1",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

function buildTicketWorkflowQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "user_roles",
      question: "用户、管理员、处理人分别有哪些权限？",
      whyImportant: "决定工单可见范围、分派权限和服务端鉴权边界。",
      options: ["用户提交，管理员分派，处理人处理", "只有管理员和处理人使用", "先不区分处理人"],
      defaultAssumption: "普通用户提交并查看自己的工单；管理员查看全部工单并分配处理人；处理人更新分配给自己的工单",
      priority: "P0",
    },
    {
      field: "ticket_fields",
      question: "工单需要哪些字段？",
      whyImportant: "决定 tickets 表结构、列表筛选和详情页展示。",
      options: ["标题/描述/优先级/状态/截止时间", "再加附件/分类/来源", "先只保留标题和描述"],
      defaultAssumption: "标题、描述、提交人、处理人、优先级、状态、截止时间、创建时间、更新时间",
      priority: "P0",
    },
    {
      field: "status_flow",
      question: "工单状态流转规则是什么？",
      whyImportant: "状态流转必须后端校验，避免越权或跳过关键处理步骤。",
      options: ["open->assigned->in_progress->resolved->closed/reopened", "open->in_progress->done", "自定义状态"],
      defaultAssumption: "open -> assigned -> in_progress -> resolved -> closed；用户不满意可 reopened",
      priority: "P0",
    },
    {
      field: "assignment_flow",
      question: "谁可以分配或改派处理人？",
      whyImportant: "决定管理员权限、处理人可见范围和操作记录。",
      options: ["管理员分配处理人", "处理人可互相转派", "暂不支持分派"],
      defaultAssumption: "管理员把工单分配给处理人；处理人只能处理分配给自己的工单",
      priority: "P0",
    },
    {
      field: "ticket_comment_flow",
      question: "处理进展和回复怎么记录？",
      whyImportant: "决定评论/处理记录表、时间线和用户通知边界。",
      options: ["用户/处理人/管理员都可留言，按时间展示", "只有处理人可写处理记录", "MVP 先不做留言"],
      defaultAssumption: "用户、管理员、处理人都可以在工单下留言，处理进展按时间保存",
      priority: "P1",
    },
    {
      field: "admin_features",
      question: "后台需要哪些筛选和管理能力？",
      whyImportant: "决定后台列表、筛选条件和权限校验范围。",
      options: ["按状态/优先级/处理人/截止时间筛选", "只按状态筛选", "再加处理效率统计"],
      defaultAssumption: "按状态、优先级、处理人、截止时间筛选工单，查看处理记录",
      priority: "P1",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

function buildContentCommunityQuestions(rawIdea: string, knownContext?: Record<string, any>): ClarificationQuestion[] {
  const text = buildContextText(rawIdea, knownContext);
  const questions: ClarificationQuestion[] = [
    {
      field: "user_roles",
      question: "普通用户和管理员分别有哪些权限？",
      whyImportant: "决定登录、管理员后台和服务端权限校验边界。",
      options: ["用户发布/评论/举报，管理员审核/隐藏/下架", "只做投稿审核", "只做管理员发布"],
      defaultAssumption: "普通用户可以注册登录、发布文章、评论和举报；管理员可以审核文章、隐藏评论、下架文章",
      priority: "P0",
    },
    {
      field: "content_model",
      question: "文章和评论需要哪些字段？",
      whyImportant: "决定 posts、comments 表结构和前后台展示字段。",
      options: ["文章标题/正文/作者/状态；评论文章ID/作者/内容/状态", "再加封面/分类/标签", "先只做文章"],
      defaultAssumption: "文章包含标题、正文、作者、状态、发布时间；评论包含文章ID、作者、内容、状态",
      priority: "P0",
    },
    {
      field: "publish_flow",
      question: "文章发布和审核流程是什么？",
      whyImportant: "决定文章状态机，避免未审核内容公开。",
      options: ["提交后 pending，管理员通过后公开", "可信用户直接公开", "全部直接公开"],
      defaultAssumption: "用户提交文章 -> 状态为 pending -> 管理员审核 -> approved 后公开展示，rejected 不公开",
      priority: "P0",
    },
    {
      field: "comment_flow",
      question: "评论如何发布和隐藏？",
      whyImportant: "决定评论权限、可见状态和违规处理方式。",
      options: ["登录用户评论公开文章，管理员可隐藏", "评论也需要审核", "MVP 暂不做评论"],
      defaultAssumption: "登录用户可以评论已公开文章；管理员可以隐藏违规评论",
      priority: "P0",
    },
    {
      field: "report_flow",
      question: "举报评论后怎么处理？",
      whyImportant: "决定 reports 表、后台举报列表和处理状态。",
      options: ["用户举报评论，管理员查看并处理", "只记录举报不处理", "MVP 暂不做举报"],
      defaultAssumption: "用户可以举报评论，管理员在后台查看举报并处理",
      priority: "P1",
    },
    {
      field: "moderation_status",
      question: "文章和评论有哪些状态？",
      whyImportant: "状态定义会直接影响公开列表、详情页和后台筛选。",
      options: ["文章 draft/pending/approved/rejected/removed，评论 visible/hidden", "文章 pending/approved/removed，评论 visible/hidden", "先只做 pending/approved"],
      defaultAssumption: "文章状态包含 draft、pending、approved、rejected、removed；评论状态包含 visible、hidden",
      priority: "P0",
    },
  ];

  return questions.filter((question) => !hasAnySignal(text, fieldCoverageSignals[question.field] || []));
}

const fieldCoverageSignals: Record<string, string[]> = {
  generation_input_schema: ["产品名称、产品介绍、目标人群", "产品名称", "目标人群", "输入项"],
  generation_output_spec: ["一次生成", "生成几条", "3条", "三条", "5条", "五条", "批量生成"],
  llm_provider: ["OpenAI", "Claude", "DeepSeek", "通义", "豆包", "模型"],
  account_and_auth: ["登录", "注册", "账号", "用户中心"],
  payment_and_quota: ["微信支付", "支付宝", "人工收款", "扣次", "余额"],
  history_and_storage: ["历史记录", "生成历史", "保存记录"],
  content_safety: ["违禁词", "敏感词", "内容安全", "合规"],
  admin_metrics: ["管理后台", "运营数据", "订单管理", "成本统计"],
  product_catalog: ["标题", "简介", "价格", "封面", "文件路径", "商品信息"],
  order_flow: ["下单", "支付成功", "下载", "创建订单"],
  payment_provider: ["mock 支付", "mock payment", "微信支付", "支付宝", "人工收款"],
  payment_confirmation: ["后端确认", "后端回调", "订单查询", "支付状态"],
  download_permission: ["下载权限", "已支付", "下载文件", "签名下载"],
  admin_features: ["上架", "下架", "订单", "下载记录", "资料管理"],
  service_catalog: ["服务项目", "名称", "简介", "时长", "可预约状态"],
  time_slot_rule: ["时间段", "开始时间", "结束时间", "可预约时间"],
  capacity_rule: ["容量", "最大预约人数", "人数", "满员"],
  booking_status: ["pending", "confirmed", "cancelled", "状态"],
  cancel_rule: ["取消预约", "取消"],
  content_model: ["文章", "正文", "评论", "字段"],
  publish_flow: ["pending", "approved", "rejected", "审核"],
  comment_flow: ["评论", "隐藏"],
  report_flow: ["举报", "处理"],
  moderation_status: ["draft", "pending", "approved", "removed", "visible", "hidden"],
  ticket_fields: ["工单", "标题", "描述", "优先级", "截止时间"],
  status_flow: ["状态流转", "open", "assigned", "in_progress", "resolved", "closed", "reopened"],
  assignment_flow: ["分配", "指派", "处理人"],
  ticket_comment_flow: ["回复", "留言", "处理进展"],
  document_fields: ["文档", "标题", "正文", "目录", "作者", "可见范围"],
  folder_structure: ["目录", "树形", "一级目录", "多级目录"],
  document_status: ["draft", "published", "草稿", "已发布", "发布"],
  permission_rule: ["权限", "可见范围", "RBAC", "成员", "管理员"],
  search_scope: ["搜索", "检索"],
  version_history: ["版本历史", "更新时间", "回滚"],
  customer_fields: ["客户", "来源", "阶段", "负责人", "下次跟进"],
  contact_fields: ["联系人", "电话", "微信", "职位"],
  followup_fields: ["跟进记录", "跟进内容", "跟进方式"],
  stage_rule: ["new", "contacted", "interested", "proposal", "won", "lost", "阶段"],
  assignment_rule: ["分配", "负责人", "销售"],
  reminder_rule: ["下次跟进", "提醒", "即将跟进"],
};

function buildContextText(rawIdea: string, knownContext?: Record<string, any>): string {
  if (!knownContext) return rawIdea;
  return `${rawIdea} ${JSON.stringify(knownContext)}`;
}

function hasAnySignal(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}
