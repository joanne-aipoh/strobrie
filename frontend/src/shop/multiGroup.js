// Shared builder for a card that merges several backend categories into one
// two-level dropdown (group, then specific item) — used where the generic
// flavor+size naming convention doesn't fit (see coffeeGrouping.js and
// drinksGrouping.js for the actual classification rules).
export function buildTwoLevelCard(name, products, groupOrder, classify) {
  const byGroup = Object.fromEntries(groupOrder.map((g) => [g, []]));
  for (const p of products) {
    const { group, label } = classify(p);
    (byGroup[group] ||= []).push({ label, product: p });
  }
  const flavors = groupOrder
    .filter((g) => byGroup[g]?.length > 0)
    .map((g) => ({ flavorLabel: g, sizeVariants: byGroup[g] }));

  // No products in this group means there is no card to show. Returning an
  // empty card instead left the renderer reading flavors[0].sizeVariants of
  // nothing, which threw and took the whole page down with it — so hiding
  // Tea from the shop, or selling out of every tea, blanked the storefront.
  // Callers filter these out.
  if (flavors.length === 0) return null;

  return { type: "grouped2d", name, flavors };
}
