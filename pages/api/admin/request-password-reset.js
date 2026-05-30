import { z } from "zod";
import { requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { getAdminEmail, getAdminUser } from "../../../lib/adminUser";
import { addMinutes, createResetToken, normalizeEmail } from "../../../lib/passwordSecurity";
import { sendPasswordResetEmail } from "../../../lib/email";
import { checkRateLimit } from "../../../lib/rateLimit";

const requestResetSchema = z.object({
  email: z.string().email().max(160).transform(normalizeEmail)
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res)) return;

  const rateLimit = checkRateLimit(req, "admin-password-reset-request", { limit: 3, windowMs: 20 * 60 * 1000 });
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ message: "Muitas solicitações. Aguarde alguns minutos e tente novamente." });
  }

  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }

  const genericResponse = {
    success: true,
    message: "Se este e-mail estiver autorizado, enviaremos as instruções de recuperação."
  };

  try {
    const supabase = createSupabaseAdminClient();
    const requestedEmail = parsed.data.email;
    const adminEmail = getAdminEmail();

    if (requestedEmail !== adminEmail) {
      return res.status(200).json(genericResponse);
    }

    const adminUser = await getAdminUser(supabase);
    if (!adminUser?.id) {
      return res.status(200).json(genericResponse);
    }

    const { token, tokenHash } = createResetToken();
    const expiresMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30);

    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("admin_user_id", adminUser.id)
      .is("used_at", null);

    const { error } = await supabase.from("password_reset_tokens").insert({
      admin_user_id: adminUser.id,
      token_hash: tokenHash,
      expires_at: addMinutes(new Date(), expiresMinutes).toISOString(),
      request_ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 120),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 400)
    });

    if (error) throw error;

    await sendPasswordResetEmail({ req, to: adminEmail, token });
    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao solicitar recuperação de senha." });
  }
}
