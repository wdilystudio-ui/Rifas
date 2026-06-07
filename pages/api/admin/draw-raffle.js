import crypto from "crypto";
import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";

const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RAFFLE_MAX_NUMBERS;
  return Math.min(Math.max(Math.round(parsed), 100), 100000);
}

function pickSecureRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const index = crypto.randomInt(0, items.length);
  return items[index];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res) || !requireAdmin(req, res)) return;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "raffle_max_numbers")
      .single();

    const raffleMaxNumbers = clampLimit(setting?.value);

    const { data: paidReservations, error } = await supabase
      .from("reservations")
      .select(`
        id,
        status,
        customer_id,
        number_id,
        customers (
          id,
          name,
          phone
        ),
        raffle_numbers (
          id,
          number,
          status
        )
      `)
      .eq("status", "paid");

    if (error) throw error;

    const eligibleReservations = (paidReservations || []).filter((item) => {
      const number = Number(item.raffle_numbers?.number || 0);

      return (
        item.status === "paid" &&
        item.raffle_numbers?.status === "paid" &&
        number >= 1 &&
        number <= raffleMaxNumbers &&
        item.customers?.id &&
        item.raffle_numbers?.id
      );
    });

    if (!eligibleReservations.length) {
      return res.status(400).json({
        message: "Não há números pagos disponíveis para realizar o sorteio."
      });
    }

    const winner = pickSecureRandomItem(eligibleReservations);

    const winningNumber = Number(winner.raffle_numbers.number);
    const winnerName = winner.customers.name || "Ganhador";
    const winnerPhone = winner.customers.phone || "";

    const { data: draw, error: drawError } = await supabase
      .from("raffle_draws")
      .insert({
        reservation_id: winner.id,
        number_id: winner.raffle_numbers.id,
        customer_id: winner.customers.id,
        winner_name: winnerName,
        winner_phone: winnerPhone,
        winning_number: winningNumber
      })
      .select(`
        id,
        winner_name,
        winner_phone,
        winning_number,
        created_at
      `)
      .single();

    if (drawError) throw drawError;

    return res.status(200).json({
      success: true,
      draw: {
        id: draw.id,
        winnerName: draw.winner_name,
        winnerPhone: draw.winner_phone,
        winningNumber: draw.winning_number,
        createdAt: draw.created_at
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro ao realizar o sorteio."
    });
  }
}
