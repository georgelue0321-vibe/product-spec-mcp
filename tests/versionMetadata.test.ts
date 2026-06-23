import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("version metadata", () => {
  it("should keep package and MCP server versions aligned", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf8")
    ) as { version: string };
    const serverSource = readFileSync(resolve(__dirname, "../src/server.ts"), "utf8");

    expect(packageJson.version).toBe("0.3.19");
    expect(serverSource).toContain(`version: "${packageJson.version}"`);
  });
});
