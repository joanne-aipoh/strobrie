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
  return {
    type: "grouped2d",
    name,
    flavors: groupOrder
      .filter((g) => byGroup[g]?.length > 0)
      .map((g) => ({ flavorLabel: g, sizeVariants: byGroup[g] })),
  };
}
