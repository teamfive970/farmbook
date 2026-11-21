const BASE_URL = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

export async function request(path, { method = "GET", body, token, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "You appear to be offline. Check your connection and try again."
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // Only a request that carried a session can mean "this session ended".
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("minders:session-expired"));
    }
    if (response.status === 403 && payload?.error?.code === "ACCOUNT_INACTIVE") {
      window.dispatchEvent(new Event("minders:account-inactive"));
    }
    throw new ApiError(
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
      payload?.error?.message || "Something went wrong. Please try again.",
      payload?.error?.details
    );
  }

  return payload;
}

// Download a file (e.g. a CSV report) that needs the session token.
export async function downloadFile(path, { token, fallbackName = "download" } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "You appear to be offline. Check your connection and try again.");
  }
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401 && token) window.dispatchEvent(new Event("minders:session-expired"));
    throw new ApiError(
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
      payload?.error?.message || "The download failed. Please try again."
    );
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match ? match[1] : fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options = {}) => request(path, { ...options, method: "DELETE" })
};
