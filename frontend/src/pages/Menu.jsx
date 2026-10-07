const MENUS = [
  { src: "/menu-breakfast.jpg", alt: "Strobriē all-day breakfast menu" },
  { src: "/menu-lunch.jpg", alt: "Strobriē lunch menu" },
  { src: "/menu-bakery.jpg", alt: "Strobriē bakery menu" },
  { src: "/menu-whole-cakes.jpg", alt: "Strobriē whole cakes menu" },
  { src: "/menu-drinks.jpg", alt: "Strobriē drinks menu" },
  { src: "/menu-coffee.jpg", alt: "Strobriē coffee menu" },
  { src: "/menu-bar.jpg", alt: "Strobriē bar menu" },
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
          Order online from our{" "}
          <a href="https://shop.strobrie.com">Shop</a>, or see more on{" "}
          <a href="https://instagram.com/strobrie" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          .
        </p>
      </div>
    </section>
  );
}
