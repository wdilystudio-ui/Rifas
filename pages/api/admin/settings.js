import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { raffleSettingsSchema } from "../../../lib/validation";

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
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireAdmin(req, res)) return;
  if (req.method === "POST" && !requireSameOrigin(req, res)) return;

  try {
    const supabase = createSupabaseAdminClient();

    if (req.method === "GET") {
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
    }

    const parsed = raffleSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Configuração inválida. Confira a quantidade e o valor do número." });
    }

    const raffleMaxNumbers = clampLimit(parsed.data.raffleMaxNumbers);
    const ticketPrice = normalizeTicketPrice(parsed.data.ticketPrice || DEFAULT_TICKET_PRICE);

    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      return res.status(400).json({ message: "Valor do número inválido. Use um valor maior que zero." });
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert(
        [
          {
            key: "raffle_max_numbers",
            value: String(raffleMaxNumbers),
            updated_at: new Date().toISOString()
          },
          {
            key: "ticket_price",
            value: ticketPrice.toFixed(2),
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: "key" }
      );

    if (error) throw error;

    return res.status(200).json({ success: true, raffleMaxNumbers, ticketPrice });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao salvar configuração da rifa." });
  }
}
