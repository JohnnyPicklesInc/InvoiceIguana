/**
 * One-click share targets for a receipt link. Pure string building — no
 * network, no platform detection. The sms: URI has no single syntax that
 * works identically on iOS and Android; `sms:?&body=` is the commonly used
 * hybrid that both platforms tolerate in current versions.
 */
export function shareLinks(link, merchant) {
  const subject = encodeURIComponent(`Receipt from ${merchant}`);
  const body = encodeURIComponent(link);
  return {
    email: `mailto:?subject=${subject}&body=${body}`,
    sms: `sms:?&body=${body}`,
    whatsapp: `https://wa.me/?text=${body}`,
  };
}
