import crypto from "crypto";
import { adminLoginSchema } from "../../../lib/validation";
import { createAdminCookie, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { getAdminUser } from "../../../lib/adminUser";
import { verifyPassword } from "../../../lib/passwordSecurity";
import { checkRateLimit } from "../../../lib/rateLimit";

async function verifyLegacyEnvPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const provided = Buffer.from(password);
  const expected = Buffer.from(adminPassword);

  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res)) return;

  const rateLimit = checkRateLimit(req, "admin-login", { limit: 6, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }

  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Senha inválida." });
  }

  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    return res.status(500).json({ message: "ADMIN_SESSION_SECRET precisa ter pelo menos 32 caracteres." });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const adminUser = await getAdminUser(supabase);

    const validPassword = adminUser?.password_hash
      ? await verifyPassword(parsed.data.password, adminUser.password_hash)
      : await verifyLegacyEnvPassword(parsed.data.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Senha incorreta." });
    }

    res.setHeader("Set-Cookie", createAdminCookie());
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao validar acesso administrativo." });
  }
}
