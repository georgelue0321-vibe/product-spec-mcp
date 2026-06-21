import type { ReadinessResult } from "./specReadiness.js";
import type { ClarificationResult } from "./clarificationEngine.js";
import type { SpecResult } from "./promptBuilder.js";
import type { ConfirmationResult } from "./confirmationBuilder.js";
import type { ArchitectureDecision } from "./architectureEngine.js";
import type { UiTranslation } from "./uiPromptEngine.js";
import type { DebugGuideResult } from "./debugEngine.js";
import type { AcceptanceResult } from "./acceptanceEngine.js";

export function formatInterrogateResult(
  readiness: ReadinessResult,
  clarification: ClarificationResult
): string {
  let md = `# 需求追问结果

## 1. 需求完整度评分

- **Score:** ${readiness.score} / 100
- **状态:** ${readiness.status}

## 2. 我当前理解的需求

基于您的描述，我理解您想要实现一个功能系统。当前信息完整度为 ${readiness.score}%，${readiness.status === "Not Ready" ? "信息不足，需要进一步明确" : readiness.status === "Draft Ready" ? "可以生成草案，但部分信息需要确认" : "信息充足，可以进入开发"}。

## 3. 当前缺失的关键信息

`;

  const missingByPriority: Record<string, string[]> = { P0: [], P1: [], P2: [] };
  for (const q of clarification.questions) {
    missingByPriority[q.priority] = missingByPriority[q.priority] || [];
    missingByPriority[q.priority].push(q.field);
  }

  for (const [priority, fields] of Object.entries(missingByPriority)) {
    if (fields.length > 0) {
      md += `### ${priority}\n`;
      for (const f of fields) {
        md += `- ${f}\n`;
      }
    }
  }

  md += `\n## 4. 需要追问用户的问题\n\n`;

  for (const q of clarification.questions) {
    md += `### ${q.question}\n`;
    md += `- **为什么要问:** ${q.whyImportant}\n`;
    md += `- **推荐选项:** ${q.options.join(" / ")}\n`;
    md += `- **默认假设:** 如果不回答，默认为「${q.defaultAssumption}」\n\n`;
  }

  md += `## 5. 当前默认假设\n\n`;
  for (const [field, assumption] of Object.entries(clarification.defaultAssumptions)) {
    md += `- **${field}:** ${assumption}\n`;
  }

  md += `\n## 6. 是否建议进入开发\n\n`;
  if (readiness.status === "Not Ready") {
    md += `**不建议直接开发** - 信息不足，建议先回答上述问题。\n`;
  } else if (readiness.status === "Draft Ready") {
    md += `**可以先生成草案** - 但需要标注默认假设和风险。\n`;
  } else {
    md += `**可以生成正式开发 Prompt** - 信息充足。\n`;
  }

  md += `\n## 7. 下一步可复制回复\n\n`;
  md += `请复制以下内容并填写：\n\n\`\`\`\n`;
  for (const q of clarification.questions) {
    md += `${q.question}\n回答：\n\n`;
  }
  md += `\`\`\`\n`;

  return md;
}

export function formatCompileResult(
  mode: "not_ready" | "draft" | "formal",
  readiness: ReadinessResult,
  clarification?: ClarificationResult,
  spec?: SpecResult,
  confirmation?: ConfirmationResult
): string {
  if (mode === "not_ready" && clarification) {
    return `# 需求信息不足

当前 Readiness Score: ${readiness.score}/100 (${readiness.status})

> ⛔ **不可直接开发** - 信息严重缺失，必须先回答以下问题。

${formatInterrogateResult(readiness, clarification)}`;
  }

  if (!spec) return "# 错误：无法生成规格";

  if (mode === "draft") {
    let md = `# 产品规格草案

> ⚠️ **注意：** 以下内容基于默认假设生成，**不可直接用于开发**，需要用户确认。

## 需求完整度

- **Score:** ${readiness.score} / 100
- **状态:** ${readiness.status}
- **是否可执行:** 否（需要用户确认假设）

## 需求摘要

- **产品目标:** ${spec.productGoal}
- **目标用户:** ${spec.targetUser}
- **运行平台:** ${spec.platform}

## 核心功能

${spec.coreFeatures.map((f) => `- ${f}`).join("\n")}

## 默认假设（需要用户确认）

${spec.assumptions.length > 0 ? spec.assumptions.map((a) => `- ⚠️ ${a}`).join("\n") : "- 无默认假设"}

## 风险提示

${spec.riskBoundaries.length > 0 ? spec.riskBoundaries.map((r) => `- ⚠️ ${r}`).join("\n") : "- 无特殊风险"}

## 下一步

请先补充上述缺失信息，或明确接受默认假设后再生成正式开发 Prompt。

`;

    if (confirmation) {
      md += confirmation.markdown;
    }

    return md;
  }

  let md = `# 产品规格

## 需求完整度

- **Score:** ${readiness.score} / 100
- **状态:** ${readiness.status}
- **是否可执行:** 是

## 需求摘要

- **产品目标:** ${spec.productGoal}
- **目标用户:** ${spec.targetUser}
- **运行平台:** ${spec.platform}

## 架构建议

${spec.architecture}

## 核心功能

${spec.coreFeatures.map((f) => `- ${f}`).join("\n")}

## 数据模型

${spec.dataModel}

## API 设计

\`\`\`
${spec.apiDesign}
\`\`\`

## 风险边界

${spec.riskBoundaries.length > 0 ? spec.riskBoundaries.map((r) => `- ⚠️ ${r}`).join("\n") : "无特殊风险"}

## 暂不包含

${spec.nonGoals.map((g) => `- ${g}`).join("\n")}

## 验收标准

${spec.successCriteria.map((c) => `- ${c}`).join("\n")}

## 开发 Prompt

请基于以上规格，实现以下内容：

1. 创建项目基础结构
2. 实现核心功能：${spec.coreFeatures.join("、")}
3. 实现数据持久化
4. 添加必要的错误处理
5. 确保桌面端和移动端适配

`;

  if (confirmation) {
    md += confirmation.markdown;
  }

  return md;
}

export function formatArchitectureResult(decision: ArchitectureDecision): string {
  let md = `# 架构决策结果

## 架构判断

| 项目 | 结论 |
|------|------|
| 可以纯前端 | ${decision.canBeFrontendOnly ? "✅ 是" : "❌ 否"} |
| 需要后端 | ${decision.needBackend ? "✅ 是" : "❌ 否"} |
| 需要前后分离 | ${decision.needSeparation ? "✅ 是" : "❌ 否"} |
| 需要鉴权 | ${decision.needAuth ? "✅ 是" : "❌ 否"} |
| 需要管理后台 | ${decision.needAdmin ? "✅ 是" : "❌ 否"} |
| 需要日志模块 | ${decision.needLogging ? "✅ 是" : "❌ 否"} |

## 推荐方案

- **数据库:** ${decision.recommendedDatabase}
- **MVP 方案:** ${decision.mvpSuggestion}
- **正式方案:** ${decision.productionSuggestion}

## 风险提示

`;

  if (decision.paymentRisk) {
    md += `- ⚠️ **支付风险:** 必须后端处理支付回调，不能只靠前端跳转判断支付成功\n`;
  }
  if (decision.aiKeyRisk) {
    md += `- ⚠️ **AI Key 风险:** API Key 不能暴露在前端，必须后端代理\n`;
  }
  if (!decision.paymentRisk && !decision.aiKeyRisk) {
    md += `- 无特殊风险\n`;
  }

  if (decision.reasoning.length > 0) {
    md += `\n## 推理过程\n\n`;
    for (const r of decision.reasoning) {
      md += `- ${r}\n`;
    }
  }

  return md;
}

export function formatUiTranslateResult(translation: UiTranslation): string {
  let md = `# UI 术语翻译结果

## 原始描述

> ${translation.originalDescription}

## 识别意图

${translation.identifiedIntent}

## 前端术语

${translation.frontendTerms.map((t) => `\`${t}\``).join(" / ")}

## 修改 Prompt

${translation.modificationPrompt}

`;

  if (translation.codeHints.length > 0) {
    md += `## 代码建议

`;
    for (const hint of translation.codeHints) {
      md += `- ${hint}\n`;
    }
  }

  return md;
}

export function formatDebugGuideResult(guide: DebugGuideResult): string {
  let md = `# Debug 排查指引

## 平台

${guide.platform}

## 需要您提供的信息

`;

  for (const info of guide.requiredInfo) {
    const provided = guide.knownInfo[info.field];
    if (provided) {
      md += `- ✅ **${info.description}:** ${provided}\n`;
    } else {
      md += `- ❌ **${info.description}** (优先级: ${info.priority})\n`;
      md += `  - 获取方式: ${info.how_to_get}\n`;
    }
  }

  md += `\n## 排查步骤\n\n`;
  for (const step of guide.troubleshootingSteps) {
    md += `${step}\n`;
  }

  md += `\n## 常见问题\n\n`;
  for (const issue of guide.commonIssues) {
    md += `- ${issue}\n`;
  }

  return md;
}

export function formatAcceptanceResult(acceptance: AcceptanceResult): string {
  let md = `# 验收标准

## 产品类型

${acceptance.productType}

## 平台

${acceptance.platform}

`;

  for (const cat of acceptance.categories) {
    md += `## ${cat.category}\n\n`;
    for (const item of cat.items) {
      md += `- [ ] ${item}\n`;
    }
    md += `\n`;
  }

  md += `## Definition of Done\n\n`;
  for (const item of acceptance.definitionOfDone) {
    md += `- [ ] ${item}\n`;
  }

  return md;
}
