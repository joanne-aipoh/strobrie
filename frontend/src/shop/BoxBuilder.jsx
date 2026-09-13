import { useEffect, useState } from "react";
import { shopApi } from "./shopApi.js";
import { useCart } from "./CartContext.jsx";

// "Build your box" — for an item sold as a fixed-size, fixed-price box (e.g.
// Cupcake Box of 8) where the customer picks how many of each flavor fill
// it, rather than the whole box being one flavor.
export default function BoxBuilder({ product, onAdd, onModeChange }) {
  const { flavorQtyInCart } = useCart();
  const [state, setState] = useState({ status: "loading", boxSize: 0, flavors: [] });
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", boxSize: 0, flavors: [] });
    setCounts({});
    shopApi
      .boxFlavors(product.id)
      .then((data) => {
        if (cancelled) return;
        // A product can match the "(Single)"/"(Box of N)" naming pattern
        // without actually being a build-your-own-box item (e.g. Muffin,
        // Cinnamon Roll) — those have no flavor trackers, so the box would
        // otherwise be permanently stuck at 0 picked with nothing to add.
        if (data.flavors.length === 0) {
          setState({ status: "not-box", boxSize: 0, flavors: [] });
          onModeChange?.(false);
          return;
        }
        setState({ status: "ready", boxSize: data.box_size, flavors: data.flavors });
        setCounts(Object.fromEntries(data.flavors.map((f) => [f.flavor, 0])));
        onModeChange?.(true);
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "not-box", boxSize: 0, flavors: [] });
        onModeChange?.(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  if (state.status === "loading") return null;
  if (state.status === "not-box") return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const remainingToFill = state.boxSize - total;

  function remainingStockFor(flavor) {
    if (flavor.remaining == null) return Infinity;
    return Math.max(0, flavor.remaining - flavorQtyInCart(flavor.flavor));
  }

  function changeCount(label, delta) {
    setCounts((prev) => {
      const flavor = state.flavors.find((f) => f.flavor === label);
      const next = Math.max(0, prev[label] + delta);
      const cappedByStock = Math.min(next, remainingStockFor(flavor));
      const currentTotal = Object.entries(prev).reduce((sum, [k, v]) => (k === label ? sum : sum + v), 0);
      const cappedByBox = Math.min(cappedByStock, state.boxSize - currentTotal);
      return { ...prev, [label]: cappedByBox };
    });
  }

  function handleAdd() {
    const breakdown = Object.fromEntries(Object.entries(counts).filter(([, qty]) => qty > 0));
    onAdd(breakdown);
    setCounts(Object.fromEntries(state.flavors.map((f) => [f.flavor, 0])));
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        Build your box — {total}/{state.boxSize} picked
      </div>
      {state.flavors.map((flavor) => {
        const remaining = remainingStockFor(flavor);
        const isOut = remaining <= 0 && counts[flavor.flavor] === 0;
        return (
          <div
            key={flavor.flavor}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 0" }}
          >
            <div>
              <span style={{ fontSize: 13.5 }}>{flavor.flavor}</span>
              {isOut && <span style={{ fontSize: 11, color: "var(--color-mauve)", marginLeft: 6 }}>Out of stock</span>}
              {!isOut && flavor.remaining != null && remaining <= 10 && (
                <span style={{ fontSize: 11, color: "var(--color-mauve)", marginLeft: 6 }}>{remaining} left</span>
              )}
            </div>
            <div className="qty-stepper" style={{ margin: 0 }}>
              <button type="button" onClick={() => changeCount(flavor.flavor, -1)} disabled={counts[flavor.flavor] === 0}>
                &minus;
              </button>
              <span>{counts[flavor.flavor]}</span>
              <button
                type="button"
                onClick={() => changeCount(flavor.flavor, 1)}
                disabled={remainingToFill <= 0 || counts[flavor.flavor] >= remaining}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="button button-primary" style={{ width: "100%", marginTop: 8 }} disabled={total !== state.boxSize} onClick={handleAdd}>
        {total === state.boxSize ? "Add box to cart" : `Pick ${remainingToFill} more`}
      </button>
    </div>
  );
}
