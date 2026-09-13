import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "strobrie-shop-cart";
const CartContext = createContext(null);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage unavailable — cart just won't survive a refresh
    }
  }, [items]);

  // A cake with an inscription, design note, or add-on request always gets
  // its own line, even if the same product is already in the cart — two
  // cakes can carry different messages/designs/add-ons. A build-your-box
  // item (flavorBreakdown) also always gets its own line, since two boxes
  // can be split differently. Plain lines still merge by product as before.
  function addItem(product, qty = 1, { inscription, designNotes, flavorBreakdown, addons } = {}) {
    const cleanInscription = inscription?.trim() || null;
    const cleanDesignNotes = designNotes?.trim() || null;
    const cleanAddons = addons?.trim() || null;
    setItems((prev) => {
      if (!cleanInscription && !cleanDesignNotes && !flavorBreakdown && !cleanAddons) {
        const existing = prev.find(
          (i) => i.productId === product.id && !i.inscription && !i.designNotes && !i.flavorBreakdown && !i.addons
        );
        if (existing) {
          return prev.map((i) => (i.lineId === existing.lineId ? { ...i, qty: i.qty + qty } : i));
        }
      }
      return [
        ...prev,
        {
          lineId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          qty,
          photo: product.photos?.[0]?.url ?? null,
          inscription: cleanInscription,
          designNotes: cleanDesignNotes,
          flavorBreakdown: flavorBreakdown || null,
          addons: cleanAddons,
        },
      ];
    });
  }

  function setQty(lineId, qty) {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.lineId !== lineId) : prev.map((i) => (i.lineId === lineId ? { ...i, qty } : i))));
  }

  function removeItem(lineId) {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }

  // Total quantity of a product already sitting in the cart, across every
  // line it appears in (a cake can be split across lines by inscription).
  function qtyInCart(productId) {
    return items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.qty, 0);
  }

  // Total qty of a build-your-box flavor already committed across every box
  // line in the cart (e.g. Vanilla picked in two separate boxes).
  function flavorQtyInCart(flavorLabel) {
    return items.reduce((sum, i) => {
      if (!i.flavorBreakdown) return sum;
      return sum + (i.flavorBreakdown[flavorLabel] || 0) * i.qty;
    }, 0);
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, setQty, removeItem, clear, count, subtotal, qtyInCart, flavorQtyInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
