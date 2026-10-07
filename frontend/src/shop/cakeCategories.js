// Categories where customers commonly want a written inscription on the
// cake ("Happy Birthday Sarah"). Kept as a single list so the shop's grid
// cards and the product detail page agree on where to show the field.
export const CAKE_CATEGORIES = ["Cakes", "Cheesecakes"];

// Made-to-order items that need at least 48 hours' notice: whole cakes and
// cheesecakes, plus cupcakes (baked fresh to order, sold by the box). This is
// only about lead time — cupcakes still live in Bakery, go by bike, and don't
// get the whole-cake inscription fields.
export function needs48hNotice(item) {
  if (!item) return false;
  if (CAKE_CATEGORIES.includes(item.category)) return true;
  return /^cupcake\b/i.test(item.name || "");
}
