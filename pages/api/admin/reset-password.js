import { z } from "zod";
import { clearAdminCookie, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { getPasswordRulesMessage, hashPassword, hashResetToken } from "../../../lib/passwordSecurity";
import { checkRateLimit } from "../../../lib/rateLimit";

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(10).max(200)
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res)) return;

  const rateLimit = checkRateLimit(req, "admin-password-reset-finish", { limit: 5, windowMs: 20 * 60 * 1000 });
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }

  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: getPasswordRulesMessage() });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const tokenHash = hashResetToken(parsed.data.token);

    const { data: resetToken, error } = await supabase
      .from("password_reset_tokens")
      .select("id,admin_user_id,expires_at,used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) throw error;

    if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "Link de recuperação inválido, expirado ou já utilizado." });
    }

    const { data: consumedToken, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!consumedToken?.id) {
      return res.status(400).json({ message: "Link de recuperação inválido, expirado ou já utilizado." });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", resetToken.admin_user_id)
      .eq("is_active", true);

    if (updateError) throw updateError;

    res.setHeader("Set-Cookie", clearAdminCookie());
    return res.status(200).json({ success: true, message: "Senha redefinida com segurança." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || "Erro ao redefinir senha." });
  }
}
