import { describe, it, expect } from "vitest";
import { generateAcceptance } from "../src/core/acceptanceEngine.js";

describe("acceptanceGenerate", () => {
  it("should generate base acceptance rules", () => {
    const result = generateAcceptance("表单工具", ["表单", "提交"], "web", false, false, false);
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.definitionOfDone.length).toBeGreaterThan(0);
  });

  it("should include form validation rules", () => {
    const result = generateAcceptance("表单工具", ["表单", "提交"], "web", false, false, false);
    const formCat = result.categories.find((c) => c.category === "表单验收");
    expect(formCat).toBeDefined();
    expect(formCat!.items.some((i) => i.includes("必填"))).toBe(true);
  });

  it("should include mobile overflow check", () => {
    const result = generateAcceptance("网站", ["展示"], "web", false, false, false);
    const allItems = result.categories.flatMap((c) => c.items);
    expect(allItems.some((i) => i.includes("横向溢出"))).toBe(true);
  });

  it("should generate static-site acceptance without dynamic app checks", () => {
    const result = generateAcceptance(
      "个人作品集展示网站（纯HTML/CSS/JS静态站）",
      ["导航栏", "Hero首屏", "关于我", "作品集", "联系方式", "响应式设计", "滚动渐入动画"],
      "web",
      false,
      false,
      false
    );

    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.categories.some((c) => c.category === "页面与内容验收")).toBe(true);
    expect(allItems).toContain("占位内容");
    expect(allItems).toContain("favicon");
    expect(allItems).toContain("meta description");
    expect(allItems).toContain("robots.txt");
    expect(allItems).toContain("noopener noreferrer");
    expect(allItems).toContain("prefers-reduced-motion");
    expect(allItems).not.toContain("loading 或 skeleton");
    expect(allItems).not.toContain("空数据");
    expect(allItems).not.toContain("表单提交");
    expect(allItems).not.toContain("接口超时");
    expect(allItems).not.toContain("500 错误");
  });

  it("should generate business checks for generic beginner tools", () => {
    const result = generateAcceptance(
      "AA 分账计算器和宠物疫苗提醒小工具",
      ["人员列表", "消费项目", "付款人", "谁转给谁多少钱", "宠物疫苗", "驱虫", "到期提醒", "本地保存"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("谁需要转给谁多少钱");
    expect(allItems).toContain("总额守恒");
    expect(allItems).toContain("疫苗、驱虫、体检");
    expect(allItems).toContain("到期提醒按日期排序");
    expect(allItems).not.toContain("管理员可以分配客户给销售");
    expect(allItems).not.toContain("管理员可以发布或撤回文档");
  });

  it("should generate static JSON map checks without backend pollution", () => {
    const result = generateAcceptance(
      "旅行攻略 HTML",
      ["data.json", "地图点位", "美食", "酒店", "景点", "分类筛选"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.technicalProfile?.shape).toBe("static_json_data_page");
    expect(allItems).toContain("data.json 加载成功");
    expect(allItems).toContain("地图点位和列表数据一致");
    expect(allItems).toContain("地图 provider");
    expect(allItems).not.toContain("管理员");
    expect(allItems).not.toContain("支付金额");
    expect(allItems).not.toContain("PostgreSQL");
  });

  it("should infer backend acceptance for registration admin exports despite default false flags", () => {
    const result = generateAcceptance(
      "活动报名系统",
      ["用户填写姓名、电话、报名人数", "后台查看和导出", "管理员需要登录"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.technicalProfile?.shape).toBe("light_backend_json_sqlite");
    expect(result.technicalProfile?.frontendOnly).toBe(false);
    expect(allItems).toContain("手机号格式错误");
    expect(allItems).toContain("管理员能按当前筛选条件导出 Excel 文件");
    expect(allItems).toContain("未登录有跳转登录页");
    expect(allItems).not.toContain("JSON 导入失败");
  });

  it("should infer backend acceptance for team knowledge bases despite default false flags", () => {
    const result = generateAcceptance(
      "内部知识库",
      ["写文档", "发布文档", "按分类搜索", "草稿只有自己能看", "发布后团队能看", "不接 AI", "不接支付"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.technicalProfile?.shape).toBe("light_backend_json_sqlite");
    expect(result.technicalProfile?.frontendOnly).toBe(false);
    expect(allItems).toContain("作者可以查看和编辑自己的 draft 文档");
    expect(allItems).toContain("搜索结果只返回当前用户有权限查看的 published 文档");
    expect(allItems).toContain("未登录用户不能创建、编辑或查看受限文档");
    expect(allItems).not.toContain("支付金额");
    expect(allItems).not.toContain("AI API");
  });

  it("should keep local subscription reminders out of commerce acceptance", () => {
    const result = generateAcceptance(
      "个人订阅续费提醒小工具，自己用，纯前端本地保存，不登录",
      ["订阅名称", "价格", "续费周期", "下次续费日期", "到期提醒", "localStorage 本地保存", "不需要登录", "不需要后台"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("订阅项能保存名称、周期、价格、下次续费日期和备注");
    expect(allItems).toContain("本地记录不会触发支付、订单或后台权限流程");
    expect(allItems).not.toContain("资料包");
    expect(allItems).not.toContain("订单金额");
    expect(allItems).not.toContain("支付成功");
    expect(allItems).not.toContain("管理员可以");
  });

  it("should keep personal repair records out of pet or admin templates", () => {
    const result = generateAcceptance(
      "家庭维修保修记录小工具，自己用，不登录，本地保存",
      ["家电名称", "维修日期", "费用", "保修到期", "状态", "备注", "搜索筛选", "不需要后台"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("维修或保修记录能保存物品名称、日期、费用、状态和备注");
    expect(allItems).toContain("即将到期、已过期和正常状态能按日期正确区分");
    expect(allItems).not.toContain("疫苗");
    expect(allItems).not.toContain("驱虫");
    expect(allItems).not.toContain("管理员可以");
  });

  it("should generate scene-specific checks for insurance and game local tools", () => {
    const insurance = generateAcceptance(
      "家庭保险保单提醒 HTML，小白自己用，不登录，本地保存",
      ["保险名称", "保费", "缴费周期", "到期日", "客服电话", "备注", "到期提醒", "不接支付", "不做后台"],
      "web",
      false,
      false,
      false
    );
    const insuranceItems = insurance.categories.flatMap((c) => c.items).join("\n");

    expect(insuranceItems).toContain("保单记录能保存保险名称、保费、缴费周期、到期日、客服电话和备注");
    expect(insuranceItems).not.toContain("维修或保修记录");
    expect(insuranceItems).not.toContain("资料包");

    const game = generateAcceptance(
      "游戏收藏与进度记录工具，自己用，不登录，本地保存",
      ["游戏名", "平台", "游玩状态", "评分", "成就进度", "标签筛选", "备注"],
      "web",
      false,
      false,
      false
    );
    const gameItems = game.categories.flatMap((c) => c.items).join("\n");

    expect(gameItems).toContain("游戏条目能保存游戏名、平台、游玩状态、评分、成就进度、标签和备注");
    expect(gameItems).not.toContain("电影条目");
    expect(gameItems).not.toContain("管理员可以");
  });

  it("should build contextual local-tool acceptance from horizontal signals", () => {
    const result = generateAcceptance(
      "家庭药品管理工具",
      ["记录家里有哪些药", "快过期提醒", "页面高级一点"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.technicalProfile?.shape).toBe("local_storage_tool");
    expect(allItems).toContain("药品记录能保存药品名、数量/库存、有效期/到期日、分类、存放位置、备注");
    expect(allItems).toContain("提醒列表能按日期排序");
    expect(allItems).toContain("页面视觉风格一致");
    expect(allItems).not.toContain("PostgreSQL");
    expect(allItems).not.toContain("管理员可以");
  });

  it("should generate PM gate acceptance for roommate collaboration without localStorage-only guidance", () => {
    const result = generateAcceptance(
      "多人使用的任务清单",
      ["我和室友的日程每天展示", "同一时间和不同时间都要展示", "可以相互安排任务", "对方需要认领"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.pmIntentDecision?.needType).toBe("multi_user_collaboration");
    expect(result.pmIntentDecision?.technicalShape).toBe("light_backend_json_sqlite");
    expect(allItems).toContain("待认领状态");
    expect(allItems).toContain("多人运行时协作数据不得分别保存在各自浏览器 localStorage");
    expect(allItems).toContain("局域网、本机公网 IP 或域名 HTTPS");
    expect(allItems).not.toContain("刷新页面后，本地保存的数据仍能恢复");
  });

  it("should generate PM gate acceptance for agent-maintained gym GEO sites without default CMS", () => {
    const result = generateAcceptance(
      "健身房 GEO 内容营销网站",
      ["Q&A", "健身房照片", "用户反馈", "近期促销活动", "教练信息", "不定期维护内容", "Agent 帮我更新"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.pmIntentDecision?.needType).toBe("content_marketing_site");
    expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(result.pmIntentDecision?.technicalShape).toBe("static_json_data_page");
    expect(allItems).toContain("Agent 更新内容文件并重新部署");
    expect(allItems).toContain("不强制生成 CMS 后台");
    expect(allItems).not.toContain("管理员使用正确账号密码可以登录后台");
  });

  it("should generate PM gate acceptance for xlsx visualization sites without default backend upload", () => {
    const result = generateAcceptance(
      "图表网站",
      ["每次我提供新的 xlsx 文件", "网站根据新的数据渲染出结果"],
      "web",
      false,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(result.pmIntentDecision?.needType).toBe("data_visualization_site");
    expect(result.pmIntentDecision?.maintenanceMode).toBe("agent_assisted");
    expect(result.pmIntentDecision?.technicalShape).toBe("static_json_data_page");
    expect(allItems).toContain("Agent 能从新 xlsx 或 CSV 生成页面读取的图表数据文件");
    expect(allItems).toContain("默认不要求后台上传、数据库或登录权限");
    expect(allItems).not.toContain("后端接口");
  });

  it("should include backend rules when has backend", () => {
    const result = generateAcceptance("管理系统", ["管理"], "web", true, false, false);
    const backendCat = result.categories.find((c) => c.category === "后端验收");
    expect(backendCat).toBeDefined();
  });

  it("should include payment rules when has payment", () => {
    const result = generateAcceptance("电商", ["支付"], "web", true, true, false);
    const paymentCat = result.categories.find((c) => c.category === "支付验收");
    expect(paymentCat).toBeDefined();
    expect(paymentCat!.items.some((i) => i.includes("后端回调"))).toBe(true);
  });

  it("should include auth rules when has auth", () => {
    const result = generateAcceptance("系统", ["登录"], "web", true, false, true);
    const authCat = result.categories.find((c) => c.category === "权限验收");
    expect(authCat).toBeDefined();
    expect(authCat!.items.some((i) => i.includes("权限校验不能只靠前端"))).toBe(true);
  });

  it("should include export rules for registration systems", () => {
    const result = generateAcceptance(
      "活动报名系统",
      ["报名表单", "后台管理", "按手机号搜索", "Excel导出", "管理员登录"],
      "web",
      true,
      false,
      true
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("导出 Excel");
    expect(allItems).toContain("必填字段");
    expect(allItems).toContain("手机号格式错误");
    expect(allItems).toContain("同一手机号重复报名");
    expect(allItems).toContain("按手机号搜索");
    expect(allItems).toContain("退出登录后不能继续访问后台数据");
  });

  it("should include AI SaaS safety and traceability rules", () => {
    const result = generateAcceptance(
      "AI 文案生成 SaaS",
      ["AI", "登录", "支付", "套餐", "历史记录"],
      "web",
      true,
      true,
      true
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("AI API Key 不能暴露在前端");
    expect(allItems).toContain("生成历史可查看");
    expect(allItems).toContain("request_id");
  });

  it("should include digital commerce download checks without export or refund pollution", () => {
    const result = generateAcceptance(
      "数字资料售卖网站",
      ["资料包浏览", "创建订单", "mock 支付", "支付成功后下载", "管理员上架资料", "订单管理", "下载记录"],
      "web",
      true,
      true,
      true
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("订单金额必须由后端根据商品价格计算");
    expect(allItems).toContain("未支付订单不能下载资料文件");
    expect(allItems).toContain("支付成功后才能下载对应资料");
    expect(allItems).toContain("下载接口必须校验登录、订单归属和支付状态");
    expect(allItems).toContain("下载记录包含用户、资料、订单和时间");
    expect(allItems).toContain("管理员可以新增、编辑和上下架资料包");
    expect(allItems).toContain("管理员可以查看订单和下载记录");
    expect(allItems).not.toContain("导出 Excel");
    expect(allItems).not.toContain("退款");
  });

  it("should include appointment checks without registration, payment or AI pollution", () => {
    const result = generateAcceptance(
      "预约服务系统",
      ["服务项目", "时间段", "预约提交", "容量限制", "取消预约", "后台管理", "状态筛选"],
      "web",
      true,
      false,
      true
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("用户可以查看可预约服务项目");
    expect(allItems).toContain("用户可以查看可预约时间段");
    expect(allItems).toContain("满员时间段不能继续预约");
    expect(allItems).toContain("取消预约后释放对应时间段容量");
    expect(allItems).toContain("管理员可以新增、编辑和停用时间段");
    expect(allItems).toContain("管理员可以按状态筛选预约");
    expect(allItems).toContain("容量限制必须由后端校验");
    expect(allItems).not.toContain("导出 Excel");
    expect(allItems).not.toContain("报名人数");
    expect(allItems).not.toContain("手机号搜索");
    expect(allItems).not.toContain("支付金额");
    expect(allItems).not.toContain("下载接口");
    expect(allItems).not.toContain("AI API Key");
  });

  it("should generate single-user CRM checks without sales or admin role pollution", () => {
    const result = generateAcceptance(
      "个人轻量 CRM，就我一个人用，不需要多角色权限，不需要销售账号",
      ["客户录入", "联系人管理", "跟进记录", "客户阶段", "下次跟进时间", "不需要管理员"],
      "web",
      true,
      false,
      false
    );
    const allItems = result.categories.flatMap((c) => c.items).join("\n");

    expect(allItems).toContain("可以新增、查看、编辑和删除或归档客户");
    expect(allItems).toContain("客户可以保存联系人信息");
    expect(allItems).toContain("下次跟进时间可以保存并用于筛选");
    expect(allItems).not.toContain("未登录用户不能创建或查看客户");
    expect(allItems).not.toContain("销售只能查看和编辑自己负责的客户");
    expect(allItems).not.toContain("管理员可以分配客户给销售");
    expect(allItems).not.toContain("敏感操作有审计日志");
  });

  it("should include mini program rules", () => {
    const result = generateAcceptance("小程序", ["展示"], "mini_program", false, false, false);
    const mpCat = result.categories.find((c) => c.category === "小程序验收");
    expect(mpCat).toBeDefined();
  });
});
