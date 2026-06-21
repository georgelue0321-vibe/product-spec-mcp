import type { SpecResult } from "./promptBuilder.js";

export interface ConfirmationResult {
  items: string[];
  markdown: string;
}

export function buildConfirmation(spec: SpecResult): ConfirmationResult {
  const items = [
    `产品目标是：${spec.productGoal}`,
    `目标用户是：${spec.targetUser}`,
    `第一版 MVP 只包含：${spec.coreFeatures.join("、")}`,
    `推荐架构是：${spec.architecture}`,
    `数据方案是：${spec.dataModel}`,
    `暂不包含：${spec.nonGoals.join("、")}`,
    `验收标准是：${spec.successCriteria.join("、")}`,
  ];

  const markdown = `# 待用户确认

请确认以下理解是否正确：

${items.map((item, i) => `${i + 1}. ${item}`).join("\n")}

如果以上理解正确，可以回复：确认，生成最终开发 Prompt。
如果不正确，请指出需要修改的项目。`;

  return { items, markdown };
}
