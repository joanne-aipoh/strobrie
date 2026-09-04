import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { photoUrl, shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function ProductDetail() {
  const { productId } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    shopApi
      .getProduct(productId)
      .then((p) => {
        setProduct(p);
        setActivePhoto(0);
      })
      .catch((err) => setError(err.message));
  }, [productId]);

  if (error) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p className="form-error">Couldn't load this product ({error}).</p>
        <Link to={shopPath("/")}>&larr; Back to shop</Link>
      </div>
    );
  }
  if (!product) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Loading&hellip;</p>;

  const outOfStock = product.stock_qty === 0;

  function handleAdd() {
    addItem(product, qty);
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
              {product.photos.length > 0 ? (
                <img src={photoUrl(product.photos[activePhoto].url)} alt={product.name} />
              ) : (
                <div className="product-card-placeholder" style={{ height: "100%" }}>No photo yet</div>
              )}
            </div>
            {product.photos.length > 1 && (
              <div className="product-thumbs">
                {product.photos.map((photo, i) => (
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
            <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{product.name}</h1>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--color-hot-pink-dark)" }}>{fmt(product.price)}</p>
            {product.description && <p>{product.description}</p>}

            {outOfStock ? (
              <p className="form-note">Currently out of stock.</p>
            ) : (
              <>
                <div className="qty-stepper">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}>&minus;</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
                <button className="button button-primary" onClick={handleAdd}>
                  Add to cart
                </button>
                {added && <p className="form-success" style={{ marginTop: "0.75rem" }}>Added to cart.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
