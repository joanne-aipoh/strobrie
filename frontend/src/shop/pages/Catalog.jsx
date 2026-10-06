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

// A line of context under a section heading, where the products alone don't
// tell the whole story.
const SECTION_NOTES = {
  Brunch: "Sundays only.",
  "Whole Cakes":
    "We also make custom cakes — please contact us directly on Instagram or call us for customized designs.",
};

function ProductCard({ card }) {
  const { addItem, qtyInCart } = useCart();
  const [variantIdx, setVariantIdx] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [inscription, setInscription] = useState("");
  const [color, setColor] = useState("");
  const [addons, setAddons] = useState("");
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

  // Eggs Breakfast carries a cooking-style choice (recorded as an add-on so it
  // reaches the kitchen on the order). Default it so an order always has one.
  const isEggs = product.name === "Eggs Breakfast";
  useEffect(() => {
    if (isEggs && addons === "") setAddons("Scrambled");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEggs]);

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
      <Link to={shopPath(`/product/${product.id}`)} className="product-card-image">
        {photos[0] ? (
          <img src={photoUrl(photos[0].url)} alt={name} />
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
        <span className="product-card-expand" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
          </svg>
        </span>
      </Link>
      <div className="product-card-body">
        <Link to={shopPath(`/product/${product.id}`)} className="product-card-name">
          {name}
        </Link>
        <Link to={shopPath(`/product/${product.id}`)} className="product-card-view-link">
          View full details &amp; photos &rarr;
        </Link>
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
        {product.category === "Tea" && (
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
            <button
              className="button button-primary"
              style={{ width: "100%" }}
              onClick={() => {
                // Reuses the order item's design_notes column — repurposed
                // here to hold the customer's requested cake color.
                const isWholeCake = product.name.startsWith("Whole Cake");
                addItem(product, 1, { inscription, designNotes: isWholeCake ? color : undefined, addons });
                setInscription("");
                setColor("");
                setAddons("");
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
              }}
            >
              {added ? "Added" : "Add to cart"}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);

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
  const HOT_TEA_NAMES = new Set(["Tea Bag Selection", "Honey Ginger Lemon Tea"]);
  function sectionFor(p) {
    // Cakes and Cheesecakes sit under one "Whole Cakes" heading, each as its
    // own card.
    if (CAKE_CATEGORIES.includes(p.category)) return "Whole Cakes";
    // Coffee, add-on Extras and the hot teas share one "Coffee & Tea" heading;
    // the cold teas split off into their own "Iced Tea" section.
    if (p.category === "Coffee" || p.category === "Extras") return "Coffee & Tea";
    if (p.category === "Tea") return HOT_TEA_NAMES.has(p.name) ? "Coffee & Tea" : "Iced Tea";
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
    "Coffee & Tea", "Iced Tea", "Drinks", "Cocktails",
  ];
  const orderedSections = Object.entries(byCategory).sort(([a], [b]) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? SECTION_ORDER.length : ia) - (ib === -1 ? SECTION_ORDER.length : ib);
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
      return [
        ...groupCoffeeSeparate(items.filter((p) => p.category === "Coffee")),
        // The hot teas (Tea Bag Selection + Honey Ginger Lemon Tea) share one
        // "Tea Bag Selection" card with a dropdown.
        mergeOne("Tea Bag Selection", items.filter((p) => p.category === "Tea")),
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
      // Keep the "Whole Cakes" heading, but title the cake card just "Cakes"
      // (it sits beside the "Cheesecake" card).
      return groupProducts(items).map((card) =>
        card.name === "Whole Cake" ? { ...card, name: "Cakes" } : card
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

        {orderedSections.map(([category, items]) => (
          <div key={category} style={{ marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: SECTION_NOTES[category] ? 2 : "1rem" }}>{category}</h2>
            {SECTION_NOTES[category] && (
              <p style={{ fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: "1rem" }}>
                {SECTION_NOTES[category]}
              </p>
            )}
            <div className="product-grid">
              {cardsForSection(category, items).map((card) => (
                <ProductCard card={card} key={card.type === "single" ? card.product.id : card.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
