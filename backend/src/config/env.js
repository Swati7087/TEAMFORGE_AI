import dotenv from "dotenv";
dotenv.config();

// Only vars needed for Phase 1 (auth) are required right now.
// Others (GEMINI_API_KEY, GITHUB_TOKEN_ENCRYPTION_KEY, GOOGLE_*) are validated
// lazily inside the modules that use them, so the server can boot without them
// during early development.
const required = ["PORT", "MONGO_URI", "JWT_SECRET", "SESSION_SECRET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
  console.error("Check backend/.env against backend/.env.example");
  process.exit(1);
}

export const env = {
  port: process.env.PORT,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  sessionSecret: process.env.SESSION_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  githubTokenEncryptionKey: process.env.GITHUB_TOKEN_ENCRYPTION_KEY || null,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};
