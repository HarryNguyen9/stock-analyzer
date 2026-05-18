export function normalizeTechnicalScore(value: number | string): number {
  const numericValue = typeof value === "number" ? value : parseTechnicalScoreString(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

export function formatTechnicalScore(value: number | string): string {
  return `${normalizeTechnicalScore(value)}/100`;
}

function parseTechnicalScoreString(value: string): number {
  const scoreText = value.trim();
  const scoreWithDenominator = scoreText.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*100$/);

  if (scoreWithDenominator) {
    return Number(scoreWithDenominator[1]);
  }

  const numericValue = Number(scoreText);

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const firstNumber = scoreText.match(/-?\d+(?:\.\d+)?/);
  return firstNumber ? Number(firstNumber[0]) : Number.NaN;
}
