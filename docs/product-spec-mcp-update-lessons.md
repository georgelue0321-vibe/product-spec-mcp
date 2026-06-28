# product-spec-mcp 更新经验索引

日期：2026-06-22

用途：后续修改 `product-spec-mcp` 本体前，先查这份文档。它只保留会影响 MCP 输出质量、路由、规格编译、架构判断、验收生成和回归验证的经验；已排除 WorkBuddy 接入、macOS 权限、NODE_OPTIONS、运行副本同步、损坏 `node_modules` 等环境类问题。

来源：从 `docs/workbuddy-mcp-pitfalls.md` 抽取非环境、非 WorkBuddy 专属的产品更新经验。

## 快速索引

| 编号 | 主题 | 先看代码区域 | 必测方向 | 来源 |
|------|------|--------------|----------|------|
| L1 | `spec_compile` 不能丢用户 answers | `src/core/promptBuilder.ts`, `src/core/specReadiness.ts` | answers 消费、英文 REST、数据模型完整 | 坑点 6、14、17 |
| L2 | 追问规则必须按 domain 裁剪 | `src/core/clarificationEngine.ts`, `src/rules/clarificationQuestions.json` | 不同 domain 不串报名字段 | 坑点 7、13 |
| L3 | 详细长输入不能被通用词带偏 | `src/core/intentRouter.ts`, `src/core/domainClassifier.ts` | 长文本路由、专项优先级 | 坑点 8、10、12 |
| L4 | 字符串 answers 要归一化为布尔/结构化语义 | `src/core/promptBuilder.ts`, `src/core/specReadiness.ts` | `"不需要"` 不得被当成 true | 坑点 9 |
| L5 | 静态站和动态应用验收必须分流 | `src/core/acceptanceEngine.ts` | 纯静态站不得出现接口/500/loading 模板 | 坑点 11 |
| L6 | AI SaaS 是一等场景，不是报名表 | `src/core/clarificationEngine.ts`, `src/core/promptBuilder.ts`, `src/core/architectureEngine.ts` | AI Key、扣次、支付、内容安全 | 坑点 13、14 |
| L7 | 真实链路中 `spec_compile` 必须比追问更可执行 | `src/core/promptBuilder.ts` | API、DDL、约束、风险边界 | 坑点 17 |
| L8 | 不能只修 `spec_compile`，四个工具要共享语义 | `src/core/contextSignals.ts`, `src/core/architectureEngine.ts`, `src/core/acceptanceEngine.ts`, `src/core/assistEngine.ts` | compile/arch/accept/assist 一致 | 坑点 18 |
| L9 | 黑盒回归必须跑 `dist/index.cjs` | `tests/v03Regression.test.ts`, `dist/index.cjs` | build 后再跑 MCP stdio | 坑点 19 |
| L10 | 小白本地工具常用隐式表达 | `src/core/contextSignals.ts`, `src/core/clarificationEngine.ts` | “数据存在浏览器里 + 清单/记录”不能回报名模板 | 坑点 20 |
| L11 | “管理”是弱词，不能单独拉起后端 | `src/rules/architectureRules.json`, `src/core/architectureEngine.ts`, `src/core/contextSignals.ts` | “XX管理工具”本地场景仍应纯前端 | v0.3.17 复测 |
| L12 | 先判技术复杂度，再判业务 domain | `src/core/technicalProfile.ts`, `src/core/assistEngine.ts`, `src/core/promptBuilder.ts`, `src/core/architectureEngine.ts`, `src/core/acceptanceEngine.ts` | 静态/本地/JSON/data.json/轻后端/SaaS 技术形态矩阵 | v0.3.18 local-first gate |
| L14 | PM Gate 是产品经理式边界门，不是新 domain pack | `src/core/pmIntentGate.ts`, `src/core/assistEngine.ts`, `src/core/promptBuilder.ts`, `src/core/architectureEngine.ts`, `src/core/acceptanceEngine.ts`, `src/core/remotePmIntentGate.ts` | 多人协作、内容营销站、xlsx 图表站、远程 gate 降级、旧 domain 不被抢路由 | v0.3.26 PM Gate |
| L15 | 订单流不是纯前端记录工具 | `src/core/technicalProfile.ts`, `src/core/promptBuilder.ts`, `src/core/architectureEngine.ts` | 扫码点餐、后厨状态、菜品维护、订单 API | v0.4.2 MVP 收口 |
| L16 | 本地计算里的付款记录不是支付系统 | `src/core/localToolSignals.ts`, `src/core/technicalProfile.ts`, `src/core/architectureEngine.ts` | AA/分账/转账建议仍应 localStorage | v0.4.2 MVP 收口 |
| L17 | 连接文件错误要机器可读 | `src/core/connectGuide.ts`, `src/tools/productSpecConnect.ts`, `src/schemas/outputs/productSpecConnect.output.ts` | 无效 connect file 应有 structuredContent.isError 和 warnings | v0.4.2 MVP 收口 |

## L1：`spec_compile` 不能丢用户 answers

**典型问题**：用户已经回答字段、去重、导出、后台、AI 服务、套餐扣次等信息，但 `spec_compile` 输出仍是空泛草案，甚至生成中文 API 路径。

**更新原则**：
- 所有新增 answers 字段必须进入 readiness、coreFeatures、dataModel、apiDesign、riskNotes 或 inputConsumption。
- 不能只把 answers 放进 markdown；structuredContent 也必须可断言。
- API 路径必须使用英文 REST，不要把中文功能词直接拼成 `/api/登录`、`/api/提交`。

**回归要求**：
- `tests/specCompile.test.ts` 覆盖源码函数。
- `tests/v03Regression.test.ts` 覆盖真实 `dist/index.cjs`。
- 断言 `inputConsumption.consumed / unused / assumed`，不要只断言 markdown。

## L2：追问规则必须按 domain 裁剪

**典型问题**：AI SaaS、内容社区、知识库、本地工具等场景被问“姓名+电话、手机号去重、导出 Excel、提交后审核”。

**更新原则**：
- `clarificationEngine` 要先判断 domain，再返回 domain 专属问题。
- 未命中稳定 domain 时，不要套报名/电商/AI/知识库任一模板。
- `product_spec_assist` 的 quickQuestions 和 markdown clarification 是两条路径，必须同时修。

**回归要求**：
- 对每个新增 domain，至少测 `product_spec_assist` 和 `spec_interrogate` 两个入口。
- 负向断言必须包含历史污染词，例如“手机号去重 / 导出 Excel / 报名数据”。

## L3：详细长输入不能被通用词带偏

**典型问题**：
- UI Hero 升级被“网站/页面/高级”带回产品开发。
- 上线咨询被作品集介绍带回静态站规划。
- 长文本里多个背景词淹没真实意图。

**更新原则**：
- 对强意图场景加专项优先规则，例如 `上线 + 需要注意什么` 优先 launch。
- UI 修改要识别“已有页面 + 局部区域 + 升级/改造”。
- 不能只用关键词累计分；要有否决和优先级。

**回归要求**：
- 用长上下文样例测 `product_spec_assist.routedIntent.scenario`。
- 同时断言 `selectedTool`，防止 scenario 对了但工具错。

## L4：字符串 answers 要归一化为布尔/结构化语义

**典型问题**：`backend_need: "需要管理后台"` 没被识别为 true，或 `"不需要登录"` 被误判成需要鉴权。

**更新原则**：
- 英文 key 的字符串值也要归一化，不只处理中文 key 映射。
- 否定词优先级高于肯定词：`不需要登录` 不能因为包含“登录”而判 true。
- 布尔归一化后仍要保留原文，用于 markdown 和 inputConsumption 审计。

**回归要求**：
- 每个关键布尔字段至少测肯定、否定、含混三类表达。
- 特别关注 `backend_need`、`has_auth`、`admin_access`、`payment`、`ai`。

## L5：静态站和动态应用验收必须分流

**典型问题**：纯静态作品网站验收里出现 loading、接口超时、500 错误、表单提交。

**更新原则**：
- `acceptance_generate` 必须先区分纯静态展示站、纯前端本地工具、动态 Web 应用。
- 动态应用模板只在明确有表单提交、后端、登录、支付、AI API 时注入。
- 上线咨询要回答上线检查，不要回到产品模块规划。

**回归要求**：
- 纯静态站负向断言：不得包含接口、500、后端、表单提交 loading。
- 动态应用正向断言：有后端时必须包含错误处理和鉴权。

## L6：AI SaaS 是一等场景，不是报名表

**典型问题**：AI 文案工具被问报名字段，或者 `spec_compile` 生成纯前端空壳。

**更新原则**：
- AI SaaS 必须覆盖模型/API、API Key 保存、账号、套餐、扣次、支付、生成失败扣次、历史记录、内容安全、后台运营。
- 架构必须提示后端代理 AI API，不能允许 API Key 放前端。
- 支付金额和支付状态必须以后端为准。

**回归要求**：
- `architecture_decide` 必须断言 `needBackend / needAuth / paymentRisk / aiKeyRisk`。
- `acceptance_generate` 必须包含 AI Key 不暴露、扣次、日志、支付状态确认。

## L7：真实链路中 `spec_compile` 必须比追问更可执行

**典型问题**：真实项目测试里 `product_spec_assist` 很强，但 Agent 实现时完全忽略 `spec_compile`，自己重做 API、表结构、校验规则。

**更新原则**：
- `spec_compile` 的输出必须能直接指导 Agent 写 MVP。
- domain pack 要产出：核心对象、数据模型、英文 REST API、状态机/规则、风险边界、验收提示。
- 不确定时宁可 Draft + 明确缺口，不要 Build Ready + 空壳。

**回归要求**：
- 真项目链路测试要记录“Agent 脑补量”。
- 如果 Agent 脑补数据模型/API/业务规则超过 30%，说明 compile 不合格。

## L8：不能只修 `spec_compile`，四个工具要共享语义

**典型问题**：`spec_compile` 已经输出 generic + 纯前端，但 `architecture_decide` 仍推荐 PostgreSQL/JWT/RBAC，`acceptance_generate` 仍套电商/宠物/电影模板，`product_spec_assist` 仍问报名字段。

**更新原则**：
- `contextSignals` 里的核心语义必须被 assist、compile、architecture、acceptance 共同消费。
- `generic + personal/local/no-login/no-backend` 是前置门，不是最后兜底。
- 弱词不能单独触发高风险架构：例如“预算、购买状态、价格、链接”不等于支付系统。

**回归要求**：
- 同一场景必须跑四阶段，而不是只测 compile。
- 必须有反向对照组，确认真报名/真电商/真知识库没有被误杀成 generic。

## L9：黑盒回归必须跑 `dist/index.cjs`

**典型问题**：源码单测通过，但 MCP 客户端仍看到旧行为。

**更新原则**：
- 行为改动后必须先 `npm run build`。
- `tests/v03Regression.test.ts` 是发布前门禁，因为它通过 stdio 启动 `dist/index.cjs`。
- 版本号、`src/server.ts`、`package.json`、构建产物要一致。

**标准验证顺序**：

```bash
npm run typecheck
npm run build
npx vitest run tests/v03Regression.test.ts
npm test
node -e "const fs=require('fs'); const pkg=require('./package.json'); const dist=fs.readFileSync('dist/index.cjs','utf8'); console.log(JSON.stringify({packageVersion:pkg.version, distHasVersion:dist.includes(pkg.version)}))"
```

## L10：小白本地工具常用隐式表达

**典型问题**：用户没有显式说“不登录/自己用”，只说“数据存在浏览器里、清单、记录、收藏、进度”，入口 assist 就退回报名模板。

**更新原则**：
- 本地信号要覆盖自然表达：`浏览器里 / 浏览器内 / 存在浏览器 / 存到浏览器 / localStorage / 本地保存`。
- 轻工具信号要覆盖：`清单 / 列表 / 收藏 / 进度 / 台账 / 记录工具 / 提醒工具 / 计算器 / 小页面 / 小网页 / HTML`。
- 判断必须保守：只有 `本地信号 + 轻工具信号 + 没有明确多人/后台/支付正向信号` 才进入本地工具门。

**回归要求**：
- `product_spec_assist` 对“露营装备清单 HTML，数据存在浏览器里”必须返回 local-first questions。
- 负向断言：不得出现“报名数据、手机号去重、导出 Excel、管理员登录才能访问”。

## L11：“管理”是弱词，不能单独拉起后端

**典型问题**：用户说“冰箱食材管理工具、家庭药箱管理工具、露营装备管理清单”时，`architecture_decide` 因为 product_type 或 features 含“管理”二字，就误判为后端管理系统，输出 `needBackend/Auth/Admin/Separation=true`、PostgreSQL、RBAC 和 high risk。

**更新原则**：
- “管理”在中文小白需求里常常只是“记录和整理”，不能等同后台管理。
- 真正触发后端/后台的强信号应是：`后台、管理员、审核、权限、多人、协作、登录、注册、服务端数据库、支付、订单` 等。
- 如果命中 `本地保存/浏览器保存 + 不需要账号/不登录 + 管理工具/清单/记录`，必须优先按 `generic + pure frontend` 处理。
- `needAdmin` 的兜底正则不要包含单字“管理”；使用“后台/管理员/审核/权限/分配/发布/撤回”等更强语义。

**回归要求**：
- `architecture_decide` 对“冰箱食材管理工具，数据存在浏览器里，不需要账号”必须返回：
  - `domain=generic`
  - `canBeFrontendOnly=true`
  - `needBackend=false`
  - `needAuth=false`
  - `needAdmin=false`
  - `needSeparation=false`
  - 输出不得包含 PostgreSQL/RBAC。
- 反向测试仍要保留：`管理系统 + 登录`、`后台管理 + 审核 + 权限`、团队知识库/CRM/报名后台不能被误杀成纯前端。

## L12：先判技术复杂度，再判业务 domain

**典型问题**：按业务 domain 先匹配时，“标题/正文/状态/评分/管理/价格/购买状态”等弱词会把小白本地工具误吸到知识库、工单、CRM、电商或报名模板。逐个补 domain pack 只能修一个过一个，遇到新小工具还会复发。

**更新原则**：
- 四个核心工具必须先生成共享 `technicalProfile`，再决定是否进入 domain pack。
- 小白基础需求默认 local-first：静态页、本地 localStorage、JSON 导入导出、`data.json` 静态数据页优先。
- “管理、价格、预算、购买状态、标题、正文、评分、状态”都是弱词，不能单独触发后端、支付、知识库或工单。
- 明确强后端信号才升级：登录、多人、后台、管理员、审核、权限、支付、订单、AI API、容量并发、服务端提交。
- 所有追问必须带例子。不要裸问“字段/API Key/鉴权/数据持久化”；要说“每条记录要保存哪些信息，比如名称、日期、备注”。

**回归要求**：
- 技术形态矩阵至少覆盖：个人作品静态页、浏览器本地工具、JSON 导入导出工具、旅行攻略 `data.json` + 地图、活动报名轻后端、AI SaaS。
- 四阶段都要测：`product_spec_assist`、`spec_compile`、`architecture_decide`、`acceptance_generate`。
- 本地/静态场景必须断言：
  - `technicalProfile.frontendOnly=true`
  - 不生成 REST API
  - 不出现 PostgreSQL/RBAC/管理员/支付/报名污染
  - quickQuestions 或 clarification 问题包含“比如/例如”的例子。
- 真 domain 反向组必须保留，防止报名、预约、电商、知识库、AI SaaS 被误杀成 pure frontend。

## 排除项

## L13：工具默认值、内容发布和否定词不能污染技术判断

**典型问题**：
- `acceptance_generate` 的 schema 默认 `has_backend=false / has_auth=false` 被当成用户明确说“不需要后端/不登录”，导致“活动报名后台导出、管理员登录”被误判成纯前端 JSON 导入导出。
- “发布文档/发布文章”里的“发布”被入口路由当成“上线发布”，让知识库需求走到 launch 场景。
- `spec_compile` 从“不需要登录、不需要后台”里提取出“登录/后台”，导致 platform 或 coreFeatures 与用户排除项自相矛盾。

**更新原则**：
- schema 默认值不是用户意图。只有用户原话或结构化答案里出现“本地保存、浏览器里、不登录、不需要账号、不需要后台、自己用”等明确表达，才可作为 local-first 压制信号。
- `发布` 是弱词。只有“上线、部署、域名、服务器、备案、怎么上线、上线前”等语境才进入 launch；“发布文档/发布文章/发布内容”仍是 build_product。
- 提取平台和功能时要做否定语境过滤：`不需要登录` 不能变成登录功能，`不需要后台` 不能把 platform 改成 backend。
- `acceptance_generate` 要根据 `technicalProfile.needsBackend/needsAuth/needsAdmin` 自我纠偏，不能只依赖调用方传入的 `has_backend/has_auth`。

**回归要求**：
- 活动报名系统：“用户填写姓名、电话、报名人数；后台查看导出；管理员需要登录”必须保持 `light_backend_json_sqlite`，验收包含表单校验、导出和鉴权，不得进入 local JSON。
- 内部知识库：“写文档、发布文档、草稿自己可见、发布后团队可见、不接 AI/支付”必须 route 到 build_product，assist 问题应包含文档字段/权限规则，验收包含 draft/published 权限。
- 个人作品展示和抽签分组工具包含“不需要登录/不需要后台”时，`spec_compile` 不得把“登录”放入 coreFeatures，platform 不得变成 backend。

## L14：PM Gate 是产品经理式边界门，不是新 domain pack

**典型问题**：
- 只靠补药品、食材、健身房、图表等 domain pack 会进入无穷枚举，遇到新型小白需求仍会重回报名、后台或 CRM 模板。
- “多人、认领、协作、相互安排”应先确认访问拓扑和运行时数据，不应默认 localStorage-only，也不应直接推公网服务器。
- “内容经常改、上传很多 Q&A/照片/促销/教练信息”不等于必须做 CMS 后台；Agent 时代可以默认内容文件 + Agent 更新 + 重新部署。
- PM Gate 泛协作规则太宽时，会误抢“工单分配处理人”等已有稳定 domain。

**更新原则**：
- 先判 `usageScope / maintenanceMode / accessTopology`，再给技术形态；不要先套业务 domain。
- PM Gate 只负责横向边界，不要把它写成新的大 domain pack。
- 已稳定命中的 domain（工单、知识库、CRM、预约、报名、AI SaaS 等）优先保留原路线；PM Gate 的三类新门只在 `domain=generic` 时接管 architecture 和 acceptance。
- 多人协作默认先问局域网是否足够；固定几人但外出也要用时，才建议低价 VPS + SQLite + IP 访问；域名/HTTPS/备案是再下一层升级。
- 内容营销站和 xlsx 图表站默认 `agent_assisted + static_json_data_page + static_hosting_with_agent_updates`；只有网页编辑、网页上传、访客提交、多人维护、历史版本或权限控制才升级后端。
- Online LLM Gate 只在本地低置信、冲突或 unknown 时辅助选门；本地枚举校验和强规则必须是最终裁判。

**回归要求**：
- 四阶段都要覆盖：`product_spec_assist`、`spec_compile`、`architecture_decide`、`acceptance_generate`。
- 家庭药品仍是 local-first MVP 草案。
- 室友任务清单进入 `multi_user_collaboration + light_backend_json_sqlite`，并追问局域网/公网、认领规则、时间冲突。
- 健身房 GEO 内容站进入 `content_marketing_site + agent_assisted + static_json_data_page`，不得默认 CMS 后台。
- xlsx 图表站进入 `data_visualization_site + agent_assisted + static_json_data_page`，不得默认上传后台/数据库。
- 工单、知识库、CRM 等旧 domain 不得被 PM Gate 泛协作门抢路由。
- 远程 gate 必测：本地高置信不调用 LLM、force/低置信调用 LLM、远端 invalid JSON 或非法枚举降级、远端错判 static page 时本地强规则修回多人协作。

## L15：订单流不是纯前端记录工具

**典型问题**：扫码点餐、后厨看订单状态、老板维护菜品价格这类需求，`spec_compile` 只抽出“订单/价格”，然后按 pure frontend/localStorage 输出，导致 Agent 需要重新设计菜单、菜品、订单项、后厨状态和老板后台。

**更新原则**：
- “扫码点餐 / 顾客下单 / 后厨 / 订单状态 / 菜品维护 / 桌号”组合是运行时订单流，默认需要统一后端状态源。
- 不需要做完整餐饮 domain pack；可以先用横向 operational order workflow 输出菜单、条目、订单、订单项和状态流。
- 订单金额或菜品价格必须以后端菜品表为准，不能信任前端传入金额。

**回归要求**：
- `spec_compile` 对扫码点餐必须输出 `menus / dishes / orders / order_items`。
- API 必须包含 `POST /api/orders`、后厨状态更新和管理员菜品维护。
- `architecture_decide` 不能把该类需求降级成纯前端。

## L16：本地计算里的付款记录不是支付系统

**典型问题**：AA 记账、分账、谁该转给谁，本质是本地计算和记录；如果看到“付款记录”就拉起支付后端，会把纯前端工具误判成 SaaS。

**更新原则**：
- `AA / 分账 / 均摊 / 谁该转给谁 / 转账建议` 与 `付款记录 / 付了多少钱 / 参与人 / 本地保存` 同时出现时，应按本地计算工具处理。
- `spec_compile` 应输出 participants、payments、shareAmount、settlements，而不是只有“新增/编辑/删除”。
- `architecture_decide` 对这类 features 仍应 `needBackend=false`。

**回归要求**：
- `spec_compile` 必须包含参与人、付款记录、转账建议、`settlements` 和总金额/差额验收。
- `architecture_decide` 对 AA 记账 features 不得触发 paymentRisk。

## L17：连接文件错误要机器可读

**典型问题**：无效 `product-spec-mcp-connect.json` 只在文本里提示错误，机器调用者无法通过结构化输出判断失败。

**更新原则**：
- 无效连接文件应返回 `structuredContent.isError=true`。
- 原始 warnings 要保留在 structured output 和 markdown 注意事项里。
- 有效连接文件即使带非关键 warnings，也不要误标错误。

**回归要求**：
- 黑盒 MCP stdio 测试必须覆盖无效 connect file。
- 断言 `configured=false`、`isError=true` 和具体 warning 文案。

以下坑点仍保留在 `docs/workbuddy-mcp-pitfalls.md`，但不进入本项目更新经验索引：

- WorkBuddy 接入路径、用户级/项目级配置、Electron 环境差异。
- `NODE_OPTIONS`、macOS TCC、JSON 配置格式、CJS/ESM 接入兼容。
- WorkBuddy 副本源码/构建产物同步。
- WorkBuddy `node_modules/.bin` 损坏。

这些是运行环境和接入维护问题，不应污染 MCP 产品逻辑的更新判断。
