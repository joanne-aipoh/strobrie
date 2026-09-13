// Many products are really the same item in different sizes/quantities
// ("Whole Cake – Vanilla (4")" .. (14")), the same item in different
// flavours ("Mini Cake – Carrot", "Mini Cake – Red Velvet", ...), or both at
// once ("Whole Cake" comes in 8 flavours, each in 6 sizes). Rather than show
// every one of those as its own card, group them into a single card with
// one or two variant dropdowns. Grouping is derived entirely from the
// product name — no per-category special-casing needed.

const SIZE_QTY_RE = /^(\d+(?:\.\d+)?")|^Single$|^Box of \d+$|^Half Stack$|^Full Stack$|^Half$|^Full$/;

// "Whole Cake – Vanilla (4", Seasonal)" -> { base: "Whole Cake – Vanilla (Seasonal)", variant: '4"' }
// "Cupcake (Box of 4)" -> { base: "Cupcake", variant: "Box of 4" }
// "Tropical Smoothie (Seasonal)" -> null (no size/qty token inside the parens)
function extractSizeVariant(name) {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return null;
  const [, prefix, inner] = m;
  const parts = inner.split(",").map((s) => s.trim());
  const idx = parts.findIndex((p) => SIZE_QTY_RE.test(p));
  if (idx === -1) return null;
  const variant = parts[idx];
  const rest = parts.filter((_, i) => i !== idx);
  const base = rest.length ? `${prefix} (${rest.join(", ")})` : prefix;
  return { base, variant };
}

function variantSortKey(label) {
  const inch = label.match(/^(\d+(?:\.\d+)?)"$/);
  if (inch) return parseFloat(inch[1]);
  const box = label.match(/^Box of (\d+)$/);
  if (box) return parseInt(box[1], 10);
  if (label === "Single" || label === "Half" || label === "Half Stack") return 0;
  if (label === "Full" || label === "Full Stack") return 1;
  return null;
}

function sortVariants(variantEntries) {
  const sortKeys = variantEntries.map((v) => variantSortKey(v.label));
  if (sortKeys.every((k) => k !== null)) {
    return variantEntries
      .map((v, i) => [v, sortKeys[i]])
      .sort((a, b) => a[1] - b[1])
      .map(([v]) => v);
  }
  return variantEntries;
}

function minId(variantEntries) {
  return Math.min(...variantEntries.map((v) => v.product.id));
}

// Groups a flat list of products (already filtered to one category) into
// cards:
//   { type: "single", product }
//   { type: "grouped", name, variants: [{label, product}] }
//   { type: "grouped2d", name, flavors: [{flavorLabel, sizeVariants: [{label, product}]}] }
export function groupProducts(items) {
  // Pass 1: pull a trailing size/qty token off the name, e.g.
  // "Whole Cake – Vanilla (4")" -> unit "Whole Cake – Vanilla" with size "4"".
  const bySize = new Map();
  const afterSizePass = [];
  for (const p of items) {
    const sv = extractSizeVariant(p.name);
    if (sv) {
      if (!bySize.has(sv.base)) bySize.set(sv.base, []);
      bySize.get(sv.base).push({ label: sv.variant, product: p });
    } else {
      afterSizePass.push(p);
    }
  }

  // Every product becomes a "unit": a name plus its size variants (a single
  // untitled variant if it never had a size/qty suffix at all).
  const units = [];
  for (const [name, variants] of bySize) units.push({ name, sizeVariants: sortVariants(variants) });
  for (const p of afterSizePass) units.push({ name: p.name, sizeVariants: [{ label: null, product: p }] });

  // Pass 2: group units by the prefix before the last " – ", e.g.
  // "Mini Cake – Carrot" -> flavour "Carrot" of base "Mini Cake".
  const byDash = new Map();
  const afterDashPass = [];
  for (const u of units) {
    const idx = u.name.lastIndexOf(" – ");
    if (idx === -1) {
      afterDashPass.push(u);
      continue;
    }
    const flavorBase = u.name.slice(0, idx);
    const flavorLabel = u.name.slice(idx + 3);
    if (!byDash.has(flavorBase)) byDash.set(flavorBase, []);
    byDash.get(flavorBase).push({ flavorLabel, sizeVariants: u.sizeVariants });
  }

  // A bare unit like "Gin and Tonic" alongside "Gin and Tonic – Blueberry"
  // becomes the "Original" flavour of that same group.
  const leftoverUnits = [];
  for (const u of afterDashPass) {
    if (byDash.has(u.name)) {
      byDash.get(u.name).unshift({ flavorLabel: "Original", sizeVariants: u.sizeVariants });
    } else {
      leftoverUnits.push(u);
    }
  }

  function unitToCard(name, sizeVariants) {
    if (sizeVariants.length > 1) {
      return { type: "grouped", name, variants: sizeVariants, sortId: minId(sizeVariants) };
    }
    return { type: "single", product: sizeVariants[0].product, sortId: sizeVariants[0].product.id };
  }

  const cards = [];

  for (const [flavorBase, flavorEntries] of byDash) {
    if (flavorEntries.length === 1) {
      const fe = flavorEntries[0];
      const name = fe.flavorLabel === "Original" ? flavorBase : `${flavorBase} – ${fe.flavorLabel}`;
      cards.push(unitToCard(name, fe.sizeVariants));
      continue;
    }

    const allHaveMultipleSizes = flavorEntries.every((fe) => fe.sizeVariants.length > 1);
    if (allHaveMultipleSizes) {
      cards.push({
        type: "grouped2d",
        name: flavorBase,
        flavors: flavorEntries,
        sortId: minId(flavorEntries.flatMap((fe) => fe.sizeVariants)),
      });
      continue;
    }

    const allHaveSingleSize = flavorEntries.every((fe) => fe.sizeVariants.length === 1);
    if (allHaveSingleSize) {
      const variants = flavorEntries.map((fe) => ({ label: fe.flavorLabel, product: fe.sizeVariants[0].product }));
      cards.push({ type: "grouped", name: flavorBase, variants, sortId: minId(variants) });
      continue;
    }

    // Mixed — some flavours have size variants, some don't. Don't force
    // them together; render each flavour as its own card.
    for (const fe of flavorEntries) {
      cards.push(unitToCard(`${flavorBase} – ${fe.flavorLabel}`, fe.sizeVariants));
    }
  }

  for (const u of leftoverUnits) cards.push(unitToCard(u.name, u.sizeVariants));

  cards.sort((a, b) => a.sortId - b.sortId);
  return cards;
}

// Every product in a card, regardless of type — used to find a photo when
// the currently-picked flavour/size variant doesn't have its own.
export function productsInCard(card) {
  if (card.type === "single") return [card.product];
  if (card.type === "grouped") return card.variants.map((v) => v.product);
  return card.flavors.flatMap((f) => f.sizeVariants.map((v) => v.product));
}

// One photo is usually enough for a whole card ("Pancakes" doesn't need a
// separate shot per flavour/size) — fall back to any sibling variant's
// photo instead of showing a blank placeholder when the picked one has none.
export function cardPhotos(card, selectedProduct) {
  if (selectedProduct.photos.length > 0) return selectedProduct.photos;
  for (const p of productsInCard(card)) {
    if (p.photos.length > 0) return p.photos;
  }
  return [];
}
