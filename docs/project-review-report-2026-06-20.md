# product-spec-mcp 项目走查报告

日期：2026-06-20  
范围：当前本地目录 `/Users/george/Documents/product-spec-mcp`，不含 Git 历史，因为该目录不是 Git 仓库。

## 1. 一句话结论

`product-spec-mcp` 是一个面向 AI 编程工作流的本地 MCP Server，用 6 个规则驱动工具把用户的模糊产品想法转成需求追问、产品规格、架构建议、UI 修改术语、Debug 排查清单和验收标准。

它现在已经是一个可运行的 MVP：测试通过、构建通过、stdio MCP 入口可加载。但它还不适合直接作为商业化产品发布，主要卡点是类型检查 OOM、部分架构判断有逻辑矛盾、输出缺少结构化结果、规则质量还没有真实项目评测闭环。

## 2. 项目是什么

### 技术形态

- 语言与运行时：TypeScript / Node.js ESM。
- 分发形态：npm CLI 包，当前 CJS 发布入口为 `bin.product-spec-mcp = dist/index.cjs`。
- 协议形态：MCP Server，通过 stdio 连接 Claude Desktop、Cursor、Continue 等 MCP 客户端。
- 核心依赖：`@modelcontextprotocol/sdk`、`zod`。
- 构建：`esbuild src/index.ts --bundle --platform=node --outfile=dist/index.cjs --format=cjs`。
- 测试：`vitest`。

### 已暴露 MCP 工具

| 工具 | 当前作用 | 主要价值 |
| --- | --- | --- |
| `spec_interrogate` | 评估需求完整度并生成追问 | 防止用户一句话直接开工 |
| `spec_compile` | 生成产品规格、API 草案、开发 Prompt、确认清单 | 把模糊想法变成可执行开发输入 |
| `architecture_decide` | 根据产品类型、功能、商业化意图给架构建议 | 提醒支付、AI Key、鉴权、后台等风险 |
| `ui_translate` | 把“高级一点”“上面那块”等口语翻译成前端术语 | 帮非技术用户和前端/AI agent 对齐 |
| `debug_guide` | 输出排查所需信息和步骤 | 让用户先提供 Console、Network、日志等证据 |
| `acceptance_generate` | 生成验收清单 | 给 AI 开发结果提供收口标准 |

### 核心设计

项目不是调用大模型生成结果，而是本地规则引擎：

- `src/rules/*.json` 保存规则库。
- `src/core/*Engine.ts` 做关键字匹配、模板生成和 Markdown 格式化。
- `src/tools/*.ts` 只负责把核心函数注册为 MCP tool。

这个设计的优点是成本低、延迟低、可离线、可控；缺点是语义能力弱，规则维护会成为产品质量上限。

## 3. 当前验证结果

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| `npm test` | 通过 | 7 个测试文件、45 个用例全部通过 |
| `npm run build` | 通过 | 当前应生成 `dist/index.cjs` |
| 入口加载 | 通过 | 当前应使用 `node dist/index.cjs` 验证 |
| `npm audit --omit=dev` | 通过 | 当前生产依赖 0 已知漏洞 |
| `npm --cache /private/tmp/product-spec-mcp-npm-cache pack --dry-run` | 通过 | 可打包，包大小约 41.3KB，解包约 166.3KB |
| `npm run typecheck` | 失败 | Node heap OOM，约 4GB 后崩溃 |

补充说明：第一次 `npm pack --dry-run` 被本机 `~/.npm` 缓存权限挡住，使用临时 cache 后通过。这是本机发布环境问题，不是项目包本身问题。

## 4. 主要问题

### P0：类型检查 OOM，阻断稳定发布

`npm run typecheck` 执行 `tsc --noEmit --skipLibCheck`，约 115 秒后崩溃：

```text
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

项目很小，`tsconfig.json` 也只 include `src/**/*`，不是误扫 `node_modules` 或 `dist`。更可能的原因是 MCP SDK + Zod shape + `registerTool` 的复杂泛型推导触发 TypeScript 类型膨胀。

影响：

- CI 无法可靠通过。
- npm 发布前无法证明类型安全。
- 后续代码增长后问题会更严重。

建议：

- 优先隔离 `registerTool` 输入 schema 的泛型推导，必要时显式收窄类型。
- 把每个 tool handler 的输入先用 Zod parse 成本地类型，而不是完全依赖 SDK 推断。
- 增加 CI，并把 `npm run typecheck && npm test && npm run build` 作为发布门禁。

### P0：架构决策存在确定性错误

抽样运行：

```json
decideArchitecture("展示官网", "web", [], false, "individual")
```

结果中同时出现：

```json
{
  "canBeFrontendOnly": true,
  "needBackend": false,
  "recommendedDatabase": "PostgreSQL"
}
```

这是矛盾的。原因在 `architectureEngine.ts`：规则里 `recommended_database: "none"` 会被替换成按用户规模推导的数据库；而 `individual` 又不在 `database_recommendations` 里，最终回退到 PostgreSQL。

影响：

- 纯展示页、官网、作品集等场景会输出不可信架构建议。
- 这是产品承诺中的核心能力，不能留到商业化后修。

建议：

- `"none"` 应保留为 `"none"` 或格式化为“无需数据库”。
- `expected_users` 枚举和 `database_recommendations` 的 key 要对齐。
- 增加回归测试：静态展示类项目不得推荐数据库或 API。

### P1：`spec_compile` 输出容易“看似完整但实质空泛”

抽样运行 `buildSpec("做一个展示官网", {}, readiness)` 的结果：

- 产品目标：`实现用户需求的功能系统`
- 核心功能：`核心功能`
- 数据模型：`建议使用 PostgreSQL 或 SQLite（MVP 阶段）`
- API：`POST /api/核心功能 - 核心功能相关操作`

这类输出对真实开发帮助有限，还会误导用户觉得已经具备可执行规格。

建议：

- 低 readiness 时只允许输出“追问 + 默认假设 + 风险”，不要生成伪 API。
- 引入规格质量分层：`not_ready`、`brief_ready`、`build_prompt_ready`。
- 对默认假设加醒目标注，并给出“不可直接开发”的机器可读状态。

### P1：输出只有 Markdown，缺少结构化结果

当前工具都返回：

```ts
content: [{ type: "text", text: markdown }]
```

MCP 规范支持 `structuredContent` 和 `outputSchema`，用于让客户端和模型更可靠地解析工具结果。官方文档也明确说明结构化输出可提供类型信息、严格校验和更好的集成体验。

影响：

- 下游 agent 很难稳定读取 readiness score、缺失字段、验收项。
- 很难接入自动化工作流，例如“score < 70 自动继续追问”。
- 商业化时难以做数据统计、质量评估和团队报表。

建议：

- 每个工具保留 Markdown，同时返回结构化 JSON。
- 为每个工具定义 output schema。
- 优先结构化 `spec_interrogate`、`spec_compile`、`acceptance_generate`。

### P1：测试覆盖偏存在性，不覆盖质量和负例

当前测试主要验证“有返回”“包含某个字段”“长度大于 0”。这对模板工具不够。

缺失测试：

- 纯展示页不得推荐数据库/API。
- 支付场景必须强制后端回调和金额后端计算。
- AI API 场景必须提示 Key 不可前端暴露。
- 低 readiness 不得输出正式开发 Prompt。
- UI 口语映射的误匹配和同义表达。
- Markdown 输出中是否包含机器可解析字段。

建议：

- 建立 golden case fixtures：10-20 个真实产品需求输入，快照输出。
- 增加 adversarial cases：非常短、口语化、混合中英文、否定表达。
- 为商业化方向增加“人工评分表”：准确性、完整性、风险提示、可执行性。

### P1：规则系统还没有产品化接口

现在规则在 `src/rules/*.json`，修改需要发版。商业化后，用户会想要：

- 按行业自定义追问。
- 按团队技术栈自定义架构建议。
- 按公司 Definition of Done 自定义验收标准。
- 按平台约束自定义 Debug Playbook。

建议：

- 把规则抽象成 profile：`default`、`solo_dev`、`agency`、`enterprise`、`mini_program`。
- 支持外部规则文件路径或 workspace 内 `.product-spec-mcp/rules.json`。
- 增加规则版本号和 changelog。

### P2：产品定位还不够聚焦

README 说它覆盖需求、架构、UI、Debug、验收。范围完整，但商业上容易变成“什么都懂一点”的工具箱。

更强的定位应聚焦在一个明确痛点：

> 面向 AI 编程用户的“开工前需求闸门”和“交付验收闸门”。

也就是不是替代 Linear/Jira/Notion，而是在 Cursor、Claude Code、Codex、Continue 等开发代理开工前，把模糊需求变成可执行规格，并在结束时生成验收清单。

### P2：包发布元数据不完整

`package.json` 缺少：

- `repository`
- `homepage`
- `bugs`
- `files`
- `engines`
- `publishConfig`

`npm pack --dry-run` 会把 `src`、`tests`、`examples`、`tsconfig` 都带进包里。开源包可以接受，但面向普通安装用户建议用 `files` 控制发布内容。

### P2：目录里有 `.DS_Store`

当前根目录、`src/`、`node_modules/` 下有 `.DS_Store`。发布/开源前应清理并加 `.gitignore`。

### P2：`intentRouter` 未接入

`src/core/intentRouter.ts` 能识别 build_product、modify_ui、debug、launch，但没有被工具使用。它可以成为下一阶段的统一入口：

- 新增 `product_spec_route` 或 `workflow_assist`。
- 自动判断应该调用追问、UI 翻译、Debug 还是上线检查。
- 对客户端用户减少选择工具的心智负担。

## 5. 商业化判断

### 市场机会

MCP 生态在快速扩张。官方 MCP 文档把 MCP 定义为连接 AI 应用与外部系统的开放标准，并明确提到 Claude、ChatGPT、VS Code、Cursor 等客户端生态支持。Glama registry 在 2026-06-20 显示已有 38,397 个 MCP servers，Developer Tools 分类也很拥挤。

这说明两件事：

1. 分发窗口存在：MCP 已经是开发者熟悉的连接方式。
2. 竞争会很快商品化：单纯“我也是一个 MCP server”不够，必须靠垂直场景和质量建立差异。

### 最有价值的用户

优先用户不是大企业产品经理，而是以下三类：

| 用户 | 痛点 | 购买/传播可能 |
| --- | --- | --- |
| AI 编程重度用户 | 经常一句话让 agent 开工，返工多 | 高，愿意安装 MCP |
| 独立开发者/小团队 | 没 PM，但需要开工前规格和验收标准 | 高，容易被案例打动 |
| 外包/工作室 | 客户表达模糊，需求确认和验收反复 | 中高，有付费场景 |

暂时不建议优先打企业 PM 市场。企业需要权限、审计、Jira/Linear 集成、模板治理和安全评估，目前项目还没到那个成熟度。

### 差异化方向

不要定位成“AI PRD generator”。这个词太宽，已有大量文档生成工具竞争。

建议定位成：

> Spec Gate for AI Coding Agents  
> 给 AI 编程代理用的需求闸门、架构闸门、验收闸门。

中文表达：

> 防止 AI 编程一上来就乱写代码的 MCP 工具。

可主打三类场景：

- 开工前：把一句想法变成追问清单和可确认规格。
- 开工中：把口语 UI 反馈变成前端修改 Prompt。
- 交付前：生成验收清单，减少“看起来好了但不能用”。

### 收费模型

短期建议先开源核心 + 付费规则包/云端增强：

| 层级 | 形态 | 收费 |
| --- | --- | --- |
| Free OSS | 本地规则、6 个基础 MCP tools | 免费 |
| Pro Rules | 行业模板、团队技术栈 profile、优质 golden cases | 一次性或订阅 |
| Team Cloud | 共享规则、项目历史、团队验收标准、统计报表 | 按席位 |
| Agency Kit | 客户需求确认模板、报价前规格、验收签收文档 | 套餐 |

不建议一开始做完整 SaaS。当前最强资产是规则与工作流，而不是云服务。

## 6. 运营推广建议

### 第 1 阶段：开发者可信度

目标：让 AI 编程用户愿意安装。

动作：

- 发布 GitHub repo，补齐 README、演示 GIF、Claude/Cursor 安装示例。
- 发布到 npm，支持 `npx product-spec-mcp`。
- 提交到 Official MCP Registry、Glama、Smithery、MCP.so 等目录。
- 做 5 个真实案例：
  - 报名系统
  - SaaS landing page
  - 微信小程序报错排查
  - 带支付的订单系统
  - 管理后台权限系统

核心内容标题：

- “我让 AI 写代码前，先让它过一遍需求闸门”
- “不要再把一句话需求直接丢给 Cursor”
- “一个 MCP Server，把模糊需求变成可验收开发 Prompt”

### 第 2 阶段：真实工作流传播

目标：证明它能减少返工。

动作：

- 做对比内容：不用工具 vs 使用工具，比较 AI 输出质量。
- 录屏演示 Claude Desktop/Cursor 中的完整流程。
- 开一个 `examples/real-world` 目录，沉淀真实输入输出。
- 邀请 10-20 个 AI 编程用户试用，收集失败案例而不是只收好评。

建议指标：

- 安装成功率。
- 首次工具调用成功率。
- 用户是否复制了生成 Prompt 去开发。
- 用户是否修改了默认假设。
- 用户是否认为减少了返工。

### 第 3 阶段：细分人群商业化

建议优先卖给外包/工作室，而不是泛开发者。

原因：

- 外包有明确金钱损失：需求不清会返工、扯皮、影响验收。
- 他们需要“客户确认清单”和“验收标准”，这和项目已有能力匹配。
- 他们可以为模板和流程包付费。

可包装为：

- “客户需求确认 MCP”
- “报价前需求澄清包”
- “交付验收清单生成器”
- “小程序/官网/管理后台项目模板包”

## 7. 推荐路线图

### 0-1 周：发布阻断修复

- 修复 `npm run typecheck` OOM。
- 修复展示类项目推荐数据库的逻辑错误。
- 清理 `.DS_Store`，补 `.gitignore`。
- 增加 `files`、`repository`、`engines` 等 npm 元数据。
- 给 `architecture_decide` 和 `spec_compile` 增加关键负例测试。

验收标准：

- `npm run typecheck && npm test && npm run build` 稳定通过。
- `npm pack --dry-run` 只包含预期文件。
- 展示官网样例不输出数据库/API。

### 1-3 周：产品质量增强

- 增加 structuredContent + outputSchema。
- 建立 10-20 个 golden cases。
- 把低 readiness 的输出改成“不可直接开发”的明确状态。
- 接入 `intentRouter`，提供一个统一入口工具。
- README 增加“推荐工作流”：先追问、再编译、再验收。

验收标准：

- 真实案例快照可回归。
- 下游 agent 能读取结构化 score、missingFields、acceptanceItems。
- 用户不用理解 6 个工具也能完成一次流程。

### 3-6 周：可分发 MVP

- 发布 npm。
- 提交 MCP registry 和第三方目录。
- 补安装问题排查文档。
- 补 3 个短视频或 GIF。
- 开始收集用户失败样例，按周更新规则。

验收标准：

- 新用户 5 分钟内能在 Claude Desktop 或 Cursor 跑通。
- 至少 20 个真实需求样例完成人工评分。
- 规则更新有版本号。

### 6-12 周：商业化试探

- 做外包/工作室版模板包。
- 支持团队自定义规则 profile。
- 支持导出客户确认文档和验收文档。
- 试一个 Pro 规则包定价。

验收标准：

- 至少 5 个团队持续使用。
- 明确一个付费场景：减少返工、缩短报价前澄清时间、提高验收通过率。
- 有可公开的案例或匿名对比数据。

## 8. 不建议现在做的事

- 不建议马上做完整 Web SaaS。当前核心风险是规则质量，不是缺界面。
- 不建议一开始接 Jira/Linear/飞书等重集成。先证明单机 MCP 工作流有效。
- 不建议把规则全交给大模型自由生成。这个项目的优势是确定性和可控，应该保留规则引擎，再用模型做增强。
- 不建议宣传“自动生成完美 PRD”。更可信的说法是“开工前澄清和验收闸门”。

## 9. 外部资料

- MCP 官方介绍：<https://modelcontextprotocol.io/docs/getting-started/intro>
- MCP Tools 规范，包含 structuredContent、outputSchema 和安全建议：<https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- Official MCP Registry：<https://registry.modelcontextprotocol.io/>
- Glama MCP Registry，2026-06-20 显示 38,397 个 servers：<https://glama.ai/mcp/servers>
- PRD 背景定义：<https://en.wikipedia.org/wiki/Product_requirements_document>

## 10. 总体建议

这个项目值得继续，但不要按“文档生成器”推进。更好的方向是做 AI 编程时代的规格闸门工具：开工前追问、开工中翻译、交付前验收。

当前优先级非常明确：

1. 先修工程发布阻断：typecheck OOM、架构矛盾、包元数据。
2. 再补结构化输出和真实样例评测。
3. 然后以开源 MCP 工具获取开发者用户。
4. 最后围绕外包/工作室和 AI 编程重度用户卖规则包、团队 profile 和验收流程。
