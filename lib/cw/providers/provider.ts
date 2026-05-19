import { twentyFourHMoneyCoveredWarrantProvider } from "@/lib/cw/providers/twenty-four-h-money-provider";
import type { CoveredWarrantProvider } from "@/lib/cw/types";

export function getCoveredWarrantProvider(): CoveredWarrantProvider {
  const provider = process.env.CW_PROVIDER?.trim().toLowerCase() || "24hmoney";

  if (provider === "24hmoney" || provider === "twenty-four-h-money") return twentyFourHMoneyCoveredWarrantProvider;

  throw new Error(`Unsupported CW_PROVIDER: ${provider}`);
}
