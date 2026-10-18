import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function secret() {
  // Only a server-only secret may sign parent tokens; public keys would let anyone forge them.
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Parent sign-in is not configured");
  return s;
}

export interface ParentClaims {
  parent_id: string;
  school_id: string;
  exp: number;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signParentToken(payload: Omit<ParentClaims, "exp">): string {
  const claims: ParentClaims = { ...payload, exp: Date.now() + TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(claims), "utf8"));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyParentToken(token: string): ParentClaims {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) throw new Error("Invalid token");
  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid token signature");
  const claims = JSON.parse(fromB64url(body).toString("utf8")) as ParentClaims;
  if (!claims.exp || Date.now() > claims.exp) throw new Error("Token expired");
  return claims;
}
