import {
  getSecretHozukiProfileByKey,
  getSecretHozukiProfileByLabel,
} from "../lib/secretRank.js";

const LOCAL_LEADERBOARD_KEY = "kiri-qi-leaderboard";
const MAX_ENTRIES = 100;
const PUBLIC_ENDPOINT = "/api/leaderboard";
const ADMIN_ENDPOINT = "/api/admin/leaderboard";

function sortEntries(entries) {
  return [...entries]
    .sort((left, right) => {
      if (Boolean(right.royalHozuki) !== Boolean(left.royalHozuki)) {
        return Number(Boolean(right.royalHozuki)) - Number(Boolean(left.royalHozuki));
      }

      if (right.qi !== left.qi) {
        return right.qi - left.qi;
      }

      if (left.time !== right.time) {
        return left.time - right.time;
      }

      return new Date(left.date).getTime() - new Date(right.date).getTime();
    })
    .slice(0, MAX_ENTRIES);
}

function normalizeEntry(rawEntry) {
  const secretProfile =
    getSecretHozukiProfileByKey(rawEntry?.secretRank) ||
    getSecretHozukiProfileByLabel(rawEntry?.rank);

  return {
    id: String(rawEntry?.id || ""),
    name: String(rawEntry?.name || "Shinobi inconnu"),
    qi: Number.parseInt(rawEntry?.qi, 10) || 0,
    rank: String(rawEntry?.rank || "D"),
    score: Number.parseInt(rawEntry?.score, 10) || 0,
    normalScore: Number.parseInt(rawEntry?.normalScore, 10) || 0,
    correctAnswers: Number.parseInt(rawEntry?.correctAnswers, 10) || 0,
    normalCorrectAnswers: Number.parseInt(rawEntry?.normalCorrectAnswers, 10) || 0,
    time: Number.parseInt(rawEntry?.time, 10) || 0,
    bonus: Boolean(rawEntry?.bonus),
    royalHozuki: Boolean(rawEntry?.royalHozuki) || Boolean(secretProfile),
    secretRank: String(rawEntry?.secretRank || secretProfile?.key || ""),
    date: typeof rawEntry?.date === "string" ? rawEntry.date : new Date().toISOString(),
    questionIds: Array.isArray(rawEntry?.questionIds) ? rawEntry.questionIds.map((id) => String(id)) : [],
    answers: Array.isArray(rawEntry?.answers) ? rawEntry.answers : [],
  };
}

function normalizeEntries(entries) {
  return sortEntries((entries || []).map(normalizeEntry));
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function loadLocalLeaderboard() {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    return normalizeEntries(raw ? safeJsonParse(raw, []) : []);
  } catch {
    return [];
  }
}

export function saveLocalEntry(entry) {
  const entries = normalizeEntries([...loadLocalLeaderboard(), entry]);
  localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(entries));
  return entries;
}

export function clearLocalLeaderboard() {
  localStorage.removeItem(LOCAL_LEADERBOARD_KEY);
  return [];
}

export function deleteLocalEntry(id) {
  const entries = normalizeEntries(loadLocalLeaderboard().filter((entry) => entry.id !== id));
  localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(entries));
  return entries;
}

export { LOCAL_LEADERBOARD_KEY };

export async function fetchLeaderboard() {
  try {
    const response = await fetch(PUBLIC_ENDPOINT, { cache: "no-store" });
    const data = await safeJson(response);

    if (response.ok && data?.mode === "shared") {
      return {
        mode: "shared",
        entries: normalizeEntries(data.entries),
      };
    }
  } catch {
    // ignore and fall back to local storage
  }

  return {
    mode: "local",
    entries: loadLocalLeaderboard(),
  };
}

export async function submitLeaderboardEntry(entry) {
  try {
    const response = await fetch(PUBLIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entry }),
    });
    const data = await safeJson(response);

    if (response.ok && data?.mode === "shared") {
      return {
        mode: "shared",
        entry: normalizeEntry(data.entry),
        entries: normalizeEntries(data.entries),
      };
    }
  } catch {
    // ignore and fall back to local storage
  }

  return {
    mode: "local",
    entry: normalizeEntry(entry),
    entries: saveLocalEntry(entry),
  };
}

export async function fetchAdminLeaderboard(password) {
  const response = await fetch(ADMIN_ENDPOINT, {
    method: "GET",
    headers: {
      "x-admin-password": password,
    },
    cache: "no-store",
  });
  const data = await safeJson(response);

  if (response.status === 401) {
    const error = new Error("unauthorized");
    error.code = "UNAUTHORIZED";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("admin_unavailable");
    error.code = data?.mode === "local" ? "LOCAL_ONLY" : "REQUEST_FAILED";
    throw error;
  }

  return {
    mode: "shared",
    entries: normalizeEntries(data.entries),
  };
}

export async function clearRemoteLeaderboard(password) {
  const response = await fetch(ADMIN_ENDPOINT, {
    method: "DELETE",
    headers: {
      "x-admin-password": password,
    },
  });
  const data = await safeJson(response);

  if (!response.ok) {
    const error = new Error("clear_failed");
    error.code = response.status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED";
    throw error;
  }

  return {
    mode: "shared",
    entries: normalizeEntries(data.entries),
  };
}

export async function deleteRemoteLeaderboardEntry(id, password) {
  const response = await fetch(`${ADMIN_ENDPOINT}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-admin-password": password,
    },
  });
  const data = await safeJson(response);

  if (!response.ok) {
    const error = new Error("delete_failed");
    error.code = response.status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED";
    throw error;
  }

  return {
    mode: "shared",
    entries: normalizeEntries(data.entries),
  };
}
