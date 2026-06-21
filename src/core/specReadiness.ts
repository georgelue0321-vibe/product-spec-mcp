export interface ReadinessResult {
  score: number;
  status: "Not Ready" | "Draft Ready" | "Build Ready";
  fields: Record<string, { weight: number; present: boolean; value?: string }>;
}

const FIELD_WEIGHTS: Record<string, number> = {
  product_goal: 10,
  target_user: 10,
  platform: 10,
  core_features: 10,
  data_persistence: 10,
  user_roles: 5,
  workflow: 10,
  backend_need: 5,
  external_integrations: 5,
  success_criteria: 5,
  non_goals: 5,
  form_fields: 5,
  primary_platform: 5,
  export_format: 3,
  dedup_strategy: 3,
  admin_access: 4,
};

const FIELD_KEYWORDS: Record<string, string[]> = {
  product_goal: ["做", "开发", "创建", "实现", "搭建", "系统", "平台", "工具", "应用"],
  target_user: ["用户", "客户", "玩家", "学生", "家长", "老师", "管理员", "企业", "个人"],
  platform: ["web", "网页", "小程序", "app", "移动端", "后台", "前端", "后端"],
  core_features: ["功能", "特性", "模块", "页面", "表单", "提交", "查看", "管理", "支付", "登录"],
  data_persistence: ["保存", "记录", "存储", "数据库", "历史", "持久化"],
  user_roles: ["登录", "注册", "权限", "管理员", "角色", "用户中心", "多角色"],
  workflow: ["流程", "步骤", "先", "然后", "最后", "审核", "审批", "提交"],
  backend_need: ["后台", "服务端", "API", "接口", "服务器", "后端"],
  external_integrations: ["支付", "短信", "微信", "支付宝", "AI", "第三方", "API调用"],
  success_criteria: ["验收", "完成", "成功", "标准", "测试"],
  non_goals: ["不做", "不包含", "排除", "不需要", "暂不"],
  form_fields: ["字段", "姓名", "电话", "邮箱", "地址", "采集", "表单", "报名"],
  primary_platform: ["手机", "移动端", "H5", "扫码", "微信", "桌面", "电脑"],
  export_format: ["导出", "Excel", "下载", "表格", "xlsx", "CSV", "PDF"],
  dedup_strategy: ["重复", "去重", "防刷", "唯一", "防重复"],
  admin_access: ["后台", "管理员", "访问", "权限", "登录"],
};

export function calculateReadiness(
  rawIdea: string,
  knownContext?: Record<string, any>
): ReadinessResult {
  let score = 0;
  const fields: Record<string, { weight: number; present: boolean; value?: string }> = {};
  const matchedKeywords = new Set<string>();

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const keywords = FIELD_KEYWORDS[field] || [];
    const hasContext = knownContext && knownContext[field] !== undefined;
    const keywordMatch = keywords.some(kw => {
      if (matchedKeywords.has(kw)) return false;
      if (rawIdea.includes(kw)) {
        matchedKeywords.add(kw);
        return true;
      }
      return false;
    });
    const present = keywordMatch || hasContext;

    if (present) {
      score += weight;
    }

    fields[field] = {
      weight,
      present: present ?? false,
      value: knownContext?.[field]?.toString(),
    };
  }

  let status: ReadinessResult["status"];
  if (score < 60) {
    status = "Not Ready";
  } else if (score < 80) {
    status = "Draft Ready";
  } else {
    status = "Build Ready";
  }

  return { score, status, fields };
}
