import {
  matchesAllowedHostname,
  matchesPathnamePrefixes,
} from './location-matcher.mjs';

function getSelector(feature) {
  if (typeof feature === 'string') return feature;
  if (feature && typeof feature === 'object') return feature.selector;
  return null;
}

function matchesAnyDomFeature(documentObject, features) {
  return (features || []).some((feature) => {
    const selector = getSelector(feature);
    return selector && documentObject.querySelector(selector) !== null;
  });
}

function matchesTitleOrContent(documentObject, keywords) {
  const title = documentObject.title || '';
  const bodyText = documentObject.body?.innerText || '';
  const pageIdentity = `${title}\n${bodyText}`.toLowerCase();
  return (keywords || []).some((keyword) =>
    pageIdentity.includes(String(keyword).toLowerCase())
  );
}

function logFailure(logger, message) {
  logger.log?.(`Claw Extension: 平台检测未通过 - ${message}`);
}

function matchesConfiguredHostname(hostname, allowedHostnames) {
  return Array.isArray(allowedHostnames)
    && allowedHostnames.length > 0
    && matchesAllowedHostname(hostname, allowedHostnames);
}

// 多层平台检测：只执行已配置的检测层。
export function detectPlatformMultiLayer(detection, overrides = {}) {
  const windowObject = overrides.windowObject || window;
  const documentObject = overrides.documentObject || document;
  const logger = overrides.logger || console;
  const logs = [];
  let hostnameTrust = null;

  // 新版主机策略：官方域名可直接确认平台，通配的本地/IP 主机需要额外身份证明。
  if (detection.trustedHostnames || detection.fallbackHostnames) {
    const trustedMatch = matchesConfiguredHostname(
      windowObject.location.hostname,
      detection.trustedHostnames
    );
    const fallbackMatch = !trustedMatch && matchesConfiguredHostname(
      windowObject.location.hostname,
      detection.fallbackHostnames
    );

    if (!trustedMatch && !fallbackMatch) {
      logFailure(logger, '主机不匹配');
      return false;
    }

    hostnameTrust = trustedMatch ? 'trusted' : 'fallback';
    logs.push(trustedMatch ? '✓ 可信主机匹配' : '✓ 回退主机匹配');
  } else if (detection.hostnames) {
    const hostMatch = matchesAllowedHostname(
      windowObject.location.hostname,
      detection.hostnames
    );
    if (!hostMatch) {
      logFailure(logger, '主机不匹配');
      return false;
    }
    logs.push('✓ 主机匹配');
  }

  if (detection.pathnamePrefixes) {
    const pathMatch = matchesPathnamePrefixes(
      windowObject.location.pathname,
      detection.pathnamePrefixes
    );
    if (!pathMatch) {
      logFailure(logger, '路径不匹配');
      return false;
    }
    logs.push('✓ 路径匹配');
  }

  // 兼容尚未迁移到结构化站点与路径配置的平台。
  if (detection.urlPatterns) {
    const urlMatch = detection.urlPatterns.some((pattern) =>
      windowObject.location.href.includes(pattern)
    );
    if (!urlMatch) {
      logFailure(logger, 'URL不匹配');
      return false;
    }
    logs.push('✓ URL匹配');
  }

  if (hostnameTrust === 'fallback') {
    if (!detection.fallbackIdentity) {
      logFailure(logger, '回退主机缺少身份校验配置');
      return false;
    }

    const { titleOrContentKeywords, optionalDomFeatures } = detection.fallbackIdentity;

    if (!titleOrContentKeywords?.length || !optionalDomFeatures?.length) {
      logFailure(logger, '回退主机身份校验配置不完整');
      return false;
    }

    if (!matchesTitleOrContent(documentObject, titleOrContentKeywords)) {
      logFailure(logger, '回退主机缺少平台品牌标识');
      return false;
    }
    logs.push('✓ 回退主机品牌标识匹配');

    if (!matchesAnyDomFeature(documentObject, optionalDomFeatures)) {
      logFailure(logger, '回退主机无语义DOM特征匹配');
      return false;
    }
    logs.push('✓ 回退主机语义DOM特征匹配');
  }

  if (detection.titleKeywords) {
    const titleMatch = detection.titleKeywords.some((keyword) =>
      documentObject.title.includes(keyword)
    );
    if (!titleMatch) {
      logFailure(logger, '标题关键字不匹配');
      return false;
    }
    logs.push('✓ 标题关键字匹配');
  }

  if (detection.domFeatures) {
    const { required, optional } = detection.domFeatures;

    if (required?.length) {
      for (const feature of required) {
        const selector = getSelector(feature);
        if (!selector) continue;
        if (documentObject.querySelector(selector) === null) {
          const description = typeof feature === 'object' ? feature.description : selector;
          logFailure(logger, `缺少必要DOM: ${description}`);
          return false;
        }
      }
      logs.push('✓ 必要DOM元素全部存在');
    }

    if (optional?.length && !matchesAnyDomFeature(documentObject, optional)) {
      logFailure(logger, '无可选DOM特征匹配');
      return false;
    }
    if (optional?.length) {
      logs.push('✓ 可选DOM特征匹配');
    }
  }

  if (detection.contentKeywords && documentObject.body) {
    const bodyText = documentObject.body.innerText || '';
    if (bodyText.length > 0) {
      const contentMatch = detection.contentKeywords.some((keyword) =>
        bodyText.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!contentMatch) {
        logFailure(logger, '页面内容关键字不匹配');
        return false;
      }
      logs.push('✓ 页面内容关键字匹配');
    }
  }

  logger.log?.('Claw Extension: 平台检测全部通过:', logs.join(' | '));
  return true;
}
