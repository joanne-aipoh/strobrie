import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photoUrl, shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    shopApi
      .listProducts()
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="form-error container" style={{ padding: "3rem 1.5rem" }}>Couldn't load products ({error}).</p>;
  if (!products) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Loading products&hellip;</p>;

  const byCategory = products.reduce((groups, p) => {
    (groups[p.category] ||= []).push(p);
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
              {items.map((p) => (
                <div className="product-card" key={p.id}>
                  <Link to={shopPath(`/product/${p.id}`)} className="product-card-image">
                    {p.photos[0] ? (
                      <img src={photoUrl(p.photos[0].url)} alt={p.name} />
                    ) : (
                      <div className="product-card-placeholder">No photo yet</div>
                    )}
                  </Link>
                  <div className="product-card-body">
                    <Link to={shopPath(`/product/${p.id}`)} className="product-card-name">
                      {p.name}
                    </Link>
                    <div className="product-card-price">{fmt(p.price)}</div>
                    {p.stock_qty === 0 ? (
                      <span className="form-note">Out of stock</span>
                    ) : (
                      <button className="button button-primary" style={{ width: "100%" }} onClick={() => addItem(p, 1)}>
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
