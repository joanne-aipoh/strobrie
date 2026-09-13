// How many inscription characters reasonably fit iced onto a cake of a
// given size. Mirrors backend/app/routers/shop_orders.py's
// INSCRIPTION_LIMIT_BY_SIZE — keep the two in sync.
const LIMIT_BY_SIZE = { '4"': 20, '6"': 30, '8"': 40, '10"': 50, '12"': 60, '14"': 70 };
const DEFAULT_LIMIT = 40;

export function inscriptionLimitForLabel(sizeLabel) {
  if (!sizeLabel) return DEFAULT_LIMIT;
  return LIMIT_BY_SIZE[sizeLabel] ?? DEFAULT_LIMIT;
}

// Pulls the size (e.g. '6"') out of a product name like
// 'Whole Cake – Vanilla (6")', for pages that don't have a live size
// dropdown (the product detail page links straight to one variant).
export function inscriptionLimitForProductName(name) {
  const m = name.match(/\((\d+)"/);
  return inscriptionLimitForLabel(m ? `${m[1]}"` : null);
}
