import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CLI help", () => {
  it("shows a concrete first-use setup flow", () => {
    const output = execFileSync("node", [resolve(__dirname, "../dist/index.cjs"), "--help"], {
      encoding: "utf8",
    });

    expect(output).toContain("用户只需要做 3 件事");
    expect(output).toContain('"mcpServers"');
    expect(output).toContain("请调用 product_spec_connect");
    expect(output).toContain("product-spec-mcp-connect.json");
    expect(output).toContain("用户不需要 DeepSeek API Key");
  });
});
