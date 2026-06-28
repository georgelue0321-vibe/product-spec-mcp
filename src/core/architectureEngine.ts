import { matchKeywords } from "../utils/keywordMatch.js";
import architectureRules from "../rules/architectureRules.json";
import { classifyProductDomain } from "./domainClassifier.js";
import { isSingleUserCrmContext } from "./contextSignals.js";
import { buildTechnicalProfile, isLocalFirstProfile, type TechnicalProfile } from "./technicalProfile.js";
import { decidePmIntent, type PmIntentDecision } from "./pmIntentGate.js";

export interface ArchitectureDecision {
  canBeFrontendOnly: boolean;
  needBackend: boolean;
  needSeparation: boolean;
  recommendedDatabase: string;
  needAuth: boolean;
  needAdmin: boolean;
  needLogging: boolean;
  paymentRisk: boolean;
  aiKeyRisk: boolean;
  capacityRisk?: boolean;
  domain?: "registration" | "digital_commerce" | "appointment" | "content_community" | "ai_copywriting" | "ticket_workflow" | "knowledge_base" | "crm" | "generic";
  mvpSuggestion: string;
  productionSuggestion: string;
  reasoning: string[];
  technicalProfile?: TechnicalProfile;
  pmIntentDecision?: PmIntentDecision;
}

function buildPmGateArchitectureDecision(
  decision: PmIntentDecision,
  technicalProfile: TechnicalProfile
): ArchitectureDecision | null {
  if (decision.needType === "multi_user_collaboration") {
    return {
      canBeFrontendOnly: false,
      needBackend: true,
      needSeparation: false,
      recommendedDatabase: "SQLite（MVP）",
      needAuth: true,
      needAdmin: false,
      needLogging: true,
      paymentRisk: false,
      aiKeyRisk: false,
      capacityRisk: false,
      domain: "generic",
      mvpSuggestion:
        decision.accessTopology === "lan_only"
          ? "局域网 Node + SQLite：一台电脑/NAS 运行服务，成员通过局域网 IP 访问"
          : "Node + SQLite：固定几人外出访问时可先用低价公网 VPS + IP 地址跑通",
      productionSuggestion: "后续再补域名、HTTPS、备份和更完整账号权限；国内公开域名按实际情况考虑备案",
      reasoning: [
        "多人、协作、认领和跨用户日程是运行时共享数据，不能用每人本地 localStorage 解决。",
        "多人协作不直接等于正式公网 SaaS；先确认局域网是否足够。",
      ],
      technicalProfile,
      pmIntentDecision: decision,
    };
  }

  if (decision.needType === "content_marketing_site") {
    const needsBackend = decision.maintenanceMode === "web_admin" || decision.maintenanceMode === "visitor_submission";
    return {
      canBeFrontendOnly: !needsBackend,
      needBackend: needsBackend,
      needSeparation: false,
      recommendedDatabase: needsBackend ? "SQLite（MVP）" : "无需服务器数据库；使用静态内容文件",
      needAuth: decision.maintenanceMode === "web_admin",
      needAdmin: decision.maintenanceMode === "web_admin",
      needLogging: needsBackend,
      paymentRisk: false,
      aiKeyRisk: false,
      capacityRisk: false,
      domain: "generic",
      mvpSuggestion: needsBackend
        ? "轻后台 CMS + SQLite，用于网页里编辑内容和上传图片"
        : "静态内容营销站 + data.json/markdown/assets，由 Agent 更新内容并重新部署",
      productionSuggestion: "需要多人网页维护或访客提交时再升级后台、审核、防垃圾和通知",
      reasoning: ["内容经常改不直接触发后台；先看维护方式是不是 Agent-assisted。"],
      technicalProfile,
      pmIntentDecision: decision,
    };
  }

  if (decision.needType === "data_visualization_site") {
    const needsBackend = decision.maintenanceMode === "web_admin" || decision.maintenanceMode === "visitor_submission";
    return {
      canBeFrontendOnly: !needsBackend,
      needBackend: needsBackend,
      needSeparation: false,
      recommendedDatabase: needsBackend ? "SQLite（MVP）" : "无需服务器数据库；使用静态 chart-data.json",
      needAuth: needsBackend,
      needAdmin: needsBackend,
      needLogging: needsBackend,
      paymentRisk: false,
      aiKeyRisk: false,
      capacityRisk: false,
      domain: "generic",
      mvpSuggestion: needsBackend
        ? "上传接口 + xlsx 解析 + SQLite/文件存储，所有访客读取最新图表数据"
        : "Agent 解析 xlsx 生成 JSON，静态图表站读取 JSON 渲染",
      productionSuggestion: "需要历史版本、多人上传或权限时再补后端和数据库",
      reasoning: ["定期提供 xlsx 不等于必须后台；Agent-assisted 更新可先静态化。"],
      technicalProfile,
      pmIntentDecision: decision,
    };
  }

  return null;
}

export function decideArchitecture(
  productType: string,
  platform: string,
  features: string[],
  commercialIntent: boolean,
  expectedUsers: string
): ArchitectureDecision {
  const featureText = features.join(" ");
  const allText = `${productType} ${featureText}`;

  const matchedRules: (typeof architectureRules.rules)[0][] = [];

  for (const rule of architectureRules.rules) {
    const cond = rule.condition;
    let matched = false;
    if (cond.features_include) {
      if (matchKeywords(allText, cond.features_include)) {
        matched = true;
      }
    }
    if (cond.product_type_keywords) {
      if (matchKeywords(allText, cond.product_type_keywords)) {
        matched = true;
      }
    }
    if (matched) {
      matchedRules.push(rule);
    }
  }

  const matchedRule = matchedRules.length > 0
    ? matchedRules[matchedRules.length - 1]
    : architectureRules.rules[0];

  const result = matchedRule.result;
  const reasoning: string[] = [];
  const domain = classifyProductDomain(allText, { expected_users: expectedUsers }).domain;
  const technicalProfile = buildTechnicalProfile(allText, {
    expected_users: expectedUsers,
    commercial_intent: commercialIntent,
  });
  const pmIntentDecision = decidePmIntent(allText, {
    expected_users: expectedUsers,
    commercial_intent: commercialIntent,
  });
  const pmGateArchitecture = domain === "generic"
    ? buildPmGateArchitectureDecision(pmIntentDecision, technicalProfile)
    : null;
  if (pmGateArchitecture) return pmGateArchitecture;
  const contentCommunityDomain = domain === "content_community";
  const singleUserCrm = domain === "crm" && isSingleUserCrmContext(allText, { expected_users: expectedUsers });
  const personalLocalSignal =
    domain === "generic" &&
    expectedUsers !== "enterprise" &&
    expectedUsers !== "massive" &&
    !commercialIntent &&
    isLocalFirstProfile(technicalProfile);

  // Merge risk flags from all matched rules
  const paymentRisk = personalLocalSignal
    ? hasDirectPaymentRisk(allText)
    : matchedRules.some(r => r.result.payment_risk) && !hasNegatedPayment(allText);
  const aiKeyRisk = matchedRules.some(r => r.result.ai_key_risk) && !hasNegatedAi(allText);
  const personalLocalFrontendTool =
    personalLocalSignal &&
    !paymentRisk &&
    !aiKeyRisk;

  if (features.length === 0) {
    reasoning.push("未识别到具体功能，默认按展示类项目处理");
  }

  if (commercialIntent) {
    reasoning.push("有商业化意图，建议使用生产级架构");
  }

  if (expectedUsers === "enterprise" || expectedUsers === "massive") {
    reasoning.push("用户规模较大，建议使用可扩展架构");
  }

  if (personalLocalFrontendTool) {
    reasoning.push("个人本地小工具优先按纯前端处理：无需后端、登录、管理员后台或数据库服务。");
    return {
      canBeFrontendOnly: true,
      needBackend: false,
      needSeparation: false,
      recommendedDatabase: technicalProfile.shape === "static_page" ? "无需数据库" : "无需服务器数据库；可使用 localStorage、静态 JSON 或浏览器文件导入导出",
      needAuth: false,
      needAdmin: false,
      needLogging: false,
      paymentRisk: false,
      aiKeyRisk: false,
      capacityRisk: false,
      domain: "generic",
      mvpSuggestion: "纯 HTML/CSS/JS + localStorage 或静态 JSON；直接静态托管即可",
      productionSuggestion: "静态托管 + 数据导入导出备份；如后续多人协作再补后端和鉴权",
      reasoning,
      technicalProfile,
    };
  }

  const dbRec = result.recommended_database === "none"
    ? "无需数据库"
    : result.recommended_database ||
      architectureRules.database_recommendations[
        expectedUsers as keyof typeof architectureRules.database_recommendations
      ] ||
      "PostgreSQL";

  const isIndividualRegistrationMvp =
    expectedUsers === "individual" &&
    !matchKeywords(allText, ["预约", "时间段", "容量", "取消预约", "服务项目"]) &&
    domain === "registration" &&
    matchKeywords(allText, ["报名", "表单", "提交"]) &&
    matchKeywords(allText, ["后台", "管理", "导出", "搜索", "管理员"]) &&
    !paymentRisk &&
    !aiKeyRisk;
  const isIndividualDigitalCommerceMvp =
    expectedUsers === "individual" &&
    domain === "digital_commerce" &&
    matchKeywords(allText, ["资料包", "数字资料", "商品", "订单", "购买", "售卖"]) &&
    matchKeywords(allText, ["支付", "下载", "文件"]) &&
    paymentRisk &&
    !aiKeyRisk;
  const isIndividualAppointmentMvp =
    expectedUsers === "individual" &&
    domain === "appointment" &&
    matchKeywords(allText, ["预约", "时间段", "服务项目", "容量", "取消预约"]) &&
    !paymentRisk &&
    !aiKeyRisk;
  const isIndividualContentCommunityMvp =
    expectedUsers === "individual" &&
    contentCommunityDomain &&
    !paymentRisk &&
    !aiKeyRisk;
  const isIndividualTicketWorkflowMvp =
    expectedUsers === "individual" &&
    domain === "ticket_workflow" &&
    !paymentRisk &&
    !aiKeyRisk;
  const isIndividualKnowledgeBaseMvp =
    expectedUsers === "individual" &&
    domain === "knowledge_base" &&
    !paymentRisk &&
    !aiKeyRisk;
  const isIndividualCrmMvp =
    expectedUsers === "individual" &&
    domain === "crm" &&
    !paymentRisk &&
    !aiKeyRisk;
  const capacityRisk = matchKeywords(allText, ["容量", "人数", "满员", "时间段", "并发"]);

  if (isIndividualRegistrationMvp) {
    reasoning.push("个人开发者报名系统 MVP，优先选择简单可运行的单体后端、SQLite 和 Session 鉴权，不建议一开始引入 RBAC 或 PostgreSQL。");
  }
  if (isIndividualDigitalCommerceMvp) {
    reasoning.push("个人开发者数字资料售卖 MVP，优先选择单体后端、SQLite/JSON 存储、Session 鉴权和可替换 Mock Payment Provider。");
  }
  if (isIndividualAppointmentMvp) {
    reasoning.push("个人开发者预约服务 MVP，优先选择单体后端、SQLite/JSON 存储和 Session 鉴权；容量限制必须在后端校验。");
  }
  if (isIndividualContentCommunityMvp) {
    reasoning.push("个人开发者内容社区 MVP，优先选择单体后端、SQLite/JSON 存储和 Session 鉴权；文章审核、评论隐藏和举报处理必须在后端校验并可追踪。");
  }
  if (isIndividualTicketWorkflowMvp) {
    reasoning.push("个人开发者工单协作 MVP，优先选择单体后端、SQLite/JSON 存储和 Session 鉴权；分派、处理人权限和状态流转必须在后端校验并记录操作。");
  }
  if (isIndividualKnowledgeBaseMvp) {
    reasoning.push("个人开发者知识库 MVP，优先选择单体后端、SQLite/JSON 存储和 Session 鉴权；草稿、发布状态、文档权限和搜索结果必须在后端校验。");
  }
  if (isIndividualCrmMvp) {
    reasoning.push(
      singleUserCrm
        ? "个人单用户 CRM MVP，优先选择单体后端、SQLite/JSON 存储；不需要销售账号、管理员分配或多角色权限。"
        : "个人开发者轻量 CRM MVP，优先选择单体后端、SQLite/JSON 存储和 Session 鉴权；客户归属、负责人分配、阶段更新和跟进记录必须在后端校验。"
    );
  }

  const isLightweightIndividualMvp =
    isIndividualRegistrationMvp ||
    isIndividualDigitalCommerceMvp ||
    isIndividualAppointmentMvp ||
    isIndividualContentCommunityMvp ||
    isIndividualTicketWorkflowMvp ||
    isIndividualKnowledgeBaseMvp ||
    isIndividualCrmMvp;
  const coveredOperationalDomain = [
    "registration",
    "appointment",
    "content_community",
    "ticket_workflow",
    "knowledge_base",
    "crm",
  ].includes(domain);
  const isLightweightCoveredDomain =
    coveredOperationalDomain &&
    expectedUsers !== "enterprise" &&
    expectedUsers !== "massive" &&
    !commercialIntent &&
    !paymentRisk &&
    !aiKeyRisk;
  const needsBackend = technicalProfile.needsBackend || isLightweightCoveredDomain || isIndividualContentCommunityMvp || isIndividualTicketWorkflowMvp || isIndividualKnowledgeBaseMvp || isIndividualCrmMvp || result.need_backend || matchedRules.some(r => r.result.need_backend);
  const needsAuth = !singleUserCrm && (technicalProfile.needsAuth || isLightweightCoveredDomain || isIndividualContentCommunityMvp || isIndividualTicketWorkflowMvp || isIndividualKnowledgeBaseMvp || isIndividualCrmMvp || result.need_auth || matchedRules.some(r => r.result.need_auth) || /登录|鉴权|权限|下载|后台|管理员|处理人|成员|销售/.test(allText));
  const needsAdmin = !singleUserCrm && (technicalProfile.needsAdmin || isLightweightCoveredDomain || isIndividualContentCommunityMvp || isIndividualTicketWorkflowMvp || isIndividualKnowledgeBaseMvp || isIndividualCrmMvp || result.need_admin || matchedRules.some(r => r.result.need_admin) || /后台|管理员|审核|举报|隐藏|下架|分配|处理人|发布|撤回|目录权限|成员权限|负责人/.test(allText));
  const needsLogging = paymentRisk || aiKeyRisk || (!isLightweightIndividualMvp && (result.need_logging || matchedRules.some(r => r.result.need_logging)));

  return {
    canBeFrontendOnly: needsBackend ? false : result.can_be_frontend_only,
    needBackend: needsBackend,
    needSeparation: isLightweightIndividualMvp || isLightweightCoveredDomain ? false : result.need_separation,
    recommendedDatabase: isIndividualRegistrationMvp || (isLightweightCoveredDomain && domain === "registration") ? "SQLite" : isIndividualDigitalCommerceMvp || isIndividualAppointmentMvp || isIndividualContentCommunityMvp || isIndividualTicketWorkflowMvp || isIndividualKnowledgeBaseMvp || isIndividualCrmMvp || isLightweightCoveredDomain ? "SQLite 或 JSON 文件存储" : dbRec,
    needAuth: needsAuth,
    needAdmin: needsAdmin,
    needLogging: needsLogging,
    paymentRisk,
    aiKeyRisk,
    capacityRisk,
    domain: domain !== "generic" ? domain : "generic",
    mvpSuggestion: isIndividualRegistrationMvp
      ? "单体 Node.js/Express + SQLite + 服务端 Session + 管理员登录"
      : isIndividualDigitalCommerceMvp
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + Mock Payment Provider"
      : isIndividualAppointmentMvp
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 管理员后台"
      : isIndividualContentCommunityMvp
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 内容审核后台"
      : isIndividualTicketWorkflowMvp
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 简单角色字段（user/admin/handler）"
      : isIndividualKnowledgeBaseMvp
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 简单 role/visibility/document_permissions"
      : isIndividualCrmMvp
      ? singleUserCrm
        ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 个人单用户客户跟进"
        : "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 简单 role/owner_id/customer_assignments"
      : isLightweightCoveredDomain && domain === "registration"
      ? "单体 Node.js/Express + SQLite + 服务端 Session + 管理员登录"
      : isLightweightCoveredDomain && domain === "crm"
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session + 简单 role/owner_id/customer_assignments"
      : isLightweightCoveredDomain
      ? "单体后端 Node.js/Express + SQLite 或 JSON 文件存储 + 服务端 Session"
      : result.mvp_suggestion,
    productionSuggestion: isIndividualRegistrationMvp
      ? "Node.js/Express + PostgreSQL + 持久化 Session + 管理员关键操作记录"
      : isIndividualDigitalCommerceMvp
      ? "Node.js/Express + PostgreSQL + 微信/支付宝支付回调 + 订单幂等 + 对象存储签名下载"
      : isIndividualAppointmentMvp
      ? "Node.js/Express + PostgreSQL + 事务化容量校验 + 管理员关键操作记录"
      : isIndividualContentCommunityMvp
      ? "Node.js/Express + PostgreSQL + 内容审核状态机 + 管理员操作日志"
      : isIndividualTicketWorkflowMvp
      ? "Node.js/Express + PostgreSQL + 工单状态机 + 分派和状态变更操作日志"
      : isIndividualKnowledgeBaseMvp
      ? "Node.js/Express + PostgreSQL + 文档权限索引 + 发布操作记录 + 可选版本历史"
      : isIndividualCrmMvp
      ? singleUserCrm
        ? "Node.js/Express + SQLite + 自动备份 + 客户数据导入导出 + 可选本地访问密码"
        : "Node.js/Express + PostgreSQL + 客户归属索引 + 跟进操作记录 + 可选提醒任务"
      : result.production_suggestion,
    reasoning,
    technicalProfile,
  };
}

function hasNegatedAi(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,6}(AI|ai|LLM|llm|GPT|gpt|大模型|模型)/.test(text);
}

function hasNegatedPayment(text: string): boolean {
  return /(不接|不做|不用|无需|不需要|暂不|先不).{0,6}(支付|付款|收费|订单|退款)/.test(text);
}

function hasDirectPaymentRisk(text: string): boolean {
  if (hasNegatedPayment(text)) return false;
  if (/(AA|aa|分账|均摊|人均|谁该转给谁|转给谁|转账建议)/.test(text) &&
    /(记账|付款记录|付了多少钱|参与人|本地保存|localStorage|浏览器)/.test(text)) return false;
  return /支付|付款|收费|收款|退款|微信支付|支付宝|在线支付|付费套餐|套餐购买/.test(text);
}
