import acceptanceRules from "../rules/acceptanceRules.json";

export interface AcceptanceResult {
  productType: string;
  platform: string;
  categories: Array<{
    category: string;
    items: string[];
  }>;
  definitionOfDone: string[];
}

export function generateAcceptance(
  productType: string,
  features: string[],
  platform: string,
  hasBackend: boolean,
  hasPayment: boolean,
  hasAuth: boolean
): AcceptanceResult {
  if (isStaticDisplaySite(productType, features, platform, hasBackend, hasPayment, hasAuth)) {
    return {
      productType,
      platform,
      categories: buildStaticDisplayAcceptanceCategories(),
      definitionOfDone: [
        "所有占位内容已替换为真实内容",
        "桌面端、平板和移动端验收通过",
        "线上链接、图片、字体和 favicon 正常加载",
        "SEO 和社交分享基础信息配置完成",
        "托管平台和回滚方式已确认",
      ],
    };
  }

  const categories: Array<{ category: string; items: string[] }> = [];

  for (const rule of acceptanceRules.base_rules) {
    categories.push({
      category: rule.category,
      items: [...rule.items],
    });
  }

  if (hasBackend) {
    for (const rule of acceptanceRules.backend_rules) {
      categories.push({
        category: rule.category,
        items: [...rule.items],
      });
    }
  }

  if (hasPayment) {
    for (const rule of acceptanceRules.payment_rules) {
      categories.push({
        category: rule.category,
        items: [...rule.items],
      });
    }
  }

  if (hasAuth) {
    for (const rule of acceptanceRules.auth_rules) {
      categories.push({
        category: rule.category,
        items: [...rule.items],
      });
    }
  }

  if (features.includes("表单") || features.includes("提交")) {
    categories.push({
      category: "表单验收",
      items: [
        "必填字段有校验提示",
        "提交中显示 loading 状态",
        "提交成功显示 toast",
        "提交失败显示错误信息",
        "重复提交被阻止",
      ],
    });
  }

  if (platform === "mini_program") {
    categories.push({
      category: "小程序验收",
      items: [
        "真机表现与开发者工具一致",
        "页面路径正确",
        "域名已配置",
        "基础库版本兼容",
      ],
    });
  }

  return {
    productType,
    platform,
    categories,
    definitionOfDone: [...acceptanceRules.definition_of_done],
  };
}

function isStaticDisplaySite(
  productType: string,
  features: string[],
  platform: string,
  hasBackend: boolean,
  hasPayment: boolean,
  hasAuth: boolean
): boolean {
  if (platform !== "web") return false;
  if (hasBackend || hasPayment || hasAuth) return false;

  const text = `${productType} ${features.join(" ")}`;
  const staticSignals = [
    "静态",
    "展示",
    "作品",
    "作品集",
    "Portfolio",
    "portfolio",
    "纯HTML",
    "纯 HTML",
    "HTML/CSS/JS",
    "无后端",
  ];
  const dynamicSignals = [
    "表单",
    "提交",
    "登录",
    "支付",
    "后台",
    "管理",
    "API",
    "接口",
    "数据提交",
    "报名",
    "预约",
  ];

  return staticSignals.some((signal) => text.includes(signal)) && !dynamicSignals.some((signal) => text.includes(signal));
}

function buildStaticDisplayAcceptanceCategories(): Array<{ category: string; items: string[] }> {
  return [
    {
      category: "页面与内容验收",
      items: [
        "桌面端、平板和移动端均正常显示",
        "移动端不能横向溢出",
        "导航、Hero、关于、作品集、联系方式和页脚内容完整",
        "姓名、介绍、作品标题、邮箱、社媒链接等占位内容已替换为真实内容",
        "所有作品图片使用真实资源，尺寸合理且加载正常",
        "favicon 已在 head 中正确引用",
      ],
    },
    {
      category: "静态资源与性能验收",
      items: [
        "CSS、JS、图片等静态资源在线上环境加载正常",
        "首页首屏加载时间在 3 秒以内",
        "图片已压缩并使用合适尺寸，避免原图直出",
        "字体有可用 fallback；国内访问不依赖单一境外字体源",
        "动画在 prefers-reduced-motion 下可降级或关闭",
      ],
    },
    {
      category: "链接与交互验收",
      items: [
        "导航锚点、作品筛选、CTA 和联系方式链接均可点击",
        "外链使用 target=\"_blank\" 时带 rel=\"noopener noreferrer\"",
        "移动端菜单可打开和关闭，当前状态清晰",
        "键盘访问焦点清晰，不阻断 Tab 导航",
        "控制台无明显报错",
      ],
    },
    {
      category: "SEO 与分享验收",
      items: [
        "title 和 meta description 已配置",
        "Open Graph 和 Twitter Card 基础标签已配置",
        "canonical URL 已确认",
        "robots.txt 和 sitemap.xml 已准备",
        "404 页面或静态托管 fallback 已配置",
      ],
    },
    {
      category: "上线验证",
      items: [
        "线上地址可正常访问且 HTTPS 生效",
        "自定义域名、DNS 和 CDN 配置已验证",
        "部署产物不包含本地临时文件或未替换的测试资源",
        "托管平台回滚方式已确认",
      ],
    },
  ];
}
