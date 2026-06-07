import { z } from "zod";

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[<>{}`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const checkoutSchema = z.object({
  name: z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(2, "Informe seu nome completo.")
        .max(80, "O nome deve ter no máximo 80 caracteres.")
        .regex(/^[A-Za-zÀ-ÿ' .-]+$/, "O nome contém caracteres inválidos.")
    ),
  phone: z
    .string()
    .transform((value) => String(value || "").replace(/[^\d+]/g, "").trim())
    .pipe(
      z
        .string()
        .min(10, "Informe um WhatsApp válido com DDD.")
        .max(15, "O WhatsApp deve ter no máximo 15 dígitos.")
        .regex(/^\+?\d{10,15}$/, "Informe apenas números, com DDD.")
    ),
  selectedNumbers: z
    .array(z.coerce.number().int().min(1).max(100000))
    .min(1, "Selecione ao menos um número.")
    .max(100000, "Selecione no máximo 100000 números por reserva.")
    .refine((numbers) => new Set(numbers).size === numbers.length, {
      message: "Existem números duplicados na seleção."
    }),
  total: z.coerce.number().finite().nonnegative()
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200)
});

export const reservationActionSchema = z.object({
  reservationId: z.string().uuid(),
  numberId: z.string().uuid()
});
export const bulkReservationActionSchema = z.object({
  action: z.enum(["mark_paid", "release_unpaid", "delete_selected"]),
  items: z
    .array(
      z.object({
        reservationId: z.string().uuid(),
        numberId: z.string().uuid()
      })
    )
    .min(1, "Selecione pelo menos um número.")
    .max(2000, "Selecione no máximo 2000 números por vez.")
});


export const raffleSettingsSchema = z.object({
  raffleMaxNumbers: z.coerce.number().int().min(100).max(100000),
  ticketPrice: z.coerce.number().finite().positive().max(9999.99).optional()
});

export const ticketPriceSchema = z.object({
  ticketPrice: z.coerce.number().finite().positive().max(9999.99)
});

export const prizeImageUploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.coerce.number().int().min(10 * 1024, "A imagem precisa ter no mínimo 10 KB.").max(5 * 1024 * 1024, "A imagem deve ter no máximo 5 MB."),
  base64: z.string().min(1)
});
