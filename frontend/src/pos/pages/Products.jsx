import { useEffect, useRef, useState } from "react";
import { photoUrl, shopApi } from "../../shop/shopApi.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

const BLANK_FORM = { name: "", description: "", category: "", price: "", stock_qty: "" };

function ProductPhotos({ product, onChanged }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await shopApi.uploadPhoto(product.id, file);
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
        ...(initial ? { is_active: form.is_active } : {}),
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

export default function Products() {
  const [products, setProducts] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function load() {
    return shopApi.adminListProducts().then(setProducts);
  }

  useEffect(() => {
    load();
  }, []);

  if (!products) return <p>Loading&hellip;</p>;

  const categories = [...new Set(products.map((p) => p.category))];

  async function handleCreate(data) {
    await shopApi.createProduct(data);
    await load();
    setShowAdd(false);
  }

  async function handleUpdate(id, data) {
    await shopApi.updateProduct(id, data);
    await load();
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product? This also removes its photos.")) return;
    await shopApi.deleteProduct(id);
    await load();
  }

  async function toggleActive(product) {
    await shopApi.updateProduct(product.id, {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock_qty: product.stock_qty,
      is_active: !product.is_active,
    });
    await load();
  }

  return (
    <>
      <div className="panel">
        <h3>Shop Products</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 12 }}>
          These products power shop.strobrie.com — separate from the till menu. Only "Available online" products
          show up for customers.
        </p>

        {products.length === 0 && <div className="empty-note">No products yet.</div>}

        {products.map((product) => (
          <div key={product.id} className="panel" style={{ background: "var(--cream-2)" }}>
            {editingId === product.id ? (
              <ProductForm
                initial={{
                  name: product.name,
                  description: product.description || "",
                  category: product.category,
                  price: String(product.price),
                  stock_qty: product.stock_qty === null ? "" : String(product.stock_qty),
                  is_active: product.is_active,
                }}
                categories={categories}
                onSubmit={(data) => handleUpdate(product.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <strong>{product.name}</strong> <span style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>({product.category})</span>
                    <div style={{ fontSize: 13, marginTop: 2 }}>
                      {fmt(product.price)} &middot; {product.stock_qty === null ? "unlimited stock" : `${product.stock_qty} in stock`}
                    </div>
                    {product.description && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>{product.description}</div>}
                  </div>
                  <span className={`checkin-badge ${product.is_active ? "in" : "out"}`}>
                    {product.is_active ? "Available online" : "Hidden"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="link-btn" onClick={() => setEditingId(product.id)}>
                    Edit
                  </button>
                  <button className="link-btn" onClick={() => toggleActive(product)}>
                    {product.is_active ? "Hide from shop" : "Show in shop"}
                  </button>
                  <button className="link-btn" style={{ color: "var(--rust-dark)" }} onClick={() => handleDelete(product.id)}>
                    Delete
                  </button>
                </div>
                <ProductPhotos product={product} onChanged={load} />
              </>
            )}
          </div>
        ))}

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
