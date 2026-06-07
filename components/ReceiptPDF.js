function formatCurrency(value) {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleString("pt-BR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ReceiptPDF({ reservation, onClose }) {
  if (!reservation) return null;

  const customerName = reservation.customers?.name || "Não informado";
  const customerPhone = reservation.customers?.phone || "Não informado";
  const raffleId = reservation.raffle_identifier || `RIFA-${new Date().getFullYear()}-${String(reservation.group_id || reservation.id || "0001").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
  const generatedAt = reservation.generated_at || new Date().toISOString();
  const createdAt = reservation.created_at;
  const numbers = Array.isArray(reservation.all_numbers) ? reservation.all_numbers : [];
  const formattedNumbers = numbers
    .map((number) => Number(number))
    .filter((number) => Number.isInteger(number))
    .sort((a, b) => a - b)
    .map((number) => String(number).padStart(6, "0"));
  const totalNumbers = formattedNumbers.length;
  const ticketPrice = Number(reservation.ticket_price || 0);
  const calculatedTotal = Number((totalNumbers * ticketPrice).toFixed(2));
  const storedTotal = Number(reservation.total);
  const totalPrice = Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : calculatedTotal;

  function handlePrint() {
    const printWindow = window.open("", "_blank", "height=800,width=900");

    if (!printWindow) {
      alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
      return;
    }

    const numbersHtml = formattedNumbers
      .map((number) => `<span class="number">${escapeHtml(number)}</span>`)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Comprovante ${escapeHtml(raffleId)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; }
            .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; padding: 28px; }
            .header { text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 24px; }
            .title { margin: 0 0 8px; font-size: 26px; font-weight: 800; }
            .identifier { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.03em; }
            .generated { margin: 8px 0 0; font-size: 12px; color: #475569; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .label { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #475569; }
            .value { margin: 0; font-size: 16px; font-weight: 700; word-break: break-word; }
            .section { border-top: 1px solid #cbd5e1; padding-top: 20px; margin-top: 20px; }
            .numbers { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
            .number { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 9px; font-weight: 800; font-size: 12px; background: #f8fafc; }
            .summary { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 16px; }
            .row { display: flex; justify-content: space-between; gap: 16px; margin: 10px 0; font-size: 15px; }
            .total { border: 1px solid #86efac; background: #f0fdf4; border-radius: 10px; padding: 12px; font-size: 20px; font-weight: 900; }
            .footer { text-align: center; margin-top: 28px; padding-top: 14px; border-top: 1px solid #cbd5e1; color: #475569; font-size: 12px; }
            @media print {
              body { padding: 0; }
              .receipt { border: none; border-radius: 0; }
            }
            @media (max-width: 640px) {
              body { padding: 16px; }
              .receipt { padding: 18px; }
              .grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <header class="header">
              <h1 class="title">Comprovante de Compra</h1>
              <p class="identifier">${escapeHtml(raffleId)}</p>
              <p class="generated">Gerado em ${escapeHtml(formatDate(generatedAt))}</p>
            </header>

            <section class="grid">
              <div><p class="label">Nome</p><p class="value">${escapeHtml(customerName)}</p></div>
              <div><p class="label">Telefone</p><p class="value">${escapeHtml(customerPhone)}</p></div>
              <div><p class="label">Data da compra</p><p class="value">${escapeHtml(formatDate(createdAt))}</p></div>
              <div><p class="label">Identificador da rifa</p><p class="value">${escapeHtml(raffleId)}</p></div>
            </section>

            <section class="section">
              <p class="label">Números escolhidos</p>
              <div class="numbers">${numbersHtml}</div>
            </section>

            <section class="summary">
              <div class="row"><strong>Quantidade de números:</strong><strong>${totalNumbers}</strong></div>
              <div class="row"><span>Valor unitário:</span><strong>${escapeHtml(formatCurrency(ticketPrice))}</strong></div>
              <div class="row total"><span>Total:</span><span>${escapeHtml(formatCurrency(totalPrice))}</span></div>
            </section>

            <footer class="footer">
              <p>Este comprovante é válido como registro da compra dos números listados acima.</p>
              <p>Guarde este documento para conferência futura.</p>
            </footer>
          </main>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 md:p-6 flex items-center justify-between print:hidden">
          <h2 className="text-2xl font-black text-slate-900">🧾 Comprovante de Compra</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 font-black text-2xl"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-8 print:p-0">
          <div className="text-center mb-6 pb-6 border-b border-slate-300">
            <h3 className="text-xl font-black text-slate-900 mb-2">Comprovante de Compra</h3>
            <p className="text-sm font-black text-slate-800">{raffleId}</p>
            <p className="text-sm text-slate-600">Gerado em {formatDate(generatedAt)}</p>
          </div>

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase">Nome</p>
              <p className="text-lg font-bold text-slate-900">{customerName}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase">Telefone</p>
              <p className="text-lg font-bold text-slate-900">{customerPhone}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase">Data da compra</p>
              <p className="text-lg font-bold text-slate-900">{formatDate(createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase">Identificador da rifa</p>
              <p className="text-lg font-bold text-slate-900 font-mono">{raffleId}</p>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-6 pb-6">
            <p className="text-xs font-bold text-slate-600 uppercase mb-3">Números escolhidos</p>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 md:grid-cols-6 gap-2">
              {formattedNumbers.map((number) => (
                <div
                  key={number}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-center"
                >
                  <span className="font-bold text-slate-900 text-sm">{number}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-300 pt-6 space-y-3">
            <div className="flex justify-between items-center gap-4">
              <span className="font-semibold text-slate-700">Quantidade de números:</span>
              <span className="font-black text-lg text-slate-900">{totalNumbers}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="font-semibold text-slate-700">Valor unitário:</span>
              <span className="font-bold text-slate-900">{formatCurrency(ticketPrice)}</span>
            </div>
            <div className="flex justify-between items-center gap-4 bg-green-50 rounded-lg p-3 border border-green-200">
              <span className="font-black text-slate-900">Total:</span>
              <span className="font-black text-2xl text-green-700">{formatCurrency(totalPrice)}</span>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-slate-600 border-t border-slate-300 pt-4">
            <p>Este comprovante é válido como registro da compra dos números listados acima.</p>
            <p>Guarde este documento para conferência futura.</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 md:p-6 flex flex-wrap gap-2 justify-end print:hidden">
          <button
            onClick={handlePrint}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 font-bold hover:bg-blue-700 transition"
          >
            🖨️ Imprimir / Salvar PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-300 text-slate-900 px-4 py-2 font-bold hover:bg-slate-400 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
