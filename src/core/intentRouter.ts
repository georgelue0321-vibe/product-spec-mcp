export interface IntentResult {
  intent: string;
  scenario: "build_product" | "modify_ui" | "debug" | "launch" | "unknown";
  confidence: number;
}

const INTENT_KEYWORDS: Record<string, string[]> = {
  build_product: ["做", "开发", "创建", "实现", "搭建", "系统", "平台", "工具", "应用", "网站", "报名", "表单", "管理", "后台", "导出", "功能", "模块", "页面"],
  modify_ui: ["改", "修改", "调整", "优化", "美化", "页面", "界面", "样式", "布局", "高级"],
  debug: ["报错", "错误", "出错", "失败", "bug", "问题", "异常", "崩溃", "白屏"],
  launch: ["部署", "上线", "发布", "域名", "服务器", "备案", "运维"],
};

const INTENT_PRIORITY: Record<IntentResult["scenario"], number> = {
  unknown: 0,
  build_product: 1,
  modify_ui: 2,
  launch: 3,
  debug: 4,
};

export function routeIntent(rawIdea: string): IntentResult {
  if (isExplicitUiModification(rawIdea)) {
    return {
      intent: "modify_ui",
      scenario: "modify_ui",
      confidence: 1,
    };
  }

  if (isExplicitLaunchInquiry(rawIdea)) {
    return {
      intent: "launch",
      scenario: "launch",
      confidence: 1,
    };
  }

  let bestScenario: IntentResult["scenario"] = "unknown";
  let bestScore = 0;

  for (const [scenario, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (rawIdea.includes(kw)) score++;
    }
    const scenarioName = scenario as IntentResult["scenario"];
    if (
      score > bestScore ||
      (score === bestScore && score > 0 && INTENT_PRIORITY[scenarioName] > INTENT_PRIORITY[bestScenario])
    ) {
      bestScore = score;
      bestScenario = scenarioName;
    }
  }

  return {
    intent: bestScenario,
    scenario: bestScenario,
    confidence: Math.min(bestScore / 3, 1),
  };
}

function isExplicitUiModification(text: string): boolean {
  const existingContextSignals = ["我做了", "已经做了", "当前", "现有", "现在的", "首页", "Hero", "hero", "首屏"];
  const uiTargetSignals = ["Hero", "hero", "首屏", "首页", "页面", "界面", "区域", "背景"];
  const modificationSignals = ["太普通", "改", "修改", "调整", "优化", "美化", "升级", "提升", "方案", "视觉冲击", "高级"];

  return (
    existingContextSignals.some((kw) => text.includes(kw)) &&
    uiTargetSignals.some((kw) => text.includes(kw)) &&
    modificationSignals.some((kw) => text.includes(kw))
  );
}

function isExplicitLaunchInquiry(text: string): boolean {
  const launchSignals = ["上线", "部署", "发布"];
  const inquirySignals = ["需要注意什么", "注意什么", "怎么上线", "如何上线", "想上线", "要上线", "上线前", "准备上线"];
  const debugSignals = ["报错", "错误", "失败", "异常", "白屏", "崩溃"];

  return (
    launchSignals.some((kw) => text.includes(kw)) &&
    inquirySignals.some((kw) => text.includes(kw)) &&
    !debugSignals.some((kw) => text.includes(kw))
  );
}
