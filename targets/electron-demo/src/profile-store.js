const PROFILE_ENDPOINT = "https://api.example.com/v1/profiles";

async function fetchRemoteProfile(profileId) {
  const response = await fetch(`${PROFILE_ENDPOINT}/${profileId}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    return { id: profileId, source: "remote-error", status: response.status };
  }

  return response.json();
}

function loadProfile(profileId) {
  return fetchRemoteProfile(profileId).catch(() => ({
    id: profileId,
    source: "local-cache",
    displayName: "Cached User"
  }));
}

module.exports = { PROFILE_ENDPOINT, fetchRemoteProfile, loadProfile };
