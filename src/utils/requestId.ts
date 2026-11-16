/**
 * A fresh id for ONE press of a button whose request must land once — a sale
 * (`client_request_id` on `POST /orders`), goods received
 * (`POST /products/{id}/stock`). Kept for the life of the dialog and sent
 * again on a retry, so a request the server already made is answered, not
 * repeated.
 */
export const newRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
