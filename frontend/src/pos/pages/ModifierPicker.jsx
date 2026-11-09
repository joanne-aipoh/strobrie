import { useMemo, useState } from "react";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

// Shown when a product with modifier groups is tapped on the Sell screen.
//   variant = pick one, its price sets the line (options may be label-only, e.g.
//             a flavour that doesn't set the price on its own)
//   matrix  = pick one, price looked up from a grid by the FIRST variant group's
//             choice × this choice (e.g. pancake Flavour × Size)
//   addon   = pick any, each adds (flat, or a percent of the base)
export default function ModifierPicker({ product, onAdd, onCancel }) {
  const groups = product.modifiers || [];
  const isPick = (g) => g.kind === "variant" || g.kind === "matrix";

  // One selected option index per pick-one group (variant or matrix).
  const [sel, setSel] = useState(() => {
    const init = {};
    groups.forEach((g, gi) => {
      if (isPick(g)) init[gi] = 0;
    });
    return init;
  });
  const [addonSel, setAddonSel] = useState(() => new Set());

  const optAmount = (opt, b) => (opt.percent != null ? Math.round((opt.percent / 100) * b) : opt.price || 0);

  // The first variant group is the "primary" dimension a matrix reads (flavour).
  const firstVariantGi = groups.findIndex((g) => g.kind === "variant");
  const primaryIndex = firstVariantGi >= 0 ? sel[firstVariantGi] ?? 0 : 0;

  const matrixPrice = (g, oi) => {
    const row = g.prices && g.prices[primaryIndex];
    return row && typeof row[oi] === "number" ? row[oi] : 0;
  };

  const { price, name } = useMemo(() => {
    let b = product.price;
    const parts = [];
    groups.forEach((g, gi) => {
      if (g.kind === "variant") {
        const opt = g.options[sel[gi] ?? 0];
        if (opt) {
          if (typeof opt.price === "number") b = opt.price;
          parts.push(opt.label);
        }
      }
    });
    groups.forEach((g, gi) => {
      if (g.kind === "matrix") {
        const oi = sel[gi] ?? 0;
        const opt = g.options[oi];
        b = matrixPrice(g, oi);
        if (opt) parts.push(opt.label);
      }
    });
    let p = b;
    groups.forEach((g, gi) => {
      if (g.kind === "addon") {
        g.options.forEach((opt, oi) => {
          if (addonSel.has(`${gi}:${oi}`)) {
            p += optAmount(opt, b);
            parts.push(opt.label);
          }
        });
      }
    });
    return { price: p, name: parts.length ? `${product.name} · ${parts.join(", ")}` : product.name };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, sel, addonSel, product, primaryIndex]);

  function toggleAddon(gi, oi) {
    setAddonSel((prev) => {
      const next = new Set(prev);
      const key = `${gi}:${oi}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function optLabel(g, opt, oi) {
    if (g.kind === "addon") return `+${fmt(optAmount(opt, price))}`;
    if (g.kind === "matrix") return fmt(matrixPrice(g, oi));
    return typeof opt.price === "number" ? fmt(opt.price) : "";
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(43,29,34,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={onCancel}
    >
      <div className="panel" style={{ maxWidth: 420, width: "100%", margin: 0, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{product.name}</h3>

        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
              {g.name}
              {g.kind === "addon" && <span style={{ fontWeight: 400 }}> (optional — add any)</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.options.map((opt, oi) => {
                const selected = isPick(g) ? (sel[gi] ?? 0) === oi : addonSel.has(`${gi}:${oi}`);
                const priceLabel = optLabel(g, opt, oi);
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`cat-btn ${selected ? "active" : ""}`}
                    onClick={() => (isPick(g) ? setSel((prev) => ({ ...prev, [gi]: oi })) : toggleAddon(gi, oi))}
                  >
                    {opt.label}
                    {priceLabel && <span style={{ opacity: 0.85, marginLeft: 6 }}>{priceLabel}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          <button className="charge-btn" style={{ flex: 1 }} onClick={() => onAdd({ name, price })}>
            Add — {fmt(price)}
          </button>
          <button className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
