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
  raffleMaxNumbers
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
        <h2 className="text-xl font-black text-slate-950 mb-3 flex items-center gap-2">
          🎯 ESCOLHA SEUS NÚMEROS
        </h2>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
          <p className="font-black text-emerald-950">
            Esta rifa possui {Number(raffleMaxNumbers).toLocaleString("pt-BR")} números disponíveis.
          </p>
          <p className="text-xs text-emerald-800 mt-1">
            A pesquisa, os filtros e a paginação respeitam esse limite configurado pelo administrador.
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
