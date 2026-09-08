// Shared WhatsApp business number and link builder — used by the floating
// contact button (every page) and the "Order via WhatsApp" checkout
// alternative. Keep this the single source of truth for the number so it
// only needs updating in one place.
export const WHATSAPP_NUMBER = "2348090701995"; // no leading + or spaces, as wa.me expects

export function whatsappLink(message = "") {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
