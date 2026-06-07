import path from "path";
import { requireAdmin, requireSameOrigin } from "../../../lib/adminAuth";
import { createSupabaseAdminClient } from "../../../lib/supabaseAdmin";
import { prizeImageUploadSchema } from "../../../lib/validation";

const BUCKET_NAME = "raffle-prizes";
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function safeExtension(fileName, mimeType) {
  const extension = path.extname(fileName || "").toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return extension;

  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";

  return "";
}

export default async function handler(req, res) {
  if (!["POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ message: "Método não permitido." });
  }

  if (!requireSameOrigin(req, res) || !requireAdmin(req, res)) return;

  const supabase = createSupabaseAdminClient();

  if (req.method === "DELETE") {
    try {
      const { data: currentSettings, error: readError } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["prize_image_url", "prize_image_path"]);

      if (readError) throw readError;

      const currentImagePath = currentSettings?.find((item) => item.key === "prize_image_path")?.value || "";

      if (currentImagePath) {
        const { error: removeError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([currentImagePath]);

        if (removeError) throw removeError;
      }

      const { error: settingsError } = await supabase
        .from("app_settings")
        .upsert(
          [
            {
              key: "prize_image_url",
              value: "",
              updated_at: new Date().toISOString()
            },
            {
              key: "prize_image_path",
              value: "",
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: "key" }
        );

      if (settingsError) throw settingsError;

      return res.status(200).json({ success: true, prizeImageUrl: "", prizeImagePath: "" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro ao apagar imagem do prêmio." });
    }
  }

  const parsed = prizeImageUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message || "Imagem inválida." });
  }

  const { fileName, mimeType, size, base64 } = parsed.data;
  const extension = safeExtension(fileName, mimeType);

  if (!extension) {
    return res.status(400).json({ message: "Formato inválido. Envie JPG, PNG ou WEBP." });
  }

  try {
    const fileBuffer = Buffer.from(base64, "base64");

    if (fileBuffer.length !== size) {
      return res.status(400).json({ message: "Arquivo inválido. Tente enviar a imagem novamente." });
    }

    const objectPath = `premio/prize-${Date.now()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectPath, fileBuffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(objectPath);

    const prizeImageUrl = publicUrlData?.publicUrl || "";

    const { error: settingsError } = await supabase
      .from("app_settings")
      .upsert(
        [
          {
            key: "prize_image_url",
            value: prizeImageUrl,
            updated_at: new Date().toISOString()
          },
          {
            key: "prize_image_path",
            value: objectPath,
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: "key" }
      );

    if (settingsError) throw settingsError;

    return res.status(200).json({ success: true, prizeImageUrl, prizeImagePath: objectPath });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao salvar imagem do prêmio. Verifique o bucket raffle-prizes no Supabase Storage." });
  }
}
