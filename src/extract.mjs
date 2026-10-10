/**
 * 把 REA 产出的 Evidence JSON 压缩成一份「每条结论都带文件:行号」的可读清单。
 *
 * Evidence 原始体积可达 1.8 MB，直接阅读不现实。本模块只保留可回溯的
 * 事实（模块 / 导入 / IPC / 路由 / 网络 / 局限），并丢弃中间推导结构。
 */

/**
 * @typedef {Record<string, any>} EvidenceNode
 * @typedef {Record<string, any>} EvidenceEdge
 * @typedef {{ nodes: EvidenceNode[], edges: EvidenceEdge[] }} EvidenceGraph
 * @typedef {{ label: string, side: string | null, operation: string | null, channel: string | null, resolution: string | null, location: string }} IpcChannel
 * @typedef {{ label: string, channel: string | null, operation: string | null, location: string }} IpcHandler
 * @typedef {{ label: string, location: string }} ModuleRef
 * @typedef {{ kind: string, label: string, properties: Record<string, any>, location: string }} ElectronNode
 * @typedef {{ from: string, to: string }} EdgeRef
 * @typedef {{ kind: string, label: string | null, location: string }} SemanticRef
 * @typedef {{ value: string | null, location: string }} LiteralRef
 * @typedef {object} ExtractedEvidence
 * @property {string | null} inputFormat
 * @property {Record<string, any>} summary
 * @property {Record<string, any>} statistics
 * @property {string[]} limitations
 * @property {IpcChannel[]} ipcChannels
 * @property {IpcHandler[]} ipcHandlers
 * @property {ModuleRef[]} modules
 * @property {ElectronNode[]} electronNodes
 * @property {EdgeRef[]} imports
 * @property {EdgeRef[]} relations
 * @property {SemanticRef[]} network
 * @property {LiteralRef[]} literals
 * @property {number} semanticRelationCount
 */

/** @param {any} observation */
const sourceOf = (observation) => {
  const loc = observation?.evidence?.location;
  if (!loc?.available) return "(-)";
  const v = loc.value ?? {};
  if (!v.source) return "(-)";
  const start = v.start;
  return start ? `${v.source}:${start.line}:${start.column}` : `${v.source}`;
};

/** @param {EvidenceNode | undefined} node */
const labelOf = (node) => node?.observations?.[0]?.label ?? "(unnamed)";
/** @param {EvidenceNode | undefined} node */
const propsOf = (node) => node?.observations?.[0]?.properties ?? {};
/** @param {EvidenceEdge} edge */
const kindOf = (edge) => edge.relation ?? edge.kind ?? edge.type;
/** @param {EvidenceNode[]} nodes @param {string} kind */
const nodesOfKind = (nodes, kind) => nodes.filter((n) => n.kind === kind);

/**
 * 从 Evidence 中提取结构化事实。
 * @param {any} evidence 完整的 Evidence JSON 对象
 * @returns {ExtractedEvidence} 可断言、可打印的中间表示
 */
export function extractEvidence(evidence) {
  const normalized = evidence?.normalized_result ?? {};
  /** @type {EvidenceGraph} */
  const graph = normalized.graph ?? { nodes: [], edges: [] };
  /** @type {{ nodes: EvidenceNode[], relations: any[] }} */
  const semantic = normalized.semantic_graph ?? { nodes: [], relations: [] };
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const byId = new Map(nodes.map((n) => [n.node_id, n]));

  const ipcChannels = nodesOfKind(nodes, "ipc-channel").map((n) => {
    const p = propsOf(n);
    return {
      label: labelOf(n),
      side: p.side ?? null,
      operation: p.operation ?? null,
      channel: p.channel ?? null,
      resolution: p.resolution ?? null,
      location: sourceOf(n.observations?.[0])
    };
  });

  const ipcHandlers = nodesOfKind(nodes, "ipc-handler").map((n) => {
    const p = propsOf(n);
    return {
      label: labelOf(n),
      channel: p.channel ?? null,
      operation: p.operation ?? null,
      location: sourceOf(n.observations?.[0])
    };
  });

  const modules = nodesOfKind(nodes, "javascript-module").map((n) => ({
    label: labelOf(n),
    location: sourceOf(n.observations?.[0])
  }));

  const electronNodes = ["electron-main", "electron-preload", "electron-renderer",
    "browser-window", "context-bridge-api", "package"].flatMap((kind) =>
    nodesOfKind(nodes, kind).map((n) => ({
      kind,
      label: labelOf(n),
      properties: propsOf(n),
      location: sourceOf(n.observations?.[0])
    }))
  );

  const imports = edges.filter((e) => kindOf(e) === "imports").map((e) => ({
    from: labelOf(byId.get(e.source_node_id)),
    to: labelOf(byId.get(e.target_node_id))
  }));

  const relations = edges.map((e) => ({
    kind: kindOf(e),
    from: labelOf(byId.get(e.source_node_id)),
    to: labelOf(byId.get(e.target_node_id))
  }));

  // 语义图里的网络与字面量（路由字符串、端点、通道常量）
  const semanticKinds = ["request", "response", "event", "listener"];
  const network = nodesOfKind(semantic.nodes ?? [], "request").concat(
    nodesOfKind(semantic.nodes ?? [], "response")
  ).map((n) => ({
    kind: n.kind,
    label: n.label ?? null,
    location: `${n.identity?.module_path ?? "?"}:${n.identity?.source_range?.start?.line ?? "?"}`
  }));

  const literals = nodesOfKind(semantic.nodes ?? [], "literal").map((n) => ({
    value: n.label ?? null,
    location: `${n.identity?.module_path ?? "?"}:${n.identity?.source_range?.start?.line ?? "?"}`
  }));

  return {
    inputFormat: normalized.format ?? null,
    summary: normalized.summary ?? {},
    statistics: normalized.statistics ?? {},
    limitations: evidence?.limitations ?? normalized.limitations ?? [],
    ipcChannels,
    ipcHandlers,
    modules,
    electronNodes,
    imports,
    relations,
    network,
    literals,
    semanticRelationCount: (semantic.relations ?? []).length
  };
}

/**
 * @param {unknown} s
 * @param {number} n
 */
const pad = (s, n) => String(s ?? "").padEnd(n);

/** 把提取结果渲染成终端可读文本 @param {ReturnType<typeof extractEvidence>} r */
export function formatReport(r) {
  const out = [];
  out.push(`Evidence: ${r.statistics.relevant_files ?? "?"} files, ` +
    `${r.statistics.parsed_javascript_files ?? "?"} parsed JS, ` +
    `${r.statistics.visited_ast_nodes ?? "?"} AST nodes, ` +
    `${r.statistics.findings ?? "?"} findings`);

  out.push("");
  out.push(`### IPC CHANNELS (${r.ipcChannels.length})`);
  for (const c of r.ipcChannels) {
    out.push(`  ${pad(c.label, 22)} side=${pad(c.side, 9)} op=${pad(c.operation, 7)} ` +
      `channel=${pad(c.channel ?? "<dynamic>", 20)} resolution=${pad(c.resolution, 8)} @ ${c.location}`);
  }

  out.push("");
  out.push(`### IPC HANDLERS (${r.ipcHandlers.length})`);
  for (const h of r.ipcHandlers) {
    out.push(`  ${pad(h.label, 22)} op=${pad(h.operation, 7)} @ ${h.location}`);
  }

  out.push("");
  out.push(`### MODULES (${r.modules.length})`);
  for (const m of r.modules) {
    out.push(`  ${pad(m.label, 30)} @ ${m.location}`);
  }

  out.push("");
  out.push("### ELECTRON BOUNDARIES");
  for (const n of r.electronNodes) {
    const members = n.properties?.members ? ` members=[${n.properties.members.join(",")}]` : "";
    out.push(`  [${n.kind}] ${pad(n.label, 24)}${members} @ ${n.location}`);
  }

  out.push("");
  out.push(`### IMPORTS (${r.imports.length})`);
  for (const i of r.imports) {
    out.push(`  ${i.from} -> ${i.to}`);
  }

  out.push("");
  out.push("### NETWORK");
  for (const n of r.network) {
    out.push(`  [${n.kind}] ${pad(n.label, 10)} @ ${n.location}`);
  }

  out.push("");
  out.push(`### ROUTE / ENDPOINT LITERALS (${r.literals.length})`);
  for (const l of r.literals) {
    out.push(`  ${pad(JSON.stringify(l.value), 40)} @ ${l.location}`);
  }

  out.push("");
  out.push(`### LIMITATIONS (${r.limitations.length})`);
  for (const l of r.limitations) {
    out.push(`  - ${l}`);
  }

  return out.join("\n");
}
