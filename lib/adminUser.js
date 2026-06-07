import { createSupabaseAdminClient } from "./supabaseAdmin";
import { normalizeEmail } from "./passwordSecurity";

export function getAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "w.dilystudio@gmail.com");
}

export async function getAdminUser(supabase = createSupabaseAdminClient()) {
  const email = getAdminEmail();

  const { data, error } = await supabase
    .from("admin_users")
    .select("id,email,password_hash,is_active,password_changed_at,created_at")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertAdminPasswordHash({ supabase = createSupabaseAdminClient(), passwordHash }) {
  const email = getAdminEmail();

  const { data, error } = await supabase
    .from("admin_users")
    .upsert(
      {
        email,
        password_hash: passwordHash,
        is_active: true,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "email" }
    )
    .select("id,email")
    .single();

  if (error) throw error;
  return data;
}
