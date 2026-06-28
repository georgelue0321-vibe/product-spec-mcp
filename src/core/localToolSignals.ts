export interface LocalToolSignalProfile {
  recordObject: string;
  fieldExample: string;
  featureHints: string[];
  acceptanceItems: string[];
}

export function buildLocalToolSignalProfile(text: string): LocalToolSignalProfile {
  const recordObject = extractRecordObject(text);
  const fieldLabels = buildFieldLabels(text, recordObject);
  const featureHints = buildFeatureHints(text, recordObject);
  const acceptanceItems = buildAcceptanceItems(text, recordObject, fieldLabels);

  return {
    recordObject,
    fieldExample: fieldLabels.join("、"),
    featureHints,
    acceptanceItems,
  };
}

function extractRecordObject(text: string): string {
  if (isSplitBillTool(text)) return "AA 记账";
  if (/药品|药箱|药/.test(text)) return "药品";

  const patterns = [
    /(?:做一个|做个|开发一个|创建一个|想做一个|想做个)([^，。,.；;]{1,16}?)(?:管理工具|提醒工具|记录工具|清单|小工具|页面|网页|HTML)/i,
    /记录(?:家里有哪些)?([^，。,.；;、和]{1,12})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanObjectLabel(match?.[1]);
    if (value) return value;
  }

  return "记录";
}

function cleanObjectLabel(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/^(家庭|个人|家里|我的|一个|一款)/, "")
    .replace(/(管理|提醒|记录|清单|工具|页面|网页|HTML)$/i, "")
    .trim();
}

function buildFieldLabels(text: string, recordObject: string): string[] {
  if (isSplitBillTool(text)) return ["参与人", "付款记录", "应付金额", "转账建议", "备注"];

  const labels = [`${recordObject}名`];
  const physicalInventory = /家里有哪些|有哪些|库存|余量|剩余|补货|存放|放在/.test(text);
  addIf(labels, "数量/库存", physicalInventory || /数量|库存|余量|剩余|补货/.test(text));
  addIf(labels, "有效期/到期日", /有效期|过期|临期|到期|截止|保质期|续费|提醒/.test(text));
  addIf(labels, "分类", physicalInventory || /分类|类别|标签|类型/.test(text));
  addIf(labels, "存放位置", physicalInventory || /位置|存放|放在|地点|地址/.test(text));
  addIf(labels, "状态", /状态|进度|已完成|未完成|正常|异常/.test(text));
  addIf(labels, "金额/价格", /金额|价格|费用|预算|保费/.test(text));
  addIf(labels, "链接", /链接|网址|URL/i.test(text));
  labels.push("备注");
  return Array.from(new Set(labels));
}

function buildFeatureHints(text: string, recordObject: string): string[] {
  if (isSplitBillTool(text)) {
    return ["参与人管理", "付款记录", "转账建议计算", "新增/编辑/删除"];
  }

  const hints: string[] = [];
  if (/记录|管理|保存|清单|列表/.test(text)) hints.push(`${recordObject}记录管理`);
  if (/记录|管理|保存|清单|列表/.test(text)) hints.push("新增/编辑/删除");
  if (/新增|添加|编辑|删除|增删改查|CRUD/i.test(text)) hints.push("新增/编辑/删除");
  if (/搜索|筛选|分类|标签|查询|家里有哪些|有哪些|清单|列表/.test(text)) hints.push("搜索/筛选/分类");
  if (/提醒|到期|过期|临期|快过期|截止|倒计时|保质期|续费/.test(text)) hints.push("到期/过期提醒");
  if (/数量|库存|余量|剩余|补货|家里有哪些|有哪些/.test(text)) hints.push("数量/库存管理");
  if (/高级|好看|美观|视觉|界面|页面|UI|ui|响应式/.test(text)) hints.push("高级界面与响应式布局");
  return Array.from(new Set(hints));
}

function buildAcceptanceItems(text: string, recordObject: string, fieldLabels: string[]): string[] {
  if (isSplitBillTool(text)) {
    return [
      "每个参与人可以记录姓名、是否参与本次 AA 和个人实际付款金额",
      "总付款金额、每人应付金额和差额计算一致",
      "转账建议能说明谁该转给谁、转多少钱，所有转账金额合计后能清零差额",
    ];
  }

  const items: string[] = [];

  if (/记录|管理|保存|清单|列表/.test(text)) {
    items.push(`${recordObject}记录能保存${fieldLabels.join("、")}`);
  }

  if (/提醒|到期|过期|临期|快过期|截止|保质期|续费/.test(text)) {
    items.push("提醒列表能按日期排序，已过期、即将到期和正常状态清晰");
    items.push("编辑或删除记录后，提醒列表同步更新");
  }

  if (/数量|库存|余量|剩余|补货/.test(text)) {
    items.push("数量或库存变化后，列表、详情和提醒状态同步更新");
  }

  if (/高级|好看|美观|视觉|界面|页面|UI|ui|响应式/.test(text)) {
    items.push("页面视觉风格一致，桌面端和移动端都不能出现文字溢出或控件重叠");
  }

  return items;
}

function addIf(items: string[], label: string, condition: boolean): void {
  if (condition) items.push(label);
}

function isSplitBillTool(text: string): boolean {
  return /(AA|aa|分账|均摊|人均|谁该转给谁|转给谁|付了多少钱|付款金额)/.test(text) &&
    /(记账|计算|小工具|本地保存|浏览器|参与人|每个人)/.test(text);
}
