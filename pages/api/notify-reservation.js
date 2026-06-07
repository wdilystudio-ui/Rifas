import nodemailer from "nodemailer";
import { checkRateLimit } from "../../lib/rateLimit";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const rateLimit = checkRateLimit(req, "notify-reservation", {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Muitas tentativas de envio de e-mail. Tente novamente em alguns minutos.",
      });
    }

    const { name, phone, numbers, total, ticketPrice } = req.body || {};

    if (!name || !phone || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({
        error: "Dados da reserva incompletos",
      });
    }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!adminEmail || !gmailUser || !gmailPassword) {
      return res.status(500).json({
        error: "Configuração de e-mail ausente no servidor",
      });
    }

    const rawName = String(name).replace(/[\r\n]+/g, " ").trim().slice(0, 120);
    const rawPhone = String(phone).replace(/[\r\n]+/g, " ").trim().slice(0, 40);
    const safeName = escapeHtml(rawName);
    const safePhone = escapeHtml(rawPhone);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    const formattedNumbers = numbers
      .map((n) => String(n).replace(/\D/g, ""))
      .filter(Boolean)
      .slice(0, 1000)
      .map((n) => n.padStart(6, "0"))
      .join(", ");

    const numericTotal = Number(total);
    const formattedTotal = Number.isFinite(numericTotal)
      ? numericTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : escapeHtml(total || "");

    const numericTicketPrice = Number(ticketPrice);
    const formattedTicketPrice = Number.isFinite(numericTicketPrice)
      ? numericTicketPrice.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : escapeHtml(ticketPrice || "");

    await transporter.sendMail({
      from: `"Sistema de Rifas" <${gmailUser}>`,
      to: adminEmail,
      subject: `Nova reserva de rifa - ${rawName}`.slice(0, 150),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Nova reserva recebida</h2>

          <p><strong>Nome:</strong> ${safeName}</p>
          <p><strong>Telefone:</strong> ${safePhone}</p>
          <p><strong>Quantidade:</strong> ${numbers.length}</p>
          <p><strong>Números:</strong> ${escapeHtml(formattedNumbers)}</p>
          <p><strong>Valor por ponto:</strong> ${formattedTicketPrice}</p>
          <p><strong>Total:</strong> ${formattedTotal}</p>

          <hr />
          <p>Essa mensagem foi enviada automaticamente pelo sistema de rifas como segunda garantia de recebimento.</p>
        </div>
      `,
      text: [
        "Nova reserva recebida",
        "",
        `Nome: ${rawName}`,
        `Telefone: ${rawPhone}`,
        `Quantidade: ${numbers.length}`,
        `Números: ${formattedNumbers}`,
        `Valor por ponto: ${formattedTicketPrice}`,
        `Total: ${formattedTotal}`,
        "",
        "Essa mensagem foi enviada automaticamente pelo sistema de rifas como segunda garantia de recebimento."
      ].join("\n"),
    });

    return res.status(200).json({
      success: true,
      message: "E-mail de reserva enviado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail da reserva:", error);

    return res.status(500).json({
      error: "Erro ao enviar e-mail da reserva",
    });
  }
}
