import { useEffect, useState } from "react";
import { posApi } from "../posApi.js";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

export default function Customers() {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    posApi.listCustomers().then(setCustomers);
  }, []);

  const filtered = customers
    ? customers.filter((c) => {
        const needle = search.trim().toLowerCase();
        return !needle || c.name.toLowerCase().includes(needle) || c.phone.includes(needle);
      })
    : [];

  async function addCustomer() {
    const name = addName.trim();
    const phone = addPhone.trim();
    if (!name || !phone) {
      setError("Enter both a name and phone number.");
      return;
    }
    try {
      const customer = await posApi.createCustomer({ name, phone });
      setCustomers((prev) => [customer, ...prev]);
      setShowAdd(false);
      setAddName("");
      setAddPhone("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function saveEdit(id) {
    const name = editName.trim();
    const phone = editPhone.trim();
    if (!name || !phone) {
      setEditError("Name and phone can't be empty.");
      return;
    }
    try {
      const updated = await posApi.updateCustomer(id, { name, phone });
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
      setEditError("");
    } catch (err) {
      setEditError(err.message);
    }
  }

  if (!customers) return <p>Loading&hellip;</p>;

  return (
    <div className="panel">
      <h3>Customers ({customers.length})</h3>
      <div className="form-field" style={{ marginBottom: 10 }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-note">No customers found.</div>
      ) : (
        <table className="log-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Points</th>
              <th>Visits</th>
              <th>Total spent</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ fontSize: 13, padding: 4, width: "100%" }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      style={{ fontSize: 13, padding: 4, width: "100%" }}
                    />
                  </td>
                  <td>{c.points}</td>
                  <td>{c.visits}</td>
                  <td>{fmt(c.total_spent)}</td>
                  <td>{new Date(c.joined_at).toLocaleDateString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-btn" onClick={() => saveEdit(c.id)}>
                      Save
                    </button>{" "}
                    <button className="link-btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                    {editError && <div className="error-text">{editError}</div>}
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.points}</td>
                  <td>{c.visits}</td>
                  <td>{fmt(c.total_spent)}</td>
                  <td>{new Date(c.joined_at).toLocaleDateString()}</td>
                  <td>
                    <button className="link-btn" onClick={() => startEdit(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
      <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setShowAdd((v) => !v)}>
        {showAdd ? "Cancel" : "+ Add customer manually"}
      </button>
      {showAdd && (
        <>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label>Name</label>
              <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input type="text" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="e.g. 0803..." />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="log-btn" onClick={addCustomer}>
            Save customer
          </button>
        </>
      )}
    </div>
  );
}
