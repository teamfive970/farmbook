import { ApiError } from "../lib/errors.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "The requested resource was not found." }
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "The request body is not valid JSON." }
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      error: { code: "CONFLICT", message: "That record already exists." }
    });
  }

  if (error?.code === "DATABASE_UNAVAILABLE" || error?.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: { code: "DATABASE_UNAVAILABLE", message: "The service is temporarily unavailable." }
    });
  }

  // 42P01 = missing table, 42703 = missing column: the code is newer than
  // the database. Say so plainly instead of a stack trace per request.
  if (error?.code === "42P01" || error?.code === "42703") {
    console.error(
      `Database is out of date (${error.message}). Run \`npm run migrate\` in the backend folder, then restart the server.`
    );
    return res.status(503).json({
      error: {
        code: "DATABASE_OUTDATED",
        message: "The database needs updating. Run npm run migrate in the backend folder, then restart the server."
      }
    });
  }

  console.error("Unhandled error:", error);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }
  });
}
