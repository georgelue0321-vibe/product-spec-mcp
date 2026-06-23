import debugPlaybooks from "../rules/debugPlaybooks.json";

export interface DebugGuideResult {
  platform: string;
  requiredInfo: Array<{
    field: string;
    description: string;
    how_to_get: string;
    priority: string;
  }>;
  knownInfo: Record<string, any>;
  checklist: string[];
  commonIssues: string[];
  troubleshootingSteps: string[];
}

export function generateDebugGuide(
  platform: string,
  errorDescription: string,
  currentInfo?: Record<string, any>
): DebugGuideResult {
  const playbook =
    debugPlaybooks.platforms[platform as keyof typeof debugPlaybooks.platforms] ||
    debugPlaybooks.platforms.web;

  const knownInfo = currentInfo || {};
  const checklist: string[] = [];

  for (const info of playbook.required_info) {
    if (!knownInfo[info.field]) {
      checklist.push(`☐ ${info.description}: ${info.how_to_get}`);
    } else {
      checklist.push(`☑ ${info.description}: 已提供`);
    }
  }

  const troubleshootingSteps = buildTroubleshootingSteps(platform, errorDescription);

  return {
    platform,
    requiredInfo: playbook.required_info,
    knownInfo,
    checklist,
    commonIssues: playbook.common_issues,
    troubleshootingSteps,
  };
}

function buildTroubleshootingSteps(platform: string, errorDesc: string): string[] {
  const steps: string[] = [];

  if (platform === "web") {
    steps.push("1. 打开浏览器开发者工具 (F12)");
    steps.push("2. 查看 Console 标签页是否有红色报错");
    steps.push("3. 查看 Network 标签页是否有失败请求（红色）");
    steps.push("4. 点击失败请求，查看 Status Code 和 Response");
    steps.push("5. 记录失败请求对应的 request_id，并查看后端日志或服务端日志");
    if (isAiGenerationIssue(errorDesc)) {
      steps.push("6. 检查后端代理是否正确读取 AI API Key，确认模型额度、超时和限流状态");
      steps.push("7. 确认后端对 AI 调用失败有错误日志，且前端不要只看 toast 文案判断原因");
    } else {
      steps.push("6. 尝试清除缓存并硬刷新 (Ctrl+Shift+R)");
    }
  } else if (platform === "mini_program") {
    steps.push("1. 在微信开发者工具中查看 Console");
    steps.push("2. 检查 Network 面板中的请求");
    steps.push("3. 确认页面路径是否正确");
    steps.push("4. 检查 app.json 中的页面注册");
    steps.push("5. 确认域名已配置到合法域名列表");
  } else if (platform === "backend") {
    steps.push("1. 查看后端日志文件");
    steps.push("2. 检查数据库连接状态");
    steps.push("3. 确认环境变量配置正确");
    steps.push("4. 检查最近的代码变更");
    steps.push("5. 使用 trace_id 追踪请求链路");
  } else if (platform === "build") {
    steps.push("1. 查看完整错误日志");
    steps.push("2. 确认 Node.js 版本符合要求");
    steps.push("3. 删除 node_modules 重新安装");
    steps.push("4. 检查 TypeScript 类型错误");
    steps.push("5. 确认环境变量已正确设置");
  } else if (platform === "app") {
    steps.push("1. 查看设备日志（Xcode Console / Android Logcat）");
    steps.push("2. 确认网络请求是否正常发出");
    steps.push("3. 检查是否有崩溃堆栈信息");
    steps.push("4. 确认 App 版本和系统版本兼容性");
    steps.push("5. 尝试卸载重装清除本地缓存");
  } else {
    steps.push("1. 复现问题并记录完整错误信息");
    steps.push("2. 确认问题出现的具体步骤和环境");
    steps.push("3. 检查最近的代码或配置变更");
    steps.push("4. 搜索错误信息查找已知解决方案");
    steps.push("5. 在隔离环境中测试排除干扰因素");
  }

  return steps;
}

function isAiGenerationIssue(errorDesc: string): boolean {
  return /AI|ai|GPT|gpt|模型|生成|文案|loading|额度|限流|API Key|密钥/.test(errorDesc);
}
