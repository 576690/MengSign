import { request } from 'node:https';
// Each school call gets a fresh IPv4 TLS connection. School's nonstandard-port
// endpoint can leave pooled serverless connections stalled between invocations.
// Hostname and certificate verification remain enabled; never redirect credentials.
export function schoolFetch(url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const encoded = init.body instanceof URLSearchParams ? init.body.toString() : undefined;
    if (encoded !== undefined) { headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'; headers['content-length'] = String(Buffer.byteLength(encoded)); }
    const req = request(url, { method: init.method, headers: { ...headers, Connection: 'close' }, agent: false, family: 4, rejectUnauthorized: true, signal: init.signal ?? undefined }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) { res.destroy(new Error('School response too large')); return; } chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) { if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : value); }
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode || 502, headers: responseHeaders }));
      });
    });
    req.on('error', reject); req.end(encoded);
  });
}
