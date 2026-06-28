# MVP 商业化前收口测试

日期：2026-06-26

版本：`product-spec-mcp@0.4.1`

目标：继续验证上一轮 MVP 判断里剩下的三块风险：

1. 公开文案是否贴近目标用户
2. Online PM Gate 是否只是可选增强，不阻断本地 MVP
3. 发布包和仓库状态是否支撑对外试用

## 1. 公开文案检查

检查对象：`README.md`

结论：README 作为 MCP 工具文档是合格的；作为面向非技术/半技术用户的公开商业化入口，还不够贴近目标用户。

通过项：

- 前 600 字已出现“模糊产品想法 / 一句话需求 / 可执行规格”等核心价值表达。
- 在工具表之前已经讲清楚推荐流程。
- `product_spec_assist` 和 `spec_compile` 在首屏附近出现，主路径可见。
- Online PM Gate 明确写成可选增强，并说明默认本地 PM Gate。

问题：

- 首屏仍同时出现 `MCP`、`AI 编程助手`、`token`、`stdio` 等偏工程术语。
- 没有在开头明确点名主要用户：有产品想法但不会整理成工程规格的人，例如创始人、运营、设计师、小团队负责人、学生和初级 vibe-coder。
- 英文工具文档较重，`Analyze / Compile / Generate / Input / Example` 等英文说明大量出现，更像开发者 README。
- 安装和 MCP 配置占比偏高，普通用户还不容易理解“我该怎样用它把想法交给 Agent”。

建议：

- README 顶部改成中文产品入口：先讲用户问题、适合谁、用完会得到什么，再进入 MCP 安装。
- 把工具 API 细节下沉到 `docs/`，README 保留最短路径。
- 首屏避免把高级 AI coding 用户当主要对象；高级用户可以作为集成者和测试者。

## 2. Online PM Gate 可选增强检查

### 本地链路不依赖 Online Gate

验证方式：用错误远程地址和 `PRODUCT_SPEC_REMOTE_GATE_MODE=force` 启动 `dist/index.cjs`，调用 `product_spec_assist`。

输入：

```text
做一个家庭药箱管理小网页，数据存在浏览器里，不需要登录
```

结果：

- `selectedTool=spec_compile`
- `scenario=build_product`
- `technicalProfile.shape=local_storage_tool`
- `frontendOnly=true`
- `needsBackend=false`

结论：远程不可达时，本地链路仍能给出正确 local-first 判断，不阻断 MVP。

### `product_spec_connect` 工具检查

验证对象：真实 `dist/index.cjs` MCP stdio 黑盒。

通过项：

- 无连接文件时，返回连接页和下载连接文件提示。
- 传入有效 `product-spec-mcp-connect.json` 时，能解析出 `PRODUCT_SPEC_REMOTE_GATE_URL`、`PRODUCT_SPEC_REMOTE_GATE_TOKEN`、`PRODUCT_SPEC_REMOTE_GATE_MODE` 等 env。
- 无效连接文件能返回错误说明。

问题：

- 无效连接文件返回了错误文案，但 `isError` 没有标成 `true`。这不影响人工使用，但对机器调用者不够清晰。

### 线上只读探测

验证命令：

```bash
curl -sS -i https://productmcp.opc-mind.top/health
curl -sS -i https://productmcp.opc-mind.top/connect
```

结果：

- `GET /health` 返回 `HTTP/2 200`，body 为 `{"ok":true,"gateSchemaVersion":"pm-gate-v1","connect":true}`。
- `GET /connect` 返回 `HTTP/2 200`，并返回中文连接页 HTML。
- `HEAD /connect` 返回 `404`，但 GET 正常；这更像 Worker 未实现 HEAD，不影响用户浏览器打开。

未执行项：

- 没有调用线上 `POST /v1/connect-token` 生成真实 token，避免在评测中写入线上 D1 token 表。若要做发布前完整冒烟，可以手动生成一个测试 token 并随后清理。

## 3. 发布包检查

首次运行：

```bash
npm pack --dry-run --json
```

结果：失败，原因是用户级 npm cache `/Users/george/.npm` 存在权限问题。

复测命令：

```bash
npm_config_cache=/Users/george/Documents/product-spec-mcp/.npm-cache npm pack --dry-run --json
```

结果：通过。

包信息：

- 包名：`product-spec-mcp`
- 版本：`0.4.1`
- 压缩包名：`product-spec-mcp-0.4.1.tgz`
- 压缩大小：`264255`
- 解包大小：`1321329`
- entry count：`10`

包含文件：

- `dist/index.cjs`
- `README.md`
- `CHANGELOG.md`
- `docs/connect-flow.md`
- `docs/online-pm-gate.md`
- `workers/pm-intent-gate.mjs`
- `workers/schema.sql`
- `workers/wrangler.toml.example`
- `workers/migrations/0002_connect_metadata.sql`
- `package.json`

结论：npm 包内容干净，适合 MVP 试用分发。

注意：复测使用了仓库内 `.npm-cache`，这是为了绕开用户级 npm cache 权限问题，不代表包本身有问题。

## 4. Git 状态检查

命令：

```bash
git status --short
find /Users/george/Documents/product-spec-mcp -maxdepth 2 -type d -name .git -print
find /Users/george/Documents/product-spec-mcp -maxdepth 2 -type f -name .git -print
```

结果：

- `git status --short` 返回 `fatal: not a git repository`
- 当前目录两层内没有 `.git` 目录或 `.git` 文件
- `/Users/george/Documents` 下存在其他项目的 `.git`，但没有 `product-spec-mcp/.git`

结论：当前工作目录不是 Git checkout，无法验证干净工作树、提交历史、远端同步和发布 tag。这个问题不影响本地构建和 npm 打包，但会影响公开发布前的变更可追踪性。

## 总结

当前状态更准确地说是：

- 本地 MCP MVP：可以小范围试用
- npm 包形态：可打包，内容干净
- Online PM Gate：可选增强基本可用，不阻断本地能力
- 公开商业化入口：README 还需要重写顶部叙事
- 发布工程卫生：需要恢复或重新建立 Git 仓库状态

建议优先级：

1. 修 `restaurant-order` / 订单流误判和 compile-architecture 一致性。
2. 重写 README 顶部，面向“有想法但不会整理工程规格”的用户。
3. 把 `product_spec_connect` 无效文件场景标记为 `isError=true`。
4. 确认真实 Git 仓库位置或重新初始化发布仓库。
