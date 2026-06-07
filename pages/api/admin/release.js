import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { reservationActionSchema } from "../../../lib/validation";

const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RAFFLE_MAX_NUMBERS;
  return Math.min(Math.max(Math.round(parsed), 100), 100000);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res) || !requireAdmin(req, res)) return;

  const parsed = reservationActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos para liberar a reserva." });
  }

  const { reservationId, numberId } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "raffle_max_numbers")
      .single();

    const raffleMaxNumbers = clampLimit(setting?.value);

    const { data: selectedNumber, error: selectedNumberError } = await supabase
      .from("raffle_numbers")
      .select("number")
      .eq("id", numberId)
      .single();

    if (selectedNumberError) throw selectedNumberError;

    if (Number(selectedNumber?.number || 0) > raffleMaxNumbers) {
      return res.status(400).json({ message: "Número não disponível nesta rifa." });
    }

    const { error: reservationError } = await supabase
      .from("reservations")
      .delete()
      .eq("id", reservationId)
      .neq("status", "paid");

    if (reservationError) throw reservationError;

    const { error: numberError } = await supabase
      .from("raffle_numbers")
      .update({
        status: "available",
        reserved_by: null,
        reserved_at: null
      })
      .eq("id", numberId)
      .neq("status", "paid");

    if (numberError) throw numberError;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao liberar reserva." });
  }
}
