import { afterEach, describe, expect, it, vi } from "vitest";

type KvStore = Map<string, string>;

const originalFetch = globalThis.fetch;

describe("pm intent Worker rate limit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("uses DAILY_LLM_LIMIT from Worker env", async () => {
    const response = await callWorker({ DAILY_LLM_LIMIT: "5" });
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.rateLimit.limit).toBe(5);
    expect(payload.rateLimit.remaining).toBe(4);
  });

  it("falls back to the default limit when DAILY_LLM_LIMIT is invalid", async () => {
    const response = await callWorker({ DAILY_LLM_LIMIT: "not-a-number" });
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.rateLimit.limit).toBe(20);
    expect(payload.rateLimit.remaining).toBe(19);
  });

  it("generates connect files and accepts psm tokens", async () => {
    const d1 = fakeD1();
    const worker = (await import("../workers/pm-intent-gate.mjs")).default;
    const connectResponse = await worker.fetch(
      new Request("https://productmcp.example.com/v1/connect-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: "opencode", useCases: ["client_requirements", "learning_testing"] }),
      }),
      {
        GATE_TOKEN: "legacy-token",
        DEEPSEEK_API_KEY: "test-key",
        PROMPT_CACHE: fakeKv(),
        PROMPT_SAMPLES: d1,
        DAILY_LLM_LIMIT: "20",
        CONNECT_TOKEN_DAILY_LIMIT: "7",
      }
    );
    const connectPayload = await connectResponse.json() as any;
    const token = connectPayload.connectFile.remoteGate.token;

    expect(connectResponse.status).toBe(200);
    expect(token).toMatch(/^psm_/);
    expect(connectPayload.dailyLimit).toBe(7);
    expect(connectPayload.client).toBe("opencode");
    expect(connectPayload.clientKey).toBe("opencode");
    expect(connectPayload.useCase).toBe("client_requirements,learning_testing");
    expect(connectPayload.useCases).toEqual(["client_requirements", "learning_testing"]);
    expect(connectPayload.connectFile.instructions.env.PRODUCT_SPEC_REMOTE_GATE_TOKEN).toBe(token);
    expect(connectPayload.connectFile.useCases).toEqual(["client_requirements", "learning_testing"]);
    expect(connectPayload.connectFile.instructions.clientHint.target).toContain("opencode");
    expect(connectPayload.connectFile.instructions.configSnippet.mcp["product-spec"].env.PRODUCT_SPEC_REMOTE_GATE_TOKEN).toBe(token);

    const gateResponse = await callWorker({ DAILY_LLM_LIMIT: "20", PROMPT_SAMPLES: d1 }, token);
    const gatePayload = await gateResponse.json() as any;

    expect(gateResponse.status).toBe(200);
    expect(gatePayload.rateLimit.limit).toBe(7);
    expect(gatePayload.rateLimit.remaining).toBe(6);
    expect(d1.usageEvents.some((event) => event.token_id === d1.tokens[0].id && event.cost_units === 1)).toBe(true);
  });

  it("serves the browser connect page", async () => {
    const worker = (await import("../workers/pm-intent-gate.mjs")).default;
    const response = await worker.fetch(new Request("https://productmcp.example.com/connect"), {});
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("生成并下载连接文件");
    expect(body).toContain("你正在用哪个 AI 工具？");
    expect(body).toContain("你准备用它做什么？");
    expect(body).toContain("帮客户梳理需求");
    expect(body).toContain("/v1/connect-token");
  });
});

async function callWorker(extraEnv: Record<string, any>, token = "test-token") {
  const worker = (await import("../workers/pm-intent-gate.mjs")).default;
  const kv = fakeKv();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                bestGate: "data_visualization_site",
                usageScope: "self",
                maintenanceMode: "agent_assisted",
                accessTopology: "single_device",
                confidence: "medium",
                strongSignals: ["xlsx"],
                weakSignals: [],
                coreObjects: ["xlsx"],
                states: [],
                actions: ["render charts"],
                mustNotUse: [],
                boundaryQuestionIds: ["data_update_mode"],
              }),
            },
          },
        ],
      }),
    })
  );

  return worker.fetch(
    new Request("https://gate.example.com/v1/pm-intent", {
      method: "POST",
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: JSON.stringify({
        message: "我想做个图表网站，每次提供新的 xlsx 文件就更新图表",
        ruleDecision: { needType: "unknown", technicalShape: "unknown" },
      }),
    }),
    {
      GATE_TOKEN: "test-token",
      DEEPSEEK_API_KEY: "test-key",
      PROMPT_CACHE: kv,
      ...extraEnv,
    }
  );
}

function fakeKv() {
  const store: KvStore = new Map();
  return {
    async get(key: string, type?: string) {
      const value = store.get(key) ?? null;
      if (type === "json" && value) return JSON.parse(value);
      return value;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function fakeD1() {
  const state = {
    tokens: [] as any[],
    usageEvents: [] as any[],
    prepare(sql: string) {
      let params: any[] = [];
      return {
        bind(...values: any[]) {
          params = values;
          return this;
        },
        async run() {
          if (/INSERT INTO api_tokens/i.test(sql)) {
            state.tokens.push({
              id: params[0],
              token_hash: params[1],
              token_prefix: params[2],
              label: params[3],
              client: params[4],
              use_case: params[5],
              daily_limit: params[6],
              monthly_limit: params[7],
              enabled: 1,
              created_at: params[8],
              last_used_at: null,
            });
          } else if (/UPDATE api_tokens/i.test(sql)) {
            const token = state.tokens.find((item) => item.id === params[1]);
            if (token) token.last_used_at = params[0];
          } else if (/INSERT INTO usage_events/i.test(sql)) {
            state.usageEvents.push({
              id: params[0],
              token_id: params[1],
              created_at: params[2],
              event_date: params[3],
              event_month: params[4],
              llm_used: params[5],
              cache_hit: params[6],
              model: params[7],
              prompt_tokens_approx: params[8],
              completion_tokens_approx: params[9],
              cost_units: params[10],
            });
          }
          return { success: true };
        },
        async first() {
          if (/FROM api_tokens/i.test(sql)) {
            return state.tokens.find((item) => item.token_hash === params[0]) || null;
          }
          if (/FROM usage_events/i.test(sql)) {
            const used = state.usageEvents
              .filter((event) => event.token_id === params[0] && event.event_month === params[1])
              .reduce((sum, event) => sum + Number(event.cost_units || 0), 0);
            return { used };
          }
          return null;
        },
      };
    },
  };
  return state;
}
