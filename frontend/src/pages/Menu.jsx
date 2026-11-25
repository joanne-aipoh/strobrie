import { SHOW_SHOP_LINKS } from "../shopVisibility.js";

const MENUS = [
  { src: "/menu-breakfast.jpg", alt: "Strobrie all-day breakfast menu" },
  { src: "/menu-lunch.jpg", alt: "Strobrie lunch menu" },
  { src: "/menu-bakery.jpg", alt: "Strobrie bakery menu" },
  { src: "/menu-whole-cakes.jpg", alt: "Strobrie whole cakes menu" },
  { src: "/menu-drinks.jpg", alt: "Strobrie drinks menu" },
  { src: "/menu-coffee.jpg", alt: "Strobrie coffee menu" },
  { src: "/menu-bar.jpg", alt: "Strobrie bar menu" },
];

export default function Menu() {
  return (
    <section className="section section-alt">
      <div className="container">
        <h2>Menu</h2>
        <div className="menu-images">
          {MENUS.map((m) => (
            <img key={m.src} src={m.src} alt={m.alt} loading="lazy" />
          ))}
        </div>
        <p className="menu-cta">
          {SHOW_SHOP_LINKS ? (
            <>
              Order online from our <a href="https://shop.strobrie.com">Shop</a>, or see more on{" "}
            </>
          ) : (
            "See more on "
          )}
          <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          .
        </p>
      </div>
    </section>
  );
}
