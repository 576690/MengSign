import { request } from "node:https";
// Each school call gets a fresh IPv4 TLS connection to avoid reusing potentially
// stale connections to the school's nonstandard-port endpoint across invocations.
// Hostname and certificate verification remain enabled; never redirect credentials.
export function schoolFetch(url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    let phase = "dns";
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const encoded =
      init.body instanceof URLSearchParams ? init.body.toString() : undefined;
    if (encoded !== undefined) {
      headers["content-type"] =
        "application/x-www-form-urlencoded;charset=UTF-8";
      headers["content-length"] = String(Buffer.byteLength(encoded));
    }
    const req = request(
      url,
      {
        method: init.method,
        headers: { ...headers, Connection: "close" },
        agent: false,
        family: 4,
        rejectUnauthorized: true,
        signal: init.signal ?? undefined,
      },
      (res) => {
        phase = "response";
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            res.destroy(new Error("School response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(res.headers)) {
            if (value !== undefined)
              responseHeaders.set(
                name,
                Array.isArray(value) ? value.join(", ") : value,
              );
          }
          const status = res.statusCode || 502;
          try {
            resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers: responseHeaders }));
          } catch (error) { reject(error); }
        });
      },
    );
    req.on("socket", (socket) => {
      socket.once("lookup", () => {
        phase = "tcp";
      });
      socket.once("connect", () => {
        phase = "tls";
      });
      socket.once("secureConnect", () => {
        phase = "headers";
      });
    });
    req.on("error", (error) => {
      console.warn("school_transport_failure", {
        phase,
        code: "code" in error ? error.code : "UNKNOWN",
      });
      reject(error);
    });
    req.end(encoded);
  });
}
