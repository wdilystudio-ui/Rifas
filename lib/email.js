import nodemailer from "nodemailer";

function getBaseUrl(req) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, "");
}

function createTransporter() {
  const user = process.env.GMAIL_USER || "w.dilystudio@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Gmail não configurado. Configure GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
}

export async function sendPasswordResetEmail({ req, to, token }) {
  const from = process.env.GMAIL_USER || "w.dilystudio@gmail.com";
  const appName = process.env.NEXT_PUBLIC_RAFFLE_TITLE || "Rifa Digital";
  const resetUrl = `${getBaseUrl(req)}/admin?resetToken=${encodeURIComponent(token)}`;
  const expiresMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30);

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `Admin ${appName} <${from}>`,
    to,
    subject: `Recuperação de senha do painel admin - ${appName}`,
    text: [
      "Você solicitou a recuperação da senha do painel administrativo.",
      "",
      `Acesse o link abaixo para criar uma nova senha. Ele expira em ${expiresMinutes} minutos e só pode ser usado uma vez:`,
      resetUrl,
      "",
      "Se você não solicitou esta recuperação, ignore este e-mail e revise a segurança do painel."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Recuperação de senha do painel admin</h2>
        <p>Você solicitou a recuperação da senha do painel administrativo.</p>
        <p>Este link expira em <strong>${expiresMinutes} minutos</strong> e só pode ser usado uma vez.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
        <p>Se o botão não funcionar, copie e cole este endereço no navegador:</p>
        <p style="word-break:break-all">${resetUrl}</p>
        <p>Se você não solicitou esta recuperação, ignore este e-mail e revise a segurança do painel.</p>
      </div>
    `
  });
}
