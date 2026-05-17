import type { Signal, SignalCategory, SignalSentiment } from "@/lib/technical-analysis/types";

export type SignalExplanationVi = Pick<Signal, "explanationVi" | "implicationVi">;

export function createSignal(input: Signal): Signal {
  return normalizeSignalPriority(input);
}

export function topSignals(signals: Signal[], limit: number): Signal[] {
  return sortSignalsByPriority(signals).slice(0, limit);
}

export function sortSignalsByPriority(signals: Signal[]): Signal[] {
  return signals.map(normalizeSignalPriority).sort(
    (a, b) =>
      b.priority - a.priority ||
      b.strength - a.strength ||
      sentimentRank(b.sentiment) - sentimentRank(a.sentiment),
  );
}

export function normalizeSignalPriority(signal: Signal): Signal {
  const priority = getStandardPriority(signal);
  return priority === signal.priority ? signal : { ...signal, priority };
}

export function sentimentTone(sentiment: SignalSentiment): "positive" | "negative" | "neutral" {
  if (sentiment === "bullish") return "positive";
  if (sentiment === "bearish") return "negative";
  return "neutral";
}

export const categoryLabelsVi: Record<SignalCategory, string> = {
  trend: "Xu hướng",
  momentum: "Động lượng",
  volume: "Khối lượng",
  volatility: "Biến động",
  breakout: "Breakout",
  risk: "Rủi ro",
  pattern: "Mẫu hình",
};

export function getSignalExplanationVi(code: string): SignalExplanationVi {
  return signalExplanationCatalog[code] ?? defaultSignalExplanation;
}

function sentimentRank(sentiment: SignalSentiment): number {
  if (sentiment === "bearish") return 3;
  if (sentiment === "bullish") return 2;
  return 1;
}

const defaultSignalExplanation: SignalExplanationVi = {
  explanationVi: "Tín hiệu này được tạo từ dữ liệu giá, khối lượng và các chỉ báo kỹ thuật hiện có.",
  implicationVi: "Nên xem tín hiệu này cùng xu hướng chính, thanh khoản và vùng hỗ trợ/kháng cự gần nhất.",
};

const signalExplanationCatalog: Record<string, SignalExplanationVi> = {
  TREND_UP_MA20_MA50: {
    explanationVi: "Giá đang giữ phía trên đường trung bình ngắn hạn, trong khi MA20 cũng nằm trên MA50.",
    implicationVi: "Cấu trúc này thường cho thấy bên mua vẫn kiểm soát xu hướng ngắn đến trung hạn.",
  },
  GOLDEN_CROSS: {
    explanationVi: "Đường trung bình ngắn hạn đang tăng nhanh hơn đường trung bình trung hạn.",
    implicationVi: "Tín hiệu này thường gợi ý xu hướng mới đang mạnh lên, nhất là khi đi kèm thanh khoản tốt.",
  },
  DEATH_CROSS: {
    explanationVi: "Đường trung bình ngắn hạn yếu đi và rơi xuống dưới đường trung bình trung hạn.",
    implicationVi: "Tín hiệu này thường cảnh báo đà tăng suy yếu hoặc thị trường chuyển sang pha phòng thủ.",
  },
  RSI_NEUTRAL_HEALTHY: {
    explanationVi: "RSI nằm trong vùng trung tính, chưa cho thấy bên mua hoặc bên bán quá áp đảo.",
    implicationVi: "Mã này có thể đang tích lũy hoặc chờ thêm tín hiệu xác nhận từ giá và khối lượng.",
  },
  RSI_OVERBOUGHT: {
    explanationVi: "RSI vượt vùng 70, cho thấy lực mua gần đây đã đẩy động lượng lên mức cao.",
    implicationVi: "Giá vẫn có thể tăng tiếp, nhưng rủi ro rung lắc hoặc chốt lời ngắn hạn cao hơn.",
  },
  RSI_OVERSOLD: {
    explanationVi: "RSI rơi dưới vùng 30, cho thấy áp lực bán ngắn hạn đang khá mạnh.",
    implicationVi: "Mã này có thể xuất hiện nhịp hồi kỹ thuật, nhưng cần tín hiệu xác nhận trước khi coi là đảo chiều.",
  },
  MACD_BULLISH: {
    explanationVi: "Đường MACD đang cao hơn đường tín hiệu, tạo histogram phía trên mốc 0.",
    implicationVi: "Động lượng tăng đang cải thiện; nếu giá cũng vượt kháng cự, tín hiệu sẽ đáng tin hơn.",
  },
  MACD_BEARISH: {
    explanationVi: "Đường MACD đang thấp hơn đường tín hiệu, tạo histogram dưới mốc 0.",
    implicationVi: "Động lượng giảm đang chiếm ưu thế; nếu đi kèm gãy MA hoặc volume bán, rủi ro cao hơn.",
  },
  PRICE_UP_VOLUME_UP: {
    explanationVi: "Giá đóng cửa tăng trong khi thanh khoản cao hơn rõ rệt so với mặt bằng gần đây.",
    implicationVi: "Dòng tiền đang tham gia tích cực hơn; tín hiệu sẽ mạnh hơn nếu xuất hiện gần vùng breakout.",
  },
  BREAKOUT_VOLUME_CONFIRM: {
    explanationVi: "Breakout xảy ra cùng lúc với thanh khoản tăng, cho thấy lực mua không chỉ là biến động mỏng.",
    implicationVi: "Đây thường là tín hiệu xác nhận tốt cho xu hướng tăng, nhưng vẫn nên theo dõi phiên retest sau đó.",
  },
  BREAK_HIGH_20: {
    explanationVi: "Giá đã vượt qua vùng cao nhất của 20 phiên trước đó, phá vùng kháng cự ngắn hạn.",
    implicationVi: "Breakout có thể mở ra nhịp tăng mới, nhất là khi được xác nhận bởi khối lượng cao.",
  },
  BREAK_LOW_20: {
    explanationVi: "Giá rơi xuống dưới vùng thấp nhất của 20 phiên trước đó, phá vùng hỗ trợ ngắn hạn.",
    implicationVi: "Tín hiệu này thường cảnh báo rủi ro giảm tiếp hoặc cần hạ tỷ trọng quan sát.",
  },
  PULLBACK_MA20: {
    explanationVi: "Giá lùi về gần đường MA20 nhưng không đóng cửa thủng vùng hỗ trợ động này.",
    implicationVi: "Nếu xu hướng chính vẫn khỏe, đây có thể là nhịp nghỉ trước khi giá tiếp tục đi lên.",
  },
  BOLLINGER_SQUEEZE: {
    explanationVi: "Biên độ dao động 20 phiên đang bị nén lại, khiến dải Bollinger hẹp hơn bình thường.",
    implicationVi: "Sau giai đoạn nén, giá thường có một nhịp biến động mạnh; cần chờ hướng breakout để xác nhận.",
  },
  BROKEN_MA20: {
    explanationVi: "Giá mất đường trung bình ngắn hạn, cho thấy lực mua gần đây đang suy yếu.",
    implicationVi: "Đây là cảnh báo sớm; nên theo dõi liệu giá có lấy lại MA20 trong vài phiên tới hay không.",
  },
  BROKEN_MA50: {
    explanationVi: "Giá mất đường trung bình trung hạn, cho thấy vùng hỗ trợ động quan trọng không còn giữ được.",
    implicationVi: "Tín hiệu này thường cần ưu tiên quản trị rủi ro vì xu hướng trung hạn có thể chuyển xấu.",
  },
  HEAVY_SELLING_VOLUME: {
    explanationVi: "Giá giảm trong khi thanh khoản tăng, cho thấy lực bán chủ động đang mạnh hơn bình thường.",
    implicationVi: "Tín hiệu này thường hàm ý áp lực phân phối hoặc thoát hàng ngắn hạn đang tăng.",
  },
  HIGHER_HIGH_HIGHER_LOW: {
    explanationVi: "Các đỉnh sau cao hơn đỉnh trước và các đáy sau cũng cao hơn đáy trước.",
    implicationVi: "Cấu trúc này thường phản ánh xu hướng tăng đang hình thành hoặc được duy trì.",
  },
  LOWER_HIGH_LOWER_LOW: {
    explanationVi: "Các nhịp hồi tạo đỉnh thấp hơn và các nhịp giảm tạo đáy thấp hơn.",
    implicationVi: "Cấu trúc này thường cho thấy bên bán đang kiểm soát nhịp giá ngắn hạn.",
  },
  CONSOLIDATION_RANGE: {
    explanationVi: "Biên dao động gần đây thu hẹp, giá chưa chọn hướng tăng hoặc giảm rõ ràng.",
    implicationVi: "Giai đoạn tích lũy có thể tạo nền cho breakout, nhưng cần chờ tín hiệu xác nhận.",
  },
  GAP_UP: {
    explanationVi: "Vùng giá thấp nhất của phiên hiện tại cao hơn vùng giá cao nhất của phiên trước.",
    implicationVi: "Gap up thường cho thấy kỳ vọng tích cực đột ngột, nhưng cần xem giá có giữ được khoảng trống hay không.",
  },
  GAP_DOWN: {
    explanationVi: "Vùng giá cao nhất của phiên hiện tại thấp hơn vùng giá thấp nhất của phiên trước.",
    implicationVi: "Gap down thường phản ánh áp lực bán mạnh, đặc biệt nếu giá không hồi lại vùng gap.",
  },
};

function getStandardPriority(signal: Signal): number {
  const byCode: Partial<Record<string, number>> = {
    BREAKOUT_VOLUME_CONFIRM: 98,
    BROKEN_MA50: 96,
    HEAVY_SELLING_VOLUME: 95,
    BREAK_HIGH_20: 94,
    BREAK_LOW_20: 94,
    DEATH_CROSS: 88,
    GOLDEN_CROSS: 86,
    RSI_OVERBOUGHT: 84,
    RSI_OVERSOLD: 84,
    BROKEN_MA20: 84,
    MACD_BULLISH: 82,
    MACD_BEARISH: 82,
    PRICE_UP_VOLUME_UP: signal.strength >= 5 ? 86 : 78,
    TREND_UP_MA20_MA50: 72,
    PULLBACK_MA20: 70,
    BOLLINGER_SQUEEZE: 68,
    HIGHER_HIGH_HIGHER_LOW: 66,
    LOWER_HIGH_LOWER_LOW: 66,
    GAP_UP: 62,
    GAP_DOWN: 62,
    RSI_NEUTRAL_HEALTHY: 45,
    CONSOLIDATION_RANGE: 42,
  };

  if (typeof byCode[signal.code] === "number") {
    return byCode[signal.code];
  }

  if (signal.sentiment === "neutral") {
    return Math.min(signal.priority, 60);
  }

  if (signal.category === "risk" || signal.category === "breakout") {
    return Math.max(signal.priority, 80);
  }

  return signal.priority;
}
