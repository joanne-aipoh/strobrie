// Editor for a product's priced choices (modifier groups), used in the Products
// admin form. Variant = pick one (sets the price); Add-on = pick any (adds).
export default function ModifierEditor({ value, onChange }) {
  const groups = value || [];

  const update = (next) => onChange(next);
  const setGroup = (gi, patch) => update(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  function addGroup() {
    update([...groups, { name: "", kind: "variant", required: true, options: [{ label: "", price: 0 }] }]);
  }
  function removeGroup(gi) {
    update(groups.filter((_, i) => i !== gi));
  }
  function addOption(gi) {
    setGroup(gi, { options: [...groups[gi].options, { label: "", price: 0 }] });
  }
  function setOption(gi, oi, patch) {
    setGroup(gi, { options: groups[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });
  }
  function removeOption(gi, oi) {
    setGroup(gi, { options: groups[gi].options.filter((_, i) => i !== oi) });
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
        Options / add-ons (leave empty for a plain single-price item)
      </label>

      {groups.map((g, gi) => (
        <div
          key={gi}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
            background: "var(--cream-2)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <input
              style={{ flex: "1 1 130px" }}
              type="text"
              value={g.name}
              onChange={(e) => setGroup(gi, { name: e.target.value })}
              placeholder="Group name (e.g. Flavor, Size)"
            />
            <select value={g.kind} onChange={(e) => setGroup(gi, { kind: e.target.value })}>
              <option value="variant">Pick one (sets price)</option>
              <option value="addon">Add any (adds to price)</option>
            </select>
            <button className="link-btn" style={{ color: "var(--rust-dark)" }} onClick={() => removeGroup(gi)}>
              Remove group
            </button>
          </div>

          {g.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input
                style={{ flex: "1 1 140px" }}
                type="text"
                value={o.label}
                onChange={(e) => setOption(gi, oi, { label: e.target.value })}
                placeholder="Option (e.g. Passion Fruit)"
              />
              <input
                style={{ width: 90 }}
                type="number"
                min="0"
                value={o.price ?? ""}
                onChange={(e) => setOption(gi, oi, { price: e.target.value })}
                placeholder={g.kind === "variant" ? "price" : "+ ₦"}
              />
              {g.kind === "addon" && (
                <input
                  style={{ width: 70 }}
                  type="number"
                  min="0"
                  value={o.percent ?? ""}
                  onChange={(e) => setOption(gi, oi, { percent: e.target.value === "" ? null : e.target.value })}
                  placeholder="or %"
                  title="Percent of the chosen price (overrides ₦)"
                />
              )}
              <button className="link-btn" onClick={() => removeOption(gi, oi)} title="Remove option">
                ✕
              </button>
            </div>
          ))}
          <button className="link-btn" onClick={() => addOption(gi)}>
            + Add option
          </button>
        </div>
      ))}

      <button className="link-btn" onClick={addGroup}>
        + Add option group
      </button>
    </div>
  );
}
