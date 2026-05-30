import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminTable from "../components/AdminTable";
import AdminRaffleDraw from "../components/AdminRaffleDraw";

const passwordHelp = "Mínimo de 10 caracteres, com letra maiúscula, minúscula, número e símbolo.";
function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
export default function Admin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [adminSearch, setAdminSearch] = useState("");
const debouncedAdminSearch = useDebounce(adminSearch, 400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [raffleMaxNumbers, setRaffleMaxNumbers] = useState(100000);
  const [ticketPriceInput, setTicketPriceInput] = useState("0,49");
  const [prizeImageUrl, setPrizeImageUrl] = useState("");
  const [prizeImageFile, setPrizeImageFile] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPrizeImage, setSavingPrizeImage] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [prizeImageMessage, setPrizeImageMessage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [resetEmail, setResetEmail] = useState("w.dilystudio@gmail.com");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [changePassword, setChangePassword] = useState("");
  const [changePasswordConfirm, setChangePasswordConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const token = router.query.resetToken;
    if (typeof token === "string" && token.length > 20) {
      setResetToken(token);
      setAuthMode("reset");
    }
  }, [router.isReady, router.query.resetToken]);

  async function fetchSettings() {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "GET",
        credentials: "same-origin"
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao carregar configuração.");

      setRaffleMaxNumbers(payload.raffleMaxNumbers || 100000);
      setTicketPriceInput(String(payload.ticketPrice || 0.49).replace(".", ","));
      setPrizeImageUrl(payload.prizeImageUrl || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao carregar configuração da rifa.");
    }
  }

  async function saveSettings(nextLimit = raffleMaxNumbers) {
    setSavingSettings(true);
    setSettingsMessage("");

    const normalizedTicketPrice = Number(String(ticketPriceInput).replace(",", "."));

    if (!Number.isFinite(normalizedTicketPrice) || normalizedTicketPrice <= 0) {
      setSavingSettings(false);
      setSettingsMessage("❌ Informe um valor do número maior que zero.");
      return;
    }

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          raffleMaxNumbers: Number(nextLimit),
          ticketPrice: normalizedTicketPrice
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao salvar configuração.");

      setRaffleMaxNumbers(payload.raffleMaxNumbers);
      setTicketPriceInput(String(payload.ticketPrice).replace(".", ","));
      setSettingsMessage(`✅ Configuração salva: ${Number(payload.raffleMaxNumbers).toLocaleString("pt-BR")} números e valor unitário de R$ ${Number(payload.ticketPrice).toFixed(2).replace(".", ",")}.`);
      fetchReservations();
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao salvar configuração da rifa.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function fetchReservations() {
    setLoading(true);
    setError("");

    try {
      const searchParams = new URLSearchParams();

if (debouncedAdminSearch.trim()) {
  searchParams.set("search", debouncedAdminSearch.trim());
}

const response = await fetch(`/api/admin/reservations?${searchParams.toString()}`, {
  method: "GET",
  credentials: "same-origin"
});

      if (response.status === 401) {
        setAuthenticated(false);
        setReservations([]);
        setError("Sessão expirada. Entre novamente.");
        return;
      }

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao carregar reservas.");

      setReservations(payload.reservations || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao carregar reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (!authenticated) return undefined;

  fetchSettings();
  fetchReservations();
  const interval = window.setInterval(fetchReservations, 15000);

  return () => window.clearInterval(interval);
}, [authenticated, debouncedAdminSearch]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setInfoMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Senha incorreta.");

      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Senha incorreta.");
    }
  }

  async function handleRequestReset(event) {
    event.preventDefault();
    setError("");
    setInfoMessage("");

    try {
      const response = await fetch("/api/admin/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: resetEmail })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao solicitar recuperação.");

      setInfoMessage(payload.message || "Verifique seu e-mail para redefinir a senha.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao solicitar recuperação.");
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");
    setInfoMessage("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: resetToken, password: newPassword })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao redefinir senha.");

      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      setAuthMode("login");
      setInfoMessage("Senha redefinida com sucesso. Entre usando a nova senha.");
      router.replace("/admin", undefined, { shallow: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao redefinir senha.");
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setPasswordMessage("");

    if (changePassword !== changePasswordConfirm) {
      setPasswordMessage("As novas senhas não conferem.");
      return;
    }

    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currentPassword, newPassword: changePassword })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao alterar senha.");

      setCurrentPassword("");
      setChangePassword("");
      setChangePasswordConfirm("");
      setPasswordMessage("✅ Senha alterada com segurança.");
    } catch (err) {
      console.error(err);
      setPasswordMessage(err.message || "Erro ao alterar senha.");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin"
      });
    } finally {
      setAuthenticated(false);
      setReservations([]);
    }
  }


  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function savePrizeImage(event) {
    event.preventDefault();
    setPrizeImageMessage("");

    if (!prizeImageFile) {
      setPrizeImageMessage("❌ Selecione uma imagem antes de salvar.");
      return;
    }

    if (!prizeImageFile.type.startsWith("image/")) {
      setPrizeImageMessage("❌ Envie apenas arquivo de imagem JPG, PNG ou WEBP.");
      return;
    }

    if (prizeImageFile.size < 200 * 1024) {
      setPrizeImageMessage("❌ A imagem precisa ter no mínimo 200 KB.");
      return;
    }

    if (prizeImageFile.size > 5 * 1024 * 1024) {
      setPrizeImageMessage("❌ A imagem deve ter no máximo 5 MB.");
      return;
    }

    try {
      setSavingPrizeImage(true);
      const base64 = await fileToBase64(prizeImageFile);

      const response = await fetch("/api/admin/prize-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fileName: prizeImageFile.name,
          mimeType: prizeImageFile.type,
          size: prizeImageFile.size,
          base64
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Erro ao salvar imagem do prêmio.");

      setPrizeImageUrl(payload.prizeImageUrl || "");
      setPrizeImageFile(null);
      setPrizeImageMessage("✅ Imagem do prêmio salva com sucesso.");
    } catch (err) {
      console.error(err);
      setPrizeImageMessage(err.message || "Erro ao salvar imagem do prêmio.");
    } finally {
      setSavingPrizeImage(false);
    }
  }

  async function adminAction(endpoint, item, failureMessage) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        reservationId: item.id,
        numberId: item.raffle_numbers.id
      })
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || failureMessage);
  }

  async function markAsPaid(item) {
    if (!item.raffle_numbers?.id) return;

    try {
      await adminAction("/api/admin/mark-paid", item, "Erro ao marcar reserva como paga.");
      fetchReservations();
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao marcar reserva como paga.");
    }
  }

  async function refundPaidClient(item) {
    if (!item.id || item.status !== "paid") return;

    const confirmRefund = window.confirm(
      "Tem certeza que deseja apagar este cliente pagante? Esta ação irá liberar novamente os números comprados para outras pessoas."
    );
    if (!confirmRefund) return;

    try {
      await adminAction("/api/admin/refund-paid", item, "Erro ao apagar cliente pagante.");
      fetchReservations();
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao apagar cliente pagante.");
    }
  }

  async function releaseReservation(item) {
    if (!item.raffle_numbers?.id) return;

    const confirmRelease = window.confirm("Deseja liberar este número novamente?");
    if (!confirmRelease) return;

    try {
      await adminAction("/api/admin/release", item, "Erro ao liberar reserva.");
      fetchReservations();
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao liberar reserva.");
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">🔐 Painel Admin</h1>
          <p className="text-slate-700 mb-6">Acesse com senha segura ou recupere o acesso pelo e-mail autorizado.</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-300 text-red-800 p-3 text-sm font-semibold">
              ❌ {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-300 text-green-800 p-3 text-sm font-semibold">
              ✅ {infoMessage}
            </div>
          )}

          {authMode === "login" && (
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="Senha do admin"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 mb-4 font-semibold"
                autoComplete="current-password"
              />

              <button className="w-full rounded-lg bg-slate-900 text-white p-3 font-bold hover:bg-slate-800 transition mb-3">
                🔓 Entrar
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("forgot");
                  setError("");
                  setInfoMessage("");
                }}
                className="w-full rounded-lg border-2 border-slate-200 text-slate-800 p-3 font-bold hover:bg-slate-50 transition mb-4"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {authMode === "forgot" && (
            <form onSubmit={handleRequestReset}>
              <label className="block text-sm font-black text-slate-800 mb-2">E-mail administrativo</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 mb-4 font-semibold"
                autoComplete="email"
              />

              <button className="w-full rounded-lg bg-slate-900 text-white p-3 font-bold hover:bg-slate-800 transition mb-3">
                Enviar link de recuperação
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                  setInfoMessage("");
                }}
                className="w-full rounded-lg border-2 border-slate-200 text-slate-800 p-3 font-bold hover:bg-slate-50 transition mb-4"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {authMode === "reset" && (
            <form onSubmit={handleResetPassword}>
              <p className="text-sm text-slate-700 mb-4">Crie uma nova senha para o painel. {passwordHelp}</p>

              <input
                type="password"
                placeholder="Nova senha forte"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 mb-3 font-semibold"
                autoComplete="new-password"
              />

              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 mb-4 font-semibold"
                autoComplete="new-password"
              />

              <button className="w-full rounded-lg bg-slate-900 text-white p-3 font-bold hover:bg-slate-800 transition mb-3">
                Redefinir senha
              </button>

              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="w-full rounded-lg border-2 border-slate-200 text-slate-800 p-3 font-bold hover:bg-slate-50 transition mb-4"
              >
                Voltar ao login
              </button>
            </form>
          )}

          <a href="/" className="block text-center text-slate-700 hover:text-slate-900 font-semibold transition">
            ← Voltar para a rifa
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-4xl font-black text-white">📊 Painel Admin</h1>
            <p className="text-slate-300">Gerencie reservas, pagamentos, segurança e números disponíveis.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={fetchReservations} className="rounded-lg bg-green-600 text-white px-4 py-3 font-bold hover:bg-green-700 transition">
              🔄 Atualizar
            </button>
            <button onClick={handleLogout} className="rounded-lg bg-red-600 text-white px-4 py-3 font-bold hover:bg-red-700 transition">
              Sair
            </button>
            <a href="/" className="rounded-lg bg-white text-slate-900 px-4 py-3 font-bold hover:bg-slate-100 transition text-center">
              ← Ver rifa
            </a>
          </div>
        </div>
    <AdminRaffleDraw />

        <section className="bg-white rounded-3xl p-5 md:p-6 shadow-xl mb-6">
          <h2 className="text-2xl font-black text-slate-900">🛡️ Segurança da senha</h2>
          <p className="text-slate-700 mt-1 mb-4">Altere a senha do administrador com hash seguro. {passwordHelp}</p>

          <form onSubmit={handleChangePassword} className="grid gap-3 md:grid-cols-3">
            <input type="password" placeholder="Senha atual" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 font-semibold" autoComplete="current-password" />
            <input type="password" placeholder="Nova senha forte" value={changePassword} onChange={(event) => setChangePassword(event.target.value)} className="rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 font-semibold" autoComplete="new-password" />
            <input type="password" placeholder="Confirmar nova senha" value={changePasswordConfirm} onChange={(event) => setChangePasswordConfirm(event.target.value)} className="rounded-lg border-2 border-slate-300 p-3 outline-none focus:border-slate-900 font-semibold" autoComplete="new-password" />
            <button className="md:col-span-1 rounded-xl bg-slate-900 text-white px-5 py-3 font-black hover:bg-slate-800 transition">Salvar nova senha</button>
            {passwordMessage && <p className="md:col-span-2 text-sm font-bold text-slate-800 bg-slate-100 rounded-xl px-4 py-3">{passwordMessage}</p>}
          </form>
        </section>

        <section className="bg-white rounded-3xl p-5 md:p-6 shadow-xl mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">🎚️ Quantidade da Rifa</h2>
              <p className="text-slate-700 mt-1">Defina quantos números ficarão disponíveis e visíveis para os participantes.</p>
            </div>

            <div className="rounded-2xl bg-slate-900 text-white px-5 py-4 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-200 font-bold">Limite atual</p>
              <strong className="text-3xl md:text-4xl font-black">{Number(raffleMaxNumbers).toLocaleString("pt-BR")}</strong>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-black text-slate-800 mb-3">
              Esta rifa possui {Number(raffleMaxNumbers).toLocaleString("pt-BR")} números disponíveis.
            </label>

            <input
              type="range"
              min="100"
              max="100000"
              step="100"
              value={raffleMaxNumbers}
              onChange={(event) => {
                setRaffleMaxNumbers(Number(event.target.value));
                setSettingsMessage("");
              }}
              onMouseUp={(event) => saveSettings(event.currentTarget.value)}
              onTouchEnd={(event) => saveSettings(event.currentTarget.value)}
              className="w-full accent-green-600 cursor-pointer"
            />

            <div className="flex justify-between text-xs md:text-sm font-bold text-slate-700 mt-2">
              <span>100</span>
              <span>100.000</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
              <div>
                <label className="block text-sm font-black text-slate-800 mb-2">Valor por número</label>
                <div className="flex items-center rounded-xl border-2 border-slate-300 bg-white overflow-hidden focus-within:border-slate-900">
                  <span className="px-3 py-3 bg-slate-100 text-slate-700 font-black border-r border-slate-200">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ticketPriceInput}
                    onChange={(event) => {
                      setTicketPriceInput(event.target.value.replace(/[^0-9,.]/g, ""));
                      setSettingsMessage("");
                    }}
                    placeholder="0,49"
                    className="w-full p-3 outline-none font-black text-slate-900"
                  />
                </div>
                <p className="text-xs text-slate-600 mt-2">Use valores como 0,49, 1,00 ou 2,50.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <button type="button" onClick={() => saveSettings()} disabled={savingSettings} className="rounded-xl bg-green-600 text-white px-5 py-3 font-black hover:bg-green-700 disabled:opacity-60 transition">
                  {savingSettings ? "Salvando..." : "Salvar quantidade e valor"}
                </button>

                {settingsMessage && (
                  <p className={`text-sm font-bold border rounded-xl px-4 py-3 ${settingsMessage.startsWith("❌") ? "text-red-800 bg-red-50 border-red-200" : "text-green-800 bg-green-50 border-green-200"}`}>{settingsMessage}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4">Números acima desse limite deixam de aparecer na rifa, na paginação, na pesquisa e nas reservas. O valor salvo passa a ser usado no cálculo total e na exibição pública.</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-5 md:p-6 shadow-xl mb-6">
          <h2 className="text-2xl font-black text-slate-900">🏆 Imagem do prêmio</h2>
          <p className="text-slate-700 mt-1 mb-4">Envie uma imagem JPG, PNG ou WEBP com no mínimo 200 KB e no máximo 5 MB.</p>

          {prizeImageUrl && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Imagem atual</p>
              <img src={prizeImageUrl} alt="Imagem atual do prêmio" className="max-h-64 w-full object-contain rounded-xl bg-white" />
            </div>
          )}

          <form onSubmit={savePrizeImage} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setPrizeImageFile(event.target.files?.[0] || null);
                setPrizeImageMessage("");
              }}
              className="rounded-xl border-2 border-slate-300 p-3 font-semibold text-slate-900"
            />

            <button type="submit" disabled={savingPrizeImage} className="rounded-xl bg-slate-900 text-white px-5 py-3 font-black hover:bg-slate-800 disabled:opacity-60 transition">
              {savingPrizeImage ? "Enviando..." : "Salvar imagem"}
            </button>

            {prizeImageMessage && (
              <p className={`md:col-span-2 text-sm font-bold border rounded-xl px-4 py-3 ${prizeImageMessage.startsWith("❌") ? "text-red-800 bg-red-50 border-red-200" : "text-green-800 bg-green-50 border-green-200"}`}>{prizeImageMessage}</p>
            )}
          </form>
        </section>

        {error && <div className="mb-6 rounded-lg border border-red-400 bg-red-900/30 p-4 text-red-100 font-semibold">⚠️ {error}</div>}
         <div className="mb-6 bg-white rounded-2xl shadow-xl p-4">
  <label htmlFor="admin-search" className="sr-only">
    Buscar por nome ou telefone
  </label>

  <div className="relative">
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
      🔎
    </span>

    <input
      id="admin-search"
      type="search"
      value={adminSearch}
      onChange={(event) => setAdminSearch(event.target.value)}
      placeholder="Buscar por nome ou telefone"
      className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-slate-900 font-semibold outline-none transition focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
      autoComplete="off"
      inputMode="search"
    />

    {adminSearch && (
      <button
        type="button"
        onClick={() => setAdminSearch("")}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-slate-500 font-black hover:bg-slate-200 hover:text-slate-900 transition"
        aria-label="Limpar busca"
      >
        ×
      </button>
    )}
  </div>
</div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 shadow text-center">
            <p className="font-semibold text-slate-700">⏳ Carregando reservas...</p>
          </div>
        ) : (
          <AdminTable reservations={reservations} onMarkAsPaid={markAsPaid} onRelease={releaseReservation} onRefundPaid={refundPaidClient} />
        )}
      </div>
    </main>
  );
}
