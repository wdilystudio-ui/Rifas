import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { bulkReservationActionSchema } from "../../../lib/validation";

const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;
const BULK_CHUNK_SIZE = 400;

function chunkArray(array, size = BULK_CHUNK_SIZE) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

async function selectInChunks({ supabase, table, columns, field, values, extra }) {
  const results = [];

  for (const chunk of chunkArray(values)) {
    let query = supabase.from(table).select(columns).in(field, chunk);

    if (typeof extra === "function") {
      query = extra(query);
    }

    const { data, error } = await query;

    if (error) throw error;

    results.push(...(data || []));
  }

  return results;
}

async function updateInChunks({ supabase, table, field, values, payload, extra }) {
  for (const chunk of chunkArray(values)) {
    let query = supabase.from(table).update(payload).in(field, chunk);

    if (typeof extra === "function") {
      query = extra(query);
    }

    const { error } = await query;

    if (error) throw error;
  }
}

async function deleteInChunks({ supabase, table, field, values, extra }) {
  for (const chunk of chunkArray(values)) {
    let query = supabase.from(table).delete().in(field, chunk);

    if (typeof extra === "function") {
      query = extra(query);
    }

    const { error } = await query;

    if (error) throw error;
  }
}

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

  const parsed = bulkReservationActionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors?.[0]?.message || "Dados inválidos."
    });
  }

  const { action, items } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "raffle_max_numbers")
      .single();

    const raffleMaxNumbers = clampLimit(setting?.value);

    const numberIds = items.map((item) => item.numberId);
    const reservationIds = items.map((item) => item.reservationId);

  const selectedNumbers = await selectInChunks({
  supabase,
  table: "raffle_numbers",
  columns: "id, number, status",
  field: "id",
  values: numberIds
});

    const hasInvalidNumber = (selectedNumbers || []).some((item) => {
      return Number(item.number || 0) > raffleMaxNumbers;
    });

    if (hasInvalidNumber) {
      return res.status(400).json({
        message: "Existe número fora do limite atual da rifa."
      });
    }

    if (action === "mark_paid") {
     await updateInChunks({
  supabase,
  table: "reservations",
  field: "id",
  values: reservationIds,
  payload: { status: "paid" }
});

await updateInChunks({
  supabase,
  table: "raffle_numbers",
  field: "id",
  values: numberIds,
  payload: { status: "paid" }
});

      return res.status(200).json({
        success: true,
        message: "Números selecionados marcados como pagos."
      });
    }

    if (action === "release_unpaid") {
     const unpaidReservations = await selectInChunks({
  supabase,
  table: "reservations",
  columns: "id",
  field: "id",
  values: reservationIds,
  extra: (query) => query.neq("status", "paid")
});

      const unpaidReservationIds = (unpaidReservations || []).map((item) => item.id);

      if (!unpaidReservationIds.length) {
        return res.status(400).json({
          message: "Nenhum número reservado não pago foi selecionado para liberar."
        });
      }

      const allowedItems = items.filter((item) =>
        unpaidReservationIds.includes(item.reservationId)
      );

      const allowedNumberIds = allowedItems.map((item) => item.numberId);

await deleteInChunks({
  supabase,
  table: "reservations",
  field: "id",
  values: unpaidReservationIds,
  extra: (query) => query.neq("status", "paid")
});

await updateInChunks({
  supabase,
  table: "raffle_numbers",
  field: "id",
  values: allowedNumberIds,
  payload: {
    status: "available",
    reserved_by: null,
    reserved_at: null
  },
  extra: (query) => query.neq("status", "paid")
});

      return res.status(200).json({
        success: true,
        message: "Números não pagos foram liberados."
      });
    }


    if (action === "delete_selected") {
      const selectedReservations = await selectInChunks({
  supabase,
  table: "reservations",
  columns: "id, status, group_id, number_id",
  field: "id",
  values: reservationIds
});

      if (!selectedReservations?.length) {
        return res.status(400).json({
          message: "Nenhuma reserva selecionada foi encontrada."
        });
      }

      const paidReservations = selectedReservations.filter((item) => item.status === "paid");
      const unpaidReservations = selectedReservations.filter((item) => item.status !== "paid");

      if (unpaidReservations.length) {
        const unpaidReservationIds = unpaidReservations.map((item) => item.id);
        const unpaidNumberIds = unpaidReservations.map((item) => item.number_id).filter(Boolean);

        await deleteInChunks({
  supabase,
  table: "reservations",
  field: "id",
  values: unpaidReservationIds,
  extra: (query) => query.neq("status", "paid")
});

        if (unpaidNumberIds.length) {
        await updateInChunks({
  supabase,
  table: "raffle_numbers",
  field: "id",
  values: unpaidNumberIds,
  payload: {
    status: "available",
    reserved_by: null,
    reserved_at: null
  },
  extra: (query) => query.neq("status", "paid")
});
        }
      }

      const paidRepresentativeReservations = Array.from(
        new Map(
          paidReservations.map((item) => [item.group_id || item.id, item])
        ).values()
      );

      for (const reservation of paidRepresentativeReservations) {
        const { data, error } = await supabase.rpc("refund_paid_reservation", {
          p_reservation_id: reservation.id
        });

        if (error) throw error;

        if (!data?.success) {
          return res.status(400).json({
            message: data?.message || "Não foi possível apagar um dos clientes pagantes selecionados."
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Selecionados apagados e números liberados com sucesso."
      });
    }

    return res.status(400).json({ message: "Ação inválida." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro ao executar ação em massa."
    });
  }
}
