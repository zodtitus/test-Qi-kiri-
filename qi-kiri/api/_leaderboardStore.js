import { Redis } from "@upstash/redis";
import {
  buildSecretHozukiOverride,
  getHiddenNameQiBonus,
  getSecretHozukiProfileByKey,
  getSecretHozukiProfileByLabel,
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
const RUSH_PENALTY_WINDOW_SEC = 5 * 60;
const RUSH_SAFE_ACCURACY_RATIO = 0.78;
const RUSH_LOW_ACCURACY_RATIO = 0.35;
const RUSH_MAX_POINT_NERF_RATIO = 0.55;
const EASY_QUESTION_MAX_DIFF = 2;
const EASY_MISTAKE_PENALTY_WINDOW_SEC = 5 * 60;
const EASY_MISTAKE_POINT_WEIGHT = 0.45;
const EASY_MISTAKE_COUNT_WEIGHT = 0.75;
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
  let easyMistakeCount = 0;
  let easyMistakePoints = 0;

  normalizedQuestions.forEach((question, index) => {
    if (answersSnapshot[index] !== question.answer) {
      if (
        !question.impossible &&
        Number.isFinite(question.diff) &&
        question.diff <= EASY_QUESTION_MAX_DIFF
      ) {
        easyMistakeCount += 1;
        easyMistakePoints += question.pts;
      }
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
    easyMistakeCount,
    easyMistakePoints,
    bonusEarned,
  };
}

function computeRushPenalty(score, elapsedSec, maxScore) {
  if (maxScore <= 0) {
    return 0;
  }

  const safeElapsedSec = Math.max(0, Number.parseInt(elapsedSec, 10) || 0);

  if (safeElapsedSec >= RUSH_PENALTY_WINDOW_SEC) {
    return 0;
  }

  const accuracyRatio = Math.min(1, score / maxScore);

  if (accuracyRatio >= RUSH_SAFE_ACCURACY_RATIO) {
    return 0;
  }

  const speedPressure = (RUSH_PENALTY_WINDOW_SEC - safeElapsedSec) / RUSH_PENALTY_WINDOW_SEC;
  const accuracyPressure = Math.min(
    1,
    Math.max(
      0,
      (RUSH_SAFE_ACCURACY_RATIO - accuracyRatio) /
        (RUSH_SAFE_ACCURACY_RATIO - RUSH_LOW_ACCURACY_RATIO)
    )
  );
  const penaltyRatio = RUSH_MAX_POINT_NERF_RATIO * speedPressure * accuracyPressure;

  return Math.min(score, Math.round(score * penaltyRatio));
}

function computeEasyMistakePenalty(easyMistakePoints, easyMistakeCount, elapsedSec) {
  if (easyMistakeCount <= 0 || easyMistakePoints <= 0) {
    return 0;
  }

  const safeElapsedSec = Math.max(0, Number.parseInt(elapsedSec, 10) || 0);

  if (safeElapsedSec >= EASY_MISTAKE_PENALTY_WINDOW_SEC) {
    return 0;
  }

  const speedPressure =
    (EASY_MISTAKE_PENALTY_WINDOW_SEC - safeElapsedSec) / EASY_MISTAKE_PENALTY_WINDOW_SEC;
  const penaltyBase =
    easyMistakePoints * EASY_MISTAKE_POINT_WEIGHT +
    easyMistakeCount * EASY_MISTAKE_COUNT_WEIGHT;

  return Math.max(0, Math.round(penaltyBase * speedPressure));
}

function applyAttemptPenalties(
  evaluation,
  { copyPenaltyCount = 0, elapsedSec = 0, normalMax = 0, totalMax = 0 } = {}
) {
  const safePenaltyCount = Math.max(0, Number.parseInt(copyPenaltyCount, 10) || 0);
  const scoreAfterCopyPenalty = Math.max(
    0,
    evaluation.totalScore - safePenaltyCount * COPY_PENALTY_POINTS
  );
  const normalScoreAfterCopyPenalty = Math.max(
    0,
    evaluation.normalScore - safePenaltyCount * COPY_PENALTY_POINTS
  );
  const rushPenalty = computeRushPenalty(
    normalScoreAfterCopyPenalty,
    elapsedSec,
    normalMax
  );
  const totalRushPenalty = computeRushPenalty(
    scoreAfterCopyPenalty,
    elapsedSec,
    totalMax
  );
  const easyMistakePenalty = computeEasyMistakePenalty(
    evaluation.easyMistakePoints,
    evaluation.easyMistakeCount,
    elapsedSec
  );

  return {
    ...evaluation,
    copyPenalties: safePenaltyCount,
    rushPenalty,
    easyMistakePenalty,
    normalScore: Math.max(0, normalScoreAfterCopyPenalty - rushPenalty - easyMistakePenalty),
    totalScore: Math.max(0, scoreAfterCopyPenalty - totalRushPenalty - easyMistakePenalty),
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
    attemptCount: Math.max(1, Number.parseInt(rawEntry?.attemptCount, 10) || 1),
    bonusCount: Math.max(
      0,
      Number.parseInt(rawEntry?.bonusCount, 10) || (rawEntry?.bonus ? 1 : 0)
    ),
    aggregateKey:
      String(rawEntry?.aggregateKey || "").trim() || normalizeLeaderboardName(rawEntry?.name),
    questionIds: sanitizeQuestionIds(rawEntry?.questionIds),
    answers: sanitizeAnswers(rawEntry?.answers),
  };
}

function stripAnswers(entry) {
  const { answers, questionIds, copyPenalties, ...publicEntry } = entry;
  return publicEntry;
}

function aggregateLeaderboardEntries(entries) {
  const groups = new Map();

  entries.forEach((rawEntry) => {
    const entry = sanitizeEntry(rawEntry);
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
        copyPenaltyTotal: entry.copyPenalties * weight,
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
    current.copyPenaltyTotal += entry.copyPenalties * weight;
  });

  return sortEntries(
    Array.from(groups.values()).map((group) => {
      const latestEntry = group.latestEntry;
      const averageQi = Math.round(group.qiTotal / group.attemptCount);
      const royalHozuki = Boolean(latestEntry.royalHozuki);
      const secretRank = String(latestEntry.secretRank || "");

      return sanitizeEntry({
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
        copyPenalties: Math.round(group.copyPenaltyTotal / group.attemptCount),
        bonus: group.bonusCount > 0,
        bonusCount: group.bonusCount,
        attemptCount: group.attemptCount,
        aggregateKey: group.aggregateKey,
        royalHozuki,
        secretRank,
        questionIds: latestEntry.questionIds,
        answers: latestEntry.answers,
      });
    })
  ).slice(0, MAX_ENTRIES);
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
    {
      copyPenaltyCount: entry.copyPenalties,
      elapsedSec: entry.time,
      normalMax: stats.normalMax,
      totalMax: stats.totalMax,
    }
  );
  const hiddenNameBonus = getHiddenNameQiBonus(entry.name);
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

  const entries = aggregateLeaderboardEntries(await readLeaderboard(redis));

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

  const entries = aggregateLeaderboardEntries(await readLeaderboard(redis));

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

  const leaderboard = aggregateLeaderboardEntries(nextEntries).map(stripAnswers);

  return {
    configured: true,
    entry: stripAnswers(entry),
    entries: leaderboard,
  };
}

export async function deleteLeaderboardEntry(id, aggregateKey = "") {
  const redis = getRedis();

  if (!redis) {
    return { configured: false, entries: [] };
  }

  const currentEntries = await readLeaderboard(redis);
  const normalizedAggregateKey = String(aggregateKey || "").trim();
  const filteredEntries = normalizedAggregateKey
    ? currentEntries.filter(
        (entry) => normalizeLeaderboardName(entry.name) !== normalizedAggregateKey
      )
    : id
      ? currentEntries.filter((entry) => entry.id !== id)
      : currentEntries;
  const nextEntries = await writeLeaderboard(redis, filteredEntries);

  return {
    configured: true,
    entries: aggregateLeaderboardEntries(nextEntries),
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
