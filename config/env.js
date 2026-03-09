const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isProd = process.env.NODE_ENV === "production";

const fromEnv = (name, fallback) => {
  const value = process.env[name];
  if (value && value.trim() !== "") return value;

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
  passwordResetMinutes: toNumber(process.env.PASSWORD_RESET_MINUTES, 15)
};
