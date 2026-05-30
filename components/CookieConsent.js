import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const cookieAccepted = localStorage.getItem("cookie_consent_accepted");

    if (!cookieAccepted) {
      setShowBanner(true);
    }
  }, []);

  function handleAcceptCookies() {
    localStorage.setItem("cookie_consent_accepted", "true");
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-950 text-white border-t border-slate-700 shadow-2xl">
      <div className="max-w-6xl mx-auto p-4 md:p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <p className="text-sm md:text-base leading-relaxed text-slate-100">
          Utilizamos cookies para personalizar conteúdo e anúncios, fornecer
          recursos de mídia social e analisar nosso tráfego. Também
          compartilhamos informações sobre o uso do nosso site com nossos
          parceiros de mídia social, publicidade e análise. Ao clicar em{" "}
          <strong>Continuar</strong>, você concorda com o uso de cookies e nossa{" "}
          <a
            href="/politica-de-privacidade"
            className="underline font-bold text-green-300 hover:text-green-200"
          >
            Política de Privacidade
          </a>
          .
        </p>

        <button
          type="button"
          onClick={handleAcceptCookies}
          className="w-full md:w-auto rounded-xl bg-green-600 hover:bg-green-700 text-white font-black px-6 py-3 transition active:scale-95"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
