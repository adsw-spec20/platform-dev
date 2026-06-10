/**
 * Dev helper: local webhook listener that prints received deliveries
 * and verifies the HMAC signature. Simulates a thermal-printer bridge.
 * Usage: node scripts/webhook-listener.mjs <secret> [port]
 */
import { createServer } from "http";
import { createHmac, timingSafeEqual } from "crypto";

const secret = process.argv[2];
const port = parseInt(process.argv[3] ?? "4949", 10);
if (!secret) {
  console.error("Usage: node scripts/webhook-listener.mjs <whsec_...> [port]");
  process.exit(1);
}

function verify(rawBody, header) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if ((parts.v1 ?? "").length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const sig = req.headers["x-platform-signature"] ?? "";
    const ok = sig && verify(body, sig);
    const evt = req.headers["x-platform-event"];
    console.log(`\n--- delivery ---`);
    console.log(`event: ${evt} | signature: ${ok ? "VALID" : "INVALID"}`);
    try {
      const data = JSON.parse(body).data;
      console.log(`order #${data.number} | ${data.status} | total ${data.total} agorot`);
    } catch {
      console.log(body.slice(0, 200));
    }
    res.writeHead(ok ? 200 : 401).end();
  });
}).listen(port, () => console.log(`listener ready on :${port}`));
