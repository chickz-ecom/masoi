import { describe, expect, it } from 'vitest';
import { clientIp } from '../src/realtime/socketServer';

describe('clientIp behind a reverse proxy', () => {
  const h = (xff?: string | string[]) => ({ address: '127.0.0.1', headers: xff === undefined ? {} : { 'x-forwarded-for': xff } });
  it('uses the first X-Forwarded-For hop when the proxy is trusted', () => {
    expect(clientIp(h('203.0.113.9, 172.70.1.1'), true)).toBe('203.0.113.9');
    expect(clientIp(h(['198.51.100.7']), true)).toBe('198.51.100.7');
  });
  it('falls back to the TCP peer when untrusted or the header is missing/empty', () => {
    expect(clientIp(h('203.0.113.9'), false)).toBe('127.0.0.1');
    expect(clientIp(h(), true)).toBe('127.0.0.1');
    expect(clientIp(h(''), true)).toBe('127.0.0.1');
  });
});
