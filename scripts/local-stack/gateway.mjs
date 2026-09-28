// Gateway mínimo que imita el enrutado de Supabase (Kong) para tests locales:
//   /auth/v1/*  -> GoTrue (supabase/auth)
//   /rest/v1/*  -> PostgREST
// Incluye un buzón SMTP en memoria (puerto 2500) consultable en GET /__mail
// para probar la recuperación de contraseña de extremo a extremo.
// SÓLO PARA DESARROLLO/TEST. No usar en producción.
import http from "node:http";
import { SMTPServer } from "smtp-server";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH = process.env.AUTH_UPSTREAM ?? "http://127.0.0.1:9999";
const REST = process.env.REST_UPSTREAM ?? "http://127.0.0.1:3001";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 2500);

const mailbox = [];

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onData(stream, session, callback) {
    let raw = "";
    stream.on("data", (chunk) => (raw += chunk.toString("utf8")));
    stream.on("end", () => {
      mailbox.push({ to: session.envelope.rcptTo.map((r) => r.address), raw, at: Date.now() });
      if (mailbox.length > 200) mailbox.shift();
      callback();
    });
  },
});
smtp.listen(SMTP_PORT, "127.0.0.1");

function cors(res, req) {
  res.setHeader("access-control-allow-origin", req.headers.origin ?? "*");
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
}

const server = http.createServer((req, res) => {
  cors(res, req);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.url?.startsWith("/__mail")) {
    const to = new URL(req.url, "http://x").searchParams.get("to");
    const items = to ? mailbox.filter((m) => m.to.includes(to)) : mailbox;
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(items));
    return;
  }
  let upstream;
  let path;
  if (req.url?.startsWith("/auth/v1")) {
    upstream = AUTH;
    path = req.url.slice("/auth/v1".length) || "/";
  } else if (req.url?.startsWith("/rest/v1")) {
    upstream = REST;
    path = req.url.slice("/rest/v1".length) || "/";
  } else {
    res.writeHead(404).end();
    return;
  }
  const target = new URL(path, upstream);
  const headers = { ...req.headers, host: target.host };
  // Como Kong: si no hay Authorization, usar la apikey como bearer.
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const proxyReq = http.request(target, { method: req.method, headers }, (proxyRes) => {
    const outHeaders = { ...proxyRes.headers };
    delete outHeaders["access-control-allow-origin"];
    res.writeHead(proxyRes.statusCode ?? 502, outHeaders);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(proxyReq);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`local gateway on http://127.0.0.1:${PORT} (smtp ${SMTP_PORT})`);
});
