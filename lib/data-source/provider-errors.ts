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
  const message = serializeProviderError(error).errorMessage;
  return message.replace(/\s+/g, " ").trim().slice(0, 220) || "Unknown provider error";
}

export function serializeProviderError(error: unknown): {
  errorMessage: string;
  errorName: string;
  errorStack?: string;
  errorStatus?: string | number;
  errorCode?: string | number;
} {
  if (error instanceof Error) {
    const extra = error as Error & {
      status?: string | number;
      statusCode?: string | number;
      code?: string | number;
      response?: { status?: string | number; statusCode?: string | number; data?: unknown };
    };

    return {
      errorMessage: error.message || "Unknown provider error",
      errorName: error.name || "Error",
      ...(error.stack ? { errorStack: error.stack } : {}),
      ...(extra.status ?? extra.statusCode ?? extra.response?.status ?? extra.response?.statusCode
        ? { errorStatus: extra.status ?? extra.statusCode ?? extra.response?.status ?? extra.response?.statusCode }
        : {}),
      ...(extra.code ? { errorCode: extra.code } : {}),
    };
  }

  if (typeof error === "object" && error !== null) {
    const objectError = error as {
      status?: string | number;
      statusCode?: string | number;
      code?: string | number;
      message?: unknown;
      response?: { status?: string | number; statusCode?: string | number; data?: unknown };
    };

    return {
      errorMessage: getObjectErrorMessage(error, objectError),
      errorName: error.constructor?.name ?? "Object",
      ...(objectError.status ?? objectError.statusCode ?? objectError.response?.status ?? objectError.response?.statusCode
        ? { errorStatus: objectError.status ?? objectError.statusCode ?? objectError.response?.status ?? objectError.response?.statusCode }
        : {}),
      ...(objectError.code ? { errorCode: objectError.code } : {}),
    };
  }

  return {
    errorMessage: String(error || "Unknown provider error"),
    errorName: typeof error,
  };
}

function getObjectErrorMessage(
  error: object,
  objectError: { message?: unknown; response?: { data?: unknown } },
): string {
  if (typeof objectError.message === "string" && objectError.message.trim()) {
    return objectError.message;
  }

  if (objectError.response?.data) {
    return stringifyProviderErrorObject(objectError.response.data);
  }

  return stringifyProviderErrorObject(error);
}

function stringifyProviderErrorObject(error: object): string {
  try {
    const text = JSON.stringify(error);
    return text && text !== "{}" ? text : "Unknown provider error object";
  } catch {
    return "Unable to serialize provider error object";
  }
}

function isUnsupportedProviderMessage(message: string): boolean {
  return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message));
}
