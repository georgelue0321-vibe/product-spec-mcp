# MCP 接入 WorkBuddy 坑点记录

日期：2026-06-20

## 坑点 1：NODE_OPTIONS 环境变量冲突

**现象**：MCP error -32000: Connection closed

**原因**：系统环境变量 `NODE_OPTIONS=--use-system-ca`，但 Node.js 22.12.0 不支持 `--use-system-ca` 参数，进程启动直接报错退出。

**解决**：在 mcp.json 的 `env` 中清除 NODE_OPTIONS：
```json
{
  "command": "node",
  "args": ["..."],
  "env": {
    "NODE_OPTIONS": ""
  }
}
```

**排查方法**：终端直接运行 `node dist/index.cjs` 看是否有报错。

---

## 坑点 2：macOS TCC 隐私保护

**现象**：Node 进程启动后报 `Operation not permitted`，无法读取文件。

**原因**：macOS 的 TCC（Transparency, Consent, and Control）隐私保护机制，限制了对 `~/Documents`、`~/Desktop`、`~/Downloads` 等目录的访问权限。

**解决**：把项目复制到不受保护的目录，如 `~/WorkBuddy/`。

**排查方法**：`ls ~/Documents/xxx` 看是否报 `Operation not permitted`。

---

## 坑点 3：ESM vs CJS 格式

**现象**：WorkBuddy 加载 MCP 失败。

**原因**：不同 Node.js 版本和运行环境对 ESM/CJS 的支持不一致。Electron 内置的 Node.js 与系统 Node.js 行为可能不同。

**解决**：用 CJS 格式（`--format=cjs`）+ `.cjs` 扩展名，兼容性最好。

---

## 坑点 4：JSON 格式错误

**现象**：WorkBuddy 的 MCP 面板消失。

**原因**：mcp.json 文件中有多余的 `}`，JSON 解析失败。

**排查方法**：`node -e "JSON.parse(require('fs').readFileSync('mcp.json','utf8'))"` 验证格式。

---

## 坑点 5：WorkBuddy MCP 配置路径

**现象**：配置不生效。

**原因**：WorkBuddy 有两套配置：
- 用户级：`~/.workbuddy/mcp.json`（所有项目复用）
- 项目级：`<项目目录>/.workbuddy/mcp.json`（仅当前项目）

如果项目在 `~/Documents` 下，终端直跑可能正常，但 WorkBuddy/Electron 启动 MCP 时仍可能被 macOS TCC 拦截，表现为 `MCP error -32000: Connection closed`。WorkBuddy 实测入口应优先指向 `~/WorkBuddy/` 下的副本。

**正确格式**（用户级）：
```json
{
  "mcpServers": {
    "product-spec": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/Users/george/WorkBuddy/product-spec-mcp/dist/index.cjs"
      ],
      "env": {
        "NODE_OPTIONS": ""
      }
    }
  }
}
```

**注意**：开发主仓库可以保留在 `/Users/george/Documents/product-spec-mcp`，但 WorkBuddy 的 `mcp.json` 建议始终指向 `/Users/george/WorkBuddy/product-spec-mcp/dist/index.cjs`。每次修复后要同步构建产物，至少确认：
```bash
shasum -a 256 /Users/george/Documents/product-spec-mcp/dist/index.cjs /Users/george/WorkBuddy/product-spec-mcp/dist/index.cjs
```

---

## 快速排查清单

1. `node dist/index.cjs` — 能否直接运行？
2. `echo $NODE_OPTIONS` — 有没有冲突的环境变量？
3. `ls <项目路径>` — 有没有权限问题？
4. `node -e "JSON.parse(...)"` — JSON 格式对不对？
5. 查看日志：`~/Library/Logs/WorkBuddy/main.log`

---

## 坑点 6：spec_compile 输出太泛，用户回答没合并

**现象**：用户回答了追问（如"支持多个活动"、"多一些信息"），但 spec 输出仍是 "待用户确认"、"纯前端架构"。

**原因**：
1. `promptBuilder.ts` 的 `extractFeatures` 只匹配少量关键词（提交、导出），漏掉 "报名"、"表单"、"后台"
2. 用户回答的 key 是中文（"活动数量"、"报名字段"），代码期望英文 key（`core_features`、`data_persistence`）
3. `needsBackend` 判断缺少 `backend_need === true`
4. `extractGoal` 正则没匹配 "网站"

**解决**：
- 新增 `normalizeContext` 函数，映射中文 key → 英文 key
- 扩展 `extractFeatures` 关键词列表
- `needsBackend` 增加 `backend_need` 判断
- `extractGoal` 正则增加 "网站"

---

## 坑点 7：clarificationRules 追问太泛

**现象**：对"活动报名系统"只追问 4 个通用问题（数据保存、用户角色、后台管理、第三方服务），没有问表单字段、审核流程、防重复、导出格式、移动端适配。

**原因**：`clarificationQuestions.json` 的 `build_product` 场景只有 7 个通用追问，缺少：
- 工作流追问（提交后要不要审核？）
- 字段追问（表单具体有哪些字段？）
- 平台追问（手机端还是桌面端？）
- 导出追问（什么格式？）
- 防重复追问（用什么维度去重？）
- 后台权限追问（谁能访问？）

**解决**：在 `clarificationQuestions.json` 新增 7 个追问规则，并在 `specReadiness.ts` 新增对应字段追踪。

---

## 坑点 8：intentRouter 对详细输入识别失败

**现象**：用户回答追问后，传入详细描述（如"网页版，单个活动，报名字段：姓名、电话..."），`product_spec_assist` 返回 0% 置信度，无法识别场景。

**原因**：`intentRouter.ts` 的 `build_product` 关键词太少（只有"做、开发、创建、实现、搭建、系统、平台、工具、应用、网站"），不包含"报名、表单、管理、后台、导出"等业务词。

**解决**：扩展 `INTENT_KEYWORDS.build_product` 列表。

---

## 坑点 9：英文 key 的字符串值未转换为 boolean

**现象**：`spec_compile` 输出"纯前端架构"，但用户明确需要后端。

**原因**：WorkBuddy 传的 answers 是英文 key + 字符串值：
```json
{
  "data_persistence": "需要保存用户数据到数据库",
  "backend_need": "需要管理后台查看数据和导出"
}
```
`normalizeContext` 只处理中文 key 映射，不处理英文 key 的字符串值。`buildSpec` 检查 `context.data_persistence === true` 但值是字符串，不匹配。

**解决**：在 `normalizeContext` 中增加字符串→boolean 转换逻辑，识别"需要/是/有/必须"为 true，"不需要/否/没有/都不"为 false。

---

## 坑点 10：通用关键词抢占专项场景

**现象**：用户说的是已有页面的局部 UI 升级，例如“首页 Hero 区域太普通了，要高级一点”，但 `product_spec_assist` 被“网站 / 页面 / 高级一点”等通用词带偏，输出静态站架构判断或泛化 UI 建议，没有进入具体的 Hero 升级方案。

**原因**：
1. `build_product`、`modify_ui` 等场景共享“页面 / 网站 / 高级”等宽泛关键词。
2. `ui_translate` 里“高级一点”这类通用映射会覆盖更具体的 Hero / 首屏 / 动效请求。
3. Agent 拿到泛化输出后容易自行发挥，加入多个渐变球、玻璃拟态、漂浮装饰物、持续 shimmer 等过度设计。

**解决**：
- 在 `intentRouter.ts` 增加专项优先规则：已有页面 + Hero/首屏/首页 + 升级/视觉冲击/高级，应优先路由到 `modify_ui`。
- 在 `uiPromptEngine.ts` 增加 Hero 高级动态视觉升级专项分支，输出具体术语：`Layered Ambient Background`、`Subtle Particle Field`、`Animated Radial Gradient`、`Mouse Parallax`、`Premium Motion Design`。
- 在代码建议里明确反过度设计边界：不要使用多个大面积渐变球、玻璃拟态卡片、漂浮装饰物或持续循环的文字 shimmer；已有多个 orb 占位时最多启用 1-2 个。

**排查方法**：
```bash
node --input-type=module -e '/* 用 MCP client 调 product_spec_assist，确认 scenario=modify_ui 且 selectedTool=ui_translate */'
```

**回归测试**：
- `tests/productSpecAssist.test.ts`：已有 portfolio Hero 升级请求必须走 `ui_translate`，不得返回“静态展示网站”。
- `tests/uiTranslate.test.ts`：Hero 动效升级必须包含专项术语和反过度设计边界。

---

## 坑点 11：静态站验收被动态应用模板污染

**现象**：用户问“个人作品网站要上线了，需要注意什么？纯静态站，HTML/CSS/JS，无框架无后端。”时，`acceptance_generate` 输出了 loading/skeleton、empty state、表单提交 loading、接口超时重试、500 错误等动态应用验收项。

**原因**：
1. `acceptanceRules.base_rules` 混合了静态页面、表单应用和后端接口的通用假设。
2. `acceptance_generate` 没有区分纯静态展示站和动态 Web 应用。
3. `product_spec_assist` 的上线快问没有利用 `known_context`，即使已知“纯静态、无后端”，仍重复追问“是否有后端”和“是否有表单/登录/支付”。

**解决**：
- 在 `acceptanceEngine.ts` 增加纯静态展示站分支：只输出页面内容、静态资源、链接交互、SEO 分享、上线验证等验收项。
- 动态应用验收项只在明确有后端、表单、支付、登录等场景下出现。
- `product_spec_assist` 的 launch quickQuestions 根据 message 和 known_context 过滤已确认的问题，避免重复追问。

**排查方法**：
```bash
npm test -- tests/acceptanceGenerate.test.ts tests/productSpecAssist.test.ts
```

**回归测试**：
- `tests/acceptanceGenerate.test.ts`：纯静态作品集不得包含 `loading 或 skeleton`、`空数据`、`表单提交`、`接口超时`、`500 错误`。
- `tests/productSpecAssist.test.ts`：已知纯静态上下文下，不再追问 `site_type` 和 `interactive_features`。
