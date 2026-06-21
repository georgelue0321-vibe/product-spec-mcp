import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSpecInterrogate } from "./tools/specInterrogate.js";
import { registerSpecCompile } from "./tools/specCompile.js";
import { registerArchitectureDecide } from "./tools/architectureDecide.js";
import { registerUiTranslate } from "./tools/uiTranslate.js";
import { registerDebugGuide } from "./tools/debugGuide.js";
import { registerAcceptanceGenerate } from "./tools/acceptanceGenerate.js";
import { registerProductSpecAssist } from "./tools/productSpecAssist.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "product-spec-mcp",
    version: "1.0.0",
  });

  registerSpecInterrogate(server);
  registerSpecCompile(server);
  registerArchitectureDecide(server);
  registerUiTranslate(server);
  registerDebugGuide(server);
  registerAcceptanceGenerate(server);
  registerProductSpecAssist(server);

  return server;
}
