import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { photoUrl, shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";
import { groupProducts, cardPhotos } from "../productGrouping.js";
import { groupCoffee, groupTea } from "../coffeeGrouping.js";
import { CAKE_CATEGORIES } from "../cakeCategories.js";
import { inscriptionLimitForLabel } from "../inscriptionLimit.js";
import BoxBuilder from "../BoxBuilder.jsx";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

const selectStyle = {
  display: "block",
  width: "100%",
  fontFamily: "inherit",
  fontSize: "0.95rem",
  padding: "0.7rem 0.9rem",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  marginBottom: "0.6rem",
};

export default function ProductDetail() {
  const { productId } = useParams();
  const { addItem, qtyInCart } = useCart();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [card, setCard] = useState(null);
  const [variantIdx, setVariantIdx] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [activePhoto, setActivePhoto] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [inscription, setInscription] = useState("");
  const [color, setColor] = useState("");
  const [addons, setAddons] = useState("");
  const [isBoxItem, setIsBoxItem] = useState(false);

  useEffect(() => {
    shopApi
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  // Find the grouped card (flavour/size variants) this product id belongs
  // to — same grouping the shop grid uses — so opening a product's own page
  // still lets you switch flavour/size instead of being stuck on one variant.
  useEffect(() => {
    if (!products) return;
    const idNum = Number(productId);
    const current = products.find((p) => p.id === idNum);
    if (!current) {
      setError("Product not found");
      return;
    }
    let cards;
    if (current.category === "Coffee") {
      cards = [groupCoffee(products.filter((p) => p.category === "Coffee"))];
    } else if (current.category === "Tea") {
      cards = [groupTea(products.filter((p) => p.category === "Tea"))];
    } else {
      cards = groupProducts(products.filter((p) => p.category === current.category));
    }
    const found = cards.find((c) => {
      if (c.type === "single") return c.product.id === idNum;
      if (c.type === "grouped") return c.variants.some((v) => v.product.id === idNum);
      return c.flavors.some((f) => f.sizeVariants.some((v) => v.product.id === idNum));
    });
    if (!found) {
      setError("Product not found");
      return;
    }
    setCard(found);
    setActivePhoto(0);
    setInscription("");
    setColor("");
    setAddons("");
    if (found.type === "grouped") {
      setVariantIdx(found.variants.findIndex((v) => v.product.id === idNum));
    } else if (found.type === "grouped2d") {
      const fIdx = found.flavors.findIndex((f) => f.sizeVariants.some((v) => v.product.id === idNum));
      setFlavorIdx(fIdx);
      setSizeIdx(found.flavors[fIdx].sizeVariants.findIndex((v) => v.product.id === idNum));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, products]);

  if (error) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p className="form-error">Couldn't load this product ({error}).</p>
        <Link to={shopPath("/")}>&larr; Back to shop</Link>
      </div>
    );
  }
  if (!card) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Loading&hellip;</p>;

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

  const remainingStock = product.stock_qty == null ? null : Math.max(0, product.stock_qty - qtyInCart(product.id));
  const outOfStock = remainingStock !== null && remainingStock <= 0;
  const sizeLabel = card.type === "grouped2d" ? card.flavors[flavorIdx].sizeVariants[sizeIdx].label : null;
  const inscriptionLimit = CAKE_CATEGORIES.includes(product.category) ? inscriptionLimitForLabel(sizeLabel) : 200;
  const photos = cardPhotos(card, product);

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

  const isWholeCake = product.name.startsWith("Whole Cake");

  function handleAdd() {
    // Reuses the order item's design_notes column — repurposed here to hold
    // the customer's requested cake color instead of free-form design text.
    addItem(product, Math.min(qty, remainingStock ?? Infinity), { inscription, designNotes: isWholeCake ? color : undefined, addons });
    setInscription("");
    setColor("");
    setAddons("");
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }

  return (
    <section className="section">
      <div className="container">
        <Link to={shopPath("/")} className="link-btn" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
          &larr; All products
        </Link>
        <div className="product-detail">
          <div>
            <div className="product-detail-main">
              {photos.length > 0 ? (
                <img src={photoUrl(photos[Math.min(activePhoto, photos.length - 1)].url)} alt={name} />
              ) : (
                <div className="product-card-placeholder" style={{ height: "100%" }}>No photo yet</div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="product-thumbs">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    className={`product-thumb ${i === activePhoto ? "active" : ""}`}
                    onClick={() => setActivePhoto(i)}
                  >
                    <img src={photoUrl(photo.url)} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{name}</h1>

            {card.type === "grouped" && (
              <select value={variantIdx} onChange={(e) => setVariantIdx(Number(e.target.value))} style={selectStyle}>
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
                <select value={flavorIdx} onChange={(e) => changeFlavor(Number(e.target.value))} style={selectStyle}>
                  {card.flavors.map((f, i) => (
                    <option key={f.flavorLabel} value={i}>
                      {f.flavorLabel}
                    </option>
                  ))}
                </select>
                <select value={sizeIdx} onChange={(e) => changeSize(Number(e.target.value))} style={selectStyle}>
                  {card.flavors[flavorIdx].sizeVariants.map((v, i) => (
                    <option key={v.product.id} value={i}>
                      {v.label}
                      {v.product.stock_qty === 0 ? " (out of stock)" : ""}
                    </option>
                  ))}
                </select>
              </>
            )}

            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--color-hot-pink-dark)" }}>{fmt(product.price)}</p>
            {product.description && <p>{product.description}</p>}

            {outOfStock ? (
              <p className="form-note">Currently out of stock.</p>
            ) : (
              <>
                {CAKE_CATEGORIES.includes(product.category) && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                      Inscription (optional)
                    </label>
                    <input
                      type="text"
                      placeholder={'e.g. "Happy Birthday Sarah"'}
                      maxLength={inscriptionLimit}
                      value={inscription}
                      onChange={(e) => setInscription(e.target.value)}
                      style={{
                        width: "100%",
                        fontFamily: "inherit",
                        fontSize: "0.95rem",
                        padding: "0.7rem 0.9rem",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "var(--color-bg)",
                        color: "var(--color-text)",
                      }}
                    />
                    <div style={{ fontSize: 11, color: "var(--color-mauve)", marginTop: 4, textAlign: "right" }}>
                      {inscription.length}/{inscriptionLimit}
                      {sizeLabel ? ` — fits on ${sizeLabel}` : ""}
                    </div>
                    {isWholeCake && (
                      <>
                        <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", margin: "10px 0 6px" }}>
                          Cake color (optional)
                        </label>
                        <input
                          type="text"
                          placeholder={'e.g. "pastel pink and gold"'}
                          maxLength={100}
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          style={{
                            width: "100%",
                            fontFamily: "inherit",
                            fontSize: "0.95rem",
                            padding: "0.7rem 0.9rem",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: "var(--color-bg)",
                            color: "var(--color-text)",
                          }}
                        />
                      </>
                    )}
                    <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", margin: "10px 0 6px" }}>
                      Add-ons (optional)
                    </label>
                    <input
                      type="text"
                      placeholder={'e.g. "extra chocolate flavor layer"'}
                      maxLength={200}
                      value={addons}
                      onChange={(e) => setAddons(e.target.value)}
                      style={{
                        width: "100%",
                        fontFamily: "inherit",
                        fontSize: "0.95rem",
                        padding: "0.7rem 0.9rem",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "var(--color-bg)",
                        color: "var(--color-text)",
                      }}
                    />
                    <p className="form-note" style={{ marginTop: 8, fontWeight: 700 }}>
                      Add-ons and custom designs: we'll confirm any extra cost with you before baking.
                    </p>
                  </div>
                )}
                <BoxBuilder
                  product={product}
                  onModeChange={setIsBoxItem}
                  onAdd={(breakdown) => {
                    addItem(product, 1, { flavorBreakdown: breakdown });
                    setAdded(true);
                    setTimeout(() => setAdded(false), 3000);
                  }}
                />
                {!isBoxItem && remainingStock !== null && remainingStock <= 10 && (
                  <p className="form-note" style={{ marginBottom: 6 }}>Only {remainingStock} left.</p>
                )}
                {!isBoxItem && (
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div className="qty-stepper" style={{ margin: 0 }}>
                      <button onClick={() => setQty((q) => Math.max(1, q - 1))}>&minus;</button>
                      <span>{Math.min(qty, remainingStock ?? Infinity)}</span>
                      <button onClick={() => setQty((q) => Math.min(q + 1, remainingStock ?? Infinity))}>+</button>
                    </div>
                    <button className="button button-primary" onClick={handleAdd}>
                      Add to cart
                    </button>
                  </div>
                )}
                {added && <p className="form-success" style={{ marginTop: "0.75rem" }}>Added to cart.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
