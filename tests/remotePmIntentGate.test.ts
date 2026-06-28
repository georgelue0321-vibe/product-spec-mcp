import { afterEach, describe, expect, it, vi } from "vitest";
import { decidePmIntent } from "../src/core/pmIntentGate.js";
import { callRemotePmIntentGate, shouldUseRemoteGate } from "../src/core/remotePmIntentGate.js";

const originalEnv = { ...process.env };

describe("remote PM intent gate", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should skip remote gate for high-confidence local decisions in auto mode", async () => {
    process.env.PRODUCT_SPEC_REMOTE_GATE_URL = "https://gate.example.com/v1/pm-intent";
    const local = decidePmIntent("我想做多人室友任务协作工具，需要认领和共享日程", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(local.confidence).toBe("high");
    expect(shouldUseRemoteGate(local)).toBe(false);
    await expect(callRemotePmIntentGate("我想做多人室友任务协作工具，需要认领和共享日程", {}, local)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should call remote gate in force mode with a truncated prompt", async () => {
    process.env.PRODUCT_SPEC_REMOTE_GATE_URL = "https://gate.example.com/v1/pm-intent";
    process.env.PRODUCT_SPEC_REMOTE_GATE_MODE = "force";
    process.env.PRODUCT_SPEC_REMOTE_GATE_TOKEN = "test-token";
    const local = decidePmIntent("我想做一个不太确定的新工具", {});
    const longMessage = `我想做一个不太确定的新工具，${"需要更多上下文。".repeat(80)}`;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        decision: {
          bestGate: "data_visualization_site",
          usageScope: "public_audience",
          maintenanceMode: "agent_assisted",
          accessTopology: "public_domain",
          technicalShape: "static_json_data_page",
          confidence: "medium",
          boundaryQuestionIds: ["data_update_mode"],
        },
        llmGate: { used: true, provider: "deepseek", model: "flash", cacheHit: false },
        rateLimit: { limit: 20, remaining: 19, resetAt: "2026-06-24T00:00:00+08:00" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callRemotePmIntentGate(longMessage, {}, local);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(result?.decision.needType).toBe("data_visualization_site");
    expect(result?.decision.technicalShape).toBe("static_json_data_page");
    expect(result?.meta.rateLimit?.remaining).toBe(19);
    expect(body.message.length).toBeLessThanOrEqual(501);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer test-token");
  });

  it("should fall back to local decision when remote schema is invalid", async () => {
    process.env.PRODUCT_SPEC_REMOTE_GATE_URL = "https://gate.example.com/v1/pm-intent";
    process.env.PRODUCT_SPEC_REMOTE_GATE_MODE = "force";
    const local = decidePmIntent("我想做一个不太确定的新工具", {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ decision: { bestGate: "not_a_gate" } }),
      })
    );

    const result = await callRemotePmIntentGate("我想做一个不太确定的新工具", {}, local);

    expect(result?.decision).toEqual(local);
    expect(result?.meta.fallbackReason).toBe("remote_invalid_schema");
  });

  it("should enforce local hard rules when remote misclassifies collaboration as static", async () => {
    process.env.PRODUCT_SPEC_REMOTE_GATE_URL = "https://gate.example.com/v1/pm-intent";
    process.env.PRODUCT_SPEC_REMOTE_GATE_MODE = "force";
    const message = "我想做多人室友任务协作工具，需要认领和共享日程";
    const local = decidePmIntent(message, {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          decision: {
            bestGate: "static_display",
            technicalShape: "static_page",
            route: "spec_compile",
            confidence: "medium",
          },
        }),
      })
    );

    const result = await callRemotePmIntentGate(message, {}, local);

    expect(result?.decision.needType).toBe("multi_user_collaboration");
    expect(result?.decision.technicalShape).toBe("light_backend_json_sqlite");
    expect(result?.decision.recommendedDeployment).toBe("unknown");
    expect(result?.decision.mustNotUse).toContain("local_storage_only");
  });

  it("should align collaboration deployment with resolved access topology after remote merge", async () => {
    process.env.PRODUCT_SPEC_REMOTE_GATE_URL = "https://gate.example.com/v1/pm-intent";
    process.env.PRODUCT_SPEC_REMOTE_GATE_MODE = "force";
    const message = "我想做一个给小区邻居用的互助平台，大家可以发布求助和拼车信息";
    const local = decidePmIntent(message, {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          decision: {
            bestGate: "multi_user_collaboration",
            usageScope: "fixed_group",
            maintenanceMode: "agent_assisted",
            accessTopology: "internet_ip",
            technicalShape: "static_json_data_page",
            recommendedDeployment: "static_hosting_with_agent_updates",
            confidence: "high",
            strongSignals: ["互助平台", "拼车信息"],
          },
        }),
      })
    );

    const result = await callRemotePmIntentGate(message, {}, local);

    expect(result?.decision.source).toBe("merged");
    expect(result?.decision.needType).toBe("multi_user_collaboration");
    expect(result?.decision.maintenanceMode).toBe("runtime_collaboration");
    expect(result?.decision.technicalShape).toBe("light_backend_json_sqlite");
    expect(result?.decision.recommendedDeployment).toBe("cheap_vps_sqlite_by_ip");
  });
});
