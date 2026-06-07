import crypto from "crypto";

const COOKIE_NAME = "rifa_admin_session";
const ONE_DAY = 60 * 60 * 24;

function secureCookieFlag() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createAdminCookie() {
  const expires = Math.floor(Date.now() / 1000) + ONE_DAY;
  const payload = `admin.${expires}`;
  const token = `${payload}.${sign(payload)}`;

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly${secureCookieFlag()}; SameSite=Strict; Max-Age=${ONE_DAY}`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly${secureCookieFlag()}; SameSite=Strict; Max-Age=0`;
}

export function isAdminRequest(req) {
  const secret = getSecret();
  if (!secret) return false;

  const cookieHeader = req.headers.cookie || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!token) return false;

  const [role, expires, signature] = token.split(".");
  if (role !== "admin" || !expires || !signature) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;

  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
}

export function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;

  res.status(401).json({ message: "Acesso não autorizado." });
  return false;
}

export function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const host = req.headers.host;
  try {
    if (new URL(origin).host === host) return true;
  } catch (_) {
    // continua para bloqueio abaixo
  }

  res.status(403).json({ message: "Origem da requisição não permitida." });
  return false;
}
