import dns from 'node:dns';
import https from 'node:https';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in current runtime
}

interface SimpleFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

const ipv4Agent = new https.Agent({
  keepAlive: true,
  maxSockets: 16,
});

const ipv4HostCache = new Map<string, { ip: string; expiresAt: number }>();

async function resolveIpv4Host(hostname: string): Promise<string> {
  const cached = ipv4HostCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ip;
  }
  try {
    const ips = await dns.promises.resolve4(hostname);
    if (ips[0]) {
      ipv4HostCache.set(hostname, {
        ip: ips[0],
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      return ips[0];
    }
  } catch {
    // Fallback to hostname if resolve4 fails
  }
  return hostname;
}

/**
 * IPv4-first HTTP helper for cloud AI endpoints.
 * Prevents 30s+ undici IPv6/getaddrinfo timeouts on dual-stack Linux networks,
 * while automatically deferring to `globalThis.fetch` for http:// (local Ollama)
 * or when `fetch` is stubbed in unit tests.
 */
export async function providerFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
): Promise<SimpleFetchResponse> {
  const isMockedFetch =
    typeof globalThis.fetch === 'function' && 'mock' in globalThis.fetch;

  if (isMockedFetch || !url.startsWith('https://')) {
    return globalThis.fetch(url, init);
  }

  const parsedUrl = new URL(url);
  const resolvedIp = await resolveIpv4Host(parsedUrl.hostname);

  return new Promise<SimpleFetchResponse>((resolve, reject) => {
    const req = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: init?.method || 'GET',
        headers: init?.headers,
        family: 4,
        agent: ipv4Agent,
        lookup: (_host, opts, cb) => {
          const all = Boolean(
            opts && typeof opts === 'object' && 'all' in opts && opts.all
          );
          if (all) {
            cb(null, [{ address: resolvedIp, family: 4 }]);
          } else {
            cb(null, resolvedIp, 4);
          }
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => rawText,
            json: async () => {
              try {
                return JSON.parse(rawText) as unknown;
              } catch {
                return {};
              }
            },
          });
        });
      }
    );

    if (init?.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error('Request timed out'));
        return;
      }
      init.signal.addEventListener(
        'abort',
        () => {
          req.destroy(new Error('Request timed out'));
        },
        { once: true }
      );
    }

    req.on('error', (err) => reject(err));

    if (init?.body) {
      req.write(init.body);
    }
    req.end();
  });
}
