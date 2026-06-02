export function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

export function getRequestIdFromHeaders(headers: Headers) {
  return headers.get("x-request-id") ?? undefined;
}

export function getOrCreateRequestId(headers: Headers) {
  return getRequestIdFromHeaders(headers) ?? createRequestId();
}
