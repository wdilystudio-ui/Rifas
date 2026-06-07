export default function Header({ availableCount = 0, totalNumbers = 0, ticketPrice = 0.49, prizeImageUrl = "" }) {
  const title = process.env.NEXT_PUBLIC_RAFFLE_TITLE || "Rifa Digital";
  const prize = process.env.NEXT_PUBLIC_RAFFLE_PRIZE || "R$ 10.000";
  const organizerName = process.env.NEXT_PUBLIC_ORGANIZER_NAME || "João Paulo";
  const formattedTicketPrice = Number(ticketPrice || 0.49).toFixed(2).replace(".", ",");

  return (
    <header className="w-full overflow-hidden rounded-b-[28px] bg-[radial-gradient(circle_at_top,#14532d_0%,#064e3b_38%,#020617_100%)] text-white shadow-2xl shadow-emerald-950/40 mb-5 md:mb-6">
      <div className="px-3.5 md:px-6 py-5 md:py-8 flex flex-col gap-5 md:gap-8">
        <div className="text-center w-full">
          {prizeImageUrl ? (
            <div className="flex justify-center">
              <img
                src={prizeImageUrl}
                alt={`Apresentação do prêmio da ${title}`}
                className="max-h-[330px] md:max-h-[460px] w-full max-w-4xl object-contain rounded-3xl border border-white/20 bg-white/10 shadow-xl shadow-black/25"
              />
            </div>
          ) : (
            <>
              <p className="text-[11px] md:text-sm uppercase tracking-[0.24em] text-emerald-100 font-black">Grande Prêmio</p>
              <h1 className="text-3xl md:text-5xl font-black mt-3 text-white drop-shadow-lg leading-tight">
                {title}
              </h1>

              <div className="flex justify-center mt-4">
                <p className="bg-amber-300 text-slate-950 text-[clamp(2rem,13vw,4.5rem)] md:text-7xl font-black px-4 md:px-6 py-2 md:py-3 rounded-2xl shadow-xl shadow-black/25 inline-block max-w-full whitespace-nowrap">
                  {prize}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-4 w-full">
          <div className="min-h-[74px] bg-white/12 backdrop-blur border border-emerald-200/25 rounded-2xl px-2 py-3 md:p-4 text-center flex flex-col items-center justify-center shadow-lg shadow-black/10">
            <p className="text-emerald-100 text-[10px] min-[390px]:text-xs font-black uppercase tracking-[0.12em] whitespace-nowrap">Organizador</p>
            <p className="text-white font-black text-[13px] min-[390px]:text-sm md:text-lg mt-1.5 leading-tight whitespace-nowrap max-w-full overflow-hidden text-ellipsis">{organizerName}</p>
          </div>
          <div className="min-h-[74px] bg-white/12 backdrop-blur border border-emerald-200/25 rounded-2xl px-2 py-3 md:p-4 text-center flex flex-col items-center justify-center shadow-lg shadow-black/10">
            <p className="text-emerald-100 text-[10px] min-[390px]:text-xs font-black uppercase tracking-[0.12em] whitespace-nowrap">Disponíveis</p>
            <p className="text-white font-black text-[13px] min-[390px]:text-sm md:text-lg mt-1.5 leading-tight whitespace-nowrap">{availableCount.toLocaleString('pt-BR')}</p>
          </div>
          <div className="min-h-[74px] bg-white/12 backdrop-blur border border-emerald-200/25 rounded-2xl px-2 py-3 md:p-4 text-center flex flex-col items-center justify-center shadow-lg shadow-black/10">
            <p className="text-emerald-100 text-[10px] min-[390px]:text-xs font-black uppercase tracking-[0.12em] whitespace-nowrap">Por Número</p>
            <p className="text-white font-black text-[13px] min-[390px]:text-sm md:text-lg mt-1.5 leading-tight whitespace-nowrap">R$ {formattedTicketPrice}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
