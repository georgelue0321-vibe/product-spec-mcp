# MVP 收口修复后复测

日期：2026-06-26

版本：`product-spec-mcp@0.4.2`

## 修复范围

1. 修复扫码点餐/订单流类需求被 `spec_compile` 编成纯前端的问题。
2. 修复 `spec_compile` 和 `architecture_decide` 在报名系统上的技术形态不一致。
3. 增强 AA 记账本地计算工具的字段、结算建议和算法验收。
4. 修复 `product_spec_connect` 无效连接文件缺少结构化错误标记的问题。
5. 重写 README 顶部，让公开入口更贴近“有产品想法但不会整理工程规格”的用户。

## 回归结果

验证命令：

```bash
npm run typecheck
npm test
```

结果：

- `typecheck`: pass
- `test`: 15 files / 259 tests pass
- `v03Regression.test.ts`: 59 black-box MCP stdio tests pass

## 真实用户链路复测

复测对象：15 个非技术/半技术用户一句话需求。

链路：

1. `product_spec_assist`
2. `spec_compile`
3. `architecture_decide`
4. `acceptance_generate`

结果：

| 样例数 | PASS | WARN | FAIL |
|--------|------|------|------|
| 15 | 15 | 0 | 0 |

重点样例：

- `restaurant-order`: `spec_compile` 输出 `light_backend_json_sqlite`，包含 `menus`、`dishes`、`orders`、`order_items`、后厨状态 API 和老板菜品维护 API。
- `registration`: `architecture_decide` 保持 `domain=registration`、`needBackend=true`、`recommendedDatabase=SQLite`，不再被降级为 frontend-only。
- `aa-calculator`: `spec_compile` 输出参与人、付款记录、转账建议和 `settlements`；`architecture_decide` 保持 `needBackend=false`。
- `product_spec_connect`: 无效连接文件在 `structuredContent.isError=true`，并保留具体 warnings。

## 当前判断

当前版本可以进入小范围 MVP 试用。公开商业化前仍建议继续做真实用户样本收集，但上一轮列出的 P1/P2 收口问题已经有回归覆盖。
