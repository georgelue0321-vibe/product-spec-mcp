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
}

export function buildSpec(
  rawIdea: string,
  context: Record<string, any>,
  readiness: { score: number; fields: Record<string, any> }
): SpecResult {
  const assumptions: string[] = [];
  const isActionable = readiness.score >= 70;
  
  // Normalize Chinese answer keys to English keys
  const normalizedContext = normalizeContext(context);

  const productGoal =
    normalizedContext.product_goal || extractGoal(rawIdea);
  if (!productGoal) {
    assumptions.push("产品目标：未明确，需要用户确认");
  }

  const targetUser =
    normalizedContext.target_user || extractTargetUser(rawIdea);
  if (!targetUser) {
    assumptions.push("目标用户：默认为个人用户");
  }

  const platform = normalizedContext.platform || extractPlatform(rawIdea) || "web";
  const coreFeatures = toArray(normalizedContext.core_features, extractFeatures(rawIdea));

  const isGenericFeatures = coreFeatures.length === 1 && coreFeatures[0] === "核心功能";
  if (isGenericFeatures) {
    assumptions.push("核心功能：未识别到具体功能，需要用户补充");
  }

  const dataModel = buildDataModel(normalizedContext);
  const needsBackend = normalizedContext.need_backend === true ||
    normalizedContext.data_persistence === true ||
    normalizedContext.user_roles === true ||
    normalizedContext.backend_need === true;

  return {
    readinessScore: readiness.score,
    readinessStatus: readiness.score < 60 ? "Not Ready" : readiness.score < 80 ? "Draft Ready" : "Build Ready",
    isActionable,
    productGoal: productGoal || "待用户确认",
    targetUser: targetUser || "待用户确认",
    platform,
    coreFeatures: isGenericFeatures ? ["待用户补充具体功能"] : coreFeatures,
    dataModel,
    architecture: buildArchitectureRecommendation(normalizedContext, needsBackend),
    apiDesign: needsBackend ? buildApiDesign(normalizedContext, coreFeatures) : "纯前端项目，无需 API",
    riskBoundaries: buildRiskBoundaries(normalizedContext),
    nonGoals: toArray(normalizedContext.non_goals, ["暂不包含高级功能", "暂不包含移动端 App"]),
    successCriteria: toArray(normalizedContext.success_criteria, ["核心功能可用", "无明显 Bug", "用户体验流畅"]),
    assumptions,
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
      if (negativeWords.some(w => lower.includes(w))) {
        mappedValue = false;
      } else if (positiveWords.some(w => lower.includes(w))) {
        mappedValue = true;
      }
    }
    
    normalized[mappedKey] = mappedValue;
  }
  
  // Special handling for specific values
  if (normalized.core_features === "支持多个活动") {
    normalized.core_features = ["活动管理", "报名表单", "数据查看", "Excel导出"];
  }
  
  // Set need_backend if any backend-related field is true
  if (normalized.backend_need === true || normalized.data_persistence === true || normalized.user_roles === true) {
    normalized.need_backend = true;
  }
  
  return normalized;
}

function toArray(value: unknown, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  return [String(value)];
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

function extractPlatform(text: string): string {
  if (text.includes("小程序")) return "mini_program";
  if (text.includes("app") || text.includes("App")) return "app";
  if (text.includes("后台")) return "backend";
  return "web";
}

function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const featureKeywords = [
    "登录", "注册", "提交", "查看", "管理", "编辑", "删除",
    "搜索", "筛选", "支付", "上传", "下载", "导出", "导入",
    "报名", "表单", "列表", "详情", "审核", "统计", "图表",
    "个人介绍", "作品", "图片", "联系方式", "响应式", "画廊", "展示",
  ];
  for (const kw of featureKeywords) {
    if (text.includes(kw)) features.push(kw);
  }
  return features.length > 0 ? features : ["核心功能"];
}

function buildDataModel(context: Record<string, any>): string {
  if (context.data_persistence === false) return "无需数据持久化";
  if (context.database) return `数据库: ${context.database}`;
  if (context.need_backend === false) return "无需数据库";
  return "待确认：建议 SQLite（MVP）或 PostgreSQL（生产）";
}

function buildArchitectureRecommendation(context: Record<string, any>, needsBackend: boolean): string {
  if (context.need_backend === false) return "纯前端架构";
  if (context.backend_need === false) return "纯前端架构";
  if (!needsBackend) return "纯前端架构";
  if (context.need_separation) return "前后分离架构";
  return "建议后端架构";
}

function buildApiDesign(context: Record<string, any>, features: string[]): string {
  if (context.need_backend === false) return "无需 API";
  const hasRealFeatures = features.some((f) => f !== "核心功能" && f !== "待用户补充具体功能");
  if (!hasRealFeatures) return "待用户补充具体功能后生成 API 设计";
  const apis = features.map((f) => `POST /api/${f} - ${f}相关操作`);
  return apis.join("\n");
}

function buildRiskBoundaries(context: Record<string, any>): string[] {
  const risks: string[] = [];
  if (context.has_payment) risks.push("支付回调必须后端处理");
  if (context.has_ai) risks.push("AI API Key 不能暴露在前端");
  if (context.has_auth) risks.push("权限校验不能只靠前端");
  return risks;
}
