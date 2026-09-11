// A dense Instagram-style photo grid of real menu items — same look as the
// account's own grid feed. Pulls straight from the shop's product photo
// uploads (backend/uploads/products) so it's always real food, no stock art.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Same shop-link pattern as the main nav (App.jsx) — a relative /shop route
// in local dev, the shop's own subdomain in production.
const SHOP_SITE_URL = "https://shop.strobrie.com";
const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";
const shopHref = isLocalDev ? "/shop" : SHOP_SITE_URL;

// Laid out to match the position/flow of Joanne's reference grid exactly
// (position-for-position closest content match — our real photos standing
// in for her example image's categories: bar dessert, individual cake, a
// cup dessert held in hand, a meat plate, drizzle-topped brunch item, two
// pastas, jarred drinks, waffles, cinnamon rolls to close it out).
const GALLERY_ITEMS = [
  { file: "yellow-cake-birthday.jpg", label: "Whole cake" },
  { file: "d3dfdd910ee9423bb8cd1dcf00a5d357.JPG", label: "Red velvet brownie" },
  { file: "8e3b54daa2dc4dcd89b739ff39234fc6.JPG", label: "Red velvet mini cake" },
  { file: "90b3985654964caf9e12e78d59b8f1bd.jpeg", label: "Very berry vanilla cake tub" },
  { file: "254a264fc69143988600b2a7ca5565be.jpeg", label: "Suya yakitori" },
  { file: "24ea3e7a59cb4c84badcfca309a56c80.jpeg", label: "Very berry French toast" },
  { file: "d721d24788cf4442a3e7c5917fade0c4.JPG", label: "Ragu pasta" },
  { file: "c984bf75bf964796841a51975c0920b8.JPG", label: "Mango matcha" },
  { file: "001029609c604962b7ed1e619049aff6.JPG", label: "Creamy chicken penne" },
  { file: "073ca0226fcf45429e2f6b84cd817c66.JPG", label: "Cinnamon rolls" },
  { file: "5487461e6b574c689e0fcc945716b291.jpeg", label: "Iced Americano" },
  { file: "3dac67fec7f24e4e9f618aeaaebf3077.JPG", label: "Fresh lemonade" },
  { file: "6b606af322054fa79e8342e93509af90.JPG", label: "Tropical smoothie" },
  { file: "06e51a0d10774ff38f2add9ed42fc044.jpeg", label: "Butter waffles" },
  { file: "e63216c405054c8cbd26adf400f01b47.jpeg", label: "Iced cafe mocha" },
];

export default function FoodGallery() {
  return (
    <div className="food-gallery">
      {GALLERY_ITEMS.map((item) => (
        <a className="food-gallery-item" key={item.file} href={shopHref}>
          <img src={`${API_BASE}/uploads/products/${item.file}`} alt={item.label} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
