// EchoMem 认知图谱数据服务
// EchoMem 同时存储了标准节点/边文件：
//   .graph/nodes/{atom|entity|episode}/{node_id}.json
//   .graph/edges/{about|contains}/{edge_id}.json
// 本服务读取标准节点和边，重建完整认知图谱。

import { createClient } from './echomem-client.js';
import { getEchoMemConfig } from './config.js';

const DEFAULT_ENGINE_ID = 'echo0_plugin';

const CATEGORY_CONFIG = [
  { name: 'atom', itemStyle: { color: '#cc66ff' } },
  { name: 'entity', itemStyle: { color: '#00e6ff' } },
  { name: 'episode', itemStyle: { color: '#f093fb' } },
  { name: 'other', itemStyle: { color: '#8899aa' } },
];

function truncate(str, maxLen = 40) {
  if (typeof str !== 'string') return String(str);
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

function getNodeDisplayName(node) {
  const props = node.properties || {};
  switch (node.node_type) {
    case 'entity':
      return props.name || node.summary_hint || node.node_id;
    case 'episode':
      return `会话: ${props.title || node.summary_hint || node.node_id}`;
    case 'atom':
    default:
      return props.statement || node.summary_hint || node.node_id;
  }
}

function toEchartsNode(node) {
  const categoryMap = { atom: 0, entity: 1, episode: 2 };
  const category = categoryMap[node.node_type] ?? 3;
  const salience = typeof node.salience === 'number' ? node.salience : 0.5;
  const baseSize = node.node_type === 'episode' ? 55 : node.node_type === 'entity' ? 45 : node.node_type === 'atom' ? 28 : 20;
  const symbolSize = Math.round(baseSize + salience * 35);
  return {
    id: node.node_id,
    name: truncate(getNodeDisplayName(node)),
    symbolSize,
    category,
    value: Math.round(salience * 100),
  };
}

function toEchartsLink(edge) {
  return {
    source: edge.source_id,
    target: edge.target_id,
    name: edge.relation_type,
  };
}

function inferNodeTypeFromId(id) {
  if (id.startsWith('atom:')) return 'atom';
  if (id.startsWith('entity:')) return 'entity';
  if (id.startsWith('episode:')) return 'episode';
  return 'other';
}

function toSyntheticNode(id) {
  const nodeType = inferNodeTypeFromId(id);
  const bare = id.split(':').slice(1).join(':') || id;
  const label = nodeType === 'episode' ? `会话: ${bare}` : bare;
  const categoryMap = { atom: 0, entity: 1, episode: 2, other: 3 };
  const baseSize = nodeType === 'episode' ? 55 : nodeType === 'entity' ? 45 : nodeType === 'atom' ? 28 : 20;
  return {
    id,
    name: truncate(label),
    symbolSize: Math.round(baseSize + 0.5 * 35),
    category: categoryMap[nodeType],
    value: 50,
    _synthetic: true,
  };
}

function buildSyntheticNodes(links, existingIds) {
  const needed = new Set();
  links.forEach((l) => {
    if (!existingIds.has(l.source)) needed.add(l.source);
    if (!existingIds.has(l.target)) needed.add(l.target);
  });
  return Array.from(needed).map(toSyntheticNode);
}

/**
 * 拉取并规范化认知图谱数据
 * @returns {Promise<{nodes: object[], links: object[], categories: object[]}>}
 */
export async function fetchGraphData(options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const graphUri = `echo://engine/${engineId}/memory/.graph`;

  const tree = await client.fsTree(graphUri, { maxDepth: 4 });
  const entries = tree?.entries || [];

  const nodeFiles = entries.filter(
    (e) => e.kind === 'file' && e.uri.includes('/nodes/') && e.uri.endsWith('.json')
  );
  const edgeFiles = entries.filter(
    (e) => e.kind === 'file' && e.uri.includes('/edges/') && e.uri.endsWith('.json')
  );

  const [nodeResults, edgeResults] = await Promise.all([
    Promise.all(
      nodeFiles.map(async (entry) => {
        try {
          const text = await client.fsRead(entry.uri);
          return JSON.parse(text);
        } catch (err) {
          console.warn('EchoMem graph: failed to read node', entry.uri, err.message);
          return null;
        }
      })
    ),
    Promise.all(
      edgeFiles.map(async (entry) => {
        try {
          const text = await client.fsRead(entry.uri);
          return JSON.parse(text);
        } catch (err) {
          console.warn('EchoMem graph: failed to read edge', entry.uri, err.message);
          return null;
        }
      })
    ),
  ]);

  const nodes = nodeResults.filter(Boolean).map(toEchartsNode);
  const nodeIds = new Set(nodes.map((n) => n.id));

  const rawLinks = edgeResults.filter(Boolean).map(toEchartsLink);

  // 后端有时会先写出边再写出端点节点（或端点节点落在 .graph/nodes 之外）。
  // 为所有缺失端点生成占位节点，保证每条边都能被渲染，图谱才不会断开。
  const syntheticNodes = buildSyntheticNodes(rawLinks, nodeIds);
  nodes.push(...syntheticNodes);
  syntheticNodes.forEach((n) => nodeIds.add(n.id));

  const links = rawLinks.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

  console.log(
    'EchoMem graph loaded:',
    nodes.length,
    'nodes,',
    links.length,
    'edges,',
    syntheticNodes.length,
    'synthetic nodes'
  );
  return { nodes, links, categories: CATEGORY_CONFIG };
}
