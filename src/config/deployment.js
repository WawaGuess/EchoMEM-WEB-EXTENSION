// 构建期发行配置。三个常量由 scripts/build-extension.mjs 注入。
// 文档：docs/decisions/008-单分支双发行包.md

export const DEPLOYMENT_PROFILE_ID = typeof __ECHOMEM_DEPLOYMENT_PROFILE__ === 'string'
  ? __ECHOMEM_DEPLOYMENT_PROFILE__
  : 'development';
export const DEPLOYMENT_PROFILE_LABEL = typeof __ECHOMEM_DEPLOYMENT_LABEL__ === 'string'
  ? __ECHOMEM_DEPLOYMENT_LABEL__
  : '开发版';
export const DEFAULT_ECHOMEM_BASE_URL = typeof __ECHOMEM_DEFAULT_BASE_URL__ === 'string'
  ? __ECHOMEM_DEFAULT_BASE_URL__
  : '';
