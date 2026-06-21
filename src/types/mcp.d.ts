declare module "@modelcontextprotocol/sdk/server/mcp.js" {
  export class McpServer {
    constructor(serverInfo: { name: string; version: string }, options?: any);
    registerTool(name: string, config: any, handler: any): any;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
  export class StdioServerTransport {
    constructor();
  }
}
