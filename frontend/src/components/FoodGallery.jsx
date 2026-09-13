// A dense Instagram-style photo grid of real menu items — same look as the
// account's own grid feed. Pulls straight from the shop's product photo
// uploads (backend/uploads/products) so it's always real food, no stock art.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Same shop-link pattern as the main nav (App.jsx) — a relative /shop route
// in local dev, the shop's own subdomain in production.
const SHOP_SITE_URL = "https://shop.strobrie.com";
const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";
const shopHref = isLocalDev ? "/shop" : SHOP_SITE_URL;

// A photo whose product is known links straight to that product's page
// (found by matching this gallery's photo files against the shop's own
// product photo uploads) — so a visitor who doesn't know an item's name can
// still tap the photo and land exactly on it, instead of the shop homepage.
function productHref(productId) {
  if (!productId) return shopHref;
  return isLocalDev ? `/shop/product/${productId}` : `${SHOP_SITE_URL}/product/${productId}`;
}

// Laid out to match the position/flow of Joanne's reference grid exactly
// (position-for-position closest content match — our real photos standing
// in for her example image's categories: bar dessert, individual cake, a
// cup dessert held in hand, a meat plate, drizzle-topped brunch item, two
// pastas, jarred drinks, waffles, cinnamon rolls to close it out).
const GALLERY_ITEMS = [
  { file: "yellow-cake-birthday.jpg", label: "Whole cake", productId: null },
  { file: "d3dfdd910ee9423bb8cd1dcf00a5d357.JPG", label: "Red velvet brownie", productId: 159 },
  { file: "8e3b54daa2dc4dcd89b739ff39234fc6.JPG", label: "Red velvet mini cake", productId: 131 },
  { file: "90b3985654964caf9e12e78d59b8f1bd.jpeg", label: "Very berry vanilla cake tub", productId: 135 },
  { file: "254a264fc69143988600b2a7ca5565be.jpeg", label: "Suya yakitori", productId: 113 },
  { file: "24ea3e7a59cb4c84badcfca309a56c80.jpeg", label: "Very berry French toast", productId: 82 },
  { file: "d721d24788cf4442a3e7c5917fade0c4.JPG", label: "Ragu pasta", productId: 116 },
  { file: "c984bf75bf964796841a51975c0920b8.JPG", label: "Mango matcha", productId: 28 },
  { file: "001029609c604962b7ed1e619049aff6.JPG", label: "Creamy chicken penne", productId: 117 },
  { file: "073ca0226fcf45429e2f6b84cd817c66.JPG", label: "Cinnamon rolls", productId: 170 },
  { file: "5487461e6b574c689e0fcc945716b291.jpeg", label: "Iced Americano", productId: 10 },
  { file: "3dac67fec7f24e4e9f618aeaaebf3077.JPG", label: "Fresh lemonade", productId: 60 },
  { file: "6b606af322054fa79e8342e93509af90.JPG", label: "Tropical smoothie", productId: 49 },
  { file: "06e51a0d10774ff38f2add9ed42fc044.jpeg", label: "Butter waffles", productId: 288 },
  { file: "e63216c405054c8cbd26adf400f01b47.jpeg", label: "Iced cafe mocha", productId: 13 },
];

export default function FoodGallery() {
  return (
    <div className="food-gallery">
      {GALLERY_ITEMS.map((item) => (
        <a className="food-gallery-item" key={item.file} href={productHref(item.productId)}>
          <img src={`${API_BASE}/uploads/products/${item.file}`} alt={item.label} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
