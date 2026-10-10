/**
 * profile-store 单元测试：证明离线模式不发起任何网络请求。
 *
 *   - REA_PLAYBOOK_OFFLINE=1 时，loadProfile 必须直接返回 local-cache，
 *     且 globalThis.fetch 一次都不应被调用。
 *   - 非离线（真实复现）时，loadProfile 仍走 fetch + catch 降级，
 *     忠实还原目标行为。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProfile } from "../recreate/profile-store.mjs";

test("离线模式（REA_PLAYBOOK_OFFLINE=1）不调用 fetch，直接降级", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (...a) => { calls.push(a[0]); throw new Error("should not be called offline"); };

  process.env.REA_PLAYBOOK_OFFLINE = "1";
  try {
    const r = await loadProfile("u-9999");
    assert.equal(calls.length, 0, "离线模式不应调用 fetch");
    assert.equal(r.id, "u-9999");
    assert.equal(r.source, "local-cache");
    assert.equal(r.displayName, "Cached User");
  } finally {
    delete process.env.REA_PLAYBOOK_OFFLINE;
    globalThis.fetch = realFetch;
  }
});

test("真实复现模式仍走 fetch + catch 降级（忠实还原目标行为）", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (...a) => { calls.push(a[0]); throw new Error("simulated network failure"); };

  delete process.env.REA_PLAYBOOK_OFFLINE;
  try {
    const r = await loadProfile("u-1");
    assert.equal(calls.length, 1, "真实模式应发起一次 fetch");
    assert.ok(String(calls[0]).includes("api.example.com"),
      "应使用证据中的端点 api.example.com");
    assert.equal(r.source, "local-cache", "网络失败后降级到 local-cache");
  } finally {
    globalThis.fetch = realFetch;
  }
});
