const GATE_SCHEMA_VERSION = "pm-gate-v1";
const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const DEFAULT_MIMO_MODEL = "mimo-v2.5";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DAILY_LIMIT = 20;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, gateSchemaVersion: GATE_SCHEMA_VERSION, connect: true });
    }
    if (request.method === "GET" && url.pathname === "/connect") {
      return html(connectPageHtml(url.origin));
    }
    if (request.method === "POST" && url.pathname === "/v1/connect-token") {
      return createConnectToken(request, env, url.origin);
    }
    if (request.method !== "POST" || url.pathname !== "/v1/pm-intent") {
      return json({ error: "not_found" }, 404);
    }
    const auth = await authorizeRequest(request, env);
    if (!auth.ok) {
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
    const dailyLimit = resolveDailyLimit(env);
    const tokenLimit = auth.token ? resolveTokenDailyLimit(auth.token, dailyLimit) : null;

    if (cached?.decision) {
      await maybeStoreSample(env, telemetryMode, body, cached.decision, cached.decision, {
        llmUsed: 0,
        cacheHit: 1,
        rateLimitStatus: "cache_hit",
      });
      await maybeStoreUsageEvent(env, auth, {
        llmUsed: 0,
        cacheHit: 1,
        model: llm.model,
        promptTokensApprox: cached.promptTokensApprox || 0,
        completionTokensApprox: cached.completionTokensApprox || 0,
        costUnits: 0,
      });
      const remaining = await combinedRemaining(env, ipKey, dailyLimit, auth.token, tokenLimit);
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
          limit: tokenLimit || dailyLimit,
          remaining,
          resetAt,
        },
        privacy: privacyResult(telemetryMode),
      });
    }

    const limit = await consumeCombinedLimit(env, ipKey, resetAt, dailyLimit, auth.token, tokenLimit);
    if (!limit.allowed) {
      await maybeStoreSample(env, telemetryMode, body, null, body.ruleDecision || {}, {
        llmUsed: 0,
        cacheHit: 0,
        rateLimitStatus: "limited",
        fallbackReason: limit.reason || "rate_limited",
      });
      await maybeStoreUsageEvent(env, auth, {
        llmUsed: 0,
        cacheHit: 0,
        model: llm.model,
        promptTokensApprox: 0,
        completionTokensApprox: 0,
        costUnits: 0,
      });
      return json({
        decision: fallbackDecision(body.ruleDecision),
        llmGate: { used: false, provider: llm.provider, model: llm.model, cacheHit: false },
        rateLimit: { limit: tokenLimit || dailyLimit, remaining: 0, resetAt },
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
    await maybeStoreUsageEvent(env, auth, {
      llmUsed: llmDecision ? 1 : 0,
      cacheHit: 0,
      model: llm.model,
      promptTokensApprox,
      completionTokensApprox,
      costUnits: llmDecision ? 1 : 0,
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
        limit: tokenLimit || dailyLimit,
        remaining: limit.remaining,
        resetAt,
      },
      privacy: privacyResult(telemetryMode),
    });
  },
};

async function authorizeRequest(request, env) {
  const token = parseBearerToken(request);
  if (!token) return { ok: false, kind: "none" };
  if (env.GATE_TOKEN && token === env.GATE_TOKEN) return { ok: true, kind: "legacy" };
  if (!token.startsWith("psm_")) return { ok: false, kind: "unknown" };
  if (!env.PROMPT_SAMPLES) return { ok: false, kind: "token", reason: "missing_d1" };
  await ensureConnectTables(env);
  const tokenHash = await sha256(token);
  const row = await env.PROMPT_SAMPLES.prepare(
    "SELECT id, token_prefix, daily_limit, monthly_limit, enabled FROM api_tokens WHERE token_hash = ? LIMIT 1"
  ).bind(tokenHash).first();
  if (!row || Number(row.enabled) !== 1) return { ok: false, kind: "token" };
  await env.PROMPT_SAMPLES.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), row.id)
    .run();
  return { ok: true, kind: "token", token: row };
}

function parseBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
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

function resolveDailyLimit(env) {
  const parsed = Number(env.DAILY_LLM_LIMIT || DEFAULT_DAILY_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAILY_LIMIT;
  return Math.floor(parsed);
}

function resolveTokenDailyLimit(token, fallback) {
  const parsed = Number(token?.daily_limit || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function resolveConnectTokenDailyLimit(env) {
  const parsed = Number(env.CONNECT_TOKEN_DAILY_LIMIT || env.DAILY_LLM_LIMIT || DEFAULT_DAILY_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAILY_LIMIT;
  return Math.floor(parsed);
}

async function createConnectToken(request, env, origin) {
  if (!env.PROMPT_SAMPLES) return json({ error: "missing_d1_binding" }, 503);
  await ensureConnectTables(env);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const token = `psm_${randomToken(32)}`;
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dailyLimit = resolveConnectTokenDailyLimit(env);
  const monthlyLimit = positiveIntegerOrNull(env.CONNECT_TOKEN_MONTHLY_LIMIT);
  const clientKey = normalizeSubmittedClient(body.client);
  const clientOther = sanitizeOptionalText(body.clientOther || body.client_other, 60);
  const client = clientKey === "other" && clientOther ? `other:${clientOther}` : clientKey;
  const useCases = normalizeSubmittedUseCases(body);
  const useCase = useCases.length > 0 ? useCases.join(",") : "unknown";
  const label = sanitizeShortText(body.label || `${client} connect token`, 80);

  await env.PROMPT_SAMPLES.prepare(
    `INSERT INTO api_tokens (
      id, token_hash, token_prefix, label, client, use_case, daily_limit, monthly_limit, enabled, created_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)`
  ).bind(
    id,
    tokenHash,
    token.slice(0, 12),
    label,
    client,
    useCase,
    dailyLimit,
    monthlyLimit,
    now
  ).run();

  const remoteGateUrl = resolveRemoteGateUrl(env, origin);
  const connectFile = buildConnectFile(remoteGateUrl, token, clientKey, client, useCases);
  return json({
    ok: true,
    tokenPrefix: token.slice(0, 12),
    dailyLimit,
    monthlyLimit,
    client,
    clientKey,
    useCase,
    useCases,
    connectFile,
  });
}

function buildConnectFile(remoteGateUrl, token, clientKey = "other", client = "other", useCases = []) {
  const env = {
    PRODUCT_SPEC_REMOTE_GATE_URL: remoteGateUrl,
    PRODUCT_SPEC_REMOTE_GATE_TOKEN: token,
    PRODUCT_SPEC_REMOTE_GATE_MODE: "auto",
    PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS: "10000",
    PRODUCT_SPEC_TELEMETRY: "off",
  };
  return {
    type: "product-spec-mcp-connect",
    version: 1,
    client,
    clientKey,
    useCase: useCases.join(",") || "unknown",
    useCases,
    remoteGate: {
      url: remoteGateUrl,
      token,
      mode: "auto",
      timeoutMs: 10000,
      telemetry: "off",
    },
    instructions: {
      summary: "请把 remoteGate 配置写入当前 Agent 的 product-spec-mcp 环境变量。",
      env,
      clientHint: clientConnectHint(clientKey),
      configSnippet: clientConfigSnippet(clientKey, env),
    },
  };
}

function normalizeSubmittedClient(value) {
  const normalized = normalizeClient(value);
  return ["workbuddy", "claude_desktop", "claude_code", "codex", "opencode", "other"].includes(normalized)
    ? normalized
    : "other";
}

function normalizeSubmittedUseCases(body) {
  const rawValues = Array.isArray(body.useCases)
    ? body.useCases
    : String(body.useCase || body.use_case || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const allowed = new Set(["personal_app_site", "client_requirements", "internal_team", "learning_testing", "other"]);
  const normalized = [];
  for (const value of rawValues) {
    const key = String(value || "").trim();
    if (allowed.has(key) && !normalized.includes(key)) normalized.push(key);
  }
  const otherText = sanitizeOptionalText(body.useCaseOther || body.use_case_other, 80);
  if (normalized.includes("other") && otherText) {
    normalized[normalized.indexOf("other")] = `other:${otherText}`;
  }
  return normalized;
}

function clientConnectHint(client) {
  const normalized = normalizeClient(client);
  const hints = {
    workbuddy: {
      target: "WorkBuddy MCP wrapper",
      action: "把 instructions.env 写入 WorkBuddy 中 product-spec MCP server 的环境变量配置，然后重启 MCP。",
    },
    cursor: {
      target: "Cursor MCP configuration",
      action: "把 configSnippet 合并到 Cursor 的 MCP 配置；如果已有 product-spec server，只补 env。",
    },
    claude_desktop: {
      target: "Claude Desktop MCP configuration",
      action: "把 configSnippet 合并到 claude_desktop_config.json；如果已有 product-spec server，只补 env。",
    },
    claude_code: {
      target: "Claude Code MCP configuration",
      action: "把 instructions.env 写入 Claude Code 中 product-spec MCP server 的环境变量配置，然后重启 MCP。",
    },
    codex: {
      target: "Codex MCP configuration",
      action: "把 instructions.env 写入当前 Codex 可用的 product-spec MCP server 配置，然后重启 MCP。",
    },
    opencode: {
      target: "opencode MCP configuration",
      action: "把 configSnippet 合并到 ~/.config/opencode/opencode.json；如果已有 product-spec server，只补 env。",
    },
    other: {
      target: "Generic MCP server configuration",
      action: "把 instructions.env 写入 product-spec MCP server 的环境变量配置，然后重启 MCP。",
    },
  };
  return hints[normalized] || hints.other;
}

function clientConfigSnippet(client, env) {
  const normalized = normalizeClient(client);
  if (normalized === "opencode") {
    return {
      mcp: {
        "product-spec": {
          type: "local",
          command: ["npx", "-y", "product-spec-mcp@latest"],
          enabled: true,
          timeout: 30000,
          env,
        },
      },
    };
  }
  if (normalized === "cursor" || normalized === "claude_desktop") {
    return {
      mcpServers: {
        "product-spec": {
          command: "npx",
          args: ["-y", "product-spec-mcp@latest"],
          env,
        },
      },
    };
  }
  return { env };
}

function normalizeClient(client) {
  const value = String(client || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("workbuddy")) return "workbuddy";
  if (value.includes("cursor")) return "cursor";
  if (value.includes("claude_code")) return "claude_code";
  if (value.includes("claude") && value.includes("code")) return "claude_code";
  if (value.includes("claude")) return "claude_desktop";
  if (value.includes("codex")) return "codex";
  if (value.includes("opencode")) return "opencode";
  return ["workbuddy", "cursor", "claude_desktop", "claude_code", "codex", "opencode", "other"].includes(value) ? value : "other";
}

function connectPageHtml(origin) {
  const apiUrl = `${origin}/v1/connect-token`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>连接 product-spec MCP</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f6f8fb; color: #172033; display: grid; place-items: center; }
    main { width: min(760px, calc(100vw - 32px)); padding: 48px 0; }
    h1 { font-size: 36px; line-height: 1.12; margin: 0 0 16px; letter-spacing: 0; }
    p { font-size: 16px; line-height: 1.7; color: #526071; margin: 0 0 18px; }
    .panel { background: rgba(255,255,255,.86); border: 1px solid #e4e9f1; border-radius: 8px; padding: 28px; box-shadow: 0 18px 48px rgba(25, 38, 64, .10); }
    .steps { display: grid; gap: 12px; margin: 26px 0; padding: 0; list-style: none; }
    .steps li { display: flex; gap: 12px; align-items: flex-start; color: #243246; }
    .num { flex: 0 0 28px; height: 28px; border-radius: 999px; background: #0f766e; color: white; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
    .form { display: grid; gap: 18px; margin: 24px 0; }
    label { display: grid; gap: 8px; font-size: 14px; font-weight: 700; color: #243246; }
    select, input[type="text"] { width: 100%; box-sizing: border-box; border: 1px solid #d8e0eb; border-radius: 8px; background: white; color: #172033; font: inherit; padding: 12px 14px; }
    select:focus, input[type="text"]:focus { outline: 2px solid rgba(15, 118, 110, .24); border-color: #0f766e; }
    .hint { font-size: 13px; font-weight: 500; color: #7a8698; }
    .hidden { display: none; }
    .checks { display: grid; gap: 10px; }
    .check { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 600; color: #243246; }
    .check input { width: 18px; height: 18px; accent-color: #0f766e; }
    button { appearance: none; border: 0; border-radius: 8px; background: #0f766e; color: white; font-size: 16px; font-weight: 700; padding: 14px 18px; cursor: pointer; }
    button:disabled { opacity: .65; cursor: wait; }
    .status { margin-top: 16px; font-size: 14px; color: #526071; min-height: 22px; }
    .fine { margin-top: 24px; font-size: 13px; color: #7a8698; }
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1>连接 product-spec MCP</h1>
      <p>下载连接文件，然后把文件发回给你正在使用的 Agent。Agent 会读取文件并把在线 PM Gate 配置写入当前 MCP 设置。</p>
      <ol class="steps">
        <li><span class="num">1</span><span>点击下方按钮生成你的连接文件。</span></li>
        <li><span class="num">2</span><span>把下载的 <strong>product-spec-mcp-connect.json</strong> 拖回或上传到 Agent 对话。</span></li>
        <li><span class="num">3</span><span>让 Agent 按文件里的说明完成配置并重启 MCP。</span></li>
      </ol>
      <div class="form">
        <label>
          你正在用哪个 AI 工具？
          <span class="hint">用于生成更准确的配置说明</span>
          <select id="client">
            <option value="workbuddy">WorkBuddy</option>
            <option value="claude_desktop">Claude Desktop</option>
            <option value="claude_code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="opencode">OpenCode</option>
            <option value="other">其他</option>
          </select>
          <input id="clientOther" class="hidden" type="text" maxlength="60" placeholder="请填写 AI 工具名称">
        </label>
        <label>
          你准备用它做什么？
          <span class="hint">可多选，只用于改进 product-spec，不影响连接</span>
          <span class="checks" id="useCases">
            <label class="check"><input type="checkbox" value="personal_app_site" checked>给自己做小应用 / 网站</label>
            <label class="check"><input type="checkbox" value="client_requirements">帮客户梳理需求</label>
            <label class="check"><input type="checkbox" value="internal_team">公司 / 团队内部项目</label>
            <label class="check"><input type="checkbox" value="learning_testing">学习或测试 MCP</label>
            <label class="check"><input id="useCaseOtherCheck" type="checkbox" value="other">其他</label>
          </span>
          <input id="useCaseOther" class="hidden" type="text" maxlength="80" placeholder="请填写其他用途">
        </label>
      </div>
      <button id="download">生成并下载连接文件</button>
      <div class="status" id="status"></div>
      <p class="fine">连接文件里包含你的专属访问 token，请不要公开分享。默认额度由服务端配置控制。</p>
    </section>
  </main>
  <script>
    const button = document.getElementById("download");
    const status = document.getElementById("status");
    const client = document.getElementById("client");
    const clientOther = document.getElementById("clientOther");
    const useCaseOtherCheck = document.getElementById("useCaseOtherCheck");
    const useCaseOther = document.getElementById("useCaseOther");
    client.addEventListener("change", () => {
      clientOther.classList.toggle("hidden", client.value !== "other");
    });
    useCaseOtherCheck.addEventListener("change", () => {
      useCaseOther.classList.toggle("hidden", !useCaseOtherCheck.checked);
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "正在生成连接文件...";
      try {
        const useCases = Array.from(document.querySelectorAll("#useCases input[type='checkbox']:checked"))
          .map((item) => item.value);
        const response = await fetch(${JSON.stringify(apiUrl)}, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client: client.value,
            clientOther: clientOther.value,
            useCases,
            useCaseOther: useCaseOther.value
          })
        });
        const payload = await response.json();
        if (!response.ok || !payload.connectFile) throw new Error(payload.error || "connect_failed");
        const blob = new Blob([JSON.stringify(payload.connectFile, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "product-spec-mcp-connect.json";
        a.click();
        URL.revokeObjectURL(url);
        status.textContent = "已下载连接文件。请把它发回给你的 Agent。";
      } catch (error) {
        status.textContent = "生成失败，请稍后重试。";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function resolveRemoteGateUrl(env, origin) {
  return String(env.PUBLIC_REMOTE_GATE_URL || `${origin}/v1/pm-intent`);
}

function randomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function positiveIntegerOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function sanitizeShortText(value, maxLength) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s.@:_-]/gu, "")
    .trim()
    .slice(0, maxLength) || "product-spec-mcp";
}

function sanitizeOptionalText(value, maxLength) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s.@:_-]/gu, "")
    .trim()
    .slice(0, maxLength);
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

async function consumeLimit(env, key, resetAt, dailyLimit) {
  if (!env.PROMPT_CACHE) return { allowed: true, remaining: dailyLimit - 1 };
  const current = Number(await env.PROMPT_CACHE.get(key) || "0");
  if (current >= dailyLimit) return { allowed: false, remaining: 0 };
  const next = current + 1;
  const resetSeconds = Math.max(60, Math.floor((new Date(resetAt).getTime() - Date.now()) / 1000));
  await env.PROMPT_CACHE.put(key, String(next), { expirationTtl: resetSeconds });
  return { allowed: true, remaining: Math.max(0, dailyLimit - next) };
}

async function remainingForKey(env, key, dailyLimit) {
  if (!env.PROMPT_CACHE) return dailyLimit;
  const current = Number(await env.PROMPT_CACHE.get(key) || "0");
  return Math.max(0, dailyLimit - current);
}

async function consumeCombinedLimit(env, ipKey, resetAt, dailyLimit, token, tokenLimit) {
  const ipLimit = await consumeLimit(env, ipKey, resetAt, dailyLimit);
  if (!ipLimit.allowed) return { allowed: false, remaining: 0, reason: "ip_rate_limited" };
  if (!token || !tokenLimit) return ipLimit;

  const monthly = await checkMonthlyLimit(env, token);
  if (!monthly.allowed) return { allowed: false, remaining: 0, reason: "token_monthly_limited" };

  const tokenKey = tokenRateLimitKey(token.id);
  const tokenDaily = await consumeLimit(env, tokenKey, resetAt, tokenLimit);
  if (!tokenDaily.allowed) return { allowed: false, remaining: 0, reason: "token_daily_limited" };

  return {
    allowed: true,
    remaining: Math.min(ipLimit.remaining, tokenDaily.remaining, monthly.remaining ?? tokenDaily.remaining),
  };
}

async function combinedRemaining(env, ipKey, dailyLimit, token, tokenLimit) {
  const ipRemaining = await remainingForKey(env, ipKey, dailyLimit);
  if (!token || !tokenLimit) return ipRemaining;
  const tokenRemaining = await remainingForKey(env, tokenRateLimitKey(token.id), tokenLimit);
  const monthly = await checkMonthlyLimit(env, token);
  return Math.min(ipRemaining, tokenRemaining, monthly.remaining ?? tokenRemaining);
}

function tokenRateLimitKey(tokenId) {
  return `token-rate:${shanghaiDateKey()}:${tokenId}`;
}

async function checkMonthlyLimit(env, token) {
  const monthlyLimit = Number(token?.monthly_limit || 0);
  if (!env.PROMPT_SAMPLES || !Number.isFinite(monthlyLimit) || monthlyLimit <= 0) return { allowed: true };
  await ensureConnectTables(env);
  const month = shanghaiDateKey().slice(0, 7);
  const row = await env.PROMPT_SAMPLES.prepare(
    "SELECT COALESCE(SUM(cost_units), 0) AS used FROM usage_events WHERE token_id = ? AND event_month = ?"
  ).bind(token.id, month).first();
  const used = Number(row?.used || 0);
  return { allowed: used < monthlyLimit, remaining: Math.max(0, monthlyLimit - used) };
}

async function rateLimitKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const day = shanghaiDateKey();
  const salt = env.RATE_LIMIT_SALT || "product-spec";
  return `rate:${day}:${await sha256(`${salt}:${ip}`)}`;
}

async function ensureConnectTables(env) {
  if (!env.PROMPT_SAMPLES) return;
  await env.PROMPT_SAMPLES.prepare(
    `CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      token_prefix TEXT NOT NULL,
      label TEXT,
      daily_limit INTEGER NOT NULL,
      monthly_limit INTEGER,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )`
  ).run();
  await env.PROMPT_SAMPLES.prepare(
    `CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash
      ON api_tokens(token_hash)`
  ).run();
  await env.PROMPT_SAMPLES.prepare(
    `CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      token_id TEXT,
      created_at TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_month TEXT NOT NULL,
      llm_used INTEGER NOT NULL,
      cache_hit INTEGER NOT NULL,
      model TEXT,
      prompt_tokens_approx INTEGER,
      completion_tokens_approx INTEGER,
      cost_units INTEGER NOT NULL
    )`
  ).run();
  await env.PROMPT_SAMPLES.prepare(
    `CREATE INDEX IF NOT EXISTS idx_usage_events_token_month
      ON usage_events(token_id, event_month)`
  ).run();
}

async function maybeStoreUsageEvent(env, auth, event) {
  if (!env.PROMPT_SAMPLES || !auth?.token) return;
  await ensureConnectTables(env);
  const date = shanghaiDateKey();
  await env.PROMPT_SAMPLES.prepare(
    `INSERT INTO usage_events (
      id, token_id, created_at, event_date, event_month, llm_used, cache_hit, model,
      prompt_tokens_approx, completion_tokens_approx, cost_units
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    auth.token.id,
    new Date().toISOString(),
    date,
    date.slice(0, 7),
    event.llmUsed ? 1 : 0,
    event.cacheHit ? 1 : 0,
    event.model || null,
    event.promptTokensApprox || 0,
    event.completionTokensApprox || 0,
    event.costUnits || 0
  ).run();
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

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
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
