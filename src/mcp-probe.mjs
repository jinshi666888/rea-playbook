/**
 * 通过 MCP 协议（stdio）连接 REA，验证握手、工具清单与一次真实分析调用。
 *
 * 这是「CLI 和 MCP 两条通道输出等价」这一主张的可执行证明：
 * 同一目标分别走 CLI 和 MCP，比较 normalized_result.summary。
 */
import { resolveReaCommand, toReaPath } from "./paths.mjs";

/** REA 的 MCP 服务名与 stdio 入口参数（来自上游 server.json） */
export const MCP_SERVER = { command: "mcp", transport: "stdio" };

/**
 * @typedef {object} ProbeResult
 * @property {string} reaSource
 * @property {any} serverInfo
 * @property {any} capabilities
 * @property {number} toolCount
 * @property {number} availableTools
 * @property {Record<string, boolean>} targetTools
 * @property {any} session
 * @property {{isError: boolean, summary: any, statistics: any} | null} analysis
 * @property {string | null} error
 */

/**
 * 建立 MCP 会话并执行探测。
 * @param {object} opts
 * @param {string} opts.target 待分析目标的路径
 * @param {any} opts.Client MCP Client 构造器
 * @param {any} opts.StdioClientTransport stdio 传输构造器
 * @returns {Promise<ProbeResult>}
 */
export async function probe({ target, Client, StdioClientTransport }) {
  const rea = resolveReaCommand();
  const transport = new StdioClientTransport({
    command: rea.command,
    args: [...rea.args, MCP_SERVER.command],
    stderr: "pipe"
  });

  const client = new Client({ name: "rea-playbook-probe", version: "1.0.0" });
  /** @type {ProbeResult} */
  const result = {
    reaSource: rea.source,
    serverInfo: null,
    capabilities: null,
    toolCount: 0,
    availableTools: 0,
    targetTools: {},
    session: null,
    analysis: null,
    error: null
  };

  try {
    await client.connect(transport);
    result.serverInfo = client.getServerVersion();
    result.capabilities = client.getServerCapabilities();

    const listed = await client.listTools();
    /** @type {any[]} */
    const tools = listed.tools ?? [];
    result.toolCount = tools.length;

    for (const name of ["binary_session", "analyze_javascript_application", "inspect_web_page"]) {
      result.targetTools[name] = tools.some((t) => t.name === name);
    }

    const session = await client.callTool({ name: "binary_session", arguments: {} });
    const sc = session.structuredContent ?? {};
    /** @type {any[]} */
    const availability = sc.result?.tool_availability ?? sc.tool_availability ?? [];
    result.availableTools = availability.filter((a) => a && a.available).length;

    const call = await client.callTool({
      name: "analyze_javascript_application",
      arguments: { input_path: toReaPath(target), format: "directory" }
    });
    const normalized = call.structuredContent?.normalized_result ?? call.structuredContent ?? {};
    result.analysis = {
      isError: call.isError ?? false,
      summary: normalized.summary ?? null,
      statistics: normalized.statistics ?? null
    };
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    await client.close().catch(() => {});
  }

  return result;
}

/** 打印探测结果 @param {ProbeResult} r */
export function formatProbe(r) {
  const out = [];
  out.push(`REA launcher: ${r.reaSource}`);
  out.push(`serverInfo:   ${JSON.stringify(r.serverInfo)}`);
  out.push(`capabilities: ${JSON.stringify(r.capabilities)}`);
  out.push(`tools:        ${r.toolCount} total, ${r.availableTools} available`);
  out.push(`  binary_session                 ${r.targetTools.binary_session ? "PRESENT" : "absent"}`);
  out.push(`  analyze_javascript_application ${r.targetTools.analyze_javascript_application ? "PRESENT" : "absent"}`);
  out.push(`  inspect_web_page               ${r.targetTools.inspect_web_page ? "PRESENT" : "absent"}`);
  if (r.error) {
    out.push(`error: ${r.error}`);
  } else if (r.analysis) {
    out.push(`analyze_javascript_application: isError=${r.analysis.isError}`);
    out.push(`summary: ${JSON.stringify(r.analysis.summary)}`);
  }
  return out.join("\n");
}
