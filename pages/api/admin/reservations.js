import { requireAdmin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";

const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RAFFLE_MAX_NUMBERS;
  return Math.min(Math.max(Math.round(parsed), 100), 100000);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const supabase = createSupabaseAdminClient();
    const search = String(req.query.search || "").trim();

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "raffle_max_numbers")
      .single();

    const raffleMaxNumbers = clampLimit(setting?.value);

    let reservationsQuery = supabase
  .from("reservations")
  .select(`
    id,
    group_id,
    customer_id,
    status,
    created_at,
    raffle_numbers (
      id,
      number,
      status
    ),
    customers!inner (
      id,
      name,
      phone
    )
  `)
  .order("created_at", { ascending: false });

if (search) {
  const safeSearch = search.replace(/[%_]/g, "\\$&");

  reservationsQuery = reservationsQuery.or(
    `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`,
    { foreignTable: "customers" }
  );
}

const { data, error } = await reservationsQuery;

    if (error) throw error;

    const visibleReservations = (data || []).filter((item) => {
      return Number(item.raffle_numbers?.number || 0) <= raffleMaxNumbers;
    });

    return res.status(200).json({ reservations: visibleReservations, raffleMaxNumbers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao carregar reservas." });
  }
}
