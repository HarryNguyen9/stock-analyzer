export type ProviderFailureKind = "unsupported" | "temporary";

export type ProviderFailure = {
  kind: ProviderFailureKind;
  message: string;
};

const UNSUPPORTED_PATTERNS = [
  /unsupported/i,
  /not supported/i,
  /invalid symbol/i,
  /invalid ticker/i,
  /unknown symbol/i,
  /symbol.*not.*found/i,
  /ticker.*not.*found/i,
  /no data/i,
  /khong co du lieu/i,
  /không có dữ liệu/i,
  /khong du nen/i,
  /không đủ nến/i,
  /delisted/i,
  /huy niem yet/i,
  /hủy niêm yết/i,
];

export function classifyProviderFailure(error: unknown): ProviderFailure {
  const message = getShortProviderError(error);

  return {
    kind: isUnsupportedProviderMessage(message) ? "unsupported" : "temporary",
    message,
  };
}

export function getShortProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 220) || "Unknown provider error";
}

function isUnsupportedProviderMessage(message: string): boolean {
  return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message));
}
