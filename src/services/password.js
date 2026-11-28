import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const dummy = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, options);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, encoded = dummy) {
  const [salt, hash] = encoded.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = await derive(password, salt, 64, options);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
