'use strict';
/**
 * 网络 / REA 调用守护预加载（仅用于测试）。
 *
 * 通过 NODE_OPTIONS=--require 注入到 demo:offline 子进程中。
 * 一旦离线路径尝试任何网络请求或 spawn 非 node 进程（即 REA），
 * 就向 NETWORK_GUARD_MARKER 写入违规记录，并立即抛错中断。
 *
 * 注意：globalThis.fetch 被拦截后，undici 不会再加载，因此 net/dns/http 等
 * 底层钩子只是兜底，正常情况下不会被触达。
 */
const fs = require('fs');
const marker = process.env.NETWORK_GUARD_MARKER;
const hits = [];

function hit(label, detail) {
  hits.push(label + (detail !== undefined ? ' :: ' + String(detail).slice(0, 160) : ''));
  if (marker) {
    try { fs.writeFileSync(marker, hits.join('\n')); } catch { /* ignore */ }
  }
}

// 1) 拦截全局 fetch：离线路径唯一可能的网络入口
if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = function (...args) {
    hit('fetch', args[0]);
    throw new Error('NETWORK_GUARD: fetch blocked in offline preview');
  };
}

// 2) 拦截底层网络模块（兜底）
for (const name of ['net', 'dns', 'http', 'https', 'tls']) {
  try {
    const mod = require(name);
    if (name === 'net') {
      for (const fn of ['connect', 'createConnection']) {
        mod[fn] = (...a) => { hit('net.' + fn, a[0]); throw new Error('NETWORK_GUARD'); };
      }
    } else if (name === 'dns') {
      mod.lookup = (...a) => { hit('dns.lookup', a[0]); throw new Error('NETWORK_GUARD'); };
    } else if (name === 'tls') {
      mod.connect = (...a) => { hit('tls.connect', a[0]); throw new Error('NETWORK_GUARD'); };
    } else {
      for (const fn of ['request', 'get']) {
        mod[fn] = (...a) => { hit(name + '.' + fn, a[0]); throw new Error('NETWORK_GUARD'); };
      }
    }
  } catch { /* module not available in this context */ }
}

// 3) 拦截 child_process：只允许 node，其余视为 REA 调用
try {
  const cp = require('child_process');
  const orig = cp.spawn.bind(cp);
  cp.spawn = function (file, args, opts) {
    const base = String(file).split(/[\\/]/).pop();
    const isNode = file === process.execPath ||
      base === 'node' || base === 'node.exe' || base === 'node.cmd';
    if (!isNode) {
      hit('spawn:' + base, args && args[0]);
      throw new Error('NETWORK_GUARD: external spawn blocked in offline preview');
    }
    return orig(file, args, opts);
  };
} catch { /* ignore */ }
