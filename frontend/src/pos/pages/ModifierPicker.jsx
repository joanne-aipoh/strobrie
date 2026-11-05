import { useMemo, useState } from "react";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

// Shown when a product with modifier groups is tapped on the Sell screen.
// variant groups = pick one (replaces the price); addon groups = pick any
// (each adds to the price). Returns a composed cart line to onAdd.
export default function ModifierPicker({ product, onAdd, onCancel }) {
  const groups = product.modifiers || [];
  // variantSel: { groupIndex: optionIndex } — default to the first option.
  const [variantSel, setVariantSel] = useState(() => {
    const init = {};
    groups.forEach((g, gi) => {
      if (g.kind === "variant") init[gi] = 0;
    });
    return init;
  });
  // addonSel: Set of "groupIndex:optionIndex".
  const [addonSel, setAddonSel] = useState(() => new Set());

  // An add-on's amount: a flat price, or a percent of the chosen variant price
  // (e.g. a cake "extra layer" = 38% of the selected size).
  const optAmount = (opt, base) =>
    opt.percent != null ? Math.round((opt.percent / 100) * base) : opt.price || 0;

  const { price, name, base } = useMemo(() => {
    let b = product.price;
    const parts = [];
    groups.forEach((g, gi) => {
      if (g.kind === "variant") {
        const opt = g.options[variantSel[gi] ?? 0];
        if (opt) {
          b = opt.price;
          parts.push(opt.label);
        }
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
    return { price: p, name: parts.length ? `${product.name} · ${parts.join(", ")}` : product.name, base: b };
  }, [groups, variantSel, addonSel, product]);

  function toggleAddon(gi, oi) {
    setAddonSel((prev) => {
      const next = new Set(prev);
      const key = `${gi}:${oi}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43,29,34,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        className="panel"
        style={{ maxWidth: 420, width: "100%", margin: 0, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>{product.name}</h3>

        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
              {g.name}
              {g.kind === "addon" && <span style={{ fontWeight: 400 }}> (optional — add any)</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.options.map((opt, oi) => {
                const selected =
                  g.kind === "variant" ? (variantSel[gi] ?? 0) === oi : addonSel.has(`${gi}:${oi}`);
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`cat-btn ${selected ? "active" : ""}`}
                    onClick={() =>
                      g.kind === "variant"
                        ? setVariantSel((prev) => ({ ...prev, [gi]: oi }))
                        : toggleAddon(gi, oi)
                    }
                  >
                    {opt.label}
                    <span style={{ opacity: 0.85, marginLeft: 6 }}>
                      {g.kind === "variant" ? fmt(opt.price) : `+${fmt(optAmount(opt, base))}`}
                    </span>
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
