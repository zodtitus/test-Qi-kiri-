import {
  getSecretHozukiProfileByKey,
  getSecretHozukiProfileByLabel,
} from "../lib/secretRank.js";

const LOCAL_LEADERBOARD_KEY = "kiri-qi-leaderboard";
const MAX_ENTRIES = 100;
const PUBLIC_ENDPOINT = "/api/leaderboard";
const ADMIN_ENDPOINT = "/api/admin/leaderboard";
const RANKS = [
  { label: "X", min: 145 },
  { label: "SS", min: 130 },
  { label: "S", min: 115 },
  { label: "A", min: 105 },
  { label: "B", min: 95 },
  { label: "C", min: 85 },
  { label: "D", min: 0 },
];

function normalizeLeaderboardName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getEntryWeight(entry) {
  return Math.max(1, Number.parseInt(entry?.attemptCount, 10) || 1);
}

function getEntryBonusCount(entry) {
  const explicitCount = Number.parseInt(entry?.bonusCount, 10);
  if (Number.isFinite(explicitCount) && explicitCount >= 0) {
    return explicitCount;
  }

  return entry?.bonus ? getEntryWeight(entry) : 0;
}

function getRankLabel(qi) {
  return (RANKS.find((rank) => qi >= rank.min) || RANKS[RANKS.length - 1]).label;
}

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
    attemptCount: Math.max(1, Number.parseInt(rawEntry?.attemptCount, 10) || 1),
    bonusCount: Math.max(
      0,
      Number.parseInt(rawEntry?.bonusCount, 10) || (rawEntry?.bonus ? 1 : 0)
    ),
    aggregateKey:
      String(rawEntry?.aggregateKey || "").trim() || normalizeLeaderboardName(rawEntry?.name),
    questionIds: Array.isArray(rawEntry?.questionIds) ? rawEntry.questionIds.map((id) => String(id)) : [],
    answers: Array.isArray(rawEntry?.answers) ? rawEntry.answers : [],
  };
}

function aggregateEntries(entries) {
  const groups = new Map();

  (entries || []).map(normalizeEntry).forEach((entry) => {
    const groupKey = entry.aggregateKey || normalizeLeaderboardName(entry.name) || entry.id;
    const weight = getEntryWeight(entry);
    const bonusCount = getEntryBonusCount(entry);
    const current = groups.get(groupKey);

    if (!current) {
      groups.set(groupKey, {
        aggregateKey: groupKey,
        latestEntry: entry,
        latestTimestamp: new Date(entry.date).getTime() || 0,
        attemptCount: weight,
        bonusCount,
        qiTotal: entry.qi * weight,
        scoreTotal: entry.score * weight,
        normalScoreTotal: entry.normalScore * weight,
        correctAnswersTotal: entry.correctAnswers * weight,
        normalCorrectAnswersTotal: entry.normalCorrectAnswers * weight,
        timeTotal: entry.time * weight,
      });
      return;
    }

    const entryTimestamp = new Date(entry.date).getTime() || 0;
    if (entryTimestamp >= current.latestTimestamp) {
      current.latestEntry = entry;
      current.latestTimestamp = entryTimestamp;
    }

    current.attemptCount += weight;
    current.bonusCount += bonusCount;
    current.qiTotal += entry.qi * weight;
    current.scoreTotal += entry.score * weight;
    current.normalScoreTotal += entry.normalScore * weight;
    current.correctAnswersTotal += entry.correctAnswers * weight;
    current.normalCorrectAnswersTotal += entry.normalCorrectAnswers * weight;
    current.timeTotal += entry.time * weight;
  });

  return Array.from(groups.values()).map((group) => {
    const latestEntry = group.latestEntry;
    const averageQi = Math.round(group.qiTotal / group.attemptCount);
    const royalHozuki = Boolean(latestEntry.royalHozuki);
    const secretRank = String(latestEntry.secretRank || "");

    return normalizeEntry({
      ...latestEntry,
      id: latestEntry.id,
      name: latestEntry.name,
      qi: averageQi,
      rank: royalHozuki && secretRank ? latestEntry.rank : getRankLabel(averageQi),
      score: Math.round(group.scoreTotal / group.attemptCount),
      normalScore: Math.round(group.normalScoreTotal / group.attemptCount),
      correctAnswers: Math.round(group.correctAnswersTotal / group.attemptCount),
      normalCorrectAnswers: Math.round(
        group.normalCorrectAnswersTotal / group.attemptCount
      ),
      time: Math.round(group.timeTotal / group.attemptCount),
      bonus: group.bonusCount > 0,
      bonusCount: group.bonusCount,
      attemptCount: group.attemptCount,
      aggregateKey: group.aggregateKey,
      royalHozuki,
      secretRank,
      questionIds: latestEntry.questionIds,
      answers: latestEntry.answers,
    });
  });
}

function normalizeEntries(entries) {
  return sortEntries(aggregateEntries(entries));
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
  const rawEntries = rawLocalEntries();
  const nextEntries = sortEntries([...rawEntries, normalizeEntry(entry)]).slice(0, MAX_ENTRIES);
  localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(nextEntries));
  return normalizeEntries(nextEntries);
}

export function clearLocalLeaderboard() {
  localStorage.removeItem(LOCAL_LEADERBOARD_KEY);
  return [];
}

function rawLocalEntries() {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    return (raw ? safeJsonParse(raw, []) : []).map(normalizeEntry);
  } catch {
    return [];
  }
}

export function deleteLocalEntry(id, aggregateKey = "") {
  const normalizedAggregateKey = String(aggregateKey || "").trim();
  const filteredEntries = rawLocalEntries().filter((entry) => {
    if (normalizedAggregateKey) {
      return entry.aggregateKey !== normalizedAggregateKey;
    }

    return entry.id !== id;
  });
  localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(filteredEntries));
  return normalizeEntries(filteredEntries);
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

export async function deleteRemoteLeaderboardEntry(id, password, aggregateKey = "") {
  const query = new URLSearchParams();

  if (id) {
    query.set("id", id);
  }

  if (aggregateKey) {
    query.set("aggregateKey", aggregateKey);
  }

  const response = await fetch(`${ADMIN_ENDPOINT}?${query.toString()}`, {
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
