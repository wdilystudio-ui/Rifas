import { requireAdmin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";

const DEFAULT_TICKET_PRICE = 0.49;

function normalizeTicketPrice(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TICKET_PRICE;
}

function makeRaffleIdentifier(sourceId, createdAt) {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  const compactId = String(sourceId || "COMPROVANTE")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase()
    .padEnd(8, "0");

  return `RIFA-${year}-${compactId}`;
}

async function getTicketPrice(supabase) {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "ticket_price")
    .maybeSingle();

  return normalizeTicketPrice(data?.value);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const supabase = createSupabaseAdminClient();
    const { groupId, reservationId, customerId } = req.body || {};

    if (!groupId && !reservationId && !customerId) {
      return res.status(400).json({
        message: "Informe groupId, reservationId ou customerId para gerar o comprovante."
      });
    }

    let targetGroupId = groupId || null;
    let targetCustomerId = customerId || null;
    let baseReservation = null;

    if (!targetGroupId && reservationId) {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, group_id, customer_id, created_at")
        .eq("id", reservationId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ message: "Reserva não encontrada." });

      baseReservation = data;
      targetGroupId = data.group_id || null;
      targetCustomerId = data.customer_id || null;
    }

    let group = null;
    if (targetGroupId) {
      const { data, error } = await supabase
        .from("reservation_groups")
        .select("id, customer_id, total, status, created_at")
        .eq("id", targetGroupId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ message: "Grupo de reservas não encontrado." });

      group = data;
      targetCustomerId = data.customer_id;
    }

    if (!targetCustomerId) {
      return res.status(404).json({ message: "Cliente vinculado à reserva não encontrado." });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, phone, created_at")
      .eq("id", targetCustomerId)
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customer) return res.status(404).json({ message: "Cliente não encontrado." });

    let reservationsQuery = supabase
      .from("reservations")
      .select("id, group_id, customer_id, status, created_at, raffle_numbers(number)");

    if (targetGroupId) {
      reservationsQuery = reservationsQuery.eq("group_id", targetGroupId);
    } else {
      // Compatibilidade para projetos antigos sem group_id preenchido.
      reservationsQuery = reservationsQuery.eq("customer_id", targetCustomerId);
    }

    const { data: reservations, error: reservationsError } = await reservationsQuery;
    if (reservationsError) throw reservationsError;

    const numbers = (reservations || [])
      .map((item) => Number(item.raffle_numbers?.number))
      .filter((number) => Number.isInteger(number))
      .sort((a, b) => a - b);

    if (!numbers.length) {
      return res.status(404).json({ message: "Nenhum número encontrado para este comprador." });
    }

    const ticketPrice = await getTicketPrice(supabase);
    const fallbackTotal = Number((numbers.length * ticketPrice).toFixed(2));
    const groupTotal = Number(group?.total);
    const total = Number.isFinite(groupTotal) && groupTotal > 0 ? groupTotal : fallbackTotal;
    const createdAt = group?.created_at || baseReservation?.created_at || reservations?.[0]?.created_at || customer.created_at;
    const sourceIdentifier = targetGroupId || targetCustomerId || reservationId;

    return res.status(200).json({
      success: true,
      receipt: {
        customer_name: customer.name,
        customer_phone: customer.phone,
        group_id: targetGroupId,
        customer_id: targetCustomerId,
        raffle_identifier: makeRaffleIdentifier(sourceIdentifier, createdAt),
        numbers,
        total_numbers: numbers.length,
        ticket_price: ticketPrice,
        total,
        created_at: createdAt,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao gerar comprovante." });
  }
}
