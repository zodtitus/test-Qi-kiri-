import { Redis } from "@upstash/redis";

const LEADERBOARD_KEY = "kiri:leaderboard";
const MAX_ENTRIES = 100;

let redisClient;

function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const redisUrl =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    "";
  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";

  if (!redisUrl || !redisToken) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  return redisClient;
}

function sanitizeAnswers(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((answer) => Number.parseInt(answer, 10))
    .filter((answer) => Number.isFinite(answer));
}

function sanitizeEntry(rawEntry) {
  const safeDate = typeof rawEntry?.date === "string" ? rawEntry.date : new Date().toISOString();

  return {
    id: String(rawEntry?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    name: String(rawEntry?.name || "Shinobi inconnu").trim().slice(0, 24) || "Shinobi inconnu",
    qi: Number.parseInt(rawEntry?.qi, 10) || 0,
    rank: String(rawEntry?.rank || "D").slice(0, 4),
    score: Number.parseInt(rawEntry?.score, 10) || 0,
    time: Number.parseInt(rawEntry?.time, 10) || 0,
    bonus: Boolean(rawEntry?.bonus),
    date: safeDate,
    answers: sanitizeAnswers(rawEntry?.answers),
  };
}

function stripAnswers(entry) {
  const { answers, ...publicEntry } = entry;
  return publicEntry;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    if (right.qi !== left.qi) {
      return right.qi - left.qi;
    }

    if (left.time !== right.time) {
      return left.time - right.time;
    }

    return new Date(left.date).getTime() - new Date(right.date).getTime();
  });
}

function normalizeLeaderboard(rawValue) {
  if (!rawValue) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return sortEntries(rawValue.map(sanitizeEntry)).slice(0, MAX_ENTRIES);
  }

  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? sortEntries(parsed.map(sanitizeEntry)).slice(0, MAX_ENTRIES) : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function readLeaderboard(redis) {
  const rawValue = await redis.get(LEADERBOARD_KEY);
  return normalizeLeaderboard(rawValue);
}

async function writeLeaderboard(redis, entries) {
  const normalized = sortEntries(entries.map(sanitizeEntry)).slice(0, MAX_ENTRIES);
  await redis.set(LEADERBOARD_KEY, normalized);
  return normalized;
}

export function isLeaderboardConfigured() {
  return Boolean(getRedis());
}

export function getAdminPassword() {
  return process.env.LEADERBOARD_ADMIN_PASSWORD || "";
}

export async function getPublicLeaderboard() {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const entries = await readLeaderboard(redis);

  return {
    configured: true,
    entries: entries.map(stripAnswers),
  };
}

export async function getAdminLeaderboard() {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const entries = await readLeaderboard(redis);

  return {
    configured: true,
    entries,
  };
}

export async function saveLeaderboardEntry(rawEntry) {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const entry = sanitizeEntry(rawEntry);
  const currentEntries = await readLeaderboard(redis);
  const nextEntries = await writeLeaderboard(redis, [entry, ...currentEntries.filter((item) => item.id !== entry.id)]);

  const leaderboard = nextEntries.map(stripAnswers);

  return {
    configured: true,
    entry: stripAnswers(entry),
    entries: leaderboard,
  };
}

export async function deleteLeaderboardEntry(id) {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const currentEntries = await readLeaderboard(redis);
  const nextEntries = await writeLeaderboard(
    redis,
    id ? currentEntries.filter((entry) => entry.id !== id) : currentEntries
  );

  return {
    configured: true,
    entries: nextEntries,
  };
}

export async function clearLeaderboard() {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  await redis.del(LEADERBOARD_KEY);

  return {
    configured: true,
    entries: [],
  };
}
