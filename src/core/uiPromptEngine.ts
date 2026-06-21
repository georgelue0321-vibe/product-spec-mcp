import uiTerms from "../rules/uiTerms.json";

export interface UiTranslation {
  originalDescription: string;
  identifiedIntent: string;
  frontendTerms: string[];
  modificationPrompt: string;
  suggestedComponent: string;
  codeHints: string[];
}

export function translateUiDescription(
  description: string,
  currentPage?: string,
  targetComponent?: string
): UiTranslation {
  let identifiedIntent = "UI 修改";
  let frontendTerms: string[] = [];
  let suggestedComponent = "";
  const codeHints: string[] = [];

  if (isPremiumHeroUpgrade(description)) {
    frontendTerms = [
      "Hero Section",
      "Layered Ambient Background",
      "Subtle Particle Field",
      "Animated Radial Gradient",
      "Mouse Parallax",
      "Premium Motion Design",
    ];
    suggestedComponent = "hero";
    identifiedIntent = "首页 Hero 高级动态视觉升级";
    codeHints.push(
      "在 Hero 内增加独立背景层，避免影响正文布局和可读性",
      "使用 1-2 个低透明度 radial-gradient 光斑做慢速漂移，不要使用高饱和大面积渐变",
      "粒子数量控制在 24-48 个，透明度低于 0.35，并在移动端减少或关闭",
      "金色点缀只用于光晕、细线、CTA hover 和少量粒子",
      "为 prefers-reduced-motion 提供降级，关闭粒子漂移和鼠标视差",
      "保持 Hero 文案层级不变，只强化背景、入场动画和 CTA 质感",
      "不要使用多个大面积渐变球、玻璃拟态卡片、漂浮装饰物或持续循环的文字 shimmer",
      "如果已有多个 orb 占位，最多启用 1-2 个作为环境光，其余隐藏或作为静态层处理"
    );
  }

  let matched = false;
  if (frontendTerms.length === 0) {
    for (const mapping of uiTerms.mappings) {
      if (description.includes(mapping.user_input)) {
        frontendTerms = mapping.frontend_terms;
        suggestedComponent = mapping.component_type;
        identifiedIntent = `将"${mapping.user_input}"映射为 ${mapping.frontend_terms.join("/")}`;
        matched = true;

        if (mapping.component_type === "upgrade") {
          codeHints.push(
            "增加标题与正文的字重和大小对比",
            "使用 8px 网格系统统一间距",
            "克制配色，主色不超过 2 种",
            "增加留白，减少视觉噪音"
          );
        }
        break;
      }
    }
  }

  if (!matched && frontendTerms.length === 0) {
    if (description.includes("高级") || description.includes("好看") || description.includes("美观")) {
      frontendTerms = ["Premium Visual Hierarchy", "Better Spacing", "Typography Scale", "Color System"];
      suggestedComponent = "upgrade";
      identifiedIntent = "提升视觉品质";
      codeHints.push(
        "增加标题与正文的字重和大小对比",
        "使用 8px 网格系统统一间距",
        "克制配色，主色不超过 2 种",
        "增加留白，减少视觉噪音"
      );
    } else if (description.includes("响应式") || description.includes("手机") || description.includes("移动端")) {
      frontendTerms = ["Responsive Layout", "Media Query", "Mobile First"];
      suggestedComponent = "responsive";
      identifiedIntent = "修复响应式布局";
    } else {
      frontendTerms = ["需要进一步明确具体修改区域"];
      identifiedIntent = "未明确识别";
    }
  }

  const modificationPrompt = buildModificationPrompt(
    frontendTerms,
    suggestedComponent,
    currentPage,
    targetComponent
  );

  return {
    originalDescription: description,
    identifiedIntent,
    frontendTerms,
    modificationPrompt,
    suggestedComponent,
    codeHints,
  };
}

function isPremiumHeroUpgrade(description: string): boolean {
  const heroSignals = ["Hero", "hero", "首屏", "首页", "首页Hero", "首页 Hero"];
  const upgradeSignals = ["高级", "视觉冲击", "动态背景", "光效", "粒子", "渐变流动", "极简", "深色主题", "金色"];
  return heroSignals.some((kw) => description.includes(kw)) && upgradeSignals.some((kw) => description.includes(kw));
}

function buildModificationPrompt(
  terms: string[],
  component: string,
  currentPage?: string,
  targetComponent?: string
): string {
  const page = currentPage || "当前页面";
  const target = targetComponent || component || "目标区域";

  return `在 ${page} 的 ${target} 区域进行修改：

技术术语：${terms.join(", ")}

修改方向：
1. 定位 ${target} 组件
2. 根据上述术语调整样式和交互
3. 确保桌面端和移动端表现一致`;
}
