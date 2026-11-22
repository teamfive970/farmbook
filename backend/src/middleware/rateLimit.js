import rateLimit from "express-rate-limit";

const disabled = () =>
  process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true";

function handler(req, res) {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait and try again." }
  });
}

const options = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: disabled
};

export const loginLimiter = rateLimit({ ...options, limit: 20 });
export const registerLimiter = rateLimit({ ...options, limit: 30 });
export const smsLimiter = rateLimit({ ...options, limit: 5 });
// Signed-in actions that confirm the current PIN (change PIN, reveal access code…).
export const pinCheckLimiter = rateLimit({ ...options, limit: 20 });
// Admin browsing is slower than farmer traffic on purpose: a single console
// should not be able to walk the whole register in one sitting.
export const adminReadLimiter = rateLimit({
  ...options,
  limit: Number(process.env.ADMIN_READ_LIMIT || 300)
});
export const adminExportLimiter = rateLimit({
  ...options,
  limit: Number(process.env.ADMIN_EXPORT_LIMIT || 10)
});
