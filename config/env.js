const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "") return fallback;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const toSameSite = (value, fallback = "lax") => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();

  if (["lax", "strict", "none"].includes(normalized)) return normalized;
  return fallback;
};

const isProd = process.env.NODE_ENV === "production";

const fromEnv = (name, fallback) => {
  const value = process.env[name];
  if (value && value.trim() !== "") return value.trim();

  if (isProd) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return fallback;
};

module.exports = {
  jwtSecret: fromEnv("JWT_SECRET", "dev-only-change-me"),
  db: {
    user: fromEnv("DB_USER", "postgres"),
    host: fromEnv("DB_HOST", "localhost"),
    database: fromEnv("DB_NAME", "restaurant_db"),
    password: fromEnv("DB_PASSWORD", "postgres"),
    port: toNumber(process.env.DB_PORT, 5432)
  },
  passwordResetMinutes: toNumber(process.env.PASSWORD_RESET_MINUTES, 15),

  session: {
    secret: fromEnv("SESSION_SECRET", "dev-only-change-me"),
    ttlMinutes: toNumber(process.env.SESSION_TTL_MINUTES, 480),
    cookieSecure: toBoolean(process.env.COOKIE_SECURE, false),
    cookieSameSite: toSameSite(process.env.COOKIE_SAME_SITE, "lax"),
    corsOrigin: fromEnv("CORS_ORIGIN", "http://localhost:5173")
  }
};

