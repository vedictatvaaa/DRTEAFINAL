import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Tiny scrypt-based password helper. We avoid bcrypt/argon dependencies
// because this surface is only used for a handful of operator accounts —
// scrypt from Node core is more than sufficient and removes a native
// build step from the deploy.

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const N = 16; // bytes — 128-bit salt
const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(N);
  const key = await scrypt(plain, salt, KEY_LEN);
  return `s1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  if (!encoded) return false;
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const got = await scrypt(plain, salt, expected.length);
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}
