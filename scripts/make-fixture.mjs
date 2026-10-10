/**
 * 从一次真实分析产出的 Evidence 生成随仓库提交的精简样本。
 *
 * 做了两件事：
 * 1. 只保留 extract.mjs 实际读取的字段，把 1.8 MB 压到几十 KB；
 * 2. 抹掉所有机器相关信息（input_path 里的绝对路径、artifact_id 等），
 *    保证仓库里不含私有路径。
 *
 * 用法: node scripts/make-fixture.mjs <evidence.json> [output]
 */
import fs from "node:fs";

const [input, output = "fixtures/electron-demo.evidence.json"] = process.argv.slice(2);
if (!input) {
  console.error("用法: node scripts/make-fixture.mjs <evidence.json> [output]");
  process.exit(1);
}

const ev = JSON.parse(fs.readFileSync(input, "utf8"));
const nr = ev.normalized_result ?? {};
const graph = nr.graph ?? { nodes: [], edges: [] };
const sg = nr.semantic_graph ?? { nodes: [] };

const KEEP_SEMANTIC = new Set(["request", "response", "event", "listener", "literal", "task"]);

/** @param {any} n @returns {{kind: any, label: any, identity: any}} */
const slimSemanticNode = (n) => ({
  kind: n.kind,
  label: n.label ?? null,
  identity: n.identity ?? null
});

/** @type {any[]} */
const semanticNodes = sg.nodes ?? [];
/** @type {any[]} */
const graphNodes = graph.nodes ?? [];
/** @type {any[]} */
const graphEdges = graph.edges ?? [];

const slimSemanticNodes = semanticNodes
  .filter((n) => KEEP_SEMANTIC.has(n.kind))
  .map(slimSemanticNode);

/** @param {any} o */
const slimObservation = (o) => ({
  label: o.label ?? null,
  properties: o.properties ?? {},
  evidence: { location: o.evidence?.location ?? { available: false } }
});

/** @param {any} n */
const slimGraphNode = (n) => ({
  node_id: n.node_id,
  kind: n.kind,
  observations: (n.observations ?? []).map(slimObservation)
});

const fixture = {
  fixture_of: "rea-agents analyze-javascript-application",
  note: "精简样本，仅用于离线测试 extract.mjs；绝对路径已被移除。",
  evidence_id: null,
  limitations: ev.limitations ?? nr.limitations ?? [],
  normalized_result: {
    input_path: "targets/electron-demo",
    format: nr.format ?? "directory",
    summary: nr.summary ?? {},
    statistics: nr.statistics ?? {},
    limitations: nr.limitations ?? [],
    graph: {
      schema: graph.schema ?? null,
      nodes: graphNodes.map(slimGraphNode),
      edges: graphEdges.map((e) => ({
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        relation: e.relation ?? null
      }))
    },
    semantic_graph: {
      schema: sg.schema ?? null,
      nodes: slimSemanticNodes
    }
  }
};

fs.mkdirSync(output.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
fs.writeFileSync(output, JSON.stringify(fixture, null, 2), "utf8");

const raw = fs.statSync(input).size;
const slim = fs.statSync(output).size;
console.log(`输入: ${input} (${raw} 字节)`);
console.log(`输出: ${output} (${slim} 字节)`);
console.log(`压缩比: ${(slim / raw * 100).toFixed(2)}%`);
