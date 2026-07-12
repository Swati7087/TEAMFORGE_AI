import crypto from "crypto";
import { env } from "../config/env.js";

// AES-256-CBC token encryption for stored GitHub PATs.
// The iv is stored alongside the ciphertext (tokenIv on Repository) — it is
// not secret, just required for decryption.

function getKey() {
  const raw = env.githubTokenEncryptionKey;
  if (!raw || !String(raw).trim()) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");
  }
  // AES-256 needs exactly 32 bytes — derive from whatever the user set in .env.
  return crypto.createHash("sha256").update(String(raw).trim()).digest();
}

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  let encryptedData = cipher.update(String(text), "utf8", "hex");
  encryptedData += cipher.final("hex");
  return { encryptedData, iv: iv.toString("hex") };
}

export function decrypt(encryptedData, iv) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getKey(),
    Buffer.from(iv, "hex")
  );
  let decrypted = decipher.update(String(encryptedData), "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
