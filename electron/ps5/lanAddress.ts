/**
 * Only an address inside a club's own network gets a PlayStation datagram
 * (2026-11-28, security audit, owner-approved). The address comes from the
 * server (`console_address`) or the LAN sweep; a wake or a pairing aimed at
 * an internet host would hand a console's credential to whoever runs it.
 *
 * Allowed: IPv4 private (10/8, 172.16/12, 192.168/16), link-local
 * (169.254/16), shared/CGNAT (100.64/10, VPN overlays such as a club's
 * Tailscale) and loopback (127/8). Anything else — a public address, a host
 * name, IPv6 — is refused. Checked on 2026-11-28: every console address in
 * production is a private IPv4.
 */
export const isLanAddress = (address: unknown): address is string => {
  if (typeof address !== "string") return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127)
    || a === 127;
};
