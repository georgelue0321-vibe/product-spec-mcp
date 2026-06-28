import { createHash } from "node:crypto";
import { decidePmIntent, type PmIntentDecision } from "./pmIntentGate.js";

export interface RemoteGateMeta {
  used: boolean;
  provider?: string;
  model?: string;
  cacheHit?: boolean;
  promptTokensApprox?: number;
  completionTokensApprox?: number;
  fallbackReason?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

export interface RemoteGateResult {
  decision: PmIntentDecision;
  meta: RemoteGateMeta;
}

type OnlineDecisionPayload = Partial<PmIntentDecision> & {
  bestGate?: PmIntentDecision["needType"];
};

export function shouldUseRemoteGate(local: PmIntentDecision, mode = process.env.PRODUCT_SPEC_REMOTE_GATE_MODE || "auto"): boolean {
  if (mode === "off") return false;
  if (!process.env.PRODUCT_SPEC_REMOTE_GATE_URL) return false;
  if (mode === "force") return true;
  return local.confidence === "low" || local.needType === "unknown" || local.technicalShape === "unknown" || hasRouteShapeConflict(local);
}

export async function callRemotePmIntentGate(
  message: string,
  context: Record<string, unknown>,
  localDecision: PmIntentDecision
): Promise<RemoteGateResult | null> {
  if (!shouldUseRemoteGate(localDecision)) return null;

  const url = process.env.PRODUCT_SPEC_REMOTE_GATE_URL;
  if (!url) return null;

  const controller = new AbortController();
  const timeout = Number(process.env.PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS || 10000);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.PRODUCT_SPEC_REMOTE_GATE_TOKEN
          ? { authorization: `Bearer ${process.env.PRODUCT_SPEC_REMOTE_GATE_TOKEN}` }
          : {}),
        "x-product-spec-telemetry": process.env.PRODUCT_SPEC_TELEMETRY || "off",
      },
      body: JSON.stringify({
        message: truncateForRemote(message),
        context,
        packageVersion: process.env.npm_package_version,
        client: "product-spec-mcp",
        messageHash: hashMessage(message),
        ruleDecision: summarizeDecision(localDecision),
        choices: {
          needType: [
            "static_display",
            "personal_local_tool",
            "multi_user_collaboration",
            "content_marketing_site",
            "data_visualization_site",
            "transaction_workflow",
            "content_knowledge",
            "ai_automation",
            "unknown",
          ],
          usageScope: ["self", "fixed_group", "public_audience", "unknown"],
          maintenanceMode: [
            "agent_assisted",
            "manual_files",
            "web_admin",
            "visitor_submission",
            "runtime_collaboration",
            "unknown",
          ],
          accessTopology: ["single_device", "lan_only", "internet_ip", "public_domain", "unknown"],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        decision: localDecision,
        meta: { used: false, fallbackReason: `remote_http_${response.status}` },
      };
    }

    const payload = await response.json() as {
      decision?: OnlineDecisionPayload;
      llmGate?: RemoteGateMeta;
      rateLimit?: RemoteGateMeta["rateLimit"];
    };
    if (!payload.decision) {
      return {
        decision: localDecision,
        meta: { used: false, fallbackReason: "remote_missing_decision" },
      };
    }

    const sanitized = sanitizeRemoteDecision(payload.decision);
    if (!sanitized) {
      return {
        decision: localDecision,
        meta: { used: false, fallbackReason: "remote_invalid_schema" },
      };
    }

    const merged = mergeRemoteDecision(localDecision, sanitized);
    return {
      decision: merged,
      meta: {
        used: payload.llmGate?.used ?? true,
        provider: payload.llmGate?.provider,
        model: payload.llmGate?.model,
        cacheHit: payload.llmGate?.cacheHit,
        promptTokensApprox: payload.llmGate?.promptTokensApprox,
        completionTokensApprox: payload.llmGate?.completionTokensApprox,
        rateLimit: payload.rateLimit,
      },
    };
  } catch (error) {
    return {
      decision: localDecision,
      meta: {
        used: false,
        fallbackReason: error instanceof Error ? error.name : "remote_error",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function mergeRemoteDecision(local: PmIntentDecision, remote: OnlineDecisionPayload): PmIntentDecision {
  const needType = remote.bestGate || remote.needType || local.needType;
  const draft: PmIntentDecision = {
    ...local,
    ...remote,
    needType,
    source: "merged",
    strongSignals: mergeStrings(local.strongSignals, remote.strongSignals),
    weakSignals: mergeStrings(local.weakSignals, remote.weakSignals),
    coreObjects: mergeStrings(local.coreObjects, remote.coreObjects),
    states: mergeStrings(local.states, remote.states),
    actions: mergeStrings(local.actions, remote.actions),
    mustNotUse: mergeStrings(local.mustNotUse, remote.mustNotUse),
    boundaryQuestionIds: mergeStrings(local.boundaryQuestionIds, remote.boundaryQuestionIds),
    defaultAssumptions: mergeStrings(local.defaultAssumptions, remote.defaultAssumptions),
  };
  return enforceRemoteHardRules(draft, local);
}

function sanitizeRemoteDecision(remote: OnlineDecisionPayload): OnlineDecisionPayload | null {
  const sanitized: OnlineDecisionPayload = {};

  if (remote.bestGate !== undefined) {
    if (!needTypes.includes(remote.bestGate)) return null;
    sanitized.bestGate = remote.bestGate;
  }
  if (remote.needType !== undefined) {
    if (!needTypes.includes(remote.needType)) return null;
    sanitized.needType = remote.needType;
  }
  if (remote.usageScope !== undefined) {
    if (!usageScopes.includes(remote.usageScope)) return null;
    sanitized.usageScope = remote.usageScope;
  }
  if (remote.maintenanceMode !== undefined) {
    if (!maintenanceModes.includes(remote.maintenanceMode)) return null;
    sanitized.maintenanceMode = remote.maintenanceMode;
  }
  if (remote.accessTopology !== undefined) {
    if (!accessTopologies.includes(remote.accessTopology)) return null;
    sanitized.accessTopology = remote.accessTopology;
  }
  if (remote.technicalShape !== undefined) {
    if (!technicalShapes.includes(remote.technicalShape)) return null;
    sanitized.technicalShape = remote.technicalShape;
  }
  if (remote.recommendedDeployment !== undefined) {
    if (!recommendedDeployments.includes(remote.recommendedDeployment)) return null;
    sanitized.recommendedDeployment = remote.recommendedDeployment;
  }
  if (remote.route !== undefined) {
    if (!routes.includes(remote.route)) return null;
    sanitized.route = remote.route;
  }
  if (remote.confidence !== undefined) {
    if (!confidences.includes(remote.confidence)) return null;
    sanitized.confidence = remote.confidence;
  }

  copyStringArray(remote, sanitized, "strongSignals");
  copyStringArray(remote, sanitized, "weakSignals");
  copyStringArray(remote, sanitized, "coreObjects");
  copyStringArray(remote, sanitized, "states");
  copyStringArray(remote, sanitized, "actions");
  copyStringArray(remote, sanitized, "mustNotUse");
  copyStringArray(remote, sanitized, "boundaryQuestionIds");
  copyStringArray(remote, sanitized, "defaultAssumptions");

  if (remote.source !== undefined) {
    if (!sources.includes(remote.source)) return null;
    sanitized.source = remote.source;
  }

  return sanitized;
}

function copyStringArray<K extends keyof OnlineDecisionPayload>(
  remote: OnlineDecisionPayload,
  sanitized: OnlineDecisionPayload,
  key: K
): void {
  const value = remote[key];
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return;
  (sanitized[key] as string[] | undefined) = value;
}

function enforceRemoteHardRules(remote: PmIntentDecision, local: PmIntentDecision): PmIntentDecision {
  const hasCollaboration =
    local.needType === "multi_user_collaboration" ||
    remote.needType === "multi_user_collaboration" ||
    mergeStrings(local.strongSignals, remote.strongSignals).some((signal) => /多人|共享|协作|认领|相互安排/.test(signal));
  if (hasCollaboration) {
    return {
      ...remote,
      needType: "multi_user_collaboration",
      maintenanceMode: "runtime_collaboration",
      technicalShape: "light_backend_json_sqlite",
      recommendedDeployment: recommendedDeploymentForCollaboration(remote.accessTopology),
      route: "spec_interrogate",
      mustNotUse: mergeStrings(remote.mustNotUse, ["static_display", "local_storage_only"]),
    };
  }

  const hasSensitiveBackendSignal = mergeStrings(local.strongSignals, remote.strongSignals).some((signal) =>
    /支付|订单|AI|公开提交|访客提交/.test(signal)
  );
  if (hasSensitiveBackendSignal && ["static_page", "local_storage_tool", "local_json_import_export"].includes(remote.technicalShape)) {
    return {
      ...remote,
      technicalShape: "full_backend_saas",
      route: "spec_interrogate",
      mustNotUse: mergeStrings(remote.mustNotUse, ["frontend_only"]),
    };
  }

  return remote;
}

function recommendedDeploymentForCollaboration(
  accessTopology: PmIntentDecision["accessTopology"]
): PmIntentDecision["recommendedDeployment"] {
  if (accessTopology === "lan_only") return "local_lan_server_sqlite";
  if (accessTopology === "internet_ip") return "cheap_vps_sqlite_by_ip";
  if (accessTopology === "public_domain") return "vps_domain_https";
  return "unknown";
}

function hasRouteShapeConflict(decision: PmIntentDecision): boolean {
  return decision.route === "architecture_decide" && decision.technicalShape !== "static_page";
}

function summarizeDecision(decision: PmIntentDecision): Record<string, unknown> {
  return {
    needType: decision.needType,
    usageScope: decision.usageScope,
    maintenanceMode: decision.maintenanceMode,
    accessTopology: decision.accessTopology,
    technicalShape: decision.technicalShape,
    confidence: decision.confidence,
    strongSignals: decision.strongSignals,
    weakSignals: decision.weakSignals,
    conflict: hasRouteShapeConflict(decision),
  };
}

function truncateForRemote(message: string): string {
  return message.length <= 500 ? message : `${message.slice(0, 500)}…`;
}

function hashMessage(message: string): string {
  return createHash("sha256").update(message.trim().replace(/\s+/g, " ")).digest("hex");
}

function mergeStrings(a: string[] = [], b: string[] = []): string[] {
  return Array.from(new Set([...a, ...b].filter(Boolean)));
}

export function buildRemoteFallbackDecision(message: string, context: Record<string, unknown> = {}): PmIntentDecision {
  return decidePmIntent(message, context);
}

const needTypes: PmIntentDecision["needType"][] = [
  "static_display",
  "personal_local_tool",
  "multi_user_collaboration",
  "content_marketing_site",
  "data_visualization_site",
  "transaction_workflow",
  "content_knowledge",
  "ai_automation",
  "unknown",
];
const usageScopes: PmIntentDecision["usageScope"][] = ["self", "fixed_group", "public_audience", "unknown"];
const maintenanceModes: PmIntentDecision["maintenanceMode"][] = [
  "agent_assisted",
  "manual_files",
  "web_admin",
  "visitor_submission",
  "runtime_collaboration",
  "unknown",
];
const accessTopologies: PmIntentDecision["accessTopology"][] = ["single_device", "lan_only", "internet_ip", "public_domain", "unknown"];
const technicalShapes: PmIntentDecision["technicalShape"][] = [
  "static_page",
  "local_storage_tool",
  "local_json_import_export",
  "static_json_data_page",
  "light_backend_json_sqlite",
  "full_backend_saas",
  "unknown",
];
const recommendedDeployments: PmIntentDecision["recommendedDeployment"][] = [
  "static_only",
  "local_browser_only",
  "static_hosting_with_agent_updates",
  "local_lan_server_sqlite",
  "cheap_vps_sqlite_by_ip",
  "vps_domain_https",
  "unknown",
];
const routes: PmIntentDecision["route"][] = ["spec_compile", "spec_interrogate", "architecture_decide"];
const confidences: PmIntentDecision["confidence"][] = ["high", "medium", "low"];
const sources: PmIntentDecision["source"][] = ["local_rule", "online_llm", "merged"];
