# MVP 真实用户链路压测

日期：2026-06-26

版本：`product-spec-mcp@0.4.1`

验证对象：当前 `dist/index.cjs`

## 目标

用 15 个非技术或半技术用户的一句话需求跑完整 MCP 黑盒链路，判断 `spec_compile` 是否真的能减少实现 Agent 的脑补量。

完整链路：

1. `product_spec_assist`
2. `spec_compile`
3. `architecture_decide`
4. `acceptance_generate`

评估重点不是输出文案是否完整，而是规格是否让 Agent 少猜：

- 核心对象和功能是否具体
- 数据字段或数据文件是否具体
- 后端场景是否给出英文 REST API
- 本地/静态场景是否避免误拉后端
- 权限、容量、支付、AI Key、多人协作等边界是否出现
- 验收项是否能约束实现结果
- `structuredContent` 是否足够下游机器读取

## 结果

| 样例数 | 低脑补 | 中脑补 | 高脑补 |
|--------|--------|--------|--------|
| 15 | 14 | 1 | 0 |

启发式平均分：`9.47 / 10`

结论：当前版本已经能支撑小范围 MVP 试用。多数常见场景下，`spec_compile` 可以把一句话需求扩展成可执行对象、字段、接口、架构和验收约束，明显减少 Agent 从零设计的空间。

## 样例明细

| ID | 用户类型 | 一句话需求 | 结果 | 主要观察 |
|----|----------|------------|------|----------|
| `local-medicine` | 非技术家庭用户 | 家庭药箱管理小网页，记录药品名称、有效期、数量和提醒，数据存在浏览器里 | 低脑补 | 正确输出 localStorage、药品字段、过期提醒和本地架构 |
| `local-camping` | 非技术户外爱好者 | 露营装备清单 HTML，勾选、备注、分类筛选、导入导出 JSON | 低脑补 | 正确走纯前端 + JSON 导入导出 |
| `registration` | 半技术社群运营 | 活动报名，姓名电话报名人数，后台查看搜索导出 Excel | 低脑补但有一致性问题 | `spec_compile` 很完整，但 `architecture_decide` 在二次调用里误判为纯前端 |
| `booking` | 非技术门店老板 | 预约服务，服务项目、时间段、容量、取消 | 低脑补 | 输出 services/time_slots/bookings、容量校验和取消规则 |
| `ai-copy-saas` | 半技术创业者 | AI 小红书文案生成，登录、套餐扣次、历史、后续支付 | 低脑补 | 覆盖模型调用、扣次、历史、支付和 API Key 风险 |
| `content-community` | 内容运营 | 内容社区，发帖评论、管理员审核、用户举报 | 低脑补 | 输出帖子/评论/举报/审核状态流 |
| `knowledge-base` | 小团队负责人 | 团队知识库，草稿自己可见、发布后团队可见、文件夹 | 低脑补 | 输出文档、目录、权限、draft/published 规则 |
| `light-crm` | 销售小团队 | 客户跟进，客户、联系人、下次跟进、负责人、成交阶段 | 低脑补但结构信号略矛盾 | compile 内容完整，`technicalProfile.frontendOnly` 与 architecture 后端判断不完全一致 |
| `ticket-workflow` | 运营团队 | 内部工单流转，提交、分配处理人、状态到已解决 | 低脑补 | 输出工单状态机、角色和评论处理记录 |
| `portfolio-static` | 设计师 | 个人作品展示网站，纯静态，手机好看 | 低脑补 | 正确静态站，无 API；数据模型简单但可接受 |
| `gym-content-site` | 健身房店长 | 门店内容网站，课程/教练/价格/FAQ，经常由 Agent 改内容 | 低脑补 | 正确推荐内容文件 + 重新部署，不默认 CMS 后台 |
| `xlsx-chart-site` | 半技术分析师 | xlsx 做成可筛选图表网页，访客只看，不登录 | 低脑补 | 正确推荐静态 `data/chart-data.json` |
| `roommate-tasks` | 合租用户 | 室友家务任务认领，看到本周任务、认领、完成，不复杂登录 | 低脑补 | 正确识别多人协作，不误判纯 localStorage |
| `aa-calculator` | 非技术聚会用户 | AA 记账，输入每人付款和参与人，算谁转给谁，本地保存 | 低脑补但偏泛 | 正确本地架构，但缺少结算算法、参与人/付款明细字段 |
| `restaurant-order` | 餐厅老板 | 扫码点餐，顾客扫码下单，后厨看订单状态，老板维护菜品价格 | 中脑补 | `spec_compile` 误判为纯前端，缺少订单/菜品/后厨状态数据模型和 API |

## 关键问题

### P1：`spec_compile` 对扫码点餐这类交易/操作流场景脑补仍偏高

样例：`restaurant-order`

现象：

- `product_spec_assist` 能识别为 build_product 并追问 MVP、存储、平台
- `spec_compile` 只抽出 `订单`、`价格` 两个泛功能
- `technicalProfile` 是 `unknown`，但 `architecture` 落成了纯前端
- `dataModel` 输出 localStorage 或 JSON
- `apiDesign` 输出无需 API
- `architecture_decide` 单独调用时又判断需要后端、鉴权、后台、日志

影响：实现 Agent 仍要自己设计菜品、购物车、订单、后厨状态、老板后台、价格维护、桌号/二维码、订单状态流和接口，脑补量偏大。

建议：增加横向识别规则，不一定新增完整餐饮 domain pack。至少把 `扫码点餐 / 下单 / 后厨 / 菜品 / 订单状态 / 老板维护价格` 组合识别为需要后端的订单流，输出通用 order workflow 规格。

### P2：`spec_compile` 与 `architecture_decide` 在部分场景存在一致性裂缝

样例：`registration`

现象：

- `spec_compile` 明确输出 `light_backend_json_sqlite`、`needsBackend=true`、SQLite、Session、后台导出接口
- 用编译后的 features 再调 `architecture_decide`，返回了纯前端 localStorage

影响：如果 Agent 严格按多工具链执行，后一步可能覆盖前一步的正确架构判断。

建议：`architecture_decide` 应消费 `technicalProfile` 或能从 compile 后的 features 中识别后台/导出/管理员权限；不要只按弱本地工具兜底。

### P2：AA 记账可以更具体

样例：`aa-calculator`

现象：

- 技术形态正确：纯前端 + localStorage
- 但 `coreFeatures` 只有“AA 记账记录管理”和“新增/编辑/删除”
- 数据模型缺少参与人、付款记录、应付金额、转账建议
- 验收没有明确结算算法正确性

影响：Agent 仍要自己设计 AA 算法和字段，虽然架构不需要猜。

建议：把 `AA / 分账 / 记账 / 谁转给谁` 识别为本地计算工具，补充 participants、payments、settlements 和最小转账验收。

## MVP 判断

当前版本可进入小范围 MVP 试用，尤其适合：

- 本地清单/记录工具
- 静态展示站
- 内容文件驱动的网站
- 数据图表静态站
- 报名、预约、知识库、CRM、工单、内容社区、AI SaaS 等已覆盖轻后端场景

不建议直接扩大到公开商业化获客，除非先修掉：

1. 扫码点餐/订单流类需求的 `spec_compile` 纯前端误判
2. compile 与 architecture 的技术形态一致性
3. 本地计算类工具的领域字段和算法验收

## 验证命令

```bash
npm run build
node <inline-mcp-blackbox-eval>
```

补充验证：

```bash
npm run typecheck
npm test
```
