import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { reservationActionSchema } from "../../../lib/validation";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res) || !requireAdmin(req, res)) return;

  const parsed = reservationActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos para apagar cliente pagante." });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("refund_paid_reservation", {
      p_reservation_id: parsed.data.reservationId
    });

    if (error) throw error;

    if (!data?.success) {
      return res.status(400).json({ message: data?.message || "Não foi possível apagar o cliente pagante." });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao apagar cliente pagante e liberar números." });
  }
}
