import type { ClarificationQuestion, ClarificationResult } from "./clarificationEngine.js";
import type { PmIntentDecision } from "./pmIntentGate.js";
import type { ReadinessResult } from "./specReadiness.js";

export function shouldUsePmGateClarification(decision: PmIntentDecision): boolean {
  return [
    "personal_local_tool",
    "multi_user_collaboration",
    "content_marketing_site",
    "data_visualization_site",
  ].includes(decision.needType);
}

export function buildPmGateClarification(decision: PmIntentDecision): ClarificationResult {
  const questions = questionsForDecision(decision);
  return {
    missingFields: questions.map((question) => question.field),
    questions,
    defaultAssumptions: Object.fromEntries(questions.map((question) => [question.field, question.defaultAssumption])),
  };
}

export function buildPmGateReadiness(decision: PmIntentDecision, readiness: ReadinessResult): ReadinessResult {
  const draftReadyNeed =
    decision.needType === "personal_local_tool" ||
    decision.needType === "content_marketing_site" ||
    decision.needType === "data_visualization_site";

  if (!draftReadyNeed) return readiness;

  return {
    ...readiness,
    score: Math.max(readiness.score, 64),
    status: "Draft Ready",
  };
}

export function formatPmGateInterrogateResult(
  decision: PmIntentDecision,
  readiness: ReadinessResult,
  clarification: ClarificationResult
): string {
  const canDraft = readiness.status !== "Not Ready";
  const nextStep =
    decision.needType === "personal_local_tool"
      ? "可以按默认假设直接进入 spec_compile 生成 MVP 草案；如果要问用户，最多只问一句：是否按浏览器本地保存、不登录不做后台、页面内提醒继续？"
      : canDraft
      ? "可以按默认假设生成草案，同时只确认会改变架构的边界问题。"
      : "先确认会改变架构的边界问题，再进入 spec_compile。";

  return `# PM Gate 判断：${needTypeTitle(decision.needType)}

- **需求门:** ${decision.needType}
- **使用范围:** ${decision.usageScope}
- **维护方式:** ${decision.maintenanceMode}
- **访问方式:** ${decision.accessTopology}
- **技术形态:** ${decision.technicalShape}
- **推荐部署:** ${decision.recommendedDeployment}
- **强信号:** ${decision.strongSignals.join("、") || "无"}
- **弱信号:** ${decision.weakSignals.join("、") || "无"}
- **不要默认使用:** ${decision.mustNotUse.join("、") || "无"}

${decision.defaultAssumptions.map((item) => `- ${item}`).join("\n")}

> 先确认使用范围、维护方式和访问边界；不要套用无关 domain 模板。

## 可执行状态

- **Score:** ${readiness.score} / 100
- **状态:** ${readiness.status}
- **下一步:** ${nextStep}

## 边界问题

${clarification.questions.map(formatQuestion).join("\n\n")}

## 默认假设

${Object.entries(clarification.defaultAssumptions).map(([field, value]) => `- **${field}:** ${value}`).join("\n")}`;
}

function formatQuestion(question: ClarificationQuestion): string {
  return `### ${question.question}
- **举个例子:** ${question.example || "按用户原话补充即可。"}
- **为什么要问:** ${question.whyImportant}
- **推荐选项:** ${question.options.join(" / ")}
- **默认假设:** 如果不回答，默认为「${question.defaultAssumption}」`;
}

function questionsForDecision(decision: PmIntentDecision): ClarificationQuestion[] {
  switch (decision.needType) {
    case "personal_local_tool":
      return personalLocalToolQuestions();
    case "multi_user_collaboration":
      return multiUserCollaborationQuestions();
    case "content_marketing_site":
      return contentMarketingQuestions();
    case "data_visualization_site":
      return dataVisualizationQuestions();
    default:
      return [];
  }
}

function personalLocalToolQuestions(): ClarificationQuestion[] {
  return [
    {
      field: "record_fields",
      question: "每条记录要保存哪些信息？",
      example: "比如药品名、分类、数量、单位、有效期、存放位置、状态、备注。",
      whyImportant: "决定表单字段、列表列和提醒计算，不需要因此升级到后台。",
      options: ["名称 + 日期 + 状态 + 备注", "再加数量/单位/分类/位置", "我会自定义字段"],
      defaultAssumption: "名称、日期、状态、备注；药品类默认再加数量、分类和存放位置",
      priority: "P0",
    },
    {
      field: "data_storage",
      question: "数据保存在哪里？",
      example: "比如浏览器 localStorage，本机 JSON 备份，或以后再考虑多人同步。",
      whyImportant: "个人或家庭自用工具默认不需要服务器数据库。",
      options: ["浏览器 localStorage", "JSON/CSV 导入导出备份", "以后再考虑多人同步"],
      defaultAssumption: "浏览器 localStorage，支持 JSON 导入导出备份",
      priority: "P0",
    },
    {
      field: "operations",
      question: "第一版需要哪些操作？",
      example: "比如新增、编辑、删除、搜索筛选、临期/过期状态列表。",
      whyImportant: "锁定 MVP，不把清单工具扩成后台系统。",
      options: ["新增/编辑/删除 + 搜索筛选", "再加临期/过期提醒", "再加统计和导入导出"],
      defaultAssumption: "新增/编辑/删除 + 搜索筛选 + 页面内临期/过期提醒",
      priority: "P0",
    },
    {
      field: "account_scope",
      question: "需要登录、后台或管理员吗？",
      example: "比如完全不用登录，家庭电脑本地用；或以后再做多人账号。",
      whyImportant: "决定是否引入后端、鉴权和服务器成本。",
      options: ["不需要，浏览器本地用", "只加本地访问密码", "需要多人账号/后台"],
      defaultAssumption: "不需要登录、后台或管理员",
      priority: "P0",
    },
  ];
}

function multiUserCollaborationQuestions(): ClarificationQuestion[] {
  return [
    {
      field: "access_topology",
      question: "你们只在同一 Wi-Fi/局域网使用，还是外出也要访问？",
      example: "比如宿舍同一 Wi-Fi 内用，或人在外面也要用手机打开。",
      whyImportant: "先决定本地局域网服务、低价 VPS，还是域名 + HTTPS。",
      options: ["只在同一 Wi-Fi/局域网", "外出也要访问", "要正式域名 + HTTPS"],
      defaultAssumption: "先确认访问范围，不直接默认公网服务器",
      priority: "P0",
    },
    {
      field: "public_ip_acceptance",
      question: "如果外出也要访问，能否接受先用几十元/年的公网 VPS + IP 地址？",
      example: "比如先通过 http://服务器IP 打开，跑通后再考虑域名和备案。",
      whyImportant: "固定小团队 MVP 可以先避开域名、证书、备案和复杂运维。",
      options: ["能接受 IP 访问", "必须域名 + HTTPS", "先只做局域网"],
      defaultAssumption: "固定小组外出访问时，默认低价 VPS + SQLite + IP 地址",
      priority: "P0",
    },
    {
      field: "claim_rule",
      question: "别人安排给我的任务，必须我认领后才进入日程吗？",
      example: "比如室友安排后先显示待认领，自己给自己的任务直接生效。",
      whyImportant: "决定任务状态机和通知/提醒逻辑。",
      options: ["必须认领后生效", "创建后进入对方日程但标待确认", "创建后直接生效"],
      defaultAssumption: "别人安排的任务需要认领；自己安排给自己的任务直接生效",
      priority: "P0",
    },
    {
      field: "time_conflict_rule",
      question: "同一时间多个任务冲突时，是并排展示高亮，还是直接阻止安排？",
      example: "比如同一小时两个任务都显示在日程格子里，并用红色提示冲突。",
      whyImportant: "决定日程视图交互，是提醒型还是拦截型。",
      options: ["并排展示 + 高亮冲突", "阻止安排", "只提示但允许保存"],
      defaultAssumption: "并排展示并高亮冲突，不默认阻止安排",
      priority: "P1",
    },
  ];
}

function contentMarketingQuestions(): ClarificationQuestion[] {
  return [
    {
      field: "maintenance_mode",
      question: "内容更新是交给 Agent 改文件并重新部署，还是需要你在网页后台自己编辑？",
      example: "比如你把新照片和促销文案发给 Agent；或网页里登录后上传图片。",
      whyImportant: "内容经常改不等于必须做后台。",
      options: ["Agent 代维护并重新部署", "我手动改 Markdown/data.json", "网页后台编辑和上传"],
      defaultAssumption: "先按 Agent 代维护内容文件并重新部署",
      priority: "P0",
    },
    {
      field: "visitor_submission",
      question: "访客需要在网站上提交反馈、预约或报名吗？",
      example: "比如用户评价只是你整理后展示，还是访客能直接提交表单。",
      whyImportant: "访客提交会触发后端、审核、防垃圾和通知。",
      options: ["不需要访客提交", "只展示你整理的反馈", "需要访客在线提交"],
      defaultAssumption: "不做访客提交，只展示维护后的内容",
      priority: "P0",
    },
    {
      field: "geo_goal",
      question: "GEO/SEO 重点服务哪个本地曝光目标？",
      example: "比如附近健身房搜索、私教关键词、团课促销、品牌问答。",
      whyImportant: "决定页面结构、FAQ、schema 和内容栏目优先级。",
      options: ["本地搜索曝光", "问答内容覆盖", "促销活动转化"],
      defaultAssumption: "本地服务官网 + FAQ + 教练/课程/促销结构化内容",
      priority: "P1",
    },
  ];
}

function dataVisualizationQuestions(): ClarificationQuestion[] {
  return [
    {
      field: "data_update_mode",
      question: "新 xlsx 是交给 Agent 更新网站，还是网站里要有上传按钮？",
      example: "比如每次把 Excel 发给 Agent 重新生成 data.json，或用户在网页里上传。",
      whyImportant: "Agent 更新可以保持静态站；网页上传才需要更多运行时逻辑。",
      options: ["交给 Agent 更新并重新部署", "浏览器内上传解析", "后端统一上传保存"],
      defaultAssumption: "Agent 解析 xlsx 生成 data.json/chart config，再重新部署静态图表站",
      priority: "P0",
    },
    {
      field: "audience_scope",
      question: "图表只给自己看，还是公开给别人看？",
      example: "比如本地打开查看，或部署到公开网址给客户/团队看。",
      whyImportant: "决定部署、权限和是否需要统一在线数据源。",
      options: ["只给自己看", "公开只读展示", "固定团队可访问"],
      defaultAssumption: "默认静态只读展示，不默认登录和后台",
      priority: "P0",
    },
    {
      field: "history_versions",
      question: "需要保留历史版本，还是只展示最新结果？",
      example: "比如只替换最新数据，或保留每月 Excel 对比趋势。",
      whyImportant: "决定数据文件结构和是否需要版本管理。",
      options: ["只展示最新", "保留历史版本", "后续再加"],
      defaultAssumption: "MVP 只展示最新结果",
      priority: "P1",
    },
  ];
}

function needTypeTitle(needType: PmIntentDecision["needType"]): string {
  const titles: Record<PmIntentDecision["needType"], string> = {
    static_display: "静态展示网站",
    personal_local_tool: "个人本地工具",
    multi_user_collaboration: "多人协作工具",
    content_marketing_site: "内容营销网站",
    data_visualization_site: "数据图表网站",
    transaction_workflow: "交易/履约流程",
    content_knowledge: "内容/知识管理",
    ai_automation: "AI 自动化产品",
    unknown: "产品开发",
  };
  return titles[needType];
}
