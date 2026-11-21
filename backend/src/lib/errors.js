export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, "VALIDATION_ERROR", message, details);

export const unauthorized = (message = "Phone number, access code or PIN is incorrect.") =>
  new ApiError(401, "INVALID_CREDENTIALS", message);

export const unauthenticated = (message = "Please sign in to continue.") =>
  new ApiError(401, "UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have access to this action.") =>
  new ApiError(403, "FORBIDDEN", message);

export const notFound = (message = "The requested record was not found.") =>
  new ApiError(404, "NOT_FOUND", message);

export const conflict = (message) => new ApiError(409, "CONFLICT", message);

export const inactive = () =>
  new ApiError(403, "ACCOUNT_INACTIVE", "This account is inactive. Please contact support.");

export const tooManyRequests = () =>
  new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
