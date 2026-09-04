import { useEffect, useState } from "react";
import { api } from "../api.js";

const CATEGORY_LABELS = {
  cafe: "Cafe",
  drinks: "Drinks",
  bakery: "Bakery",
};

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    (groups[item.category] ||= []).push(item);
    return groups;
  }, {});
}

function formatNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function Menu() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getMenu()
      .then(setItems)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="section section-alt">
      <div className="container">
        <h2>Menu</h2>

        {error && (
          <p className="form-error">
            Couldn't load the menu right now ({error}). Please try again shortly.
          </p>
        )}

        {!items && !error && <p>Loading menu&hellip;</p>}

        {items && (
          <div className="menu-tabs">
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
              const categoryItems = groupByCategory(items)[category] || [];
              if (categoryItems.length === 0) return null;
              return (
                <div
                  key={category}
                  className={`menu-card ${category === "drinks" ? "menu-card-featured" : ""}`}
                >
                  <h3>{label}</h3>
                  <ul>
                    {categoryItems.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        {item.price_kobo != null && (
                          <span className="price">{formatNaira(item.price_kobo)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <p className="menu-cta">
          Full menus and photos are on{" "}
          <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          .
        </p>
      </div>
    </section>
  );
}
