import { getPublicLeaderboard, saveLeaderboardEntry } from "./_leaderboardStore.js";

function setNoStore(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
}

export default async function handler(request, response) {
  setNoStore(response);

  if (request.method === "GET") {
    const result = await getPublicLeaderboard();

    return response.status(200).json({
      mode: result.configured ? "shared" : "local",
      entries: result.entries,
    });
  }

  if (request.method === "POST") {
    const entry = request.body?.entry;

    if (!entry || typeof entry !== "object") {
      return response.status(400).json({ error: "missing_entry" });
    }

    const result = await saveLeaderboardEntry(entry);

    if (!result.configured) {
      return response.status(503).json({
        error: "leaderboard_not_configured",
        mode: "local",
      });
    }

    return response.status(201).json({
      mode: "shared",
      entry: result.entry,
      entries: result.entries,
    });
  }

  response.setHeader("Allow", "GET, POST");
  return response.status(405).json({ error: "method_not_allowed" });
}
