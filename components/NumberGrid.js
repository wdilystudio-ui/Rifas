export default function NumberGrid({
  numbers,
  selectedNumbers,
  setSelectedNumbers,
  loading,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  resultCount,
  searchMessage,
  raffleMaxNumbers,
  purchaseSuggestions = [],
  ticketPrice,
  suggestionLoadingAmount,
  suggestionMessage,
  suggestionProgress = 0,
  suggestionPreviewNumbers = [],
  onPurchaseSuggestion
}) {
  function toggleNumber(item) {
    if (item.status !== "available") return;

    if (selectedNumbers.includes(item.number)) {
      setSelectedNumbers(selectedNumbers.filter((number) => number !== item.number));
    } else {
      setSelectedNumbers([...selectedNumbers, item.number]);
    }
  }

  function getNumberClass(item) {
    const isSelected = selectedNumbers.includes(item.number);

    if (item.status === "paid") {
      return "bg-rose-700 text-white border-rose-800 cursor-not-allowed opacity-95";
    }

    if (item.status === "reserved") {
      return "bg-amber-300 text-slate-950 border-amber-500 cursor-not-allowed font-black";
    }

    if (isSelected) {
      return "bg-emerald-600 text-white border-emerald-800 scale-[1.04] shadow-lg shadow-emerald-900/30 font-black ring-2 ring-emerald-200";
    }

    return "bg-white text-slate-950 border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 active:bg-emerald-100 font-black";
  }

  function getSuggestionQuantity(amount) {
    const safeTicketPrice = Number(ticketPrice);

    if (!Number.isFinite(safeTicketPrice) || safeTicketPrice <= 0) {
      return 0;
    }

    const rawQuantity = amount / safeTicketPrice;
    const roundedQuantity = Math.round(rawQuantity);

    if (Math.abs(rawQuantity - roundedQuantity) < 0.000001) {
      return roundedQuantity;
    }

    return Math.floor(rawQuantity);
  }

  function getFilterButtonClass(filter, activeClass, inactiveClass) {
    const isActive = statusFilter === filter;

    return `rounded-xl px-4 py-2 text-sm font-black border-2 transition-all active:scale-95 ${
      isActive
        ? `${activeClass} scale-105 shadow-lg`
        : `${inactiveClass} hover:scale-105`
    }`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
        <p className="font-semibold text-slate-700">Carregando números...</p>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-3xl p-4 md:p-6 shadow-xl shadow-slate-950/10 border border-slate-200/70">
      <div className="mb-6">
      <h2 className="text-[11px] sm:text-xl font-bold text-slate-800 leading-tight text-center max-w-full">
          🎯 ESCOLHA SEUS NÚMEROS
        </h2>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
          <p className="font-black text-emerald-950">
            Esta rifa possui {Number(raffleMaxNumbers).toLocaleString("pt-BR")} números.
          </p>
        
        </div>


        <div className="rounded-2xl bg-slate-100/90 p-4 border border-slate-200">
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
              🔎
            </span>

            <input
              type="search"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Pesquisar número. Ex: 1 ou 000001"
              className="w-full rounded-xl border-2 border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 font-black outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => onStatusFilterChange("all")}
              className={getFilterButtonClass(
                "all",
                "bg-slate-900 text-white border-slate-900",
                "bg-white text-slate-800 border-slate-400"
              )}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => onStatusFilterChange("available")}
              className={getFilterButtonClass(
                "available",
                "bg-emerald-600 text-white border-emerald-700",
                "bg-emerald-50 text-emerald-800 border-emerald-300"
              )}
            >
              Disponíveis
            </button>

            <button
              type="button"
              onClick={() => onStatusFilterChange("reserved")}
              className={getFilterButtonClass(
                "reserved",
                "bg-amber-500 text-amber-950 border-amber-600",
                "bg-amber-50 text-amber-800 border-amber-300"
              )}
            >
              Reservados
            </button>

            <button
              type="button"
              onClick={() => onStatusFilterChange("paid")}
              className={getFilterButtonClass(
                "paid",
                "bg-red-600 text-white border-red-700",
                "bg-red-50 text-red-800 border-red-300"
              )}
            >
              Pagos
            </button>
          </div>

          {purchaseSuggestions.length > 0 && (
            <div className="mt-5 rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#dcfce7_45%,#f0fdf4_100%)] p-4 md:p-5 shadow-xl shadow-emerald-900/10">
              <div className="mb-4 text-center md:text-left">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Sugestões de compra</p>
                <h3 className="mt-1 text-lg md:text-xl font-black text-emerald-950">Escolha um pacote e deixe o sistema selecionar por você</h3>
                <p className="mt-1 text-xs md:text-sm font-semibold text-emerald-800">
                  A seleção usa apenas números disponíveis e mantém a mesma lista de compra atual.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {purchaseSuggestions.map((amount) => {
                  const quantity = getSuggestionQuantity(amount);
                  const isLoading = suggestionLoadingAmount === amount;
                  const hasAnySuggestionLoading = Boolean(suggestionLoadingAmount);

                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => onPurchaseSuggestion?.(amount)}
                      disabled={hasAnySuggestionLoading}
                      aria-busy={isLoading}
                      className={`raffle-suggestion-button relative overflow-hidden rounded-2xl border px-3 py-4 text-center font-black shadow-lg transition-all duration-300 active:scale-[0.98] disabled:cursor-wait focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-200 touch-manipulation ${
                        isLoading
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-emerald-900/30 scale-[1.03]"
                          : "border-emerald-300 bg-lime-200 text-emerald-950 shadow-emerald-900/15 hover:scale-[1.04] hover:bg-lime-100 hover:shadow-emerald-700/30 disabled:opacity-55"
                      }`}
                      aria-label={`Selecionar pacote de R$ ${amount.toFixed(2).replace(".", ",")}`}
                    >
                      {isLoading && (
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.28)_45%,transparent_70%)] raffle-suggestion-shine" />
                      )}

                      <span className="relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <span className="inline-flex items-center gap-2 text-sm md:text-base leading-tight">
                              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
                              Gerando seus números...
                            </span>
                            <span className="text-[10px] md:text-xs font-black uppercase tracking-wide text-white/85">
                              Aguarde alguns segundos
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block text-xl md:text-2xl leading-none">R$ {amount}</span>
                            <span className="block text-[11px] md:text-xs font-black uppercase tracking-wide text-emerald-800">
                              {quantity > 0 ? `${quantity.toLocaleString("pt-BR")} números` : "Pacote"}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {suggestionLoadingAmount && (
                <div className="mt-4 rounded-3xl border border-emerald-200 bg-white/85 p-4 shadow-inner" role="status" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between gap-3 text-xs md:text-sm font-black text-emerald-950">
                    <span>Selecionando números aleatórios disponíveis</span>
                    <span>{Math.round(suggestionProgress)}%</span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, suggestionProgress))}%` }}
                    />
                  </div>

                  {suggestionPreviewNumbers.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {suggestionPreviewNumbers.map((number, index) => (
                        <span
                          key={`${number}-${index}`}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] md:text-xs font-black text-emerald-800 animate-pulse"
                        >
                          {String(number).padStart(6, "0")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {suggestionMessage && (
                <p className="mt-4 rounded-2xl bg-white/75 px-4 py-3 text-center text-xs md:text-sm font-bold text-emerald-900 border border-emerald-100">
                  {suggestionMessage}
                </p>
              )}
            </div>
          )}

          <p className="text-sm font-bold text-slate-700">
            {Number(resultCount).toLocaleString("pt-BR")} número{resultCount === 1 ? "" : "s"} encontrado
            {resultCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {!numbers.length ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center animate-pulse">
          <p className="font-black text-slate-800">
            {searchMessage || "Nenhum número encontrado."}
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Tente buscar outro número ou alterar o filtro selecionado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(54px,1fr))] sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 touch-manipulation select-none">
          {numbers.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleNumber(item)}
              disabled={item.status !== "available"}
              className={`aspect-square rounded-xl border-2 text-xs md:text-sm transition-all duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 select-none touch-manipulation ${getNumberClass(item)}`}
            >
              {String(item.number).padStart(6, "0")}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
