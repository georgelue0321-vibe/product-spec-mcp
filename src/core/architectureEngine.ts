import { matchKeywords } from "../utils/keywordMatch.js";
import architectureRules from "../rules/architectureRules.json";

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
  mvpSuggestion: string;
  productionSuggestion: string;
  reasoning: string[];
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

  // Merge risk flags from all matched rules
  const paymentRisk = matchedRules.some(r => r.result.payment_risk);
  const aiKeyRisk = matchedRules.some(r => r.result.ai_key_risk);

  if (features.length === 0) {
    reasoning.push("未识别到具体功能，默认按展示类项目处理");
  }

  if (commercialIntent) {
    reasoning.push("有商业化意图，建议使用生产级架构");
  }

  if (expectedUsers === "enterprise" || expectedUsers === "massive") {
    reasoning.push("用户规模较大，建议使用可扩展架构");
  }

  const dbRec = result.recommended_database === "none"
    ? "无需数据库"
    : result.recommended_database ||
      architectureRules.database_recommendations[
        expectedUsers as keyof typeof architectureRules.database_recommendations
      ] ||
      "PostgreSQL";

  return {
    canBeFrontendOnly: result.can_be_frontend_only,
    needBackend: result.need_backend,
    needSeparation: result.need_separation,
    recommendedDatabase: dbRec,
    needAuth: result.need_auth,
    needAdmin: result.need_admin,
    needLogging: result.need_logging,
    paymentRisk,
    aiKeyRisk,
    mvpSuggestion: result.mvp_suggestion,
    productionSuggestion: result.production_suggestion,
    reasoning,
  };
}
