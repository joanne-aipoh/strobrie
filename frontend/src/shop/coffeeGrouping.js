// Coffee and Tea each get their own card (with their own two-level dropdown
// — drink names don't fit the generic flavor+size naming convention) but sit
// under one shared "Coffee & Tea" heading in the shop grid.
import { buildTwoLevelCard } from "./multiGroup.js";

const COFFEE_GROUP_ORDER = ["Hot Coffee", "Cold Coffee", "Matcha"];
const TEA_GROUP_ORDER = ["Hot Tea", "Iced Tea"];

const COLD_COFFEE_NAMES = new Set(["Dalgona Whipped Coffee"]);
const MATCHA_RE = /matcha/i;
const COLD_PREFIX_RE = /^(Iced\s|Ice Blended)/i;
const ICED_TEA_RE = /^Iced Tea – /i;
// "Tea Bag Selection" and "Honey Ginger Lemon Tea" are Hot Tea — the rest
// (Brown Sugar Milk Tea, Mango Passion Fruit Tea, plus the existing "Iced
// Tea – X" items) are actually served cold, so they group under Iced Tea.
const HOT_TEA_NAMES = new Set(["Tea Bag Selection", "Honey Ginger Lemon Tea"]);

function classifyCoffee(p) {
  if (MATCHA_RE.test(p.name)) return { group: "Matcha", label: p.name };
  if (COLD_PREFIX_RE.test(p.name) || COLD_COFFEE_NAMES.has(p.name)) return { group: "Cold Coffee", label: p.name };
  return { group: "Hot Coffee", label: p.name };
}

function classifyTea(p) {
  if (HOT_TEA_NAMES.has(p.name)) return { group: "Hot Tea", label: p.name };
  return { group: "Iced Tea", label: p.name.replace(ICED_TEA_RE, "") };
}

export function groupCoffee(products) {
  return buildTwoLevelCard("Coffee", products, COFFEE_GROUP_ORDER, classifyCoffee);
}

// Coffee split into one card per group — Hot Coffee, Iced Coffee, Matcha —
// each a single dropdown of its drinks, all still under the Coffee & Tea
// heading.
const COFFEE_CARD_LABELS = { "Hot Coffee": "Hot Coffee", "Cold Coffee": "Iced Coffee", Matcha: "Matcha" };
export function groupCoffeeSeparate(products) {
  const byGroup = Object.fromEntries(COFFEE_GROUP_ORDER.map((g) => [g, []]));
  for (const p of products) {
    const { group, label } = classifyCoffee(p);
    (byGroup[group] ||= []).push({ label, product: p });
  }
  return COFFEE_GROUP_ORDER.filter((g) => byGroup[g]?.length > 0).map((g) => ({
    type: "grouped",
    name: COFFEE_CARD_LABELS[g] || g,
    variants: byGroup[g],
  }));
}

export function groupTea(products) {
  return buildTwoLevelCard("Tea", products, TEA_GROUP_ORDER, classifyTea);
}
