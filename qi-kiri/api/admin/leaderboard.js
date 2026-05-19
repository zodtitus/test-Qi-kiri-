import {
  clearLeaderboard,
  deleteLeaderboardEntry,
  getAdminLeaderboard,
  getAdminPassword,
  isLeaderboardConfigured,
} from "../_leaderboardStore.js";

function setNoStore(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
}

function isAuthorized(request) {
  const expectedPassword = getAdminPassword();
  const receivedPassword = request.headers["x-admin-password"];

  if (!expectedPassword) {
    return false;
  }

  return typeof receivedPassword === "string" && receivedPassword === expectedPassword;
}

export default async function handler(request, response) {
  setNoStore(response);

  if (!isLeaderboardConfigured()) {
    return response.status(503).json({
      error: "leaderboard_not_configured",
      mode: "local",
    });
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: "unauthorized" });
  }

  if (request.method === "GET") {
    const result = await getAdminLeaderboard();

    return response.status(200).json({
      mode: "shared",
      entries: result.entries,
    });
  }

  if (request.method === "DELETE") {
    const id = typeof request.query?.id === "string" ? request.query.id : "";
    const aggregateKey =
      typeof request.query?.aggregateKey === "string" ? request.query.aggregateKey : "";
    const result = id || aggregateKey
      ? await deleteLeaderboardEntry(id, aggregateKey)
      : await clearLeaderboard();

    return response.status(200).json({
      mode: "shared",
      entries: result.entries,
    });
  }

  response.setHeader("Allow", "GET, DELETE");
  return response.status(405).json({ error: "method_not_allowed" });
}
