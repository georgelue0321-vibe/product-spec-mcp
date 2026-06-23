export function isSingleUserCrmContext(text: string, context: Record<string, any> = {}): boolean {
  const combined = `${text} ${JSON.stringify(context)}`;

  const singleUserSignal =
    /我一个人|就我一人|只有我|自己用|我自己用|单人|单用户|个人单用户|个人使用|没有团队|无团队|不需要团队/.test(combined);
  const noRoleSignal =
    /不需要多角色|无需多角色|不做多角色|不要多角色|不需要销售账号|无需销售账号|不做销售账号|不需要管理员|无需管理员|不需要后台|无需后台|不需要登录|无需登录|不做登录/.test(combined);
  const authDisabled = context.has_auth === false || context.user_roles === false;
  const individualNoRole = context.expected_users === "individual" && noRoleSignal;

  return authDisabled || individualNoRole || (singleUserSignal && noRoleSignal);
}

export function isPersonalLocalFrontendToolContext(text: string, context: Record<string, any> = {}): boolean {
  const combined = `${text} ${JSON.stringify(context)}`;

  const personalSignal =
    /我自己用|自己用|个人用|个人使用|个人|我一个人|就我一人|只有我|单人|单用户|小白|本地小工具|小工具/.test(combined);
  const localSignal =
    /纯前端|静态|纯 HTML|HTML\/CSS\/JS|html|localStorage|浏览器保存|浏览器里|浏览器内|存在浏览器|存到浏览器|本地保存|本地存储|本地用|本地工具|单机|离线|无需后端|不需要后端|不做后端/.test(combined);
  const noAccountSignal =
    /不登录|不需要登录|无需登录|不做登录|不需要账号|无需账号|不要账号|不做账号|不注册|不需要注册|不做注册|不需要权限|不做权限|不需要后台|不做后台|不需要管理员/.test(combined);
  const simpleToolSignal =
    /清单|列表|收藏|进度|台账|管理工具|记录工具|提醒工具|计算器|小页面|小网页|HTML/.test(combined);
  const explicitMultiUserOrBackendSignal =
    /多人|团队|成员|协作|管理员|后台|登录|注册|权限|RBAC|数据库|后端|服务器|支付|订单|购买|下单/.test(combined) &&
    !/不登录|不需要登录|无需登录|不做登录|不注册|不需要注册|不做注册|不需要后台|不做后台|不需要管理员|不接支付|不做支付/.test(combined);

  const contextDisablesBackend =
    context.need_backend === false ||
    context.backend_need === false ||
    context.has_auth === false ||
    context.user_roles === false;

  return (
    (personalSignal && (localSignal || noAccountSignal)) ||
    (localSignal && noAccountSignal) ||
    (localSignal && simpleToolSignal && !explicitMultiUserOrBackendSignal) ||
    (contextDisablesBackend && (personalSignal || localSignal))
  );
}
