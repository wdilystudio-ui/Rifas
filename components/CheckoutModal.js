import { useState } from "react";
import { supabase } from "../lib/supabase";
import { checkoutSchema } from "../lib/validation";

export default function CheckoutModal({
  selectedNumbers,
  onClose,
  onSuccess,
  ticketPrice
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "(xx) xxxxxxxxx";
  const total = selectedNumbers.length * ticketPrice;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase não configurado. Confira o arquivo .env.local.");
      return;
    }

    const parsed = checkoutSchema.safeParse({
      name,
      phone,
      selectedNumbers,
      total
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Verifique os dados informados.");
      return;
    }

    try {
      setSending(true);
      setError("");

      const { name: safeName, phone: safePhone, selectedNumbers: safeNumbers } = parsed.data;

      const { data, error: rpcError } = await supabase.rpc("reserve_numbers", {
        p_name: safeName,
        p_phone: safePhone,
        p_numbers: safeNumbers,
        p_total: total
      });

      if (rpcError) throw rpcError;

      if (!data?.success) {
        setError(data?.message || "Não foi possível reservar os números.");
        return;
      }

      const numbersText = safeNumbers
        .map((number) => String(number).padStart(6, "0"))
        .join(", ");

      const message = [
        "Olá! Acabei de reservar meus números na rifa.",
        "",
        `Nome: ${safeName}`,
        `Telefone: ${safePhone}`,
        `Números escolhidos: ${numbersText}`,
        `Total: R$ ${total.toFixed(2).replace(".", ",")}`
      ].join("\n");

      window.open(
        `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
        "_blank"
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Erro ao finalizar reserva. Verifique o Supabase e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 mobile-keyboard-safe">
     <div className="w-full max-w-md max-h-[calc(var(--app-viewport-height,100dvh)-24px)] bg-white rounded-2xl shadow-2xl overflow-y-auto overscroll-contain">
        <div className="bg-gradient-to-r from-emerald-950 to-slate-950 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Finalizar Reserva</h2>
              <p className="text-slate-200 mt-1">Preencha seus dados para continuar.</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 active:scale-95 p-2 rounded-lg transition touch-manipulation"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              Nome Completo *
            </label>
            <input
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              placeholder="Digite seu nome completo"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 80))}
              className="w-full rounded-xl border-2 border-slate-300 p-3 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 focus:bg-white bg-white text-black placeholder:text-slate-400 font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              WhatsApp *
            </label>
            <input
              type="tel"
              inputMode="tel"
              pattern="[0-9()\s+-]*"
              autoComplete="tel"
              enterKeyHint="done"
              placeholder="(xx) xxxxx-xxxx"
              value={phone}
              onChange={(event) => setPhone(event.target.value.slice(0, 20))}
              className="w-full rounded-xl border-2 border-slate-300 p-3 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 focus:bg-white bg-white text-black placeholder:text-slate-400 font-semibold"
            />
          </div>

          <div className="rounded-xl bg-slate-100 p-4 border-l-4 border-emerald-600">
            <p className="text-xs font-bold text-slate-700 uppercase mb-2">📋 Resumo da Reserva</p>
            <p className="font-black text-slate-900 mb-3">
              {selectedNumbers
                .map((number) => String(number).padStart(6, "0"))
                .join(", ")}
            </p>
            <div className="space-y-2 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Quantidade:</span>
                <strong className="text-slate-900">{selectedNumbers.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total:</span>
                <strong className="text-xl text-emerald-700">
                  R$ {total.toFixed(2).replace(".", ",")}
                </strong>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-xs text-emerald-900 font-semibold">
              ℹ️ Ao confirmar, seus números serão reservados e você será redirecionado para o WhatsApp.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-300 text-rose-800 p-3 text-sm font-semibold">
              ❌ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border-2 border-slate-300 p-3 font-bold text-slate-900 hover:bg-slate-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 transition touch-manipulation"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl bg-amber-300 text-slate-950 p-3 font-black hover:bg-amber-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 transition touch-manipulation"
            >
              {sending ? "⏳ Reservando..." : "✓ Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
