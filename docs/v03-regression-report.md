# v0.3.x 黑盒回归测试报告

日期：2026-06-22  
测试文件：`tests/v03Regression.test.ts`  
测试方式：MCP SDK Client -> `node dist/index.cjs` 真实黑盒  
测试框架：vitest 3.2.6

## 总览

| 指标 | 结果 |
|------|------|
| 当前版本 | 0.3.4 |
| 主项目测试 | 11 文件 / 138 用例，全通过 |
| WorkBuddy 运行副本测试 | 11 文件 / 138 用例，全通过 |
| v0.3 黑盒回归 | 18 / 18 全通过 |
| 建议进入 v0.4 | 可以进入下一阶段真实环境项目引导测试 |

## 本轮修复

| 模块 | 修复点 |
|------|--------|
| promptBuilder | 英文 key 字符串答案可正确识别后端、存储、后台和鉴权需求，报名系统不再被编译成纯前端架构 |
| acceptanceEngine | 增加报名导出验收、AI SaaS API Key/生成历史/错误追踪验收 |
| markdownFormatter | 支付风险 Markdown 补充支付金额和套餐价格必须后端计算 |
| debugEngine | Web + AI 生成失败场景补充后端日志、request_id、AI API Key、额度、超时和限流排查 |
| assistEngine / clarificationEngine | 增加预约服务场景追问，禁止预约需求回落到报名模板 |
| specReadiness / promptBuilder | 增加预约上下文补全和 `services/time_slots/bookings` 编译输出，补充 `inputConsumption` |
| architectureEngine / markdownFormatter | 增加预约容量并发风险提示，裁剪报名/导出类后台风险措辞 |
| acceptanceEngine | 增加预约满员、取消、后台时间段和状态筛选验收，避免报名/支付/AI 污染 |
| WorkBuddy 运行副本 | 同步 `src/`、`tests/`、`dist/` 和关键文档，修复损坏的 `node_modules/.bin` 入口 |

## 最新验证命令

主项目：

```bash
cd /Users/george/Documents/product-spec-mcp
npm run typecheck
npm test
npm run build
```

WorkBuddy 运行副本：

```bash
cd /Users/george/WorkBuddy/product-spec-mcp
npm run build
npm run typecheck
npm test
npx vitest run tests/v03Regression.test.ts
```

## 最新验证结果

```text
/Users/george/Documents/product-spec-mcp
typecheck: pass
test: 11 files / 138 tests pass
build: pass

/Users/george/WorkBuddy/product-spec-mcp
build: pass
typecheck: pass
test: 11 files / 138 tests pass
v03Regression.test.ts: 18 / 18 pass
```

## 结论

旧报告中的 3/14 失败结果来自未同步最新构建的 WorkBuddy 运行副本，已经失效。

当前 v0.3 黑盒回归全部通过。0.3.4 在 0.3.3 基础上补齐预约服务/时间段/容量/取消场景，并收紧报名 fallback：`product_spec_assist` 不再把预约套成报名追问，`spec_compile` 能消费预约 answers 并输出 `services`、`time_slots`、`bookings`，`architecture_decide` 提醒容量限制必须后端校验，`acceptance_generate` 覆盖满员、取消释放容量和后台时间段管理。
