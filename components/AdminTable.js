export default function AdminTable({
  reservations,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  allSelected,
  onMarkAsPaid,
  onRelease,
  onRefundPaid,
  onGenerateReceipt
}) {
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
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-4 text-left font-bold">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Selecionar todos"
                  className="h-5 w-5 accent-green-600 cursor-pointer"
                />
              </th>
              <th className="p-4 text-left font-bold">Cliente</th>
              <th className="p-4 text-left font-bold">Telefone</th>
              <th className="p-4 text-left font-bold">Número</th>
              <th className="p-4 text-left font-bold">Status</th>
              <th className="p-4 text-left font-bold">Data</th>
              <th className="p-4 text-left font-bold">Ações</th>
            </tr>
          </thead>

         <tbody>
  {reservations.map((item, index) => {
    const isSelected = selectedIds.includes(item.id);

    return (
      <tr
        key={item.id}
        className={`border-b last:border-b-0 transition ${
          isSelected
            ? "bg-green-100 ring-2 ring-inset ring-green-500"
            : index % 2 === 0
              ? "bg-slate-50"
              : "bg-white"
        }`}
      >
               <td className="p-4 whitespace-nowrap">
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggleSelected(item.id)}
      aria-label={`Selecionar número ${item.raffle_numbers?.number || ""}`}
      className="h-5 w-5 accent-green-600 cursor-pointer"
    />

    {isSelected && (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white text-xs font-black">
        ✓
      </span>
    )}
  </div>
</td>
                <td className="p-4 font-bold text-slate-900 whitespace-nowrap">
                    {item.customers?.name || "-"}
               </td>
                 <td className="p-4 text-slate-800 whitespace-nowrap">
                     {item.customers?.phone || "-"}
                </td>
                <td className="p-4 font-black text-lg text-slate-900 whitespace-nowrap">
                  {String(item.raffle_numbers?.number || "").padStart(6, "0")}
                </td>
               <td className="p-4 whitespace-nowrap">
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
               <td className="p-4 text-slate-700 text-sm whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="p-4 whitespace-nowrap">
                  <div className="flex flex-nowrap gap-2">
                    <button
                      onClick={() => onGenerateReceipt(item)}
                     className="rounded-lg bg-blue-500 text-white px-3 py-2 font-bold text-xs whitespace-nowrap hover:bg-blue-600 transition"
                      
                      title="Gerar comprovante com todos os números deste cliente"
                    >
                      🧾 Comprovante
                    </button>

                    {item.status !== "paid" && (
                      <button
                        onClick={() => onMarkAsPaid(item)}
                       className="rounded-lg bg-green-500 text-white px-3 py-2 font-bold text-xs whitespace-nowrap hover:bg-green-600 transition"
                         >
                        ✓ Pago
                      </button>
                    )}

                    {item.status !== "paid" && (
                      <button
                        onClick={() => onRelease(item)}
                       className="rounded-lg bg-red-500 text-white px-3 py-2 font-bold text-xs whitespace-nowrap hover:bg-red-600 transition"
                         >
                        🔄 Liberar
                      </button>
                    )}

                    {item.status === "paid" && (
                      <button
                        onClick={() => onRefundPaid(item)}
                       className="rounded-lg bg-red-700 text-white px-3 py-2 font-bold text-xs whitespace-nowrap hover:bg-red-800 transition"
                         >
                        Apagar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
