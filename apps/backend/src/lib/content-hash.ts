import crypto from "node:crypto";

/** SHA-256 hex digest of a response body, used to detect unexpected page content changes. */
export function hashContent(body: Buffer): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}
