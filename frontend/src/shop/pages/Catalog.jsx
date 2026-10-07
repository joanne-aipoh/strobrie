import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photoUrl, shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";
import { groupProducts, cardPhotos } from "../productGrouping.js";
import { groupCoffeeSeparate } from "../coffeeGrouping.js";
import { CAKE_CATEGORIES } from "../cakeCategories.js";
import { inscriptionLimitForLabel } from "../inscriptionLimit.js";
import BoxBuilder from "../BoxBuilder.jsx";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

// Flavoured lattes that aren't really coffee — shown in their own "Non Coffee"
// card, each with a hot/iced choice.
const NON_COFFEE_NAMES = new Set(["Chai Latte", "Chocolate Latte", "Oreo Latte"]);
// The teas served hot (the rest of the Tea category is iced).
const HOT_TEA_NAMES = new Set(["Tea Bag Selection", "Honey Ginger Lemon Tea"]);

// A line of context under a section heading, where the products alone don't
// tell the whole story.
const SECTION_NOTES = {
  Brunch: "Sundays only.",
  "Whole Cakes":
    "We also make custom cakes — please contact us directly on Instagram or call us for customized designs.",
};

// Default a grouped card to the variant whose photo is best to show first —
// a real photo (not the .png illustration placeholder) wins, so e.g. the
// Matcha card opens on Mango Matcha's real photo even though it isn't first.
// Falls back to any photo, then to the first item.
const hasRealPhoto = (p) => p.photos.some((ph) => !/\.png$/i.test(ph.url));
const hasAnyPhoto = (p) => p.photos.length > 0;
function firstPhotoVariant(card) {
  const pick = (test) => {
    if (card.type === "grouped") {
      const i = card.variants.findIndex((v) => test(v.product));
      return i >= 0 ? { variant: i, flavor: 0, size: 0 } : null;
    }
    if (card.type === "grouped2d") {
      for (let fi = 0; fi < card.flavors.length; fi++) {
        for (let si = 0; si < card.flavors[fi].sizeVariants.length; si++) {
          if (test(card.flavors[fi].sizeVariants[si].product)) return { variant: 0, flavor: fi, size: si };
        }
      }
    }
    return null;
  };
  return pick(hasRealPhoto) || pick(hasAnyPhoto) || { variant: 0, flavor: 0, size: 0 };
}

const DRINK_CATEGORIES = new Set(["Coffee", "Tea", "Juices", "Lemonades", "Milkshakes", "Smoothies", "Mocktails"]);

function ProductCard({ card }) {
  const { addItem, qtyInCart } = useCart();
  const initial = firstPhotoVariant(card);
  const [variantIdx, setVariantIdx] = useState(initial.variant);
  const [flavorIdx, setFlavorIdx] = useState(initial.flavor);
  const [sizeIdx, setSizeIdx] = useState(initial.size);
  const [inscription, setInscription] = useState("");
  const [color, setColor] = useState("");
  const [addons, setAddons] = useState("");
  const [qty, setQty] = useState(1);
  const [ebEggs, setEbEggs] = useState("Scrambled");
  const [ebMeat, setEbMeat] = useState("Turkey Ham");
  const [ebSide, setEbSide] = useState("Pancakes");
  const [added, setAdded] = useState(false);
  const [isBoxItem, setIsBoxItem] = useState(false);

  let product, name;
  if (card.type === "grouped2d") {
    product = card.flavors[flavorIdx].sizeVariants[sizeIdx].product;
    name = card.name;
  } else if (card.type === "grouped") {
    product = card.variants[variantIdx].product;
    name = card.name;
  } else {
    product = card.product;
    name = card.product.name;
  }
  const photos = cardPhotos(card, product);
  const remainingStock = product.stock_qty == null ? null : Math.max(0, product.stock_qty - qtyInCart(product.id));
  const outOfStock = product.unavailable || (remainingStock !== null && remainingStock <= 0);

  // Eggs Breakfast carries a cooking-style choice; the non-coffee lattes carry
  // a hot/iced choice. Both ride along as an add-on on the order, defaulted so
  // an order always has one.
  const isEggs = product.name === "Eggs Breakfast";
  const isEnglishBreakfast = product.name === "English Breakfast";
  const isNonCoffeeLatte = NON_COFFEE_NAMES.has(product.name);
  const isHotTea = product.category === "Tea" && HOT_TEA_NAMES.has(product.name);
  useEffect(() => {
    if (isEggs && addons === "") setAddons("Scrambled");
    if (isNonCoffeeLatte && addons === "") setAddons("Hot");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEggs, isNonCoffeeLatte]);

  const sizeLabel = card.type === "grouped2d" ? card.flavors[flavorIdx].sizeVariants[sizeIdx].label : null;
  const inscriptionLimit = CAKE_CATEGORIES.includes(product.category) ? inscriptionLimitForLabel(sizeLabel) : 200;

  function applySizeLimit(limit) {
    setInscription((prev) => (prev.length > limit ? prev.slice(0, limit) : prev));
  }

  function changeFlavor(i) {
    setFlavorIdx(i);
    const newSizeIdx = Math.min(sizeIdx, card.flavors[i].sizeVariants.length - 1);
    setSizeIdx(newSizeIdx);
    applySizeLimit(inscriptionLimitForLabel(card.flavors[i].sizeVariants[newSizeIdx].label));
  }

  function changeSize(i) {
    setSizeIdx(i);
    applySizeLimit(inscriptionLimitForLabel(card.flavors[flavorIdx].sizeVariants[i].label));
  }

  return (
    <div className="product-card">
      <div className="product-card-image">
        {photos[0] ? (
          <img
            src={photoUrl(photos[0].url)}
            alt={name}
            style={
              /cinnamon/i.test(product.name)
                ? // The cinnamon roll shot has text across the top — drop the
                  // crop down so the roll shows and the text is cut off.
                  { objectPosition: "center 60%" }
                : DRINK_CATEGORIES.has(product.category)
                ? { objectPosition: /matcha/i.test(product.name) ? "center 85%" : "center 72%" }
                : undefined
            }
          />
        ) : (
          <div className="product-card-placeholder">No photo yet</div>
        )}
        {!isBoxItem && outOfStock && (
          <span className="product-card-stock-badge sold-out">
            {product.unavailable ? "Unavailable Today" : "Sold Out"}
          </span>
        )}
        {!isBoxItem && !outOfStock && remainingStock !== null && remainingStock <= 10 && (
          <span className="product-card-stock-badge low">Only {remainingStock} left</span>
        )}
      </div>
      <div className="product-card-body">
        <Link to={shopPath(`/product/${product.id}`)} className="product-card-name">
          {name}
        </Link>
        {product.description && <p className="product-card-desc">{product.description}</p>}
        {card.type === "grouped" && (
          <select
            className="product-card-variant"
            value={variantIdx}
            onChange={(e) => setVariantIdx(Number(e.target.value))}
          >
            {card.variants.map((v, i) => (
              <option key={v.product.id} value={i}>
                {v.label}
                {v.product.stock_qty === 0 ? " (out of stock)" : ""}
              </option>
            ))}
          </select>
        )}
        {card.type === "grouped2d" && (
          <>
            <select className="product-card-variant" value={flavorIdx} onChange={(e) => changeFlavor(Number(e.target.value))}>
              {card.flavors.map((f, i) => (
                <option key={f.flavorLabel} value={i}>
                  {f.flavorLabel}
                </option>
              ))}
            </select>
            <select className="product-card-variant" value={sizeIdx} onChange={(e) => changeSize(Number(e.target.value))}>
              {card.flavors[flavorIdx].sizeVariants.map((v, i) => (
                <option key={v.product.id} value={i}>
                  {v.label}
                  {v.product.stock_qty === 0 ? " (out of stock)" : ""}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="product-card-price">{fmt(product.price)}</div>
        {CAKE_CATEGORIES.includes(product.category) && (
          <div>
            <input
              type="text"
              className="product-card-variant"
              placeholder="Inscription (optional)"
              maxLength={inscriptionLimit}
              value={inscription}
              onChange={(e) => setInscription(e.target.value)}
            />
            <div style={{ fontSize: 11, color: "var(--color-mauve)", marginTop: 2, textAlign: "right" }}>
              {inscription.length}/{inscriptionLimit}
              {sizeLabel ? ` — fits on ${sizeLabel}` : ""}
            </div>
            {product.name.startsWith("Whole Cake") && (
              <input
                type="text"
                className="product-card-variant"
                placeholder='Cake color (optional), e.g. "pastel pink and gold"'
                maxLength={100}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
              />
            )}
            <input
              type="text"
              className="product-card-variant"
              placeholder='Add-ons (optional), e.g. "extra chocolate flavor layer"'
              maxLength={200}
              value={addons}
              onChange={(e) => setAddons(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
            />
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginTop: 2, fontWeight: 700 }}>
              Add-ons and custom designs: we'll confirm any extra cost with you before baking.
            </div>
          </div>
        )}
        {isEggs && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 4 }}>
              How would you like your eggs?
            </div>
            <select className="product-card-variant" value={addons} onChange={(e) => setAddons(e.target.value)}>
              {["Scrambled", "Fried", "Poached", "Sunny Side Up"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
        {isNonCoffeeLatte && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 4 }}>
              Hot or iced?
            </div>
            <select className="product-card-variant" value={addons} onChange={(e) => setAddons(e.target.value)}>
              {["Hot", "Iced"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
        {isEnglishBreakfast && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 4 }}>How would you like your eggs?</div>
            <select className="product-card-variant" value={ebEggs} onChange={(e) => setEbEggs(e.target.value)}>
              {["Scrambled", "Fried", "Poached", "Sunny Side Up"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", margin: "6px 0 4px" }}>Choose your meat</div>
            <select className="product-card-variant" value={ebMeat} onChange={(e) => setEbMeat(e.target.value)}>
              {["Turkey Ham", "Bacon"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", margin: "6px 0 4px" }}>Choose your side</div>
            <select className="product-card-variant" value={ebSide} onChange={(e) => setEbSide(e.target.value)}>
              {["Pancakes", "Ciabatta Toast", "French Toast"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
        {isHotTea && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 4 }}>
              Sweetener (optional, no extra cost)
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["None", "Honey", "Sugar"].map((option) => (
                <button
                  key={option}
                  type="button"
                  className="button"
                  style={{
                    flex: 1,
                    padding: "0.4rem 0.5rem",
                    fontSize: 12,
                    background: (addons || "None") === option ? "var(--color-hot-pink-dark)" : "var(--color-bg)",
                    color: (addons || "None") === option ? "#fff" : "var(--color-text)",
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                  onClick={() => setAddons(option === "None" ? "" : option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        <BoxBuilder
          product={product}
          onModeChange={setIsBoxItem}
          onAdd={(breakdown) => {
            addItem(product, 1, { flavorBreakdown: breakdown });
            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
          }}
        />
        {!isBoxItem &&
          (outOfStock ? (
            <span className="form-note">{product.unavailable ? "Not available today" : "Out of stock"}</span>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 6px" }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", background: "var(--color-bg)", fontSize: 18, cursor: "pointer" }}
                >
                  −
                </button>
                <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => q + 1)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", background: "var(--color-bg)", fontSize: 18, cursor: "pointer" }}
                >
                  +
                </button>
              </div>
              <button
                className="button button-primary"
                style={{ width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.9rem", borderRadius: 10, whiteSpace: "nowrap" }}
                onClick={() => {
                  // Reuses the order item's design_notes column — repurposed
                  // here to hold the customer's requested cake color.
                  const isWholeCake = product.name.startsWith("Whole Cake");
                  const finalAddons = isEnglishBreakfast ? `${ebEggs}, ${ebMeat}, ${ebSide}` : addons;
                  addItem(product, qty, { inscription, designNotes: isWholeCake ? color : undefined, addons: finalAddons });
                  setInscription("");
                  setColor("");
                  setAddons("");
                  setQty(1);
                  setAdded(true);
                  setTimeout(() => setAdded(false), 2000);
                }}
              >
                {added ? "Added" : "Add to cart"}
              </button>
            </>
          ))}
      </div>
    </div>
  );
}

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  // Which sections are expanded. Starts null (not yet known); once the
  // sections load we open just the first so the page isn't a wall of items.
  const [openSections, setOpenSections] = useState(null);

  useEffect(() => {
    shopApi
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err.message));
    shopApi
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings({ hidden_categories: [], hidden_now: [] })); // fail open — don't hide anything over a settings-fetch hiccup
  }, []);

  if (error) return <p className="form-error container" style={{ padding: "3rem 1.5rem" }}>Couldn't load products ({error}).</p>;
  if (!products || !settings) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Loading products&hellip;</p>;

  // Several backend categories share one grid section. Cakes/Cheesecakes →
  // "Whole Cakes"; Coffee + add-on Extras → "Coffee"; Tea splits by item into
  // "Hot Tea" and "Iced Tea"; the cold drink categories plus Mocktails →
  // "Drinks".
  const DRINKS_CATEGORIES = ["Juices", "Milkshakes", "Lemonades", "Smoothies"];
  function sectionFor(p) {
    // Cakes and Cheesecakes sit under one "Whole Cakes" heading, each as its
    // own card.
    if (CAKE_CATEGORIES.includes(p.category)) return "Whole Cakes";
    // Coffee, add-on Extras and all teas (hot and iced) share one "Coffee &
    // Tea" heading.
    if (p.category === "Coffee" || p.category === "Extras" || p.category === "Tea") return "Coffee & Tea";
    if (DRINKS_CATEGORIES.includes(p.category) || p.category === "Mocktails") return "Drinks";
    return p.category;
  }

  // hidden_now = manually-hidden categories plus time-gated ones (Brunch only
  // shows on Sundays). Fall back to hidden_categories if an older API response
  // doesn't carry the field.
  const hiddenNow = settings.hidden_now ?? settings.hidden_categories;
  const byCategory = products.reduce((groups, p) => {
    if (hiddenNow.includes(p.category)) return groups;
    (groups[sectionFor(p)] ||= []).push(p);
    return groups;
  }, {});

  // Sections are grouped Food, then Dessert/Cakes, then Drinks — rather than
  // the alphabetical-by-category order the API returns them in, which
  // interleaved food and drink sections in a confusing way. Anything not
  // listed here falls to the end, in whatever order it was encountered.
  const SECTION_ORDER = [
    "Breakfast", "Brunch", "Lunch",
    "Bakery", "Whole Cakes",
    "Coffee & Tea", "Drinks", "Cocktails",
  ];
  const orderedSections = Object.entries(byCategory).sort(([a], [b]) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? SECTION_ORDER.length : ia) - (ib === -1 ? SECTION_ORDER.length : ib);
  });

  // Before any interaction (openSections === null) only the first section is
  // shown open; the toggle below seeds the set from that same default.
  const isOpen = (category) =>
    openSections ? openSections.has(category) : orderedSections[0]?.[0] === category;
  const toggleSection = (category) =>
    setOpenSections((prev) => {
      const next = new Set(prev ?? (orderedSections[0] ? [orderedSections[0][0]] : []));
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  // One card with a single dropdown, from a flat list of products — used to
  // collapse a long list (mocktails, sandwiches, pastas) into one tidy item.
  function mergeOne(name, items, labelFn = (p) => p.name) {
    if (!items.length) return null;
    return { type: "grouped", name, variants: items.map((p) => ({ label: labelFn(p), product: p })) };
  }

  // A shared section can bundle several original categories, each becoming its
  // own card(s) — or, for the collapsible groups below, one merged card.
  function cardsForSection(section, items) {
    if (section === "Coffee & Tea") {
      const coffee = items.filter((p) => p.category === "Coffee");
      const teas = items.filter((p) => p.category === "Tea");
      const coffeeCards = groupCoffeeSeparate(coffee.filter((p) => !NON_COFFEE_NAMES.has(p.name)));
      const byName = (n) => coffeeCards.find((c) => c.name === n);
      // Order: Hot Coffee, Iced Coffee, Iced Tea, hot teas, Matcha, Non Coffee,
      // then add-ons.
      return [
        byName("Hot Coffee"),
        byName("Iced Coffee"),
        mergeOne("Iced Tea", teas.filter((p) => !HOT_TEA_NAMES.has(p.name)), (p) => p.name.replace(/^Iced Tea – /, "")),
        ...groupProducts(teas.filter((p) => HOT_TEA_NAMES.has(p.name))),
        byName("Matcha"),
        mergeOne("Non Coffee", coffee.filter((p) => NON_COFFEE_NAMES.has(p.name))),
        ...groupProducts(items.filter((p) => p.category === "Extras")),
      ].filter(Boolean);
    }
    if (section === "Drinks") {
      return [
        ...DRINKS_CATEGORIES.flatMap((cat) => groupProducts(items.filter((p) => p.category === cat))),
        mergeOne("Mocktails", items.filter((p) => p.category === "Mocktails")),
      ].filter(Boolean);
    }
    if (section === "Whole Cakes") {
      // Keep the "Whole Cakes" heading; title the two cards "Cakes" and
      // "Cheesecakes".
      const RENAME = { "Whole Cake": "Cakes", Cheesecake: "Cheesecakes" };
      return groupProducts(items).map((card) =>
        RENAME[card.name] ? { ...card, name: RENAME[card.name] } : card
      );
    }
    if (section === "Lunch") {
      const isSandwich = (p) => /sandwich|grilled cheese|torzo/i.test(p.name);
      const isPasta = (p) => /pasta|penne/i.test(p.name);
      const sandwiches = items.filter(isSandwich);
      const pastas = items.filter(isPasta);
      const rest = items.filter((p) => !isSandwich(p) && !isPasta(p));
      return [
        mergeOne("Sandwiches", sandwiches, (p) => p.name.replace(/^Sandwich – /, "")),
        mergeOne("Pasta", pastas),
        ...groupProducts(rest),
      ].filter(Boolean);
    }
    return groupProducts(items);
  }

  return (
    <section className="section">
      <div className="container">
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Shop Strobriē</h1>
        <p style={{ marginBottom: "2rem" }}>Cakes, drinks, and bakes — order online for pickup or delivery.</p>

        {products.length === 0 && <p className="empty-note">Nothing's in the shop yet — check back soon.</p>}

        {orderedSections.map(([category, items]) => {
          const open = isOpen(category);
          const cards = cardsForSection(category, items);
          return (
            <div key={category} style={{ marginBottom: open ? "2.5rem" : "0.75rem" }}>
              <button
                type="button"
                onClick={() => toggleSection(category)}
                aria-expanded={open}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--color-border, #e6e2da)",
                  padding: "0.5rem 0",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "inherit",
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: 600 }}>{category}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-soft, #6b6b6b)" }}>
                    {cards.length} {cards.length === 1 ? "item" : "items"}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-soft, #6b6b6b)",
                    transform: open ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s ease",
                  }}
                >
                  ▾
                </span>
              </button>
              {open && (
                <>
                  {SECTION_NOTES[category] && (
                    <p style={{ fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", margin: "0.75rem 0 1rem" }}>
                      {SECTION_NOTES[category]}
                    </p>
                  )}
                  <div className="product-grid" style={{ marginTop: "1rem" }}>
                    {cards.map((card) => (
                      <ProductCard card={card} key={card.type === "single" ? card.product.id : card.name} />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
