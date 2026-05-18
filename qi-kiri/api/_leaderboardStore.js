import { Redis } from "@upstash/redis";

const LEADERBOARD_KEY = "kiri:leaderboard";
const ENTRY_PREFIX = "kiri:leaderboard:entry:";
const MAX_ENTRIES = 100;

let redisClient;

function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });

  return redisClient;
}

function entryKey(id) {
  return `${ENTRY_PREFIX}${id}`;
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

function buildSortScore(entry) {
  const qiComponent = Math.max(0, entry.qi) * 1_000_000_000;
  const timeComponent = Math.max(0, 999_999 - Math.max(0, entry.time)) * 1_000;
  const timestamp = Date.parse(entry.date);
  const freshnessComponent = Number.isFinite(timestamp) ? timestamp % 1_000 : 0;

  return qiComponent + timeComponent + freshnessComponent;
}

function stripAnswers(entry) {
  const { answers, ...publicEntry } = entry;
  return publicEntry;
}

async function readEntries(ids) {
  const redis = getRedis();

  if (!redis || !ids.length) {
    return [];
  }

  const payloads = await Promise.all(ids.map((id) => redis.get(entryKey(id))));

  return payloads
    .map((payload) => {
      if (typeof payload !== "string") {
        return null;
      }

      try {
        return sanitizeEntry(JSON.parse(payload));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function trimLeaderboard(redis) {
  const count = await redis.zcard(LEADERBOARD_KEY);

  if (count <= MAX_ENTRIES) {
    return;
  }

  const removeCount = count - MAX_ENTRIES;
  const idsToRemove = await redis.zrange(LEADERBOARD_KEY, 0, removeCount - 1);

  await Promise.all(idsToRemove.map((id) => redis.del(entryKey(id))));
  await redis.zremrangebyrank(LEADERBOARD_KEY, 0, removeCount - 1);
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

  const ids = await redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, { rev: true });
  const entries = await readEntries(ids);

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

  const ids = await redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, { rev: true });
  const entries = await readEntries(ids);

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

  await Promise.all([
    redis.set(entryKey(entry.id), JSON.stringify(entry)),
    redis.zadd(LEADERBOARD_KEY, { score: buildSortScore(entry), member: entry.id }),
  ]);

  await trimLeaderboard(redis);

  const leaderboard = await getPublicLeaderboard();

  return {
    configured: true,
    entry: stripAnswers(entry),
    entries: leaderboard.entries,
  };
}

export async function deleteLeaderboardEntry(id) {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  if (id) {
    await Promise.all([
      redis.zrem(LEADERBOARD_KEY, id),
      redis.del(entryKey(id)),
    ]);
  }

  const leaderboard = await getAdminLeaderboard();

  return {
    configured: true,
    entries: leaderboard.entries,
  };
}

export async function clearLeaderboard() {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const ids = await redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1);

  await Promise.all(ids.map((id) => redis.del(entryKey(id))));
  await redis.del(LEADERBOARD_KEY);

  return {
    configured: true,
    entries: [],
  };
}
