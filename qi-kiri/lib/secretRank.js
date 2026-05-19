export const SECRET_HOZUKI_RANK_LABEL = "Princesse du clan Hozuki";
export const SECRET_HOZUKI_QI = 180;

const SECRET_HOZUKI_ALIASES = [
  "mizuhimehozuki",
  "mizuhimehouzuki",
];
const MAX_SECRET_NAME_DISTANCE = 2;

function normalizeSecretName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
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
  const normalized = normalizeSecretName(value);

  if (!normalized) {
    return false;
  }

  return SECRET_HOZUKI_ALIASES.some((alias) =>
    hasEditDistanceWithin(normalized, alias, MAX_SECRET_NAME_DISTANCE)
  );
}

export function isSecretHozukiRankLabel(value) {
  return String(value || "").trim().toLowerCase() === SECRET_HOZUKI_RANK_LABEL.toLowerCase();
}

export function buildSecretHozukiOverride({ name, normalMax, totalMax, questionMeta }) {
  if (!isSecretHozukiName(name)) {
    return null;
  }

  const normalizedQuestions = Array.isArray(questionMeta) ? questionMeta : [];

  return {
    qi: SECRET_HOZUKI_QI,
    rank: SECRET_HOZUKI_RANK_LABEL,
    score: totalMax,
    normalScore: normalMax,
    correctAnswers: normalizedQuestions.length,
    normalCorrectAnswers: normalizedQuestions.filter((question) => !question.impossible).length,
    bonus: normalizedQuestions.some((question) => question.impossible),
    answers: normalizedQuestions.map((question) => question.answer),
    royalHozuki: true,
  };
}
