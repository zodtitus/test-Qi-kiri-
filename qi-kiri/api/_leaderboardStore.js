import { Redis } from "@upstash/redis";
import {
  buildSecretHozukiOverride,
  getSecretHozukiProfileByKey,
  getSecretHozukiProfileByLabel,
  HIDDEN_HOZUKI_NAME_QI_BONUS,
  hasHiddenHozukiNameBonus,
  isSecretHozukiRankLabel,
} from "../lib/secretRank.js";
import {
  getLegacyQuestions,
  getQuestionSetByIds,
  getQuestionStats,
} from "../lib/questionBank.js";

const LEADERBOARD_KEY = "kiri:leaderboard:v2";
const MAX_ENTRIES = 100;
const QUESTION_META = [
  { pts: 1, answer: 1, impossible: false },
  { pts: 1, answer: 1, impossible: false },
  { pts: 1, answer: 2, impossible: false },
  { pts: 1, answer: 1, impossible: false },
  { pts: 2, answer: 1, impossible: false },
  { pts: 2, answer: 2, impossible: false },
  { pts: 2, answer: 1, impossible: false },
  { pts: 3, answer: 2, impossible: false },
  { pts: 3, answer: 2, impossible: false },
  { pts: 1, answer: 1, impossible: false },
  { pts: 1, answer: 1, impossible: false },
  { pts: 2, answer: 2, impossible: false },
  { pts: 2, answer: 2, impossible: false },
  { pts: 3, answer: 1, impossible: false },
  { pts: 3, answer: 1, impossible: false },
  { pts: 2, answer: 1, impossible: false },
  { pts: 3, answer: 1, impossible: false },
  { pts: 5, answer: 2, impossible: false },
  { pts: 2, answer: 1, impossible: false },
  { pts: 3, answer: 1, impossible: false },
  { pts: 4, answer: 1, impossible: false },
  { pts: 8, answer: 0, impossible: false },
  { pts: 20, answer: 3, impossible: true },
];
const NORMAL_MAX = QUESTION_META.filter((question) => !question.impossible).reduce((sum, question) => sum + question.pts, 0);
const TOTAL_MAX = QUESTION_META.reduce((sum, question) => sum + question.pts, 0);
const QI_BASE = 60;
const ANSWER_QI_WEIGHT = 90;
const IMPOSSIBLE_INDEX = QUESTION_META.findIndex((question) => question.impossible);
const IMPOSSIBLE_QI_BONUS = 10;
const TIME_BONUS_MAX = 20;
const TIME_ELITE_SEC = 3 * 60;
const TIME_TARGET_SEC = 5 * 60;
const TIME_CAP_100_SEC = 10 * 60;
const TIME_FLOOR_SEC = 15 * 60;
const TIME_PENALTY_AT_10_MIN = -35;
const TIME_PENALTY_MIN = -50;
const COPY_PENALTY_POINTS = 1;
const RANKS = [
  { label: "X", min: 145 },
  { label: "SS", min: 130 },
  { label: "S", min: 115 },
  { label: "A", min: 105 },
  { label: "B", min: 95 },
  { label: "C", min: 85 },
  { label: "D", min: 0 },
];
const LEGACY_QUESTIONS = getLegacyQuestions();

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

function sanitizeQuestionIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((id) => String(id)).filter(Boolean);
}

function getRankLabel(qi) {
  return (RANKS.find((rank) => qi >= rank.min) || RANKS[RANKS.length - 1]).label;
}

function computeTimeAdjustment(elapsedSec) {
  if (elapsedSec <= TIME_ELITE_SEC) {
    return TIME_BONUS_MAX;
  }

  if (elapsedSec <= TIME_TARGET_SEC) {
    const ratio = (elapsedSec - TIME_ELITE_SEC) / (TIME_TARGET_SEC - TIME_ELITE_SEC);
    return Math.round(TIME_BONUS_MAX * (1 - ratio));
  }

  if (elapsedSec <= TIME_CAP_100_SEC) {
    const ratio = (elapsedSec - TIME_TARGET_SEC) / (TIME_CAP_100_SEC - TIME_TARGET_SEC);
    return Math.round(TIME_PENALTY_AT_10_MIN * ratio);
  }

  if (elapsedSec <= TIME_FLOOR_SEC) {
    const ratio = (elapsedSec - TIME_CAP_100_SEC) / (TIME_FLOOR_SEC - TIME_CAP_100_SEC);
    return Math.round(
      TIME_PENALTY_AT_10_MIN + (TIME_PENALTY_MIN - TIME_PENALTY_AT_10_MIN) * ratio
    );
  }

  return TIME_PENALTY_MIN;
}

function resolveQuestionsForEntry(entry) {
  const entryQuestions = getQuestionSetByIds(entry?.questionIds);

  if (entryQuestions.length) {
    return entryQuestions;
  }

  const legacyLength =
    Array.isArray(entry?.answers) && entry.answers.length
      ? entry.answers.length
      : LEGACY_QUESTIONS.length;

  return LEGACY_QUESTIONS.slice(0, legacyLength);
}

function evaluateAnswers(answerList, questions) {
  const normalizedQuestions = Array.isArray(questions) ? questions : [];
  const stats = getQuestionStats(normalizedQuestions);
  const answersSnapshot = normalizedQuestions.map((_, index) => {
    const value = answerList?.[index];
    return Number.isFinite(value) ? value : -1;
  });

  let normalScore = 0;
  let totalScore = 0;
  let correctAnswers = 0;
  let normalCorrectAnswers = 0;

  normalizedQuestions.forEach((question, index) => {
    if (answersSnapshot[index] !== question.answer) {
      return;
    }

    correctAnswers += 1;
    totalScore += question.pts;

    if (!question.impossible) {
      normalScore += question.pts;
      normalCorrectAnswers += 1;
    }
  });

  const bonusEarned =
    stats.impossibleIndex >= 0 &&
    answersSnapshot[stats.impossibleIndex] === normalizedQuestions[stats.impossibleIndex].answer;

  return {
    answersSnapshot,
    normalScore,
    totalScore,
    correctAnswers,
    normalCorrectAnswers,
    bonusEarned,
  };
}

function applyAttemptPenalties(evaluation, copyPenaltyCount = 0) {
  const safePenaltyCount = Math.max(0, Number.parseInt(copyPenaltyCount, 10) || 0);

  return {
    ...evaluation,
    copyPenalties: safePenaltyCount,
    normalScore: Math.max(0, evaluation.normalScore - safePenaltyCount * COPY_PENALTY_POINTS),
    totalScore: Math.max(0, evaluation.totalScore - safePenaltyCount * COPY_PENALTY_POINTS),
  };
}

function computeQI(score, normalMax, elapsedSec, bonusEarned, hiddenNameBonus = 0) {
  const baseRatio = normalMax > 0 ? Math.min(1, score / normalMax) : 0;
  const base = QI_BASE + baseRatio * ANSWER_QI_WEIGHT;
  const timeBonus = computeTimeAdjustment(elapsedSec) * baseRatio;
  const secretBonus = bonusEarned ? IMPOSSIBLE_QI_BONUS : 0;
  return Math.max(
    60,
    Math.min(180, Math.round(base + timeBonus + secretBonus + hiddenNameBonus))
  );
}

function sanitizeEntry(rawEntry) {
  const safeDate = typeof rawEntry?.date === "string" ? rawEntry.date : new Date().toISOString();
  const secretProfile =
    getSecretHozukiProfileByKey(rawEntry?.secretRank) ||
    getSecretHozukiProfileByLabel(rawEntry?.rank);

  return {
    id: String(rawEntry?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    name: String(rawEntry?.name || "Shinobi inconnu").trim().slice(0, 24) || "Shinobi inconnu",
    qi: Number.parseInt(rawEntry?.qi, 10) || 0,
    rank: String(rawEntry?.rank || "D").trim().slice(0, 64),
    score: Number.parseInt(rawEntry?.score, 10) || 0,
    normalScore: Number.parseInt(rawEntry?.normalScore, 10) || 0,
    correctAnswers: Number.parseInt(rawEntry?.correctAnswers, 10) || 0,
    normalCorrectAnswers: Number.parseInt(rawEntry?.normalCorrectAnswers, 10) || 0,
    time: Number.parseInt(rawEntry?.time, 10) || 0,
    bonus: Boolean(rawEntry?.bonus),
    copyPenalties: Math.max(0, Number.parseInt(rawEntry?.copyPenalties, 10) || 0),
    royalHozuki: Boolean(rawEntry?.royalHozuki) || Boolean(secretProfile),
    secretRank: String(rawEntry?.secretRank || secretProfile?.key || ""),
    date: safeDate,
    questionIds: sanitizeQuestionIds(rawEntry?.questionIds),
    answers: sanitizeAnswers(rawEntry?.answers),
  };
}

function stripAnswers(entry) {
  const { answers, questionIds, copyPenalties, ...publicEntry } = entry;
  return publicEntry;
}

function migrateEntry(rawEntry) {
  const entry = sanitizeEntry(rawEntry);
  const questions = resolveQuestionsForEntry(entry);
  const stats = getQuestionStats(questions);
  const secretOverride = buildSecretHozukiOverride({
    name: entry.name,
    normalMax: stats.normalMax,
    totalMax: stats.totalMax,
    questionMeta: questions,
  });

  if (secretOverride) {
    return {
      ...entry,
      ...secretOverride,
      questionIds: questions.map((question) => question.id),
    };
  }

  if (!Array.isArray(entry.answers) || entry.answers.length === 0) {
    if (entry.royalHozuki || entry.secretRank || isSecretHozukiRankLabel(entry.rank)) {
      return {
        ...entry,
        royalHozuki: false,
        secretRank: "",
        questionIds: questions.map((question) => question.id),
        rank: getRankLabel(entry.qi),
      };
    }

    return entry;
  }

  const evaluation = applyAttemptPenalties(
    evaluateAnswers(entry.answers, questions),
    entry.copyPenalties
  );
  const hiddenNameBonus = hasHiddenHozukiNameBonus(entry.name)
    ? HIDDEN_HOZUKI_NAME_QI_BONUS
    : 0;
  const qi = computeQI(
    evaluation.normalScore,
    stats.normalMax,
    entry.time,
    evaluation.bonusEarned,
    hiddenNameBonus
  );

  return {
    ...entry,
    qi,
    rank: getRankLabel(qi),
    score: evaluation.totalScore,
    normalScore: evaluation.normalScore,
    correctAnswers: evaluation.correctAnswers,
    normalCorrectAnswers: evaluation.normalCorrectAnswers,
    bonus: evaluation.bonusEarned,
    copyPenalties: evaluation.copyPenalties,
    royalHozuki: false,
    secretRank: "",
    questionIds: questions.map((question) => question.id),
    answers: evaluation.answersSnapshot,
  };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
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
  const entries = normalizeLeaderboard(rawValue);
  const migratedEntries = entries.map(migrateEntry);

  if (JSON.stringify(entries) !== JSON.stringify(migratedEntries)) {
    await writeLeaderboard(redis, migratedEntries);
    return migratedEntries;
  }

  return entries;
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

  const entry = migrateEntry(rawEntry);
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
