import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Header from "../components/Header";
import NumberGrid from "../components/NumberGrid";
import CheckoutModal from "../components/CheckoutModal";

const PAGE_SIZE = 1000;
const DEFAULT_RAFFLE_MAX_NUMBERS = 100000;
const DEFAULT_TICKET_PRICE = 0.49;
const PURCHASE_SUGGESTIONS = [49, 98, 147, 196];
const AVAILABLE_NUMBERS_BATCH_SIZE = 1000;

function normalizeNumberSearch(value) {
  const onlyNumbers = String(value || "").replace(/\D/g, "");
  if (!onlyNumbers) return "";
  return String(Number(onlyNumbers));
}

export default function Home() {
  const [numbers, setNumbers] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [raffleMaxNumbers, setRaffleMaxNumbers] = useState(DEFAULT_RAFFLE_MAX_NUMBERS);
  const [ticketPrice, setTicketPrice] = useState(DEFAULT_TICKET_PRICE);
  const [prizeImageUrl, setPrizeImageUrl] = useState("");
  const [resultCount, setResultCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchMessage, setSearchMessage] = useState("");
  const [suggestionLoadingAmount, setSuggestionLoadingAmount] = useState(null);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [suggestionProgress, setSuggestionProgress] = useState(0);
  const [suggestionPreviewNumbers, setSuggestionPreviewNumbers] = useState([]);
  const selectionRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));

  const selectedTotal = useMemo(() => {
    return selectedNumbers.length * ticketPrice;
  }, [selectedNumbers, ticketPrice]);

  async function fetchSettings() {
    try {
      setSettingsLoading(true);

      const response = await fetch("/api/settings", {
        method: "GET",
        credentials: "same-origin"
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao carregar configuração da rifa.");

      const nextLimit = Number(payload.raffleMaxNumbers || DEFAULT_RAFFLE_MAX_NUMBERS);
      const nextTicketPrice = Number(payload.ticketPrice || DEFAULT_TICKET_PRICE);
      setRaffleMaxNumbers(nextLimit);
      setTicketPrice(Number.isFinite(nextTicketPrice) && nextTicketPrice > 0 ? nextTicketPrice : DEFAULT_TICKET_PRICE);
      setPrizeImageUrl(payload.prizeImageUrl || "");
      return nextLimit;
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao carregar configuração da rifa.");
      return DEFAULT_RAFFLE_MAX_NUMBERS;
    } finally {
      setSettingsLoading(false);
    }
  }

  async function fetchAvailableCount(limit = raffleMaxNumbers) {
    if (!supabase || !isSupabaseConfigured) return;

    const { count, error: countError } = await supabase
      .from("raffle_numbers")
      .select("id", { count: "exact", head: true })
      .eq("status", "available")
      .lte("number", limit);

    if (!countError) {
      setAvailableCount(count || 0);
    }
  }

  async function fetchNumbers(currentPage = page, limit = raffleMaxNumbers) {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      setError(
        "Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    setLoading(true);
    setError("");
    setSearchMessage("");

    const normalizedSearch = normalizeNumberSearch(searchTerm);
    const searchedNumber = normalizedSearch ? Number(normalizedSearch) : null;

    if (searchedNumber && (searchedNumber < 1 || searchedNumber > limit)) {
      setNumbers([]);
      setResultCount(0);
      setSelectedNumbers((currentSelected) =>
        currentSelected.filter((selectedNumber) => selectedNumber <= limit)
      );
      setSearchMessage("Número não disponível nesta rifa.");
      setLoading(false);
      await fetchAvailableCount(limit);
      return;
    }

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("raffle_numbers")
      .select("id, number, status, reserved_by, reserved_at", { count: "exact" })
      .order("number", { ascending: true })
      .lte("number", limit);

    if (searchedNumber) {
      query = query.eq("number", searchedNumber);
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, count, error: fetchError } = await query.range(from, to);

    if (fetchError) {
      console.error(fetchError);
      setError(
        `Erro ao carregar números: ${fetchError.message}. Verifique as permissões da tabela raffle_numbers no Supabase.`
      );
      setLoading(false);
      return;
    }

    const visibleNumbers = data || [];

    setResultCount(count || 0);
    setNumbers(visibleNumbers);
    setSelectedNumbers((currentSelected) => {
      const visibleUnavailableNumbers = new Set(
        visibleNumbers
          .filter((item) => item.status !== "available")
          .map((item) => item.number)
      );

      return currentSelected.filter(
        (selectedNumber) => selectedNumber <= limit && !visibleUnavailableNumbers.has(selectedNumber)
      );
    });

    if (searchedNumber && !visibleNumbers.length) {
      setSearchMessage("Nenhum número encontrado.");
    }

    setLoading(false);
    await fetchAvailableCount(limit);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const limit = await fetchSettings();
      if (cancelled) return;
      await fetchNumbers(0, limit);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (settingsLoading) return undefined;

    fetchNumbers(page, raffleMaxNumbers);

    if (!isSupabaseConfigured || !supabase) return undefined;

    const channel = supabase
      .channel(`raffle-numbers-page-${page}-limit-${raffleMaxNumbers}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raffle_numbers"
        },
        () => {
          fetchSettings().then((limit) => fetchNumbers(page, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, raffleMaxNumbers, searchTerm, statusFilter, settingsLoading]);

  function handleSearchChange(value) {
    setSearchTerm(value);
    setPage(0);
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(0);
  }

  function shuffleNumbers(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
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

  function createSuggestionPreviewNumbers(limit = raffleMaxNumbers) {
    const safeLimit = Math.max(1, Number(limit) || DEFAULT_RAFFLE_MAX_NUMBERS);

    return Array.from({ length: 12 }, () => Math.floor(Math.random() * safeLimit) + 1);
  }

  async function handlePurchaseSuggestion(amount) {
    if (suggestionLoadingAmount) return;

    if (!supabase || !isSupabaseConfigured) {
      setSuggestionMessage("Supabase não configurado para selecionar números automaticamente.");
      return;
    }

    const quantity = getSuggestionQuantity(amount);

    if (quantity < 1) {
      setSuggestionMessage("O valor deste pacote é menor que o valor atual de cada número.");
      return;
    }

    let progressInterval = null;

    try {
      setSuggestionLoadingAmount(amount);
      setSuggestionMessage("Gerando seus números...");
      setSuggestionProgress(8);
      setSuggestionPreviewNumbers(createSuggestionPreviewNumbers());

      progressInterval = window.setInterval(() => {
        setSuggestionProgress((currentProgress) => {
          if (currentProgress >= 92) return currentProgress;
          return Math.min(92, currentProgress + Math.floor(Math.random() * 10) + 4);
        });
        setSuggestionPreviewNumbers(createSuggestionPreviewNumbers());
      }, 450);

      const { count, error: countError } = await supabase
        .from("raffle_numbers")
        .select("id", { count: "exact", head: true })
        .eq("status", "available")
        .lte("number", raffleMaxNumbers);

      if (countError) throw countError;

      const availableTotal = count || 0;

      if (availableTotal < quantity) {
        setSuggestionMessage(
          `Existem apenas ${availableTotal.toLocaleString("pt-BR")} números disponíveis para este pacote.`
        );
        return;
      }

      const availableNumbers = [];

      for (let from = 0; from < availableTotal; from += AVAILABLE_NUMBERS_BATCH_SIZE) {
        const to = Math.min(from + AVAILABLE_NUMBERS_BATCH_SIZE - 1, availableTotal - 1);
        const { data, error: batchError } = await supabase
          .from("raffle_numbers")
          .select("number")
          .eq("status", "available")
          .lte("number", raffleMaxNumbers)
          .order("number", { ascending: true })
          .range(from, to);

        if (batchError) throw batchError;

        availableNumbers.push(...(data || []).map((item) => item.number));
      }

      const randomSelection = shuffleNumbers(availableNumbers).slice(0, quantity);
      setSuggestionProgress(100);
      setSuggestionPreviewNumbers(randomSelection.slice(0, 12));
      setSelectedNumbers(randomSelection);
      setSuggestionMessage(
        `${quantity.toLocaleString("pt-BR")} números aleatórios foram selecionados para o pacote de R$ ${amount.toFixed(2).replace(".", ",")}.`
      );
      selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error(err);
      setSuggestionMessage("Não foi possível selecionar números aleatórios agora. Tente novamente.");
    } finally {
      if (progressInterval) window.clearInterval(progressInterval);
      setSuggestionProgress((currentProgress) => (currentProgress > 0 ? 100 : currentProgress));
      window.setTimeout(() => {
        setSuggestionLoadingAmount(null);
        setSuggestionProgress(0);
        setSuggestionPreviewNumbers([]);
      }, 350);
    }
  }

  function handleSuccess() {
    setSelectedNumbers([]);
    fetchNumbers(page, raffleMaxNumbers);
  }

  function goToPreviousPage() {
    setPage((prev) => Math.max(prev - 1, 0));
  }

  function goToNextPage() {
    setPage((prev) => Math.min(prev + 1, totalPages - 1));
  }

  function scrollToSelection() {
    selectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  const startNumber = resultCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const endNumber = Math.min(startNumber + numbers.length - 1, resultCount);

  return (
    <main className="min-h-[100svh] bg-[linear-gradient(180deg,#020617_0%,#052e2b_48%,#020617_100%)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Header availableCount={availableCount} totalNumbers={raffleMaxNumbers} ticketPrice={ticketPrice} prizeImageUrl={prizeImageUrl} />

        {error && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl p-4 mb-5 font-semibold text-center shadow">
            ⚠️ {error}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 md:gap-8">
          <div>
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-950/10 border border-slate-200/70 p-4 md:p-5 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-center md:text-left">
              <div>
                <p className="text-sm text-slate-600">Mostrando resultados</p>
                <strong className="text-lg text-slate-900">
                  {startNumber} até {endNumber}
                </strong>

                <p className="text-xs text-slate-600 mt-1">
                  Página {page + 1} de {totalPages} · Limite da rifa: {Number(raffleMaxNumbers).toLocaleString("pt-BR")}
                </p>
              </div>

              <div className="flex gap-2 justify-center md:justify-start">
                <button
                  onClick={goToPreviousPage}
                  disabled={page === 0 || loading}
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 font-black disabled:opacity-40 hover:bg-slate-800 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 transition text-sm md:text-base touch-manipulation"
                >
                  Anterior
                </button>

                <button
                  onClick={goToNextPage}
                  disabled={page >= totalPages - 1 || loading}
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 font-black disabled:opacity-40 hover:bg-slate-800 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 transition text-sm md:text-base touch-manipulation"
                >
                  Próxima
                </button>
              </div>
            </div>

            <NumberGrid
              numbers={numbers}
              selectedNumbers={selectedNumbers}
              setSelectedNumbers={setSelectedNumbers}
              loading={loading || settingsLoading}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              resultCount={resultCount}
              searchMessage={searchMessage}
              raffleMaxNumbers={raffleMaxNumbers}
              purchaseSuggestions={PURCHASE_SUGGESTIONS}
              ticketPrice={ticketPrice}
              suggestionLoadingAmount={suggestionLoadingAmount}
              suggestionMessage={suggestionMessage}
              suggestionProgress={suggestionProgress}
              suggestionPreviewNumbers={suggestionPreviewNumbers}
              onPurchaseSuggestion={handlePurchaseSuggestion}
            />
          </div>

          <aside
            ref={selectionRef}
            className="bg-white rounded-3xl p-5 md:p-6 shadow-2xl shadow-slate-950/20 border border-slate-200/70 h-fit sticky top-4 scroll-mt-24 lg:top-6"
          >
            <h2 className="text-2xl md:text-3xl font-black mb-3 text-center lg:text-left text-slate-950">Sua Seleção</h2>

            <p className="text-slate-700 mb-4 text-center lg:text-left text-sm md:text-base">
              Escolha seus números disponíveis para continuar.
            </p>

            <div className="rounded-2xl bg-slate-100 p-4 md:p-5 mb-4 border border-slate-200">
              <p className="text-sm text-slate-700">Quantidade</p>
              <strong className="text-3xl md:text-4xl block text-slate-950">{selectedNumbers.length}</strong>

              <p className="text-sm text-slate-700 mt-4">Total</p>
              <strong className="text-3xl md:text-4xl text-emerald-700 block">
                R$ {selectedTotal.toFixed(2).replace(".", ",")}
              </strong>
            </div>

            {selectedNumbers.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-bold text-slate-700 mb-2 text-center lg:text-left">
                  Números Selecionados:
                </p>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto justify-center lg:justify-start">
                  {selectedNumbers.map((number) => (
                    <span
                      key={number}
                      className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-black text-xs md:text-sm select-none"
                    >
                      {String(number).padStart(6, "0")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowCheckout(true)}
              disabled={!selectedNumbers.length}
              className="w-full rounded-2xl bg-amber-300 text-slate-950 p-4 md:p-5 font-black text-base md:text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 shadow-xl shadow-amber-950/20 transition mb-4 touch-manipulation"
            >
              Comprar Números
            </button>

            <a
              href="/admin"
              className="block text-center lg:text-left text-xs md:text-sm text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 rounded-lg mt-4 underline"
            >
              informações
            </a>
            <a
              href="/politica-de-privacidade"
              className="block text-center lg:text-left text-xs md:text-sm text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 rounded-lg mt-4 underline"
            >
              Política de Privacidade
            </a>
          </aside>
        </section>
      </div>

      {selectedNumbers.length > 0 && (
        <button
          type="button"
          onClick={scrollToSelection}
          className="fixed bottom-5 right-5 z-50 rounded-full bg-amber-300 text-slate-950 px-6 py-4 font-black shadow-2xl shadow-slate-950/30 hover:bg-amber-200 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 transition lg:hidden text-sm md:text-base touch-manipulation"
          aria-label="Ir para finalizar seleção"
        >
          Finalizar
        </button>
      )}

      {showCheckout && (
        <CheckoutModal
          selectedNumbers={selectedNumbers}
          ticketPrice={ticketPrice}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  );
}
