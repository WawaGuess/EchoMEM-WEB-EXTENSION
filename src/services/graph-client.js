// EchoMem 认知图谱数据服务
// 通过 fs/tree + fs/read 拉取 engine/echo0_plugin/memory/.graph 下的节点与边

import { createClient } from './echomem-client.js';
import { getEchoMemConfig } from './config.js';

const DEFAULT_ENGINE_ID = 'echo0_plugin';

const CATEGORY_CONFIG = [
  { name: 'atom', itemStyle: { color: '#4facfe' } },
  { name: 'entity', itemStyle: { color: '#667eea' } },
  { name: 'episode', itemStyle: { color: '#f093fb' } },
];

function getNodeName(node) {
  const props = node.properties || {};
  switch (node.node_type) {
    case 'entity':
      return props.name || node.summary_hint || node.node_id;
    case 'episode': {
      const title = props.title || node.summary_hint || node.node_id;
      return `会话: ${title}`;
    }
    case 'atom':
    default:
      return props.statement || node.summary_hint || node.node_id;
  }
}

function truncate(str, maxLen = 40) {
  if (typeof str !== 'string') return String(str);
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

function toEchartsNode(node) {
  const categoryMap = { atom: 0, entity: 1, episode: 2 };
  const category = categoryMap[node.node_type] ?? 0;
  const salience = typeof node.salience === 'number' ? node.salience : 0.5;
  const baseSize = node.node_type === 'episode' ? 55 : node.node_type === 'entity' ? 45 : 28;
  const symbolSize = Math.round(baseSize + salience * 35);
  return {
    id: node.node_id,
    name: truncate(getNodeName(node)),
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

export async function fetchGraphData(options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const graphUri = `echo://engine/${engineId}/memory/.graph`;

  const tree = await client.fsTree(graphUri, { maxDepth: 3 });
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
  const links = edgeResults
    .filter(Boolean)
    .map(toEchartsLink)
    .filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

  return { nodes, links, categories: CATEGORY_CONFIG };
}
