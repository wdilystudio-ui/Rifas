import { createSupabaseAdminClient } from "../../lib/supabaseAdmin";

const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;
const DEFAULT_TICKET_PRICE = 0.49;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RAFFLE_MAX_NUMBERS;
  return Math.min(Math.max(Math.round(parsed), 100), 100000);
}

function normalizeTicketPrice(value) {
  const parsed = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TICKET_PRICE;
  return Math.round(parsed * 100) / 100;
}

function settingValue(settings, key, fallback = "") {
  return settings?.find((item) => item.key === key)?.value || fallback;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Método não permitido." });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["raffle_max_numbers", "ticket_price", "prize_image_url"]);

    if (error) throw error;

    return res.status(200).json({
      raffleMaxNumbers: clampLimit(settingValue(data, "raffle_max_numbers", DEFAULT_RAFFLE_MAX_NUMBERS)),
      ticketPrice: normalizeTicketPrice(settingValue(data, "ticket_price", DEFAULT_TICKET_PRICE)),
      prizeImageUrl: settingValue(data, "prize_image_url", "")
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao carregar configuração da rifa." });
  }
}
