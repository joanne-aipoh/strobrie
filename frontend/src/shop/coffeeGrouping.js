// Coffee doesn't fit the generic flavor+size grouping other categories use —
// drink names aren't a recognized "size" token, and there are too many to
// hardcode into that shared regex. Instead it gets one card with its own
// two-level split: a group (Hot/Cold/Matcha), then the specific drink.
const COLD_NAMES = new Set(["Dalgona Whipped Coffee"]);
const MATCHA_RE = /matcha/i;
const COLD_PREFIX_RE = /^(Iced\s|Ice Blended)/i;

function groupFor(name) {
  if (MATCHA_RE.test(name)) return "Matcha";
  if (COLD_PREFIX_RE.test(name) || COLD_NAMES.has(name)) return "Cold Coffee";
  return "Hot Coffee";
}

export function groupCoffee(products) {
  const order = ["Hot Coffee", "Cold Coffee", "Matcha"];
  const byGroup = { "Hot Coffee": [], "Cold Coffee": [], Matcha: [] };
  for (const p of products) byGroup[groupFor(p.name)].push(p);

  return {
    type: "grouped2d",
    name: "Coffee",
    flavors: order
      .filter((label) => byGroup[label].length > 0)
      .map((label) => ({
        flavorLabel: label,
        sizeVariants: byGroup[label].map((p) => ({ label: p.name, product: p })),
      })),
  };
}
