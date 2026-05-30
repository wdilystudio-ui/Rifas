export default function AdminTable({ reservations, onMarkAsPaid, onRelease, onRefundPaid }) {
  if (!reservations.length) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow text-center">
        <p className="text-slate-700 font-semibold">
          Nenhuma reserva encontrada.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-4 text-left font-bold">Cliente</th>
              <th className="p-4 text-left font-bold">Telefone</th>
              <th className="p-4 text-left font-bold">Número</th>
              <th className="p-4 text-left font-bold">Status</th>
              <th className="p-4 text-left font-bold">Data</th>
              <th className="p-4 text-left font-bold">Ações</th>
            </tr>
          </thead>

          <tbody>
            {reservations.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b last:border-b-0 ${index % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
              >
                <td className="p-4 font-bold text-slate-900">{item.customers?.name || "-"}</td>
                <td className="p-4 text-slate-800">{item.customers?.phone || "-"}</td>
                <td className="p-4 font-black text-lg text-slate-900">
                  {String(item.raffle_numbers?.number || "").padStart(6, "0")}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.status === "paid" ? "✓ Pago" : "⏳ Reservado"}
                  </span>
                </td>
                <td className="p-4 text-slate-700 text-sm">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {item.status !== "paid" && (
                      <button
                        onClick={() => onMarkAsPaid(item)}
                        className="rounded-lg bg-green-500 text-white px-3 py-2 font-bold text-xs hover:bg-green-600 transition"
                      >
                        ✓ Pago
                      </button>
                    )}

                    {item.status !== "paid" && (
                      <button
                        onClick={() => onRelease(item)}
                        className="rounded-lg bg-red-500 text-white px-3 py-2 font-bold text-xs hover:bg-red-600 transition"
                      >
                        🔄 Liberar
                      </button>
                    )}

                    {item.status === "paid" && (
                      <button
                        onClick={() => onRefundPaid(item)}
                        className="rounded-lg bg-red-700 text-white px-3 py-2 font-bold text-xs hover:bg-red-800 transition"
                      >
                        Apagar cliente
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
