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
// Only "Tea Bag Selection" stays Hot Tea for now — everything else in the
// Tea category (Honey Ginger Lemon Tea, Brown Sugar Milk Tea, Mango Passion
// Fruit Tea, plus the existing "Iced Tea – X" items) is actually served
// cold, so it all goes under Iced Tea. Pending a breakdown of what Tea Bag
// Selection itself covers.
const HOT_TEA_NAMES = new Set(["Tea Bag Selection"]);

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

export function groupTea(products) {
  return buildTwoLevelCard("Tea", products, TEA_GROUP_ORDER, classifyTea);
}
