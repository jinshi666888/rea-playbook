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
 * @param {string} profileId
 * @returns {Promise<any>}
 */
export function loadProfile(profileId) {
  return fetchRemoteProfile(profileId).catch(() => ({
    id: profileId,
    source: "local-cache",
    displayName: "Cached User"
  }));
}
