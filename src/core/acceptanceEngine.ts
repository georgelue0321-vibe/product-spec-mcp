import acceptanceRules from "../rules/acceptanceRules.json";
import { classifyProductDomain, hasNegatedAi } from "./domainClassifier.js";
import { isSingleUserCrmContext } from "./contextSignals.js";
import { buildLocalToolSignalProfile } from "./localToolSignals.js";
import { decidePmIntent, type PmIntentDecision } from "./pmIntentGate.js";
import { buildTechnicalProfile, isLocalFirstProfile, type TechnicalProfile } from "./technicalProfile.js";

export interface AcceptanceResult {
  productType: string;
  platform: string;
  categories: Array<{
    category: string;
    items: string[];
  }>;
  definitionOfDone: string[];
  technicalProfile?: TechnicalProfile;
  pmIntentDecision?: PmIntentDecision;
}

export function generateAcceptance(
  productType: string,
  features: string[],
  platform: string,
  hasBackend: boolean,
  hasPayment: boolean,
  hasAuth: boolean
): AcceptanceResult {
  const technicalProfile = buildTechnicalProfile(buildFeatureText(productType, features), {
    has_backend: hasBackend,
    has_payment: hasPayment,
    has_auth: hasAuth,
  });
  const featureText = buildFeatureText(productType, features);
  const pmIntentDecision = decidePmIntent(featureText, {
    has_backend: hasBackend,
    has_payment: hasPayment,
    has_auth: hasAuth,
  });
  const domain = classifyProductDomain(productType, { features }).domain;
  const inferredBackend = hasBackend || technicalProfile.needsBackend;
  const inferredAuth = hasAuth || technicalProfile.needsAuth;
  const inferredPayment = hasPayment || technicalProfile.blockers.some((blocker) => blocker.includes("支付"));

  if (
    domain === "generic" &&
    ["multi_user_collaboration", "content_marketing_site", "data_visualization_site"].includes(pmIntentDecision.needType)
  ) {
    return {
      productType,
      platform,
      technicalProfile,
      pmIntentDecision,
      categories: buildPmGateAcceptanceCategories(pmIntentDecision),
      definitionOfDone: [
        "核心边界已按 PM Gate 确认",
        "桌面端和移动端验收通过",
        "控制台无明显报错",
        "无 P0/P1 Bug",
      ],
    };
  }

  if (isStaticDisplaySite(productType, features, platform, inferredBackend, inferredPayment, inferredAuth)) {
    return {
      productType,
      platform,
      technicalProfile,
      pmIntentDecision,
      categories: buildStaticDisplayAcceptanceCategories(),
      definitionOfDone: [
        "所有占位内容已替换为真实内容",
        "桌面端、平板和移动端验收通过",
        "线上链接、图片、字体和 favicon 正常加载",
        "SEO 和社交分享基础信息配置完成",
        "托管平台和回滚方式已确认",
      ],
    };
  }

  const categories: Array<{ category: string; items: string[] }> = [];
  const personalLocalTool =
    platform === "web" &&
    domain === "generic" &&
    !inferredBackend &&
    !inferredPayment &&
    !inferredAuth &&
    isLocalFirstProfile(technicalProfile) &&
    !/表单|提交|报名/.test(featureText);
  const contentCommunity = domain === "content_community";
  const appointment = domain === "appointment";
  const registration = domain === "registration";
  const ticketWorkflow = domain === "ticket_workflow";
  const knowledgeBase = domain === "knowledge_base";
  const crm = domain === "crm";
  const singleUserCrm = crm && (!hasAuth || isSingleUserCrmContext(buildFeatureText(productType, features), { has_auth: hasAuth }));

  if (personalLocalTool) {
    return {
      productType,
      platform,
      technicalProfile,
      pmIntentDecision,
      categories: buildLocalFirstAcceptanceCategories(technicalProfile, productType, features),
      definitionOfDone: [
        "核心功能按需求实现",
        "刷新页面或重新打开页面后数据表现符合预期",
        "桌面端和移动端验收通过",
        "控制台无明显报错",
        "无 P0/P1 Bug",
      ],
    };
  }

  for (const rule of acceptanceRules.base_rules) {
    categories.push({
      category: rule.category,
      items: [...rule.items],
    });
  }

  if (inferredBackend) {
    for (const rule of acceptanceRules.backend_rules) {
      const items = singleUserCrm
        ? rule.items.filter((item) => !item.includes("审计日志"))
        : [...rule.items];
      categories.push({
        category: rule.category,
        items,
      });
    }
  }

  if (inferredPayment) {
    for (const rule of acceptanceRules.payment_rules) {
      const text = buildFeatureText(productType, features);
      categories.push({
        category: rule.category,
        items: rule.items.filter((item) => !item.includes("退款") || /退款|refund/i.test(text)),
      });
    }
  }

  if (inferredAuth) {
    for (const rule of acceptanceRules.auth_rules) {
      const text = buildFeatureText(productType, features);
      categories.push({
        category: rule.category,
        items: rule.items.filter((item) => !item.includes("Token") || /token|jwt|刷新/.test(text)),
      });
    }
  }

  if (!contentCommunity && !appointment && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["表单", "提交", "报名"])) {
    categories.push({
      category: "表单验收",
      items: [
        "必填字段有校验提示",
        "手机号格式错误时有明确提示",
        "报名人数必须为正整数",
        "提交中显示 loading 状态",
        "提交成功显示 toast",
        "提交失败显示错误信息",
        "同一手机号重复报名会被拦截",
        "连续点击提交按钮不会产生重复数据",
      ],
    });
  }

  if (hasFeatureSignal(productType, features, ["搜索", "筛选", "查询", "手机号搜索"])) {
    if (registration) {
      categories.push({
        category: "搜索验收",
        items: [
          "管理员可以按手机号搜索报名记录",
          "搜索结果只展示匹配手机号的数据",
          "清空搜索条件后恢复完整列表",
          "无匹配结果时显示空状态提示",
        ],
      });
    } else if (!ticketWorkflow && !knowledgeBase && !crm) {
      categories.push({
        category: "列表筛选验收",
        items: [
          "管理员可以按状态、日期或关键词筛选列表",
          "筛选结果只展示符合条件的数据",
          "清空筛选条件后恢复完整列表",
          "无匹配结果时显示空状态提示",
        ],
      });
    }
  }

  if (registration && hasFeatureSignal(productType, features, ["导出", "Excel", "xlsx", "CSV"])) {
    categories.push({
      category: "导出验收",
      items: [
        "管理员能按当前筛选条件导出 Excel 文件",
        "导出文件字段、顺序和页面列表一致",
        "无数据时导出空表也有表头",
        "导出失败时有明确错误提示",
      ],
    });
  }

  if (!contentCommunity && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["资料包", "数字资料", "商品", "产品", "价格"])) {
    categories.push({
      category: "资料包验收",
      items: [
        "资料包列表和详情页展示标题、简介、价格和状态",
        "只展示已上架资料包，已下架资料不能被购买",
        "订单金额必须由后端根据商品价格计算",
        "前端传入金额被篡改时后端必须拒绝或忽略",
      ],
    });
  }

  if (!contentCommunity && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["订单", "下单", "购买"])) {
    categories.push({
      category: "订单验收",
      items: [
        "登录用户可以为指定资料包创建待支付订单",
        "订单状态至少区分 pending、paid、failed 或 canceled",
        "重复点击创建订单不会产生不可解释的重复支付状态",
        "用户只能查看自己的订单",
      ],
    });
  }

  if (!contentCommunity && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["下载", "下载权限", "资料文件", "文件"])) {
    categories.push({
      category: "下载权限验收",
      items: [
        "未支付订单不能下载资料文件",
        "支付成功后才能下载对应资料",
        "下载接口必须校验登录、订单归属和支付状态",
        "下载记录包含用户、资料、订单和时间",
        "不能通过前端拼接文件 URL 绕过下载权限",
      ],
    });
  }

  if (!contentCommunity && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["上架", "下架", "订单管理", "下载记录", "资料管理"])) {
    categories.push({
      category: "电商后台验收",
      items: [
        "管理员可以新增、编辑和上下架资料包",
        "管理员可以查看订单和下载记录",
        "未登录管理员不能访问资料、订单和下载记录接口",
        "后台操作失败时有明确错误提示",
      ],
    });
  }

  if (appointment) {
    categories.push({
      category: "预约验收",
      items: [
        "用户可以查看可预约服务项目",
        "用户可以查看可预约时间段",
        "用户可以提交预约并看到确认信息",
        "满员时间段不能继续预约",
        "重复点击提交不会产生重复预约",
        "容量限制必须由后端校验",
        "用户可以取消预约",
        "取消预约后释放对应时间段容量",
      ],
    });
    categories.push({
      category: "预约后台验收",
      items: [
        "管理员可以新增、编辑和停用服务项目",
        "管理员可以新增、编辑和停用时间段",
        "管理员可以查看预约列表",
        "管理员可以按状态筛选预约",
        "未登录管理员不能访问服务、时间段和预约管理接口",
      ],
    });
  }

  if (contentCommunity) {
    categories.push({
      category: "内容发布验收",
      items: [
        "用户可以注册、登录和退出",
        "登录用户提交文章后进入 pending 状态",
        "pending 文章不能在公开列表或详情页展示",
        "管理员通过文章后，文章状态变为 approved 并公开展示",
        "管理员拒绝或下架文章后，文章不能公开展示",
      ],
    });
    categories.push({
      category: "评论与举报验收",
      items: [
        "登录用户可以评论 approved 文章",
        "未登录用户不能发布文章、评论或举报",
        "用户可以举报评论",
        "管理员可以查看举报列表",
        "管理员隐藏评论后，该评论不在前台展示",
      ],
    });
    categories.push({
      category: "内容审核后台验收",
      items: [
        "管理员可以查看待审核文章列表",
        "管理员可以按文章状态筛选列表",
        "审核、隐藏评论、下架文章接口必须校验管理员登录态",
        "普通用户不能访问管理员审核接口",
        "管理员操作建议写入 moderation_actions 或等价日志，便于追踪",
      ],
    });
  }

  if (ticketWorkflow) {
    categories.push({
      category: "工单权限验收",
      items: [
        "未登录用户不能提交或查看工单",
        "用户只能查看自己的工单",
        "管理员可以查看全部工单",
        "处理人只能查看和处理分配给自己的工单",
        "普通用户不能访问管理员分派和后台筛选接口",
      ],
    });
    categories.push({
      category: "工单流转验收",
      items: [
        "管理员可以把工单分配给处理人",
        "状态只能按允许流程流转",
        "assigned、in_progress、resolved、closed、reopened 流程可验证",
        "非法状态流转会被后端拒绝并返回明确提示",
        "状态变更和分派操作会保存处理记录",
      ],
    });
    categories.push({
      category: "工单列表与回复验收",
      items: [
        "用户、管理员和处理人可以按权限在工单下留言",
        "评论和处理记录能按时间展示",
        "管理员可以按状态、优先级、处理人和截止时间筛选工单",
        "截止时间字段可以保存和展示",
      ],
    });
  }

  if (knowledgeBase) {
    categories.push({
      category: "知识库文档验收",
      items: [
        "未登录用户不能创建、编辑或查看受限文档",
        "成员登录后可以创建 draft 文档",
        "作者可以查看和编辑自己的 draft 文档",
        "非作者不能查看别人的 draft 文档",
        "draft 文档不出现在普通成员列表和搜索结果中",
      ],
    });
    categories.push({
      category: "文档发布与权限验收",
      items: [
        "管理员可以发布或撤回文档",
        "published 文档可以被有权限成员查看",
        "无权限成员不能查看受限文档详情",
        "管理员可以设置文档权限或可见范围",
        "权限校验必须在后端完成，不能只靠前端隐藏",
      ],
    });
    categories.push({
      category: "目录与搜索验收",
      items: [
        "管理员可以创建和编辑目录",
        "成员可以按权限查看目录下的文档",
        "搜索结果只返回当前用户有权限查看的 published 文档",
        "管理员可以查看全部文档并按目录或状态筛选",
        "错误操作有明确提示",
      ],
    });
  }

  if (singleUserCrm) {
    categories.push({
      category: "个人 CRM 客户管理验收",
      items: [
        "可以新增、查看、编辑和删除或归档客户",
        "客户可以保存联系人信息",
        "客户阶段可以更新并保存",
        "下次跟进时间可以保存并用于筛选",
        "系统不出现销售账号、管理员分配或多角色权限入口",
      ],
    });
    categories.push({
      category: "个人 CRM 跟进验收",
      items: [
        "可以给客户新增多条跟进记录",
        "跟进记录按时间展示",
        "跟进记录包含内容、方式和时间",
        "空内容、异常电话或异常日期有明确错误提示",
      ],
    });
  } else if (crm) {
    categories.push({
      category: "CRM 客户权限验收",
      items: [
        "未登录用户不能创建或查看客户",
        "销售可以创建客户",
        "销售只能查看和编辑自己负责的客户",
        "管理员可以查看所有客户",
        "普通销售不能访问管理员接口",
      ],
    });
    categories.push({
      category: "CRM 跟进验收",
      items: [
        "管理员可以分配客户给销售",
        "客户阶段可以更新并保存",
        "跟进记录可以新增并按时间展示",
        "跟进记录包含跟进人、内容、方式和时间",
        "下次跟进时间可以保存和筛选",
      ],
    });
    categories.push({
      category: "CRM 筛选验收",
      items: [
        "管理员可以按阶段筛选客户",
        "管理员可以按负责人筛选客户",
        "销售客户列表只展示自己负责的客户",
        "所有敏感操作需要后端鉴权，权限不能只靠前端隐藏",
        "错误操作有明确提示",
      ],
    });
  }

  if (domain === "generic") {
    const genericItems = buildGenericToolAcceptanceItems(productType, features);
    if (genericItems.length > 0) {
      categories.push({
        category: "小工具业务验收",
        items: genericItems,
      });
    }
  }

  if (!contentCommunity && !ticketWorkflow && !knowledgeBase && !crm && hasFeatureSignal(productType, features, ["AI", "GPT", "LLM", "模型", "生成", "文案"]) && !hasNegatedAi(buildFeatureText(productType, features))) {
    categories.push({
      category: "AI 生成验收",
      items: [
        "AI API Key 不能暴露在前端，所有模型调用必须经过后端代理",
        "生成失败有明确错误提示，失败时不应错误扣减次数",
        "生成过程中 loading 状态可见，避免用户重复点击",
        "生成历史可查看，并能追溯输入、输出、模型和时间",
        "错误日志包含 request_id，便于排查模型超时、额度不足和限流问题",
      ],
    });
  }

  if (hasAuth && hasFeatureSignal(productType, features, ["管理员", "后台", "登录", "退出"])) {
    const adminItems = contentCommunity
      ? [
          "管理员使用正确账号密码可以登录审核后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问文章审核、评论隐藏和举报处理接口会被拦截",
          "管理员退出登录后不能继续访问审核后台数据",
        ]
      : appointment
      ? [
          "管理员使用正确账号密码可以登录后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问后台服务、时间段和预约接口会被拦截",
          "管理员退出登录后不能继续访问后台数据",
        ]
      : ticketWorkflow
      ? [
          "管理员使用正确账号密码可以登录工单后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问工单分派、状态修改和后台筛选接口会被拦截",
          "管理员退出登录后不能继续访问工单后台数据",
        ]
      : knowledgeBase
      ? [
          "管理员使用正确账号密码可以登录知识库后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问成员、目录、文档发布和权限接口会被拦截",
          "管理员退出登录后不能继续访问知识库后台数据",
        ]
      : crm
      ? [
          "管理员使用正确账号密码可以登录 CRM 后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问客户分配、销售账号和全部客户接口会被拦截",
          "管理员退出登录后不能继续访问 CRM 后台数据",
        ]
      : [
          "管理员使用正确账号密码可以登录后台",
          "错误账号或密码会显示明确错误提示",
          "未登录访问后台列表、搜索和导出接口会被拦截",
          "管理员退出登录后不能继续访问后台数据",
        ];
    categories.push({
      category: "管理员登录验收",
      items: adminItems,
    });
  }

  if (platform === "mini_program") {
    categories.push({
      category: "小程序验收",
      items: [
        "真机表现与开发者工具一致",
        "页面路径正确",
        "域名已配置",
        "基础库版本兼容",
      ],
    });
  }

  return {
    productType,
    platform,
    technicalProfile,
    pmIntentDecision,
    categories,
    definitionOfDone: [...acceptanceRules.definition_of_done],
  };
}

function buildPmGateAcceptanceCategories(
  decision: PmIntentDecision
): Array<{ category: string; items: string[] }> {
  if (decision.needType === "multi_user_collaboration") {
    return [
      {
        category: "多人协作流程验收",
        items: [
          "自己给自己安排的任务保存后立即进入自己的日程",
          "给室友或成员安排的任务先进入待认领状态，不能直接变成对方已确认日程",
          "对方认领任务后，任务进入对方日程并保留认领时间",
          "任务完成、取消或重新分配后，所有成员刷新页面看到一致状态",
        ],
      },
      {
        category: "日程与访问边界验收",
        items: [
          "同一时间段的任务按已确认规则并排展示、高亮冲突或阻止安排",
          "访问方式必须在局域网、本机公网 IP 或域名 HTTPS 中明确一种",
          "多人运行时协作数据不得分别保存在各自浏览器 localStorage 里",
          "SQLite 数据文件或等价持久化文件重启服务后仍能恢复任务和成员数据",
        ],
      },
    ];
  }

  if (decision.needType === "content_marketing_site") {
    return [
      {
        category: "内容营销站验收",
        items: [
          "FAQ、照片、促销活动、教练或团队信息能从内容文件渲染到页面",
          "Agent 更新内容文件并重新部署后，线上页面展示最新内容",
          "页面包含面向本地曝光的标题、描述、结构化 FAQ 和 sitemap 基础信息",
          "移动端首屏、图片列表、活动信息和联系方式均正常展示",
        ],
      },
      {
        category: "维护边界验收",
        items: [
          "内容经常修改时默认按 Agent-assisted 内容文件维护，不强制生成 CMS 后台",
          "只有用户明确要求网页编辑、图片上传、多人维护或访客提交时才引入后端",
          "访客反馈或预约提交如果进入 MVP，必须有后端保存、审核或防垃圾策略",
        ],
      },
    ];
  }

  if (decision.needType === "data_visualization_site") {
    return [
      {
        category: "数据图表站验收",
        items: [
          "Agent 能从新 xlsx 或 CSV 生成页面读取的图表数据文件",
          "页面读取最新数据文件后，图表、指标卡和表格结果一致",
          "替换数据并重新部署后，线上页面展示最新结果",
          "数据为空、字段缺失或格式错误时页面有明确提示，不显示旧结果",
        ],
      },
      {
        category: "数据更新边界验收",
        items: [
          "默认不要求后台上传、数据库或登录权限",
          "只有用户明确要求网页上传、多人上传、历史版本或权限控制时才升级后端",
          "如果公开展示，部署地址和数据脱敏边界必须明确",
        ],
      },
    ];
  }

  return [
    {
      category: "PM Gate 验收",
      items: [
        "使用者、维护方式和访问方式已确认",
        "MVP 技术方案没有超出已确认边界",
      ],
    },
  ];
}

function hasFeatureSignal(productType: string, features: string[], signals: string[]): boolean {
  const text = buildFeatureText(productType, features).toLowerCase();
  return signals.some((signal) => text.includes(signal.toLowerCase()));
}

function buildFeatureText(productType: string, features: string[]): string {
  return `${productType} ${features.join(" ")}`;
}

function isStaticDisplaySite(
  productType: string,
  features: string[],
  platform: string,
  hasBackend: boolean,
  hasPayment: boolean,
  hasAuth: boolean
): boolean {
  if (platform !== "web") return false;
  if (hasBackend || hasPayment || hasAuth) return false;

  const text = `${productType} ${features.join(" ")}`;
  const staticSignals = [
    "静态",
    "展示",
    "作品",
    "作品集",
    "Portfolio",
    "portfolio",
    "纯HTML",
    "纯 HTML",
    "HTML/CSS/JS",
    "无后端",
  ];
  const dynamicSignals = [
    "表单",
    "提交",
    "登录",
    "支付",
    "后台",
    "管理",
    "API",
    "接口",
    "数据提交",
    "报名",
    "预约",
  ];

  return staticSignals.some((signal) => text.includes(signal)) && !dynamicSignals.some((signal) => text.includes(signal));
}

function buildStaticDisplayAcceptanceCategories(): Array<{ category: string; items: string[] }> {
  return [
    {
      category: "页面与内容验收",
      items: [
        "桌面端、平板和移动端均正常显示",
        "移动端不能横向溢出",
        "导航、Hero、关于、作品集、联系方式和页脚内容完整",
        "姓名、介绍、作品标题、邮箱、社媒链接等占位内容已替换为真实内容",
        "所有作品图片使用真实资源，尺寸合理且加载正常",
        "favicon 已在 head 中正确引用",
      ],
    },
    {
      category: "静态资源与性能验收",
      items: [
        "CSS、JS、图片等静态资源在线上环境加载正常",
        "首页首屏加载时间在 3 秒以内",
        "图片已压缩并使用合适尺寸，避免原图直出",
        "字体有可用 fallback；国内访问不依赖单一境外字体源",
        "动画在 prefers-reduced-motion 下可降级或关闭",
      ],
    },
    {
      category: "链接与交互验收",
      items: [
        "导航锚点、作品筛选、CTA 和联系方式链接均可点击",
        "外链使用 target=\"_blank\" 时带 rel=\"noopener noreferrer\"",
        "移动端菜单可打开和关闭，当前状态清晰",
        "键盘访问焦点清晰，不阻断 Tab 导航",
        "控制台无明显报错",
      ],
    },
    {
      category: "SEO 与分享验收",
      items: [
        "title 和 meta description 已配置",
        "Open Graph 和 Twitter Card 基础标签已配置",
        "canonical URL 已确认",
        "robots.txt 和 sitemap.xml 已准备",
        "404 页面或静态托管 fallback 已配置",
      ],
    },
    {
      category: "上线验证",
      items: [
        "线上地址可正常访问且 HTTPS 生效",
        "自定义域名、DNS 和 CDN 配置已验证",
        "部署产物不包含本地临时文件或未替换的测试资源",
        "托管平台回滚方式已确认",
      ],
    },
  ];
}

function buildLocalFirstAcceptanceCategories(
  technicalProfile: TechnicalProfile,
  productType: string,
  features: string[]
): Array<{ category: string; items: string[] }> {
  const categories: Array<{ category: string; items: string[] }> = [
    {
      category: "页面与交互验收",
      items: [
        "桌面端和移动端均正常显示",
        "移动端不能横向溢出",
        "新增、编辑、删除等用户操作后有明确反馈",
        "空数据时显示 empty state，例如提示“还没有记录”",
        "控制台无明显报错",
      ],
    },
    {
      category: "本地数据验收",
      items: [
        "可以新增一条记录，例如新增一个“帐篷”“牛奶”或“示例景点”",
        "可以编辑记录，例如修改数量、日期、状态或备注",
        "刷新页面后数据仍在，或静态 data.json 数据仍能重新加载",
        "删除记录后列表、统计和提醒同步更新",
      ],
    },
    {
      category: "搜索筛选验收",
      items: [
        "搜索、筛选、分类或标签条件能组合使用，清空条件后恢复完整列表",
        "无匹配结果时显示空状态，不应展示旧数据",
      ],
    },
  ];

  if (technicalProfile.shape === "local_json_import_export") {
    categories.push({
      category: "导入导出验收",
      items: [
        "可以导出 JSON 文件，文件里包含当前页面记录",
        "导入合法 JSON 后页面数据更新正确",
        "JSON 导入失败有明确提示，例如文件格式不对时不清空旧数据",
        "CSV 导出时字段、金额或日期与页面列表一致",
      ],
    });
  }

  if (technicalProfile.shape === "static_json_data_page") {
    categories.push({
      category: "静态数据页验收",
      items: [
        "data.json 加载成功，示例数据能展示出来，例如名称、地址、标签和备注",
        "列表数据和详情数据一致，不出现空白或 undefined",
        "按类型、标签或关键词筛选结果正确",
      ],
    });
    if (/地图|点位|坐标|景点|酒店|美食/.test(buildFeatureText(productType, features))) {
      categories.push({
        category: "地图验收",
        items: [
          "地图 provider 和 key 使用方式已明确，例如 Leaflet/OpenStreetMap 可不需要私密 key",
          "地图点位和列表数据一致，点击点位能看到对应详情",
          "地图 provider 或 key 缺失时有降级提示，例如仍展示列表",
        ],
      });
    }
  }

  categories.push({
    category: "小工具业务验收",
    items: buildGenericToolAcceptanceItems(productType, features),
  });

  return categories;
}

function buildGenericToolAcceptanceItems(productType: string, features: string[]): string[] {
  const text = buildFeatureText(productType, features);
  const items: string[] = [...buildLocalToolSignalProfile(text).acceptanceItems];

  if (/地图|景点|酒店|美食|点位|坐标|路线/.test(text)) {
    items.push("地图 provider、坐标来源和 API Key 使用方式已明确；Key 不应硬编码到公开仓库");
    items.push("用户保存的美食、酒店、景点能按类型筛选并正确显示在地图或列表中");
    items.push("点位新增、编辑、删除后刷新页面仍能保留本地数据");
  }

  if (/记账|预算|支出|收入|金额|CSV|导出/.test(text)) {
    items.push("金额输入只能接受合法数字，负数、空值和异常格式有明确提示");
    items.push("预算超限时有可见提醒，且不会阻止用户查看历史记录");
    items.push("CSV 导出字段、金额和日期与页面列表一致");
  }

  if (/打卡|健身|体重|趋势|连续/.test(text)) {
    items.push("同一天重复打卡时有明确处理规则，不会产生不可解释的重复记录");
    items.push("体重趋势图或统计结果与本地记录一致");
    items.push("连续打卡天数按日期计算，跨天和断签场景可验证");
  }

  if (/(宠物|猫|狗|疫苗|驱虫|体检)/.test(text) && /(提醒|到期|记录)/.test(text)) {
    items.push("疫苗、驱虫、体检等记录能保存名称、日期、下次到期时间和备注");
    items.push("到期提醒按日期排序，已过期、即将到期和未到期状态清晰");
    items.push("编辑或删除健康记录后，提醒列表同步更新");
  }

  if (/AA|均摊|分账|付款人|谁转给谁|结算|人员/.test(text)) {
    items.push("人员、消费项目、付款人和参与人变更后，结算结果实时重新计算");
    items.push("结算结果能明确展示谁需要转给谁多少钱，且总额守恒");
    items.push("小数、四舍五入和零金额场景有稳定规则，不会出现 NaN 或负零");
  }

  if (/搜索|筛选|分类|标签|收藏/.test(text)) {
    items.push("搜索、筛选、分类或标签条件能组合使用，清空条件后恢复完整列表");
    items.push("无匹配结果时显示空状态，不应展示旧数据");
  }

  if (/(电影|观影|影单|片单)/.test(text)) {
    items.push("电影条目能保存标题、状态、评分、标签和备注");
    items.push("想看、看过和收藏状态切换后刷新页面仍能保留");
    items.push("评分、标签和关键词筛选结果与本地记录一致");
  }

  if (/(保险|保单|保费)/.test(text)) {
    items.push("保单记录能保存保险名称、保费、缴费周期、到期日、客服电话和备注");
    items.push("到期提醒按日期排序，已过期、即将到期和未到期状态清晰");
    items.push("编辑或删除保单后，提醒列表同步更新");
  }

  if (/(食材|冰箱|保质期|菜谱)/.test(text)) {
    items.push("食材记录能保存名称、数量、保质期、存放位置和备注");
    items.push("快过期、已过期和正常食材能按保质期正确区分");
    items.push("菜谱灵感能关联或引用已有食材，筛选结果准确");
  }

  if (/(车辆|私家车|汽车|保养|里程)/.test(text)) {
    items.push("车辆记录能保存保养日期、里程、费用、维修项目和下次保养时间");
    items.push("下次保养提醒按日期或里程规则计算，状态清晰");
    items.push("编辑或删除保养记录后，统计和提醒同步更新");
  }

  if (/(露营|装备|打包|补货)/.test(text)) {
    items.push("装备项能保存名称、分类、数量、是否已打包、是否需要补货和备注");
    items.push("已打包、未打包和需补货状态切换后刷新页面仍能保留");
    items.push("按分类、关键词或状态筛选时结果准确，空列表有提示");
  }

  if (/(礼物|送礼|生日礼物|礼物灵感)/.test(text)) {
    items.push("礼物灵感能保存送礼对象、预算、礼物想法、购买状态、链接和备注");
    items.push("预算和购买状态更新后，列表和筛选结果同步变化");
    items.push("本地记录不会触发支付、订单或后台权限流程");
  }

  if (/(游戏|平台|成就|游玩状态|进度)/.test(text)) {
    items.push("游戏条目能保存游戏名、平台、游玩状态、评分、成就进度、标签和备注");
    items.push("游玩状态和成就进度更新后刷新页面仍能保留");
    items.push("按平台、状态、评分或标签筛选时结果准确");
  }

  if (/(维修|保修|家电|设备|维护)/.test(text)) {
    items.push("维修或保修记录能保存物品名称、日期、费用、状态和备注");
    items.push("即将到期、已过期和正常状态能按日期正确区分");
    items.push("编辑或删除记录后，提醒和列表状态同步更新");
  }

  if (/密码|账号|提示卡|密保|登录信息/.test(text)) {
    items.push("账号提示卡能保存服务名称、账号标识、提示信息和分类");
    items.push("敏感字段默认不明文展示，复制或查看操作有明确反馈");
    items.push("搜索和分类筛选不会暴露不相关记录");
  }

  if (/行李|打包|旅行清单|出行清单|装备|携带/.test(text)) {
    items.push("清单项能保存名称、分类、数量、是否已打包和备注");
    items.push("已打包和未打包状态切换后刷新页面仍能保留");
    items.push("按分类、关键词或状态筛选时结果准确，空列表有提示");
  }

  if (/作业|课程|考试|倒计时|截止|deadline/i.test(text)) {
    items.push("任务能保存课程、标题、截止时间、优先级和完成状态");
    items.push("倒计时按当前日期计算，逾期、今日到期和未到期状态清晰");
    items.push("完成状态切换后不会影响其它任务的截止提醒");
  }

  if (/订阅|续费|会员|账单|到期提醒/.test(text)) {
    items.push("订阅项能保存名称、周期、价格、下次续费日期和备注");
    items.push("续费提醒按日期排序，已过期、即将到期和未到期状态清晰");
    items.push("本地记录不会触发支付、订单或后台权限流程");
  }

  if (items.length === 0) {
    items.push("核心记录可以新增、查看、编辑和删除");
    items.push("刷新页面后，本地保存的数据仍能恢复");
    items.push("空值、异常日期和重复记录有明确处理规则");
  }

  return Array.from(new Set(items));
}
