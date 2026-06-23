const GATE_SCHEMA_VERSION = "pm-gate-v1";
const DEFAULT_PROVIDER = "mimo";
const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const DEFAULT_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DAILY_LIMIT = 3;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, gateSchemaVersion: GATE_SCHEMA_VERSION });
    }
    if (request.method !== "POST" || url.pathname !== "/v1/pm-intent") {
      return json({ error: "not_found" }, 404);
    }
    if (!isAuthorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const telemetryMode = normalizeTelemetry(request.headers.get("x-product-spec-telemetry") || "off");
    const message = String(body.message || "").slice(0, 500);
    const messageHash = body.messageHash || await sha256(normalizeText(message));
    const llm = resolveLlmConfig(env);
    const cacheKey = `cache:${llm.provider}:${llm.model}:${messageHash}:${GATE_SCHEMA_VERSION}`;
    const cached = await env.PROMPT_CACHE?.get(cacheKey, "json");
    const ipKey = await rateLimitKey(request, env);
    const resetAt = nextShanghaiMidnightIso();

    if (cached?.decision) {
      await maybeStoreSample(env, telemetryMode, body, cached.decision, cached.decision, {
        llmUsed: 0,
        cacheHit: 1,
        rateLimitStatus: "cache_hit",
      });
      return json({
        decision: cached.decision,
        llmGate: {
          used: false,
          provider: llm.provider,
          model: llm.model,
          promptTokensApprox: cached.promptTokensApprox || 0,
          completionTokensApprox: cached.completionTokensApprox || 0,
          cacheHit: true,
        },
        rateLimit: {
          limit: DAILY_LIMIT,
          remaining: await remainingForKey(env, ipKey),
          resetAt,
        },
        privacy: privacyResult(telemetryMode),
      });
    }

    const limit = await consumeLimit(env, ipKey, resetAt);
    if (!limit.allowed) {
      await maybeStoreSample(env, telemetryMode, body, null, body.ruleDecision || {}, {
        llmUsed: 0,
        cacheHit: 0,
        rateLimitStatus: "limited",
        fallbackReason: "rate_limited",
      });
      return json({
        decision: fallbackDecision(body.ruleDecision),
        llmGate: { used: false, provider: llm.provider, model: llm.model, cacheHit: false },
        rateLimit: { limit: DAILY_LIMIT, remaining: 0, resetAt },
        privacy: privacyResult(telemetryMode),
      }, 429);
    }

    const prompt = buildGatePrompt(message, body.ruleDecision || {}, body.choices || {});
    const promptTokensApprox = approxTokens(prompt);

    let llmDecision;
    let completionTokensApprox = 0;
    let fallbackReason = "";
    try {
      const llmText = await callOpenAiCompatible(llm, prompt);
      completionTokensApprox = approxTokens(llmText);
      llmDecision = sanitizeDecision(extractJson(llmText));
      if (!llmDecision) fallbackReason = "invalid_llm_schema";
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "llm_error";
    }

    const finalDecision = llmDecision || fallbackDecision(body.ruleDecision);
    if (llmDecision && env.PROMPT_CACHE) {
      await env.PROMPT_CACHE.put(cacheKey, JSON.stringify({
        decision: finalDecision,
        promptTokensApprox,
        completionTokensApprox,
      }), { expirationTtl: 7 * 24 * 60 * 60 });
    }

    await maybeStoreSample(env, telemetryMode, body, llmDecision, finalDecision, {
      llmUsed: llmDecision ? 1 : 0,
      cacheHit: 0,
      promptTokensApprox,
      completionTokensApprox,
      rateLimitStatus: "allowed",
      fallbackReason,
    });

    return json({
      decision: finalDecision,
      llmGate: {
        used: Boolean(llmDecision),
        provider: llm.provider,
        model: llm.model,
        promptTokensApprox,
        completionTokensApprox,
        cacheHit: false,
        ...(fallbackReason ? { fallbackReason } : {}),
      },
      rateLimit: {
        limit: DAILY_LIMIT,
        remaining: limit.remaining,
        resetAt,
      },
      privacy: privacyResult(telemetryMode),
    });
  },
};

function isAuthorized(request, env) {
  if (!env.GATE_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.GATE_TOKEN}`;
}

function buildGatePrompt(message, rule, choices) {
  return JSON.stringify({
    task: "Choose the best PM gate only. Return strict JSON only.",
    example: {
      bestGate: "data_visualization_site",
      usageScope: "self",
      maintenanceMode: "agent_assisted",
      accessTopology: "single_device",
      confidence: "medium",
      strongSignals: ["xlsx"],
      weakSignals: ["website"],
      coreObjects: ["xlsx file"],
      states: [],
      actions: ["parse xlsx", "render chart"],
      mustNotUse: ["admin_backend_by_default"],
      boundaryQuestionIds: ["data_update_mode"],
    },
    output: {
      bestGate: "one needType enum",
      usageScope: "one usageScope enum",
      maintenanceMode: "one maintenanceMode enum",
      accessTopology: "one accessTopology enum",
      confidence: "high|medium|low",
      strongSignals: ["short strings"],
      weakSignals: ["short strings"],
      coreObjects: ["short strings"],
      states: ["short strings"],
      actions: ["short strings"],
      mustNotUse: ["short ids"],
      boundaryQuestionIds: ["short ids"],
    },
    msg: message,
    rule: {
      strong: rule.strongSignals || [],
      weak: rule.weakSignals || [],
      shape: rule.technicalShape || rule.shape || "unknown",
      conflict: Boolean(rule.conflict),
    },
    choices,
  });
}

function resolveLlmConfig(env) {
  const provider = String(env.LLM_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  if (provider === "deepseek") {
    return {
      provider,
      baseUrl: env.LLM_BASE_URL || env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
      model: env.LLM_MODEL || env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      apiKey: env.LLM_API_KEY || env.DEEPSEEK_API_KEY,
    };
  }
  return {
    provider: "mimo",
    baseUrl: env.LLM_BASE_URL || env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL,
    model: env.LLM_MODEL || env.MIMO_MODEL || DEFAULT_MIMO_MODEL,
    apiKey: env.LLM_API_KEY || env.MIMO_API_KEY,
  };
}

async function callOpenAiCompatible(llm, prompt) {
  if (!llm.apiKey) throw new Error(`missing_${llm.provider}_api_key`);
  const response = await fetch(`${normalizeBaseUrl(llm.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a terse product intent classifier.",
            "Return exactly one valid JSON object.",
            "Do not use markdown, code fences, comments, or prose.",
            "Use only enum values supplied by the user.",
          ].join(" "),
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${llm.provider}_http_${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(`${llm.provider}_error_${data.error.code || data.error.type || "unknown"}`);
  const content = extractOpenAiCompatibleContent(data);
  if (typeof content !== "string" || !content.trim()) throw new Error(`${llm.provider}_empty_content`);
  return content;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function extractOpenAiCompatibleContent(data) {
  const choice = data?.choices?.[0];
  const message = choice?.message || {};
  const content = message.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("");
    if (text.trim()) return text;
  }
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) return message.reasoning_content;
  if (typeof choice?.text === "string" && choice.text.trim()) return choice.text;
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  return "";
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // Continue to balanced object extraction below.
      }
    }
    const candidate = extractFirstBalancedObject(text);
    if (!candidate) return null;
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function extractFirstBalancedObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return "";
}

function sanitizeDecision(raw) {
  if (!raw || typeof raw !== "object") return null;
  const bestGate = raw.bestGate || raw.needType;
  if (!needTypes.includes(bestGate)) return null;
  const decision = { bestGate };
  copyEnum(raw, decision, "usageScope", usageScopes);
  copyEnum(raw, decision, "maintenanceMode", maintenanceModes);
  copyEnum(raw, decision, "accessTopology", accessTopologies);
  copyEnum(raw, decision, "confidence", confidences);
  copyStringArray(raw, decision, "strongSignals");
  copyStringArray(raw, decision, "weakSignals");
  copyStringArray(raw, decision, "coreObjects");
  copyStringArray(raw, decision, "states");
  copyStringArray(raw, decision, "actions");
  copyStringArray(raw, decision, "mustNotUse");
  copyStringArray(raw, decision, "boundaryQuestionIds");
  return decision;
}

function fallbackDecision(ruleDecision) {
  return {
    bestGate: ruleDecision?.needType || "unknown",
    usageScope: ruleDecision?.usageScope || "unknown",
    maintenanceMode: ruleDecision?.maintenanceMode || "unknown",
    accessTopology: ruleDecision?.accessTopology || "unknown",
    confidence: "low",
    strongSignals: ruleDecision?.strongSignals || [],
    weakSignals: ruleDecision?.weakSignals || [],
    coreObjects: [],
    states: [],
    actions: [],
    mustNotUse: ruleDecision?.mustNotUse || [],
    boundaryQuestionIds: ruleDecision?.boundaryQuestionIds || ["usage_scope", "maintenance_mode", "data_flow"],
  };
}

async function consumeLimit(env, key, resetAt) {
  if (!env.PROMPT_CACHE) return { allowed: true, remaining: DAILY_LIMIT - 1 };
  const current = Number(await env.PROMPT_CACHE.get(key) || "0");
  if (current >= DAILY_LIMIT) return { allowed: false, remaining: 0 };
  const next = current + 1;
  const resetSeconds = Math.max(60, Math.floor((new Date(resetAt).getTime() - Date.now()) / 1000));
  await env.PROMPT_CACHE.put(key, String(next), { expirationTtl: resetSeconds });
  return { allowed: true, remaining: Math.max(0, DAILY_LIMIT - next) };
}

async function remainingForKey(env, key) {
  if (!env.PROMPT_CACHE) return DAILY_LIMIT;
  const current = Number(await env.PROMPT_CACHE.get(key) || "0");
  return Math.max(0, DAILY_LIMIT - current);
}

async function rateLimitKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const day = shanghaiDateKey();
  const salt = env.RATE_LIMIT_SALT || "product-spec";
  return `rate:${day}:${await sha256(`${salt}:${ip}`)}`;
}

async function maybeStoreSample(env, telemetryMode, body, llmDecision, finalDecision, meta) {
  if (!env.PROMPT_SAMPLES || telemetryMode === "off") return;
  const id = crypto.randomUUID();
  const message = String(body.message || "").slice(0, 500);
  const messageHash = body.messageHash || await sha256(normalizeText(message));
  const sample = telemetryMode === "sample" ? redact(message) : null;
  await env.PROMPT_SAMPLES.prepare(
    `INSERT INTO prompt_samples (
      id, created_at, package_version, client, telemetry_mode, message_hash, message_sample,
      rule_decision_json, llm_decision_json, final_decision_json, llm_used, cache_hit,
      prompt_tokens_approx, completion_tokens_approx, rate_limit_status, fallback_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    new Date().toISOString(),
    body.packageVersion || null,
    body.client || null,
    telemetryMode,
    messageHash,
    sample,
    JSON.stringify(body.ruleDecision || {}),
    llmDecision ? JSON.stringify(llmDecision) : null,
    JSON.stringify(finalDecision || {}),
    meta.llmUsed,
    meta.cacheHit,
    meta.promptTokensApprox || null,
    meta.completionTokensApprox || null,
    meta.rateLimitStatus || null,
    meta.fallbackReason || null
  ).run();
}

function normalizeTelemetry(value) {
  return ["off", "minimal", "sample"].includes(value) ? value : "off";
}

function privacyResult(telemetryMode) {
  return {
    stored: telemetryMode !== "off",
    mode: telemetryMode,
    redacted: telemetryMode === "sample",
  };
}

function redact(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[PHONE]")
    .replace(/\b\d{15,19}\b/g, "[SENSITIVE_NUMBER]")
    .replace(/\b(?:sk|pk|api|token|secret)[-_]?[A-Za-z0-9]{16,}\b/gi, "[SECRET]")
    .replace(/([?&](?:token|key|secret|access_token)=)[^&\s]+/gi, "$1[SECRET]");
}

function shanghaiDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextShanghaiMidnightIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  const day = Number(parts.find((p) => p.type === "day").value);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00+08:00`;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, " ");
}

function approxTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function copyEnum(raw, decision, key, allowed) {
  if (raw[key] !== undefined && allowed.includes(raw[key])) decision[key] = raw[key];
}

function copyStringArray(raw, decision, key) {
  if (Array.isArray(raw[key])) decision[key] = raw[key].filter((item) => typeof item === "string").slice(0, 12);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const needTypes = [
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
const usageScopes = ["self", "fixed_group", "public_audience", "unknown"];
const maintenanceModes = ["agent_assisted", "manual_files", "web_admin", "visitor_submission", "runtime_collaboration", "unknown"];
const accessTopologies = ["single_device", "lan_only", "internet_ip", "public_domain", "unknown"];
const confidences = ["high", "medium", "low"];
