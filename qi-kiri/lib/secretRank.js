export const SECRET_HOZUKI_QI = 180;
export const HIDDEN_HOZUKI_NAME_QI_BONUS = 10;
const MAX_SECRET_NAME_DISTANCE = 2;
const SECRET_HOZUKI_PROFILES = [
  {
    key: "princess",
    label: "Princesse du clan Hozuki",
    shortLabel: "Princesse",
    aliases: [
      "mizuhimehozuki",
      "mizuhimehouzuki",
      "umihimehozuki",
      "umihimehouzuki",
    ],
  },
  {
    key: "godfather",
    label: "Le Parrain",
    shortLabel: "Parrain",
    aliases: [
      "onigetsuhozuki",
      "onigetsuhouzuki",
    ],
  },
];

function normalizeSecretName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function hasHiddenHozukiNameBonus(value) {
  const normalized = normalizeSecretName(value);

  if (!normalized) {
    return false;
  }

  return normalized.includes("hozuki") || normalized.includes("houzuki");
}

function hasEditDistanceWithin(source, target, maxDistance) {
  if (source === target) {
    return true;
  }

  if (Math.abs(source.length - target.length) > maxDistance) {
    return false;
  }

  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    const current = [sourceIndex];
    let rowMin = current[0];

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const substitutionCost =
        source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;

      const nextValue = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + substitutionCost
      );

      current[targetIndex] = nextValue;
      rowMin = Math.min(rowMin, nextValue);
    }

    if (rowMin > maxDistance) {
      return false;
    }

    previous = current;
  }

  return previous[target.length] <= maxDistance;
}

export function isSecretHozukiName(value) {
  return Boolean(getSecretHozukiProfileByName(value));
}

export function getSecretHozukiProfileByName(value) {
  const normalized = normalizeSecretName(value);

  if (!normalized) {
    return null;
  }

  return SECRET_HOZUKI_PROFILES.find((profile) =>
    profile.aliases.some((alias) =>
      hasEditDistanceWithin(normalized, alias, MAX_SECRET_NAME_DISTANCE)
    )
  );
}

export function isSecretHozukiRankLabel(value) {
  return Boolean(getSecretHozukiProfileByLabel(value));
}

export function getSecretHozukiProfileByLabel(value) {
  const normalizedLabel = String(value || "").trim().toLowerCase();
  return SECRET_HOZUKI_PROFILES.find(
    (profile) => profile.label.toLowerCase() === normalizedLabel
  ) || null;
}

export function getSecretHozukiProfileByKey(value) {
  const normalizedKey = String(value || "").trim().toLowerCase();
  return SECRET_HOZUKI_PROFILES.find(
    (profile) => profile.key.toLowerCase() === normalizedKey
  ) || null;
}

export function buildSecretHozukiOverride({ name, normalMax, totalMax, questionMeta }) {
  const profile = getSecretHozukiProfileByName(name);

  if (!profile) {
    return null;
  }

  const normalizedQuestions = Array.isArray(questionMeta) ? questionMeta : [];

  return {
    qi: SECRET_HOZUKI_QI,
    rank: profile.label,
    secretRank: profile.key,
    score: totalMax,
    normalScore: normalMax,
    correctAnswers: normalizedQuestions.length,
    normalCorrectAnswers: normalizedQuestions.filter((question) => !question.impossible).length,
    bonus: normalizedQuestions.some((question) => question.impossible),
    answers: normalizedQuestions.map((question) => question.answer),
    royalHozuki: true,
  };
}

