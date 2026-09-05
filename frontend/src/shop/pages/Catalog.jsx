import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photoUrl, shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";
import { groupProducts, cardPhotos } from "../productGrouping.js";
import { CAKE_CATEGORIES } from "../cakeCategories.js";
import { inscriptionLimitForLabel } from "../inscriptionLimit.js";
import BoxBuilder from "../BoxBuilder.jsx";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function ProductCard({ card }) {
  const { addItem, qtyInCart } = useCart();
  const [variantIdx, setVariantIdx] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [inscription, setInscription] = useState("");
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
  const outOfStock = remainingStock !== null && remainingStock <= 0;

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
            <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)", marginTop: 2, fontWeight: 700 }}>
              Want a custom design? Contact us directly instead of ordering online.
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
        {!isBoxItem && remainingStock !== null && remainingStock > 0 && remainingStock <= 10 && (
          <div style={{ fontSize: 11, color: "var(--color-text-soft, #6b6b6b)" }}>Only {remainingStock} left.</div>
        )}
        {!isBoxItem &&
          (outOfStock ? (
            <span className="form-note">Out of stock</span>
          ) : (
            <button
              className="button button-primary"
              style={{ width: "100%" }}
              onClick={() => {
                addItem(product, 1, { inscription });
                setInscription("");
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

  useEffect(() => {
    shopApi
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="form-error container" style={{ padding: "3rem 1.5rem" }}>Couldn't load products ({error}).</p>;
  if (!products) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Loading products&hellip;</p>;

  // Cakes and Cheesecakes share one grid section — they're both "cake" to a
  // customer browsing, just split into two backend categories for pricing.
  const sectionLabel = (category) => (CAKE_CATEGORIES.includes(category) ? "Whole Cakes" : category);

  const byCategory = products.reduce((groups, p) => {
    (groups[sectionLabel(p.category)] ||= []).push(p);
    return groups;
  }, {});

  return (
    <section className="section">
      <div className="container">
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Shop Strobriē</h1>
        <p style={{ marginBottom: "2rem" }}>Cakes, drinks, and bakes — order online for pickup or delivery.</p>

        {products.length === 0 && <p className="empty-note">Nothing's in the shop yet — check back soon.</p>}

        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category} style={{ marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>{category}</h2>
            <div className="product-grid">
              {groupProducts(items).map((card) => (
                <ProductCard card={card} key={card.type === "single" ? card.product.id : card.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
