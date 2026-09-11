import { useEffect, useRef, useState } from "react";
import { photoUrl, shopApi } from "../../shop/shopApi.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

const BLANK_FORM = { name: "", description: "", category: "", price: "", stock_qty: "" };

function RestockControl({ product, onChanged }) {
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  async function addBatch() {
    const q = parseInt(qty, 10);
    if (!q || q <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    await shopApi.restockProduct(product.id, q);
    setQty("");
    setError("");
    onChanged();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <input
        type="number"
        min="1"
        placeholder="Qty made"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        style={{ maxWidth: 100, fontSize: 12.5, padding: "4px 8px" }}
      />
      <button className="link-btn" onClick={addBatch}>
        + Add to stock
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

function ProductPhotos({ product, onChanged }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // A new upload replaces whatever photo(s) this product already had,
      // rather than piling up alongside them — most products only ever
      // need the one current photo.
      const existingIds = product.photos.map((p) => p.id);
      await shopApi.uploadPhoto(product.id, file);
      await Promise.all(existingIds.map((id) => shopApi.deletePhoto(id)));
      setError("");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
    e.target.value = "";
  }

  async function removePhoto(photoId) {
    await shopApi.deletePhoto(photoId);
    onChanged();
  }

  async function move(photoId, direction) {
    const ids = product.photos.map((p) => p.id);
    const idx = ids.indexOf(photoId);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    await shopApi.reorderPhotos(product.id, ids);
    onChanged();
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {product.photos.map((photo, i) => (
          <div key={photo.id} style={{ position: "relative" }}>
            <img
              src={photoUrl(photo.url)}
              alt=""
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
            />
            <div style={{ display: "flex", gap: 2, marginTop: 2, justifyContent: "center" }}>
              <button className="remove-btn" disabled={i === 0} onClick={() => move(photo.id, -1)}>
                &larr;
              </button>
              <button className="remove-btn" onClick={() => removePhoto(photo.id)}>
                &times;
              </button>
              <button className="remove-btn" disabled={i === product.photos.length - 1} onClick={() => move(photo.id, 1)}>
                &rarr;
              </button>
            </div>
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ fontSize: 12 }} />
      {product.photos.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
          Choosing a new photo replaces the current one.
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

function ProductForm({ initial, onSubmit, onCancel, categories }) {
  const [form, setForm] = useState(initial || BLANK_FORM);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("Enter a product name.");
      return;
    }
    if (!form.category.trim()) {
      setError("Enter a category.");
      return;
    }
    const price = parseInt(form.price, 10);
    if (!price || price <= 0) {
      setError("Enter a price greater than 0.");
      return;
    }
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim(),
        price,
        stock_qty: form.stock_qty === "" ? null : parseInt(form.stock_qty, 10),
        ...(initial ? { is_active: form.is_active, unavailable: form.unavailable } : {}),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="form-grid">
      <div className="form-field">
        <label>Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Red Velvet Cake (6 in)" />
      </div>
      <div className="form-field">
        <label>Category</label>
        <input
          type="text"
          list="product-categories"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="e.g. Cakes"
        />
        <datalist id="product-categories">
          {categories.map((c) => (
            <option value={c} key={c} />
          ))}
        </datalist>
      </div>
      <div className="form-field">
        <label>Price (₦)</label>
        <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 46400" />
      </div>
      <div className="form-field">
        <label>Stock (blank = unlimited)</label>
        <input type="number" min="0" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} placeholder="e.g. 5" />
      </div>
      <div className="form-field full">
        <label>Description</label>
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      {error && <div className="error-text full">{error}</div>}
      <div className="full" style={{ display: "flex", gap: 10 }}>
        <button className="log-btn" onClick={handleSubmit}>
          {initial ? "Save changes" : "Add product"}
        </button>
        {onCancel && (
          <button className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product, categories, editingId, setEditingId, selected, onToggleSelect, onChanged }) {
  async function handleUpdate(data) {
    await shopApi.updateProduct(product.id, data);
    await onChanged();
    setEditingId(null);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this product? This also removes its photos.")) return;
    await shopApi.deleteProduct(product.id);
    await onChanged();
  }

  async function toggleActive() {
    await shopApi.updateProduct(product.id, {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock_qty: product.stock_qty,
      unavailable: product.unavailable,
      is_active: !product.is_active,
    });
    await onChanged();
  }

  async function toggleUnavailable() {
    await shopApi.updateProduct(product.id, {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock_qty: product.stock_qty,
      is_active: product.is_active,
      unavailable: !product.unavailable,
    });
    await onChanged();
  }

  if (editingId === product.id) {
    return (
      <div className="panel" style={{ background: "var(--cream-2)" }}>
        <ProductForm
          initial={{
            name: product.name,
            description: product.description || "",
            category: product.category,
            price: String(product.price),
            stock_qty: product.stock_qty === null ? "" : String(product.stock_qty),
            is_active: product.is_active,
            unavailable: product.unavailable,
          }}
          categories={categories}
          onSubmit={handleUpdate}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: "var(--cream-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ marginTop: 4, flexShrink: 0 }}
            aria-label={`Select ${product.name}`}
          />
          <div>
            <strong>{product.name}</strong>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              {fmt(product.price)} &middot; {product.stock_qty === null ? "unlimited stock" : `${product.stock_qty} in stock`}
            </div>
            {product.description && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>{product.description}</div>}
            <label
              title="Use this if you can't make it today (e.g. out of an ingredient it needs) — separate from stock count."
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 6, whiteSpace: "nowrap" }}
            >
              <input type="checkbox" checked={product.unavailable} onChange={toggleUnavailable} />
              Not available today
            </label>
            <RestockControl product={product} onChanged={onChanged} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <span className={`checkin-badge ${product.is_active ? "in" : "out"}`}>
            {product.is_active ? "Available online" : "Hidden"}
          </span>
          {product.unavailable && <span className="checkin-badge out">Unavailable Today</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button className="link-btn" onClick={() => setEditingId(product.id)}>
          Edit
        </button>
        <button className="link-btn" onClick={toggleActive}>
          {product.is_active ? "Hide from shop" : "Show in shop"}
        </button>
        <button className="link-btn" style={{ color: "var(--rust-dark)" }} onClick={handleDelete}>
          Delete
        </button>
      </div>
      <ProductPhotos product={product} onChanged={onChanged} />
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  function load() {
    return shopApi.adminListProducts().then(setProducts);
  }

  useEffect(() => {
    load();
    shopApi.getSettings().then(setSettings);
  }, []);

  async function toggleBrunchVisible() {
    const updated = await shopApi.updateSettings({ brunch_visible: !settings.brunch_visible });
    setSettings(updated);
  }

  if (!products) return <p>Loading&hellip;</p>;

  const categories = [...new Set(products.map((p) => p.category))];

  const searchTerm = search.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (trackedOnly && p.stock_qty === null) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  // Category order follows first appearance in the full (unfiltered) list —
  // stable regardless of which categories the current filter happens to hit.
  const byCategory = new Map();
  for (const p of filtered) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }

  // While actively searching/filtering, every matching category auto-opens
  // so results aren't hidden behind a collapsed group.
  const isFiltering = searchTerm !== "" || trackedOnly;

  function toggleCategory(cat) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected product${selectedIds.size === 1 ? "" : "s"}? This also removes their photos.`)) {
      return;
    }
    await Promise.all([...selectedIds].map((id) => shopApi.deleteProduct(id)));
    setSelectedIds(new Set());
    await load();
  }

  async function handleCreate(data) {
    await shopApi.createProduct(data);
    await load();
    setShowAdd(false);
  }

  return (
    <>
      <div className="panel">
        <h3>Shop Products</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 12 }}>
          These products power shop.strobrie.com — separate from the till menu. Only "Available online" products
          show up for customers.
        </p>

        {settings && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 16,
              padding: "10px 12px",
              background: "var(--cream-2)",
              borderRadius: 8,
            }}
          >
            <div>
              <strong>Brunch section</strong>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                Brunch only runs Sundays — turn it off the rest of the week so it doesn't show in the shop.
              </div>
            </div>
            <button className="link-btn" onClick={toggleBrunchVisible}>
              {settings.brunch_visible ? "Visible — turn off" : "Hidden — turn on"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search products by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={trackedOnly} onChange={(e) => setTrackedOnly(e.target.checked)} />
            Tracked stock only
          </label>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: -6, marginBottom: 12 }}>
          {products.length} products total. Anything with "unlimited stock" is made to order and never needs
          counting — check "Tracked stock only" to hide those and see just what's actually being tracked.
        </p>

        {selectedIds.size > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--cream-2)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 13 }}>{selectedIds.size} selected</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="link-btn" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
              <button className="link-btn" style={{ color: "var(--rust-dark)" }} onClick={deleteSelected}>
                Delete selected
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 && <div className="empty-note">No products match.</div>}

        {[...byCategory.entries()].map(([cat, items]) => {
          const isOpen = isFiltering || openCategories.has(cat);
          const allSelected = items.every((p) => selectedIds.has(p.id));
          return (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 4px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--line)",
                }}
                onClick={() => toggleCategory(cat)}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onClick={(e) => e.stopPropagation()}
                  style={{ margin: 0, flexShrink: 0 }}
                  onChange={() =>
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (allSelected) items.forEach((p) => next.delete(p.id));
                      else items.forEach((p) => next.add(p.id));
                      return next;
                    })
                  }
                />
                <strong style={{ flex: 1 }}>
                  {cat} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>({items.length})</span>
                </strong>
                <span style={{ color: "var(--ink-soft)" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  {items.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      categories={categories}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      selected={selectedIds.has(product.id)}
                      onToggleSelect={() => toggleSelect(product.id)}
                      onChanged={load}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button className="link-btn" style={{ marginTop: 6 }} onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Cancel" : "+ Add product"}
        </button>
        {showAdd && (
          <div style={{ marginTop: 14 }}>
            <ProductForm categories={categories} onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
          </div>
        )}
      </div>
    </>
  );
}
