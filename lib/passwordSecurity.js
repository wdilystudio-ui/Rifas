import bcrypt from "bcryptjs";
import crypto from "crypto";

const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_ROUNDS = 12;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isStrongPassword(password) {
  const value = String(password || "");
  return (
    value.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function getPasswordRulesMessage() {
  return "A senha precisa ter no mínimo 10 caracteres, com letra maiúscula, minúscula, número e símbolo.";
}

export async function hashPassword(password) {
  if (!isStrongPassword(password)) {
    throw new Error(getPasswordRulesMessage());
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}

export function createResetToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashResetToken(token)
  };
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function safeTokenPreview(token) {
  const value = String(token || "");
  if (value.length < 10) return "token-curto";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
