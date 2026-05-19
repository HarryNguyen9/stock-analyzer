import { NextResponse } from "next/server";

type DnseEndpointResult = {
  status: number | null;
  data?: unknown;
  error?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");

  if (!symbol) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vui lòng truyền symbol, ví dụ /api/cw/dnse-test?symbol=CFPTxxxx",
      },
      { status: 400 },
    );
  }

  const baseUrl = process.env.DNSE_API_BASE_URL?.trim() || "https://openapi.dnse.com.vn";
  const [secdef, latestTrade] = await Promise.all([
    callDnseEndpoint(baseUrl, `/price/${symbol}/secdef`),
    callDnseEndpoint(baseUrl, `/price/${symbol}/trades/latest`),
  ]);

  return NextResponse.json({
    ok: true,
    symbol,
    secdefStatus: secdef.status,
    ...(secdef.error ? { secdefError: secdef.error } : { secdefData: secdef.data }),
    latestTradeStatus: latestTrade.status,
    ...(latestTrade.error ? { latestTradeError: latestTrade.error } : { latestTradeData: latestTrade.data }),
    supportedGuess: isSupported(secdef) || isSupported(latestTrade),
  });
}

async function callDnseEndpoint(baseUrl: string, path: string): Promise<DnseEndpointResult> {
  const url = new URL(path, ensureTrailingSlash(baseUrl));
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  const token = process.env.DNSE_API_TOKEN?.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });
    const bodyText = await response.text();
    const parsedBody = parseBody(bodyText);

    console.info("DNSE CW endpoint test", {
      path,
      status: response.status,
      body: bodyText.slice(0, 500),
    });

    if (!response.ok) {
      return {
        status: response.status,
        error: typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody).slice(0, 500),
      };
    }

    return {
      status: response.status,
      data: parsedBody,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "DNSE request failed";
    console.warn("DNSE CW endpoint test failed", { path, error: message });

    return {
      status: null,
      error: message,
    };
  }
}

function parseBody(body: string): unknown {
  if (!body.trim()) return null;

  try {
    return JSON.parse(body);
  } catch {
    return body.slice(0, 1_000);
  }
}

function isSupported(result: DnseEndpointResult): boolean {
  return typeof result.status === "number" && result.status >= 200 && result.status < 300 && result.data !== null && result.data !== undefined;
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

