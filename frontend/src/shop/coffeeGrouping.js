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

function classifyCoffee(p) {
  if (MATCHA_RE.test(p.name)) return { group: "Matcha", label: p.name };
  if (COLD_PREFIX_RE.test(p.name) || COLD_COFFEE_NAMES.has(p.name)) return { group: "Cold Coffee", label: p.name };
  return { group: "Hot Coffee", label: p.name };
}

function classifyTea(p) {
  if (ICED_TEA_RE.test(p.name)) return { group: "Iced Tea", label: p.name.replace(ICED_TEA_RE, "") };
  return { group: "Hot Tea", label: p.name };
}

export function groupCoffee(products) {
  return buildTwoLevelCard("Coffee", products, COFFEE_GROUP_ORDER, classifyCoffee);
}

export function groupTea(products) {
  return buildTwoLevelCard("Tea", products, TEA_GROUP_ORDER, classifyTea);
}
