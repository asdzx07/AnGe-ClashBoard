// 订阅拉取：HTTP GET，存原文（解码/解析是 P3 配置生成的事）。
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_BYTES = 10 * 1024 * 1024;

export async function fetchSubscription(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'mybox-subscription-fetcher' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('订阅内容超过 10MB 上限');
    return buf.toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

/** 粗略数节点数（行数），仅用于展示；精确解析在 P3 */
export function countNodesHeuristic(content) {
  const text = content.trim();
  if (!text) return 0;
  // base64 整段：解不开就按 1 算
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && !text.includes('://')) {
    try {
      const decoded = Buffer.from(text.replace(/\s/g, ''), 'base64').toString('utf8');
      return decoded.split('\n').filter((l) => l.includes('://')).length || 1;
    } catch {
      return 1;
    }
  }
  return text.split('\n').filter((l) => l.includes('://')).length;
}
