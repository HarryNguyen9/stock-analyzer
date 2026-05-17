import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import type { Database } from "../lib/supabase/types";

type SymbolInsert = Database["public"]["Tables"]["symbols"]["Insert"];
type Exchange = SymbolInsert["exchange"];
type Tier = NonNullable<SymbolInsert["tier"]>;

type SeedSymbol = {
  symbol: string;
  name: string;
  exchange: Exchange;
  sector: string;
  tier: Tier;
  autoSync: boolean;
};

const A_TIER_SYMBOLS: SeedSymbol[] = [
  { symbol: "FPT", name: "Tập đoàn FPT", exchange: "HOSE", sector: "Công nghệ", tier: "A", autoSync: true },
  { symbol: "VCB", name: "Vietcombank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "BID", name: "BIDV", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "CTG", name: "VietinBank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "TCB", name: "Techcombank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "MBB", name: "MB Bank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "ACB", name: "Ngân hàng Á Châu", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "STB", name: "Sacombank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "VPB", name: "VPBank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "HDB", name: "HDBank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "SHB", name: "SHB", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "TPB", name: "TPBank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "LPB", name: "LPBank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "SSB", name: "SeABank", exchange: "HOSE", sector: "Ngân hàng", tier: "A", autoSync: true },
  { symbol: "SSI", name: "Chứng khoán SSI", exchange: "HOSE", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "VND", name: "Chứng khoán VNDirect", exchange: "HOSE", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "VCI", name: "Chứng khoán Vietcap", exchange: "HOSE", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "HCM", name: "Chứng khoán HSC", exchange: "HOSE", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "VIX", name: "Chứng khoán VIX", exchange: "HOSE", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "SHS", name: "Chứng khoán Sài Gòn - Hà Nội", exchange: "HNX", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "MBS", name: "Chứng khoán MB", exchange: "HNX", sector: "Chứng khoán", tier: "A", autoSync: true },
  { symbol: "HPG", name: "Tập đoàn Hòa Phát", exchange: "HOSE", sector: "Thép", tier: "A", autoSync: true },
  { symbol: "HSG", name: "Tập đoàn Hoa Sen", exchange: "HOSE", sector: "Thép", tier: "A", autoSync: true },
  { symbol: "NKG", name: "Thép Nam Kim", exchange: "HOSE", sector: "Thép", tier: "A", autoSync: true },
  { symbol: "VGS", name: "Ống thép Việt Đức", exchange: "HNX", sector: "Thép", tier: "A", autoSync: true },
  { symbol: "MWG", name: "Thế Giới Di Động", exchange: "HOSE", sector: "Bán lẻ", tier: "A", autoSync: true },
  { symbol: "FRT", name: "FPT Retail", exchange: "HOSE", sector: "Bán lẻ", tier: "A", autoSync: true },
  { symbol: "PNJ", name: "Vàng bạc Đá quý Phú Nhuận", exchange: "HOSE", sector: "Bán lẻ", tier: "A", autoSync: true },
  { symbol: "VNM", name: "Vinamilk", exchange: "HOSE", sector: "Tiêu dùng thiết yếu", tier: "A", autoSync: true },
  { symbol: "MSN", name: "Tập đoàn Masan", exchange: "HOSE", sector: "Tiêu dùng", tier: "A", autoSync: true },
  { symbol: "SAB", name: "Sabeco", exchange: "HOSE", sector: "Tiêu dùng", tier: "A", autoSync: true },
  { symbol: "KDC", name: "KIDO Group", exchange: "HOSE", sector: "Tiêu dùng", tier: "A", autoSync: true },
  { symbol: "VHM", name: "Vinhomes", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "VIC", name: "Vingroup", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "VRE", name: "Vincom Retail", exchange: "HOSE", sector: "BĐS bán lẻ", tier: "A", autoSync: true },
  { symbol: "KDH", name: "Khang Điền", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "DXG", name: "Đất Xanh Group", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "DIG", name: "DIC Corp", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "PDR", name: "Phát Đạt", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "NVL", name: "Novaland", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "NLG", name: "Nam Long", exchange: "HOSE", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "CEO", name: "CEO Group", exchange: "HNX", sector: "Bất động sản", tier: "A", autoSync: true },
  { symbol: "IDC", name: "IDICO", exchange: "HNX", sector: "Khu công nghiệp", tier: "A", autoSync: true },
  { symbol: "BCM", name: "Becamex IDC", exchange: "HOSE", sector: "Khu công nghiệp", tier: "A", autoSync: true },
  { symbol: "KBC", name: "Kinh Bắc City", exchange: "HOSE", sector: "Khu công nghiệp", tier: "A", autoSync: true },
  { symbol: "SZC", name: "Sonadezi Châu Đức", exchange: "HOSE", sector: "Khu công nghiệp", tier: "A", autoSync: true },
  { symbol: "GVR", name: "Tập đoàn Công nghiệp Cao su Việt Nam", exchange: "HOSE", sector: "Cao su/KCN", tier: "A", autoSync: true },
  { symbol: "GAS", name: "PV Gas", exchange: "HOSE", sector: "Năng lượng", tier: "A", autoSync: true },
  { symbol: "PLX", name: "Petrolimex", exchange: "HOSE", sector: "Năng lượng", tier: "A", autoSync: true },
  { symbol: "POW", name: "PV Power", exchange: "HOSE", sector: "Điện", tier: "A", autoSync: true },
  { symbol: "PVD", name: "PV Drilling", exchange: "HOSE", sector: "Dịch vụ năng lượng", tier: "A", autoSync: true },
  { symbol: "PVS", name: "Dịch vụ Kỹ thuật Dầu khí", exchange: "HNX", sector: "Dịch vụ năng lượng", tier: "A", autoSync: true },
  { symbol: "BSR", name: "Lọc hóa dầu Bình Sơn", exchange: "UPCOM", sector: "Năng lượng", tier: "A", autoSync: true },
  { symbol: "OIL", name: "PV Oil", exchange: "UPCOM", sector: "Năng lượng", tier: "A", autoSync: true },
  { symbol: "DPM", name: "Đạm Phú Mỹ", exchange: "HOSE", sector: "Hóa chất/Phân bón", tier: "A", autoSync: true },
  { symbol: "DCM", name: "Đạm Cà Mau", exchange: "HOSE", sector: "Hóa chất/Phân bón", tier: "A", autoSync: true },
  { symbol: "DGC", name: "Hóa chất Đức Giang", exchange: "HOSE", sector: "Hóa chất", tier: "A", autoSync: true },
  { symbol: "GMD", name: "Gemadept", exchange: "HOSE", sector: "Logistics", tier: "A", autoSync: true },
  { symbol: "HAH", name: "Vận tải Hải An", exchange: "HOSE", sector: "Logistics", tier: "A", autoSync: true },
  { symbol: "VTP", name: "Viettel Post", exchange: "UPCOM", sector: "Logistics", tier: "A", autoSync: true },
  { symbol: "ACV", name: "Tổng công ty Cảng hàng không Việt Nam", exchange: "UPCOM", sector: "Hạ tầng", tier: "A", autoSync: true },
  { symbol: "VJC", name: "Vietjet Air", exchange: "HOSE", sector: "Hàng không", tier: "A", autoSync: true },
  { symbol: "HVN", name: "Vietnam Airlines", exchange: "HOSE", sector: "Hàng không", tier: "A", autoSync: true },
  { symbol: "GEX", name: "Gelex", exchange: "HOSE", sector: "Công nghiệp", tier: "A", autoSync: true },
  { symbol: "REE", name: "REE Corporation", exchange: "HOSE", sector: "Cơ điện lạnh", tier: "A", autoSync: true },
  { symbol: "PC1", name: "PC1 Group", exchange: "HOSE", sector: "Xây lắp điện", tier: "A", autoSync: true },
  { symbol: "VGC", name: "Viglacera", exchange: "HOSE", sector: "Vật liệu xây dựng", tier: "A", autoSync: true },
  { symbol: "CTR", name: "Viettel Construction", exchange: "HOSE", sector: "Hạ tầng viễn thông", tier: "A", autoSync: true },
  { symbol: "VGI", name: "Viettel Global", exchange: "UPCOM", sector: "Viễn thông", tier: "A", autoSync: true },
  { symbol: "FOX", name: "FPT Telecom", exchange: "UPCOM", sector: "Viễn thông", tier: "A", autoSync: true },
  { symbol: "VGT", name: "Tập đoàn Dệt May Việt Nam", exchange: "UPCOM", sector: "Dệt may", tier: "A", autoSync: true },
  { symbol: "HUT", name: "Tasco", exchange: "HNX", sector: "Hạ tầng", tier: "A", autoSync: true },
  { symbol: "HHV", name: "Đèo Cả", exchange: "HOSE", sector: "Hạ tầng", tier: "A", autoSync: true },
  { symbol: "HAG", name: "Hoàng Anh Gia Lai", exchange: "HOSE", sector: "Nông nghiệp", tier: "A", autoSync: true },
  { symbol: "DBC", name: "Dabaco", exchange: "HOSE", sector: "Nông nghiệp", tier: "A", autoSync: true },
  { symbol: "ANV", name: "Nam Việt", exchange: "HOSE", sector: "Thủy sản", tier: "A", autoSync: true },
  { symbol: "MPC", name: "Minh Phú", exchange: "UPCOM", sector: "Thủy sản", tier: "A", autoSync: true },
  { symbol: "QNS", name: "Đường Quảng Ngãi", exchange: "UPCOM", sector: "Tiêu dùng thiết yếu", tier: "A", autoSync: true },
  { symbol: "MCH", name: "Masan Consumer", exchange: "UPCOM", sector: "Tiêu dùng", tier: "A", autoSync: true },
  { symbol: "VEA", name: "VEAM", exchange: "UPCOM", sector: "Công nghiệp", tier: "A", autoSync: true },
];

const B_TIER_SYMBOLS: SeedSymbol[] = [
  { symbol: "ASM", name: "Sao Mai Group", exchange: "HOSE", sector: "Đa ngành", tier: "B", autoSync: false },
  { symbol: "CII", name: "CII", exchange: "HOSE", sector: "Hạ tầng", tier: "B", autoSync: false },
  { symbol: "CRE", name: "Cen Land", exchange: "HOSE", sector: "Bất động sản", tier: "B", autoSync: false },
  { symbol: "DHC", name: "Đông Hải Bến Tre", exchange: "HOSE", sector: "Bao bì", tier: "B", autoSync: false },
  { symbol: "DGW", name: "Digiworld", exchange: "HOSE", sector: "Phân phối", tier: "B", autoSync: false },
  { symbol: "DPG", name: "Đạt Phương", exchange: "HOSE", sector: "Xây dựng", tier: "B", autoSync: false },
  { symbol: "EIB", name: "Eximbank", exchange: "HOSE", sector: "Ngân hàng", tier: "B", autoSync: false },
  { symbol: "EVF", name: "EVNFinance", exchange: "HOSE", sector: "Tài chính", tier: "B", autoSync: false },
  { symbol: "FCN", name: "FECON", exchange: "HOSE", sector: "Xây dựng", tier: "B", autoSync: false },
  { symbol: "HDG", name: "Hà Đô", exchange: "HOSE", sector: "Bất động sản/Năng lượng", tier: "B", autoSync: false },
  { symbol: "IMP", name: "Dược Imexpharm", exchange: "HOSE", sector: "Dược phẩm", tier: "B", autoSync: false },
  { symbol: "LCG", name: "Lizen", exchange: "HOSE", sector: "Xây dựng", tier: "B", autoSync: false },
  { symbol: "PAN", name: "The PAN Group", exchange: "HOSE", sector: "Nông nghiệp/Tiêu dùng", tier: "B", autoSync: false },
  { symbol: "PHR", name: "Cao su Phước Hòa", exchange: "HOSE", sector: "Cao su/KCN", tier: "B", autoSync: false },
  { symbol: "SBT", name: "Thành Thành Công - Biên Hòa", exchange: "HOSE", sector: "Tiêu dùng thiết yếu", tier: "B", autoSync: false },
  { symbol: "TCH", name: "Hoàng Huy", exchange: "HOSE", sector: "Bất động sản", tier: "B", autoSync: false },
  { symbol: "TNG", name: "TNG Investment and Trading", exchange: "HNX", sector: "Dệt may", tier: "B", autoSync: false },
  { symbol: "VCS", name: "Vicostone", exchange: "HNX", sector: "Vật liệu xây dựng", tier: "B", autoSync: false },
  { symbol: "PVI", name: "PVI Holdings", exchange: "HNX", sector: "Bảo hiểm", tier: "B", autoSync: false },
  { symbol: "MSR", name: "Masan High-Tech Materials", exchange: "UPCOM", sector: "Khai khoáng", tier: "B", autoSync: false },
];

async function seedTopSymbols() {
  loadEnvConfig(process.cwd());

  const rows = toUpsertRows([...A_TIER_SYMBOLS, ...B_TIER_SYMBOLS]);
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("symbols").upsert(rows, {
    onConflict: "symbol",
  });

  if (error) {
    throw error;
  }

  const autoSyncCount = rows.filter((row) => row.auto_sync).length;
  console.log(`Seed symbols done: ${rows.length} ma, ${autoSyncCount} ma auto_sync=true.`);
}

function toUpsertRows(seedSymbols: SeedSymbol[]): SymbolInsert[] {
  const unique = new Map<string, SeedSymbol>();

  for (const item of seedSymbols) {
    unique.set(item.symbol, item);
  }

  return [...unique.values()].map((item, index) => ({
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    sector: item.sector,
    tier: item.tier,
    auto_sync: item.autoSync,
    liquidity_rank: index + 1,
  }));
}

function isDirectRun(importMetaUrl: string): boolean {
  return Boolean(process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href);
}

if (isDirectRun(import.meta.url)) {
  seedTopSymbols().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
