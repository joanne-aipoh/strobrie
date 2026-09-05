import { useEffect, useState } from "react";
import { api } from "../api.js";

const CATEGORY_ORDER = ["Coffee", "Tea", "Juices", "Smoothies", "Milkshakes", "Lemonades", "Extras", "Breakfast", "Lunch", "Bakery", "Cakes", "Cheesecakes", "Mocktails", "Cocktails", "Schweppes", "Beer"];

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    (groups[item.category] ||= []).push(item);
    return groups;
  }, {});
}

function formatNaira(amount) {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
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

  const grouped = items ? groupByCategory(items) : {};
  const categories = items
    ? [...CATEGORY_ORDER.filter((c) => grouped[c]), ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c))]
    : [];

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
            {categories.map((category) => (
              <div
                key={category}
                className={`menu-card ${category === "Coffee" ? "menu-card-featured" : ""}`}
              >
                <h3>{category}</h3>
                <ul>
                  {grouped[category].map((item) => (
                    <li key={item.id}>
                      <span>{item.name}</span>
                      {item.price != null && <span className="price">{formatNaira(item.price)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
