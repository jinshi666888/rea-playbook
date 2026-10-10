// Recreate: 复现 src/profile-store.js 的 fetch + 失败降级
// 证据来源: evidence.json -> semantic_graph [request] fetch @ src/profile-store.js:4
//                                          [response] json @ src/profile-store.js:13
//                                          literal "https://api.example.com/v1/profiles" @ :1

export const PROFILE_ENDPOINT = "https://api.example.com/v1/profiles";

/**
 * @param {string} profileId
 * @returns {Promise<any>}
 */
export async function fetchRemoteProfile(profileId) {
  const response = await fetch(`${PROFILE_ENDPOINT}/${profileId}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    return { id: profileId, source: "remote-error", status: response.status };
  }

  return response.json();
}

/**
 * 复现 src/profile-store.js 的 fetch + 失败降级。
 *
 * 离线预览（demo:offline）会通过 REA_PLAYBOOK_OFFLINE=1 走「直接降级」分支，
 * 完全不发起网络请求，保证离线体验不依赖外网。
 * 真实复现（verify）则走 fetch + catch 降级，忠实还原目标行为。
 *
 * @param {string} profileId
 * @returns {Promise<any>}
 */
export function loadProfile(profileId) {
  if (process.env.REA_PLAYBOOK_OFFLINE === "1") {
    return Promise.resolve({
      id: profileId,
      source: "local-cache",
      displayName: "Cached User"
    });
  }
  return fetchRemoteProfile(profileId).catch(() => ({
    id: profileId,
    source: "local-cache",
    displayName: "Cached User"
  }));
}
