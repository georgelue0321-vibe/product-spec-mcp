export interface ConnectGuideResult {
  configured: boolean;
  connectUrl: string;
  env?: Record<string, string>;
  steps: string[];
  warnings: string[];
  isError?: boolean;
}

const DEFAULT_CONNECT_URL = "https://productmcp.opc-mind.top/connect";

export function buildConnectGuide(connectFile?: Record<string, unknown>, client = "unknown"): ConnectGuideResult {
  const connectUrl = process.env.PRODUCT_SPEC_CONNECT_URL || DEFAULT_CONNECT_URL;
  const currentEnv = currentRemoteGateEnv();
  if (isRemoteGateConfigured() && !connectFile) {
    return {
      configured: true,
      connectUrl,
      env: currentEnv,
      steps: [
        "当前 product-spec MCP 已配置在线 PM Gate。",
        "继续正常使用 product_spec_assist；低置信或冲突需求会自动尝试在线判断。",
      ],
      warnings: [],
    };
  }

  const parsed = parseConnectFile(connectFile);
  if (parsed.env) {
    return {
      configured: false,
      connectUrl,
      env: parsed.env,
      steps: [
        `检测到连接文件。请把 env 写入当前 ${client || "Agent"} 的 product-spec-mcp 配置。`,
        "保存配置后，重启或刷新 MCP Server。",
        "重启后再次调用 product_spec_connect，确认 configured=true。",
      ],
      warnings: parsed.warnings,
    };
  }

  return {
    configured: false,
    connectUrl,
    isError: Boolean(connectFile && parsed.warnings.length > 0),
    steps: [
      `把这个链接发给用户打开：${connectUrl}`,
      "让用户点击“生成并下载连接文件”，页面会下载 product-spec-mcp-connect.json。",
      "请用户把下载的 JSON 文件直接发回当前对话；不要让用户手抄 token。",
      "收到 JSON 后，再调用 product_spec_connect 并把文件内容放入 connect_file。",
      "根据返回的 instructions.env 更新当前 MCP 配置，然后提示用户重启或刷新 MCP 连接。",
    ],
    warnings: parsed.warnings.length > 0
      ? parsed.warnings
      : [
          "不要手动填写 token；连接文件中已经包含所需配置。",
          "浏览器页面不能直接修改本机 Agent 配置，需要把连接文件交给 Agent 完成。",
        ],
  };
}

export function isRemoteGateConfigured(): boolean {
  return Boolean(process.env.PRODUCT_SPEC_REMOTE_GATE_URL && process.env.PRODUCT_SPEC_REMOTE_GATE_TOKEN);
}

function currentRemoteGateEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of [
    "PRODUCT_SPEC_REMOTE_GATE_URL",
    "PRODUCT_SPEC_REMOTE_GATE_TOKEN",
    "PRODUCT_SPEC_REMOTE_GATE_MODE",
    "PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS",
    "PRODUCT_SPEC_TELEMETRY",
  ]) {
    if (process.env[key]) env[key] = key === "PRODUCT_SPEC_REMOTE_GATE_TOKEN" ? "[CONFIGURED]" : String(process.env[key]);
  }
  return env;
}

function parseConnectFile(connectFile?: Record<string, unknown>): { env?: Record<string, string>; warnings: string[] } {
  if (!connectFile) return { warnings: [] };
  const warnings: string[] = [];
  if (connectFile.type !== "product-spec-mcp-connect") {
    warnings.push("连接文件 type 不是 product-spec-mcp-connect，请确认文件来源。");
  }

  const instructions = getRecord(connectFile.instructions);
  const env = getRecord(instructions?.env);
  if (env) {
    const normalized = normalizeEnv(env);
    if (normalized.PRODUCT_SPEC_REMOTE_GATE_URL && normalized.PRODUCT_SPEC_REMOTE_GATE_TOKEN) {
      return { env: normalized, warnings };
    }
  }

  const remoteGate = getRecord(connectFile.remoteGate);
  const url = asString(remoteGate?.url);
  const token = asString(remoteGate?.token);
  if (url && token) {
    return {
      env: {
        PRODUCT_SPEC_REMOTE_GATE_URL: url,
        PRODUCT_SPEC_REMOTE_GATE_TOKEN: token,
        PRODUCT_SPEC_REMOTE_GATE_MODE: asString(remoteGate?.mode) || "auto",
        PRODUCT_SPEC_REMOTE_GATE_TIMEOUT_MS: String(remoteGate?.timeoutMs || "10000"),
        PRODUCT_SPEC_TELEMETRY: asString(remoteGate?.telemetry) || "off",
      },
      warnings,
    };
  }

  warnings.push("连接文件缺少 PRODUCT_SPEC_REMOTE_GATE_URL 或 PRODUCT_SPEC_REMOTE_GATE_TOKEN。");
  return { warnings };
}

function normalizeEnv(env: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
