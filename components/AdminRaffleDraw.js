import { useEffect, useMemo, useRef, useState } from "react";

const DRAW_DURATION_SECONDS = 10;
const CELEBRATION_DURATION_MS = 25000;

function formatNumber(number) {
  return String(number || "").padStart(6, "0");
}

function buildVisualNumbers(finalNumber) {
  const numbers = [];

  for (let index = 0; index < 42; index += 1) {
    numbers.push(Math.floor(Math.random() * 100000) + 1);
  }

  if (finalNumber) {
    numbers[numbers.length - 1] = finalNumber;
  }

  return numbers;
}

function ConfettiLayer({ active }) {
  const particles = useMemo(() => {
    return Array.from({ length: 90 }, (_, index) => ({
      id: index,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.8}s`,
      duration: `${2.5 + Math.random() * 3.5}s`,
      size: `${8 + Math.random() * 10}px`,
      rotate: `${Math.random() * 360}deg`
    }));
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

      {particles.map((particle) => (
        <span
          key={particle.id}
          className="raffle-confetti-particle"
          style={{
            left: particle.left,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            width: particle.size,
            height: particle.size,
            transform: `rotate(${particle.rotate})`
          }}
        />
      ))}

      <span className="raffle-firework raffle-firework-one" />
      <span className="raffle-firework raffle-firework-two" />
      <span className="raffle-firework raffle-firework-three" />
    </div>
  );
}

export default function AdminRaffleDraw() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [countdown, setCountdown] = useState(DRAW_DURATION_SECONDS);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState("");
  const [visualNumbers, setVisualNumbers] = useState(() => buildVisualNumbers());
  const [celebrating, setCelebrating] = useState(false);
  const countdownIntervalRef = useRef(null);
  const rouletteIntervalRef = useRef(null);
  const celebrationTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      window.clearInterval(countdownIntervalRef.current);
      window.clearInterval(rouletteIntervalRef.current);
      window.clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  function stopTimers() {
    window.clearInterval(countdownIntervalRef.current);
    window.clearInterval(rouletteIntervalRef.current);
    window.clearTimeout(celebrationTimeoutRef.current);
  }

  function startRoulette(finalNumber) {
    let speed = 70;
    let elapsed = 0;

    function spin() {
      setVisualNumbers(buildVisualNumbers(finalNumber));

      elapsed += speed;

      if (elapsed >= 7000) speed = 150;
      if (elapsed >= 8200) speed = 260;
      if (elapsed >= 9200) speed = 420;

      window.clearInterval(rouletteIntervalRef.current);

      rouletteIntervalRef.current = window.setInterval(() => {
        if (elapsed >= 9800) {
          window.clearInterval(rouletteIntervalRef.current);
          setVisualNumbers(buildVisualNumbers(finalNumber));
          return;
        }

        spin();
      }, speed);
    }

    spin();
  }

  async function handleDraw() {
    const confirmDraw = window.confirm(
      "Deseja realizar o sorteio agora? Apenas números pagos participarão."
    );

    if (!confirmDraw) return;

    stopTimers();

    setIsDrawing(true);
    setError("");
    setWinner(null);
    setCelebrating(false);
    setCountdown(DRAW_DURATION_SECONDS);
    setVisualNumbers(buildVisualNumbers());

    let drawPayload = null;

    try {
      const response = await fetch("/api/admin/draw-raffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Erro ao realizar o sorteio.");
      }

      drawPayload = payload.draw;
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao realizar o sorteio.");
      setIsDrawing(false);
      return;
    }

    startRoulette(drawPayload.winningNumber);

    const startedAt = Date.now();

    countdownIntervalRef.current = window.setInterval(() => {
      const diff = Date.now() - startedAt;
      const remaining = Math.max(
        0,
        DRAW_DURATION_SECONDS - Math.ceil(diff / 1000)
      );

      setCountdown(remaining);

      if (diff >= DRAW_DURATION_SECONDS * 1000) {
        window.clearInterval(countdownIntervalRef.current);
        window.clearInterval(rouletteIntervalRef.current);

        setCountdown(0);
        setVisualNumbers(buildVisualNumbers(drawPayload.winningNumber));
        setWinner(drawPayload);
        setIsDrawing(false);
        setCelebrating(true);

        celebrationTimeoutRef.current = window.setTimeout(() => {
          setCelebrating(false);
        }, CELEBRATION_DURATION_MS);
      }
    }, 200);
  }

  return (
    <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 rounded-3xl p-5 md:p-7 shadow-2xl mb-6 overflow-hidden border border-amber-400/20">
      <ConfettiLayer active={celebrating} />

      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-yellow-300/10 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300 font-black">
              Ferramenta VIP
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-2">
              🎰 Sorteio de Rifa
            </h2>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Realize o sorteio de forma segura. O vencedor é escolhido no servidor entre os números pagos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDraw}
            disabled={isDrawing}
            className="rounded-2xl bg-amber-400 text-slate-950 px-6 py-4 font-black text-lg shadow-xl hover:bg-amber-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDrawing ? "Sorteando..." : "🚀 Iniciar Sorteio"}
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/15 text-red-100 px-4 py-3 font-bold">
            ❌ {error}
          </div>
        )}

        {(isDrawing || winner) && (
          <div className="mt-7 rounded-3xl bg-white/10 border border-white/10 p-5 md:p-7 backdrop-blur">
            <div className="text-center">
              <p className="text-slate-300 uppercase tracking-[0.35em] text-xs font-black">
                Contagem regressiva
              </p>

              <div className="mt-3 text-7xl md:text-8xl font-black text-amber-300 drop-shadow-lg">
                {countdown}
              </div>

              <p className="text-slate-300 font-bold">
                {isDrawing ? "Preparando o grande resultado..." : "Resultado finalizado"}
              </p>
            </div>

            <div className="mt-7 overflow-hidden rounded-3xl border border-amber-300/30 bg-slate-950/80 p-4">
              <div
                className={`flex gap-3 ${
                  isDrawing ? "raffle-roulette-moving" : "justify-center"
                }`}
              >
                {visualNumbers.map((number, index) => {
                  const isFinal = winner && index === visualNumbers.length - 1;

                  return (
                    <div
                      key={`${number}-${index}`}
                      className={`shrink-0 rounded-2xl px-5 py-4 text-center font-black shadow-lg border ${
                        isFinal
                          ? "bg-amber-300 text-slate-950 border-white scale-110"
                          : "bg-white text-slate-900 border-white/40"
                      }`}
                    >
                      <span className="block text-xs uppercase tracking-widest opacity-70">
                        Número
                      </span>
                      <strong className="text-2xl md:text-3xl">
                        {formatNumber(number)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {winner && (
          <div className="mt-7 rounded-[2rem] border border-amber-300/40 bg-gradient-to-br from-white via-amber-50 to-yellow-100 p-6 md:p-8 text-center shadow-2xl">
            <p className="text-sm uppercase tracking-[0.4em] text-amber-700 font-black">
              🏆 O grande ganhador
            </p>

            <h3 className="mt-4 text-4xl md:text-6xl font-black text-slate-950 break-words">
              {winner.winnerName}
            </h3>

            <div className="mt-6 inline-flex flex-col rounded-3xl bg-slate-950 text-white px-8 py-6 shadow-2xl border-4 border-amber-300">
              <span className="text-xs uppercase tracking-[0.35em] text-amber-300 font-black">
                Número sorteado
              </span>
              <strong className="text-5xl md:text-7xl font-black mt-2">
                {formatNumber(winner.winningNumber)}
              </strong>
            </div>

            {winner.winnerPhone && (
              <p className="mt-5 text-slate-700 font-bold">
                Telefone: {winner.winnerPhone}
              </p>
            )}

            <p className="mt-4 text-slate-600 text-sm font-semibold">
              Sorteio registrado com segurança no banco de dados.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
