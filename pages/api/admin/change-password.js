import { z } from "zod";
import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { getAdminUser, upsertAdminPasswordHash } from "../../../lib/adminUser";
import { getPasswordRulesMessage, hashPassword, verifyPassword } from "../../../lib/passwordSecurity";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200)
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res) || !requireAdmin(req, res)) return;

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: getPasswordRulesMessage() });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const adminUser = await getAdminUser(supabase);

    const validPassword = adminUser?.password_hash
      ? await verifyPassword(parsed.data.currentPassword, adminUser.password_hash)
      : parsed.data.currentPassword === process.env.ADMIN_PASSWORD;

    if (!validPassword) {
      return res.status(401).json({ message: "Senha atual incorreta." });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await upsertAdminPasswordHash({ supabase, passwordHash });

    return res.status(200).json({ success: true, message: "Senha alterada com segurança." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || "Erro ao alterar senha." });
  }
}
