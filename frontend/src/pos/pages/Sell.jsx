import { useEffect, useRef, useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi, PAYMENT_METHODS } from "../posApi.js";
import { shopApi } from "../../shop/shopApi.js";
import { queueSale, cacheMenu, cachedMenu, isNetworkError } from "../offline.js";
import ApprovalModal from "./ApprovalModal.jsx";
import ModifierPicker from "./ModifierPicker.jsx";
import { RECEIPT_LOGO } from "../receiptLogo.js";
import { directPrintOn, setDirectPrint, sendRaw, encodeReceipt, encodeKitchen, prepareLogo } from "../escpos.js";

const CATEGORY_ORDER = ["Hot Coffee", "Iced Coffee", "Special Brews", "Tea", "Juices", "Smoothies", "Milkshakes", "Lemonades", "Breakfast", "Lunch", "Brunch", "Bakery", "Cakes", "Cheesecakes", "Mocktails", "Cocktails", "Schweppes", "Beer", "Extras"];

// Coffee is one category in the DB (so the shop keeps grouping it), but on the
// till it reads cleaner split into three tabs, derived from the drink name.
const SPECIAL_COFFEE = new Set(["Maple Cream Brew", "Spanish Latte", "Oreo Latte", "Chai Latte", "Chocolate Latte"]);
function coffeeTab(nm) {
  if (/^(Iced|Ice Blended)/i.test(nm) || nm === "Dalgona Whipped Coffee") return "Iced Coffee";
  if (/matcha/i.test(nm) || SPECIAL_COFFEE.has(nm)) return "Special Brews";
  return "Hot Coffee";
}
// The tab an item belongs to (coffee items map to one of the three coffee tabs).
function tabOf(item) {
  return item.category === "Coffee" ? coffeeTab(item.name) : item.category;
}
const NAIRA_PER_POINT_REDEEM = 1;

function tabTotal(tab) {
  return tab.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// "25m" / "2h 10m" — how long a table has been sitting on an unpaid tab.
function since(iso) {
  // Server times are UTC; if the string carries no zone, say so explicitly
  // rather than letting the browser read it as local time.
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const ms = new Date(hasZone ? iso : `${iso}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const h = Math.floor(mins / 60), m = mins % 60;
  const hr = `${h} hr${h === 1 ? "" : "s"}`;
  return (m ? `${hr} ${m} min${m === 1 ? "" : "s"}` : hr) + " ago";
}

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

// Café details printed at the top of every receipt.
const CAFE = {
  name: "Strobriē",
  tagline: "by Joanne",
  address: "HFIA Garden, Off Tafawa Balewa Way, Garki, Abuja",
  website: "www.strobrie.com",
  phones: "0809 070 1995 / 0802 912 5229",
};
const VAT_RATE = 7.5; // Nigerian VAT, already included in menu prices.
const ORDER_TYPE_LABEL = { dine_in: "Dine in", takeaway: "Takeaway/Delivery", delivery: "Takeaway/Delivery" };
// The café's seats/tables, picked from a dropdown to name an order or tab.
// "Custom" lets staff type anything (a walk-in, a customer's name, takeaway).
const TABLES = ["Black Table", "Wood Table - Short", "Lovers Corner", "Rustic Table", "Reading Nook", "Blue sofa", "Outside"];
const CUSTOM = "__custom__";

// Remember which saved tickets had loyalty skipped, so the loyalty box doesn't
// pop back up each time that ticket is reopened.
const LOYALTY_SKIP_KEY = "flow_loyalty_skipped_tabs";
function readSkippedTabs() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOYALTY_SKIP_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markTabLoyaltySkipped(id) {
  if (id == null) return;
  try {
    const s = readSkippedTabs();
    s.add(id);
    localStorage.setItem(LOYALTY_SKIP_KEY, JSON.stringify([...s]));
  } catch {
    /* storage unavailable — skip just won't persist across reopen */
  }
}

// Remember each saved ticket's order type (tabs don't store it server-side), so
// reopening a ticket shows its own type instead of the last-used one.
const TAB_TYPE_KEY = "flow_tab_types";
function readTabTypes() {
  try {
    return JSON.parse(localStorage.getItem(TAB_TYPE_KEY) || "{}");
  } catch {
    return {};
  }
}
function markTabType(id, type) {
  if (id == null) return;
  try {
    const m = readTabTypes();
    m[id] = type;
    localStorage.setItem(TAB_TYPE_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable — fall back to the label heuristic on reopen */
  }
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Cart item names carry their modifiers after " · " (e.g. "8\" Cake · Chocolate").
function splitItem(name) {
  const parts = String(name).split(" · ");
  return { base: parts[0], mods: parts.slice(1).join(", ") };
}

// Items to send to the kitchen on a tab save: the whole cart for a new tab, or
// only the newly-added quantities when adding to an existing tab (so the kitchen
// doesn't re-make what it already got).
function kitchenDelta(cartLines, tab) {
  if (!tab) return cartLines;
  const prev = {};
  tab.items.forEach((i) => {
    prev[i.name] = (prev[i.name] || 0) + i.qty;
  });
  const out = [];
  cartLines.forEach((c) => {
    const add = c.qty - (prev[c.name] || 0);
    if (add > 0) out.push({ ...c, qty: add });
  });
  return out;
}

// Print by writing into a hidden iframe and calling print() on it — works when
// fired programmatically after an async charge (a popup window would be blocked).
function printHTML(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow;
  win.onafterprint = () => setTimeout(() => frame.remove(), 300);
  let fired = false;
  const doPrint = () => {
    if (fired) return;
    fired = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* printing unavailable — ignore */
    }
  };
  // Wait for any images (the logo) to finish loading first, so the receipt
  // isn't printed blank. Fall back to a timer if an image never resolves.
  const imgs = Array.from(doc.images || []);
  const pending = imgs.filter((img) => !img.complete);
  if (pending.length) {
    let left = pending.length;
    const one = () => {
      if (--left <= 0) setTimeout(doPrint, 60);
    };
    pending.forEach((img) => {
      img.onload = one;
      img.onerror = one;
    });
    setTimeout(doPrint, 2000); // safety net
  } else {
    setTimeout(doPrint, 90);
  }
  // Fallback cleanup in case onafterprint never fires (e.g. dialog dismissed oddly).
  setTimeout(() => frame.parentNode && frame.remove(), 120000);
}

const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; width: 100%; margin: 0; color: #000; font-size: 13.5px; line-height: 1.4; }
  .c { text-align: center; }
  .logo { width: 58mm; max-width: 100%; height: auto; margin: 2px 0 6px; }
  .small { font-size: 12px; }
  .hr { border-top: 1px dashed #000; margin: 7px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .meta { font-size: 13.5px; margin: 2px 0; }
  .item { margin: 7px 0; }
  .item .row { font-size: 15px; }
  .item .sub { font-size: 11.5px; padding-left: 2px; }
  .item .mod { font-size: 12.5px; padding-left: 10px; }
  .total { font-size: 19px; font-weight: 700; }
  .right { text-align: right; }
`;

function receiptHTML(r) {
  const tax = Math.round((r.total * VAT_RATE) / (100 + VAT_RATE));
  const items = r.items
    .map((it) => {
      const { base, mods } = splitItem(it.name);
      return `<div class="item">
        <div class="row"><span>${esc(base)}</span><span class="right">${fmt(it.price * it.qty)}</span></div>
        <div class="sub">${it.qty} × ${fmt(it.price)}</div>
        ${mods ? `<div class="mod">${esc(mods)}</div>` : ""}
      </div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>${RECEIPT_CSS}</style></head><body>
    <div class="c"><img class="logo" src="${RECEIPT_LOGO}" alt="Strobriē"></div>
    <div class="c small">${esc(CAFE.address)}</div>
    <div class="c small">${CAFE.website}</div>
    <div class="c small">${CAFE.phones}</div>
    ${r.bill ? `<div class="c" style="font-weight:700;font-size:17px;margin-top:5px">*** BILL — NOT PAID ***</div>` : ""}
    <div class="hr"></div>
    ${r.orderName ? `<div class="meta">Order: ${esc(r.orderName)}</div>` : ""}
    <div class="meta">Employee: ${esc(r.staffName)}</div>
    <div class="meta row"><span>${ORDER_TYPE_LABEL[r.orderType] || "Dine in"}</span><span class="small">${new Date(r.timestamp).toLocaleString()}</span></div>
    <div class="hr"></div>
    ${items}
    <div class="hr"></div>
    ${r.discount > 0 ? `<div class="row"><span>Subtotal</span><span>${fmt(r.subtotal)}</span></div><div class="row"><span>Loyalty discount</span><span>-${fmt(r.discount)}</span></div>` : ""}
    <div class="row total"><span>Total</span><span>${fmt(r.total)}</span></div>
    <div class="row small"><span>Tax inc. ${VAT_RATE}%</span><span>${fmt(tax)}</span></div>
    ${r.bill
      ? `<div class="row total"><span>Amount due</span><span>${fmt(r.total)}</span></div>`
      : `<div class="row"><span>${esc(r.paymentMethod)}</span><span>${fmt(r.total)}</span></div>`}
    ${!r.bill && r.customerName ? `<div class="row small"><span>${esc(r.customerName)}</span><span>+${r.pointsEarned} pts</span></div>` : ""}
    <div class="hr"></div>
    <div class="c">${r.bill ? "Not paid yet — please pay at the counter." : "Thank you!"}</div>
  </body></html>`;
}

// Some drinks are named by flavour alone (e.g. a milkshake just called
// "Vanilla", a lemonade called "Blueberry"), so prefix the drink type to keep
// it unambiguous on the order panel and bar ticket — but only when the name
// doesn't already say it. The menu tile itself keeps the short name.
const DRINK_TYPE_LABEL = {
  Juices: "Juice", Smoothies: "Smoothie", Milkshakes: "Milkshake", Lemonades: "Lemonade",
};
function drinkFullName(base, category) {
  const label = DRINK_TYPE_LABEL[category];
  if (label && !base.toLowerCase().includes(label.toLowerCase())) return `${label} – ${base}`;
  return base;
}

function kitchenHTML(k) {
  const items = k.items
    .map((it) => {
      const { base, mods } = splitItem(it.name);
      const shown = drinkFullName(base, it.category);
      const parts = mods ? mods.split(", ") : [];
      const choices = parts.filter((m) => !m.startsWith("+ "));
      const extras = parts.filter((m) => m.startsWith("+ ")).map((m) => m.slice(2));
      const choiceLine = choices.length ? `<div class="kmod">${esc(choices.join(", "))}</div>` : "";
      const extraLines = extras.map((e) => `<div class="kextra">ADD: ${esc(e)}</div>`).join("");
      return `<div class="kitem"><div class="krow">${it.qty} x ${esc(shown)}</div>${choiceLine}${extraLines}</div>`;
    })
    .join("");
  const css = `
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body { font-family: "Courier New", monospace; width: 100%; margin: 0; color: #000; font-size: 15px; }
    .hdr { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 2px; }
    .no { text-align: center; font-size: 30px; font-weight: 700; margin-top: 3px; }
    .ord { text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 6px; }
    .meta { font-size: 15px; margin: 2px 0; }
    .hr { border-top: 2px dashed #000; margin: 8px 0; }
    .type { display: flex; justify-content: space-between; align-items: baseline; font-size: 22px; font-weight: 700; }
    .type .dt { font-size: 13px; font-weight: 400; }
    .kitem { margin: 11px 0; }
    .krow { font-size: 21px; font-weight: 700; }
    .kmod { font-size: 16px; padding-left: 16px; }
    .kextra { font-size: 18px; font-weight: 700; padding-left: 16px; margin-top: 3px; }
    .knote { font-size: 21px; font-weight: 700; text-align: center; border: 2px solid #000; padding: 6px; margin-top: 4px; }
    .topgap { height: 32mm; }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kitchen</title><style>${css}</style></head><body>
    <div class="topgap"></div>
    <div class="hdr">*** ${esc(k.station || "KITCHEN")} ***</div>
    ${k.orderNo ? `<div class="no">#${esc(k.orderNo)}</div>` : ""}
    ${k.orderName ? `<div class="ord">${esc(k.orderName)}</div>` : ""}
    <div class="meta">${esc(k.staffName)}</div>
    <div class="hr"></div>
    <div class="type"><span>${ORDER_TYPE_LABEL[k.orderType] || "Dine in"}</span><span class="dt">${new Date(k.timestamp).toLocaleString()}</span></div>
    <div class="hr"></div>
    ${items}
    <div class="hr"></div>
    ${k.note && k.note.trim() ? `<div class="knote">NOTE: ${esc(k.note.trim())}</div>` : ""}
  </body></html>`;
}

function printReceipt(receipt) {
  if (directPrintOn()) {
    try {
      sendRaw(encodeReceipt(receipt, CAFE, VAT_RATE));
      return;
    } catch {
      /* fall back to the HTML print path below */
    }
  }
  printHTML(receiptHTML(receipt));
}

function printKitchenTicket(ticket) {
  if (directPrintOn()) {
    try {
      sendRaw(encodeKitchen(ticket));
      return;
    } catch {
      /* fall back to the HTML print path below */
    }
  }
  printHTML(kitchenHTML(ticket));
}

// The bar makes drinks and plates the bakery; the kitchen makes food — different
// stations, so an order can print two tickets. (Coffee is one DB category.)
const BAR_CATEGORIES = new Set([
  "Coffee", "Tea", "Juices", "Smoothies", "Milkshakes", "Lemonades", "Mocktails", "Cocktails", "Schweppes", "Beer",
  "Bakery",
]);
// Whole cakes / cheesecakes are pre-made and logged in a book — no prep ticket.
const NO_PRINT_CATEGORIES = new Set(["Cakes", "Cheesecakes"]);
// The Brunch category mixes food and drinks, so its drinks are listed by name.
const BRUNCH_DRINKS = new Set([
  "Blueberry Lemosas", "Virgin Orange Mimosa", "Virgin Sunrise Mimosa",
  "Mermaids Kiss", "Ginger Lemon Spritz", "Orange Mimosas", "Whiskey Lemonade",
]);
const isBar = (item) => {
  if (BAR_CATEGORIES.has(item.category)) return true;
  if (item.category === "Brunch") {
    const base = splitItem(item.name).base;
    return BRUNCH_DRINKS.has(base) || /mimosa|lemosa|spritz|mocktail/i.test(base);
  }
  return false;
};

// Print the kitchen ticket(s): a FOOD ticket (kitchen) and/or a BAR ticket
// (drinks + bakery). Whole cakes/cheesecakes are skipped. Only stations with
// items print.
function printKitchenTickets({ items, ...common }) {
  const printable = items.filter((i) => !NO_PRINT_CATEGORIES.has(i.category));
  const food = printable.filter((i) => !isBar(i));
  const bar = printable.filter((i) => isBar(i));
  if (food.length) printKitchenTicket({ ...common, items: food, station: "FOOD" });
  if (bar.length) {
    const printBar = () => printKitchenTicket({ ...common, items: bar, station: "BAR" });
    // Stagger the second ticket so the two print jobs queue in order.
    if (food.length) setTimeout(printBar, 700);
    else printBar();
  }
}

// A sample receipt to confirm the printer (e.g. RawBT → Bluetooth) is connected.
function printTestReceipt() {
  printReceipt({
    items: [{ name: "Americano · Whole Milk", qty: 1, price: 5200 }],
    subtotal: 5200,
    discount: 0,
    total: 5200,
    paymentMethod: "Cash",
    staffName: "Printer test",
    customerName: null,
    pointsEarned: 0,
    timestamp: new Date().toISOString(),
    orderType: "dine_in",
    orderName: "PRINTER TEST",
  });
}

export default function Sell() {
  const { currentStaff, canManageOps, staffList } = usePosAuth();
  // Staff need a front-desk/manager PIN to close a tab or reduce its total.
  const [pendingApproval, setPendingApproval] = useState(null); // { label, run }
  const [modifierProduct, setModifierProduct] = useState(null); // product being configured
  const [search, setSearch] = useState("");
  const approvers = (staffList || []).filter((s) => s.role === "front_desk" || s.role === "manager");
  const [menu, setMenu] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState("");
  const [payMethod, setPayMethod] = useState(""); // "" (none yet) until staff pick one
  const [directPrint, setDirectPrintState] = useState(directPrintOn); // RawBT ESC/POS auto-cut
  function toggleDirectPrint() {
    const next = !directPrint;
    setDirectPrint(next);
    setDirectPrintState(next);
  }

  const [custSearchPhone, setCustSearchPhone] = useState("");
  const [custSearchResult, setCustSearchResult] = useState("idle");
  const [attachedCustomer, setAttachedCustomer] = useState(null);
  const [custSuggestions, setCustSuggestions] = useState([]); // live matches as the waitress types
  const [redeemPoints, setRedeemPoints] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [custFormError, setCustFormError] = useState("");

  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);   // the tab loaded into the cart, if any
  const [tabBusy, setTabBusy] = useState(false);
  const [tabError, setTabError] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [editingPriceIdx, setEditingPriceIdx] = useState(null);  // cart line being repriced
  const [priceDraft, setPriceDraft] = useState("");

  const [chargeStatus, setChargeStatus] = useState("idle");
  const [chargeError, setChargeError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [savedFlash, setSavedFlash] = useState(""); // brief "saved" note beside the heading
  const savedTimer = useRef(null);

  function flashSaved(message, ms = 6000) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedFlash(message);
    savedTimer.current = setTimeout(() => setSavedFlash(""), ms);
  }

  function showToast(message, ms = 8000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }

  function clearToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast("");
  }

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);
  const [lastReceipt, setLastReceipt] = useState(null);
  // Printed on receipts + kitchen tickets, and used as the tab name. orderType
  // stays as last used; the table/name clears with each order.
  const [orderType, setOrderType] = useState(""); // "" (none yet) | dine_in | takeaway | delivery
  const [tableChoice, setTableChoice] = useState(""); // "" (none) | a table | CUSTOM
  const [customTable, setCustomTable] = useState("");
  const [loyaltySkipped, setLoyaltySkipped] = useState(false); // "no loyalty for this order"
  const [orderNote, setOrderNote] = useState(""); // special request, printed on the kitchen/bar ticket
  // The one order name — from the table dropdown, or the custom field.
  // Only dine-in picks a table from the dropdown; takeaway/delivery type a name.
  const orderName = (orderType === "dine_in" ? (tableChoice === CUSTOM ? customTable : tableChoice) : customTable).trim();
  // Tables with an open ticket are occupied — hide them from the dropdown so a
  // new order can't be started on a table that's already in use. "Outside" is an
  // area that can hold several orders at once, so it's never treated as occupied.
  const occupiedTables = new Set(openTabs.map((t) => t.label).filter((l) => l !== "Outside"));
  // A new order is set up in three steps, each revealing the next: pick a type,
  // then a table/name, then handle loyalty (find a customer or skip). Only when
  // all three are answered does the rest of the panel (items, totals, charge)
  // appear. A saved ticket skips straight to the full panel.
  const typeAnswered = orderType !== "";
  const nameAnswered =
    orderType === "dine_in"
      ? tableChoice !== "" && (tableChoice !== CUSTOM || customTable.trim() !== "")
      : customTable.trim() !== "";
  const loyaltyAnswered = !!attachedCustomer || loyaltySkipped;
  const showLoyaltyStep = !!activeTab || (typeAnswered && nameAnswered);
  const setupDone = !!activeTab || (typeAnswered && nameAnswered && loyaltyAnswered);

  // Live connection state, so the till can switch to offline selling and so we
  // can disable loyalty redemption (balance can't be verified without a server).
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function pickMenu(items) {
    // Only sell active products — a retired tile (e.g. an old merged flavour
    // picker that was split into individual tiles) stays in the DB for the
    // Products tab but must not show on the till.
    const active = items.filter((i) => i.is_active !== false);
    setMenu(active);
    setActiveCat((prev) => prev || CATEGORY_ORDER.find((c) => active.some((i) => tabOf(i) === c)) || active[0]?.category);
    return active;
  }

  function loadMenu() {
    return shopApi
      .adminListProducts()
      .then((items) => {
        cacheMenu(items); // keep a copy so the till can still sell offline
        return pickMenu(items);
      })
      .catch((err) => {
        // Offline / server unreachable: fall back to the last menu we cached.
        const cached = cachedMenu();
        if (cached) return pickMenu(cached);
        throw err;
      });
  }

  function loadTabs() {
    return posApi.listTabs().then(setOpenTabs);
  }

  useEffect(() => {
    loadMenu();
    loadTabs();
    prepareLogo(RECEIPT_LOGO); // render the logo to an ESC/POS bitmap for direct prints
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live customer suggestions as the waitress types a name or part of a number.
  useEffect(() => {
    const q = custSearchPhone.trim();
    if (attachedCustomer || q.length < 2) {
      setCustSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      posApi
        .listCustomers(q)
        .then((list) => {
          if (!cancelled) setCustSuggestions((list || []).slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setCustSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [custSearchPhone, attachedCustomer]);

  const categories = menu ? CATEGORY_ORDER.filter((c) => menu.some((i) => tabOf(i) === c)) : [];
  const searchQuery = search.trim().toLowerCase();
  // When searching, match across ALL items by name; otherwise show the tab.
  const itemsInCat = menu
    ? searchQuery
      ? menu.filter((i) => i.name.toLowerCase().includes(searchQuery))
      : menu.filter((i) => tabOf(i) === activeCat)
    : [];

  function qtyInCart(itemId) {
    return cart.find((c) => c.menuItemId === itemId)?.qty || 0;
  }

  // A product with priced choices opens the picker; a composed line is added
  // (not merged, since each selection is distinct).
  function addModifierLine({ name, price }) {
    const p = modifierProduct;
    setCart((prev) => [...prev, { menuItemId: p.id, name, category: p.category, price, qty: 1 }]);
    setModifierProduct(null);
  }

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      const currentQty = existing?.qty || 0;
      if (item.stock_qty !== null && currentQty >= item.stock_qty) return prev;
      if (existing) {
        return prev.map((c) => (c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { menuItemId: item.id, name: item.name, category: item.category, price: item.price, qty: 1 }];
    });
  }

  function changeQty(idx, delta) {
    setCart((prev) => {
      const line = prev[idx];
      const menuItem = menu?.find((m) => m.id === line.menuItemId);
      const nextQty = line.qty + delta;
      if (menuItem?.stock_qty !== null && menuItem?.stock_qty !== undefined && nextQty > menuItem.stock_qty) return prev;
      const next = [...prev];
      next[idx] = { ...line, qty: nextQty };
      return next.filter((c) => c.qty > 0);
    });
  }

  function removeLine(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  // Repricing a line (a different cake size, say) is edited in place. It used
  // window.prompt, which throws in a browser that suppresses dialogs — the
  // kind a till runs — so tapping "edit" did nothing at all.
  function startEditPrice(idx) {
    setEditingPriceIdx(idx);
    setPriceDraft(String(cart[idx].price));
  }

  function cancelEditPrice() {
    setEditingPriceIdx(null);
    setPriceDraft("");
  }

  function commitEditPrice(idx) {
    const val = parseFloat(priceDraft);
    if (!isNaN(val) && val > 0) {
      setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, price: val } : c)));
    }
    cancelEditPrice();
  }

  function addCustomItem() {
    const name = customName.trim();
    const price = parseFloat(customPrice);
    if (!name) {
      setCustomError("Enter an item name.");
      return;
    }
    if (!price || price <= 0) {
      setCustomError("Enter a price greater than 0.");
      return;
    }
    setCart((prev) => [...prev, { menuItemId: null, name, category: "Other", price, qty: 1 }]);
    setCustomName("");
    setCustomPrice("");
    setCustomError("");
    setShowCustomForm(false);
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const requestedRedeem = parseInt(redeemPoints) || 0;
  const cappedRedeem = attachedCustomer ? Math.max(0, Math.min(requestedRedeem, attachedCustomer.points)) : 0;
  const discount = attachedCustomer ? Math.min(cappedRedeem * NAIRA_PER_POINT_REDEEM, subtotal) : 0;
  const finalTotal = subtotal - discount;

  // Print the current (in-progress) order: kitchen ticket or customer receipt.
  function printCurrentOrder() {
    if (cart.length === 0) return;
    printKitchenTickets({
      items: cart,
      orderNo: activeTab ? activeTab.id : undefined,
      orderName: activeTab ? activeTab.label : orderName,
      orderType,
      staffName: currentStaff.name,
      timestamp: new Date().toISOString(),
      note: orderNote,
    });
  }
  function printCurrentBill() {
    if (cart.length === 0) return;
    printReceipt({
      items: cart,
      subtotal,
      discount,
      total: finalTotal,
      paymentMethod: payMethod,
      staffName: currentStaff.name,
      customerName: attachedCustomer?.name ?? null,
      pointsEarned: 0,
      timestamp: new Date().toISOString(),
      orderType,
      orderName: activeTab ? activeTab.label : orderName,
      note: orderNote,
      bill: true,
    });
  }

  async function searchCustomer() {
    const phone = custSearchPhone.trim();
    if (!phone) {
      setCustSearchResult("idle");
      return;
    }
    try {
      const customer = await posApi.lookupCustomer(phone);
      setAttachedCustomer(customer);
      setCustSearchResult("found");
    } catch {
      setCustSearchResult("notfound");
    }
  }

  function detachCustomer() {
    setAttachedCustomer(null);
    setCustSearchPhone("");
    setRedeemPoints("");
    setCustSearchResult("idle");
    setCustSuggestions([]);
  }

  function attachSuggestion(c) {
    setAttachedCustomer(c);
    setCustSearchResult("found");
    setCustSuggestions([]);
  }

  async function quickAddCustomer() {
    const name = newCustName.trim();
    const phone = custSearchPhone.trim();
    if (!name || !phone) {
      setCustFormError("Enter both a name and phone number.");
      return;
    }
    try {
      const customer = await posApi.createCustomer({ name, phone });
      setAttachedCustomer(customer);
      setCustSearchResult("found");
      setNewCustName("");
      setCustFormError("");
    } catch (err) {
      setCustFormError(err.message);
    }
  }

  function cartToLines() {
    return cart.map((c) => ({
      menu_item_id: c.menuItemId,
      name: c.name,
      category: c.category,
      qty: c.qty,
      price: c.price,
    }));
  }

  function clearOrder() {
    setCart([]);
    setActiveTab(null);
    setTabError("");
    setConfirmingClose(false);
    setOrderType("");
    setTableChoice("");
    setCustomTable("");
    setLoyaltySkipped(false);
    setPayMethod("");
    setOrderNote("");
    setSavedFlash("");
    detachCustomer();
  }

  // "Change" the order type after picking the wrong one: clear the type and the
  // table/name so both options show again. Cart and loyalty are left as-is.
  function resetOrderType() {
    setOrderType("");
    setTableChoice("");
    setCustomTable("");
  }

  // Put a saved tab back on screen so it can be added to or paid off.
  function openTab(tab) {
    setCart(
      tab.items.map((i) => ({
        menuItemId: i.menu_item_id,
        name: i.name,
        category: i.category,
        price: i.price,
        qty: i.qty,
      })),
    );
    setActiveTab(tab);
    // Restore this ticket's own order type — from memory, else inferred from the
    // label (a preset table → dine in, otherwise takeaway/delivery).
    setOrderType(readTabTypes()[tab.id] || (TABLES.includes(tab.label) ? "dine_in" : "takeaway"));
    setLoyaltySkipped(readSkippedTabs().has(tab.id)); // keep loyalty hidden if it was skipped before
    // Reflect the tab's name in the dropdown (a preset table, else Custom).
    if (TABLES.includes(tab.label)) {
      setTableChoice(tab.label);
      setCustomTable("");
    } else {
      setTableChoice(CUSTOM);
      setCustomTable(tab.label || "");
    }
    setTabError("");
    clearToast();
    setAttachedCustomer(tab.customer ?? null);
    setCustSearchResult(tab.customer ? "found" : "idle");
    setCustSearchPhone(tab.customer?.phone ?? "");
    setRedeemPoints("");
  }

  // The order's table/name (from the dropdown) is also the tab name — no
  // separate "name this tab" step. An existing tab keeps its own label.
  function startSaveTab() {
    if (cart.length === 0) return;
    setTabError("");
    saveTab(activeTab ? activeTab.label : orderName);
  }

  function saveTab(rawLabel) {
    if (cart.length === 0) return;
    // A name is optional — fall back to the order type so the ticket still saves.
    const label = (rawLabel ?? "").trim() || ORDER_TYPE_LABEL[orderType] || "Order";
    // Staff can add to a tab freely, but reducing its total needs approval.
    if (activeTab && !canManageOps && subtotal < tabTotal(activeTab)) {
      setPendingApproval({ label: "save this ticket with items removed", run: () => doSaveTab(label) });
      return;
    }
    doSaveTab(label);
  }

  async function doSaveTab(label) {
    setTabBusy(true);
    setTabError("");
    try {
      const body = { label, items: cartToLines(), customer_id: attachedCustomer?.id ?? null };
      const saved = activeTab
        ? await posApi.updateTab(activeTab.id, body)
        : await posApi.openTab({ staff_id: currentStaff.id, ...body });
      // Send the new items to the kitchen (whole order for a new tab, only the
      // added items when topping up an existing one).
      const kitchen = kitchenDelta(cart, activeTab);
      // The kitchen + bar tickets print automatically whenever a ticket is saved
      // (only the newly-added items on a top-up, via kitchenDelta).
      if (kitchen.length) {
        printKitchenTickets({
          items: kitchen,
          orderNo: saved.id,
          orderName: label,
          orderType,
          staffName: currentStaff.name,
          timestamp: new Date().toISOString(),
          note: orderNote,
        });
      }
      await loadTabs();
      loadMenu();
      setLastReceipt(null);
      const wasUpdate = !!activeTab;
      // Remember this ticket's order type + any loyalty skip for when it reopens.
      markTabType(saved.id, orderType || "dine_in");
      if (loyaltySkipped && !attachedCustomer) markTabLoyaltySkipped(saved.id);
      // Keep the saved ticket on screen (don't clear) — staff start a fresh one
      // with the "New Order" button when they're ready.
      openTab(saved);
      flashSaved(wasUpdate ? "Items saved" : "Ticket saved");
    } catch (err) {
      setTabError(err.message);
    } finally {
      setTabBusy(false);
    }
  }

  function cancelTab() {
    if (!activeTab) return;
    // Staff need a front-desk/manager PIN to void a tab.
    if (!canManageOps) {
      setPendingApproval({ label: "void this ticket", run: doCancelTab });
      return;
    }
    doCancelTab();
  }

  async function doCancelTab() {
    if (!activeTab) return;
    setTabBusy(true);
    setTabError("");
    try {
      await posApi.cancelTab(activeTab.id, currentStaff.id);
      await loadTabs();
      loadMenu();
      clearOrder();
      setLastReceipt(null);
      showToast("Tab closed without payment.", 6000);
    } catch (err) {
      setTabError(err.message);
    } finally {
      setTabBusy(false);
    }
  }

  function charge() {
    if (cart.length === 0) return;
    // Staff taking payment on a tab for less than it was saved at needs approval.
    if (activeTab && !canManageOps && subtotal < tabTotal(activeTab)) {
      setPendingApproval({ label: "take payment on this ticket with items removed", run: doCharge });
      return;
    }
    doCharge();
  }

  async function doCharge() {
    if (cart.length === 0) return;
    setChargeStatus("submitting");
    setChargeError("");
    // Tabs and loyalty redemption need the live server; they're online-only.
    if (activeTab && !navigator.onLine) {
      setChargeError("You're offline — tabs need a connection. Take this as a direct sale instead.");
      setChargeStatus("idle");
      return;
    }
    try {
      const body = {
        staff_id: currentStaff.id,
        payment_method: payMethod,
        items: cartToLines(),
        customer_id: attachedCustomer?.id ?? null,
        redeem_points: navigator.onLine ? cappedRedeem : 0,
      };

      let sale;
      let queued = false;
      if (activeTab) {
        // Settling a tab records the same sale, and closes the tab with it.
        sale = await posApi.settleTab(activeTab.id, body);
      } else if (!navigator.onLine) {
        sale = queueSale(body); // save locally, sync later
        queued = true;
      } else {
        try {
          sale = await posApi.charge(body);
        } catch (err) {
          // Connection dropped mid-charge: don't lose the sale — queue it.
          if (isNetworkError(err)) {
            sale = queueSale(body);
            queued = true;
          } else {
            throw err;
          }
        }
      }

      const receipt = {
        items: cart,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        paymentMethod: sale.payment_method,
        staffName: currentStaff.name,
        customerName: attachedCustomer?.name ?? null,
        pointsEarned: sale.points_earned,
        timestamp: sale.timestamp,
        orderType,
        note: orderNote,
        // A tab carries its own name; a direct sale uses the typed order name.
        orderName: activeTab ? activeTab.label : orderName.trim(),
      };
      setLastReceipt(receipt);
      // Receipt prints automatically on payment. For a pay-now direct sale the
      // kitchen hasn't seen the order yet, so send it a ticket too (a settled tab
      // already got one at save).
      printReceipt(receipt);
      if (!activeTab) {
        printKitchenTickets({
          items: cart,
          orderNo: sale.id,
          orderName: receipt.orderName,
          orderType,
          staffName: currentStaff.name,
          timestamp: receipt.timestamp,
          note: orderNote,
        });
      }
      const custNote = attachedCustomer ? ` — ${attachedCustomer.name} earned ${sale.points_earned} pts` : "";
      showToast(
        queued
          ? `Saved offline — ${fmt(sale.total)} (${sale.payment_method}). Will sync when you're back online.`
          : `Sale recorded — ${fmt(sale.total)} (${sale.payment_method})${custNote}`,
      );
      clearOrder();
      setChargeStatus("idle");
      if (!queued) {
        loadMenu();
        if (activeTab) loadTabs();
      }
    } catch (err) {
      setChargeError(err.message);
      setChargeStatus("idle");
    }
  }

  if (!menu) return <p>Loading menu&hellip;</p>;

  return (
    <div className="layout">
      <div>
        {openTabs.length > 0 && (
          <div className="panel" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openTabs.map((t) => (
                <button
                  key={t.id}
                  className={`cat-btn ${activeTab?.id === t.id ? "active" : ""}`}
                  onClick={() => openTab(t)}
                >
                  <strong>{t.label}</strong> &middot; {fmt(tabTotal(t))} &middot; {since(t.opened_at)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all items…"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 34px 10px 12px",
              fontSize: 14,
              background: "var(--white)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="link-btn"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", textDecoration: "none", fontSize: 16 }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 10 }}>
            {itemsInCat.length} result{itemsInCat.length === 1 ? "" : "s"} for “{search.trim()}”
          </div>
        ) : (
          <div className="categories">
            {categories.map((c) => (
              <button key={c} className={`cat-btn ${c === activeCat ? "active" : ""}`} onClick={() => setActiveCat(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="item-grid">
          {showCustomForm ? (
            <div className="item-card" style={{ cursor: "default" }}>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <input type="text" placeholder="Item name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Price (₦)"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
              {customError && <div className="error-text" style={{ marginBottom: 6 }}>{customError}</div>}
              <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5 }} onClick={addCustomItem}>
                Add to order
              </button>
            </div>
          ) : (
            <button className="item-card" style={{ borderStyle: "dashed" }} onClick={() => setShowCustomForm(true)}>
              <div className="name">+ Custom item</div>
              <div className="price">Any price, any name</div>
            </button>
          )}
          {itemsInCat.map((item) => {
            const remaining = item.stock_qty === null ? null : item.stock_qty - qtyInCart(item.id);
            const soldOut = remaining !== null && remaining <= 0;
            return (
              <button
                key={item.id}
                className="item-card"
                disabled={soldOut}
                style={soldOut ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => (item.modifiers?.length ? setModifierProduct(item) : addToCart(item))}
              >
                <div className="name">
                  {item.name}
                  {item.modifiers?.length > 0 && (
                    <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> ›</span>
                  )}
                </div>
                {soldOut ? <div className="price">Sold out</div> : <div className="price">{fmt(item.price)}</div>}
                {remaining !== null && !soldOut && (
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{remaining} left</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cart">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {activeTab ? `Ticket — ${activeTab.label}` : "New Order"}
              {savedFlash && (
                <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: "var(--sage)", verticalAlign: "middle" }}>
                  ✓ {savedFlash}
                </span>
              )}
            </h3>
            {activeTab && (
              <div style={{ marginTop: 5 }}>
                <span className="tab-status">
                  <span className="dot" />
                  Open · {since(activeTab.opened_at)}
                </span>
              </div>
            )}
          </div>
          {activeTab && (
            <button className="mini-btn" style={{ whiteSpace: "nowrap" }} onClick={clearOrder}>
              + New Order
            </button>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="pay-row" style={{ marginBottom: 8 }}>
            {(orderType === "" || orderType === "dine_in") && (
              <button className={`pay-btn ${orderType === "dine_in" ? "selected" : ""}`} onClick={() => setOrderType("dine_in")}>
                Dine in
              </button>
            )}
            {(orderType === "" || orderType === "takeaway") && (
              <button className={`pay-btn ${orderType === "takeaway" ? "selected" : ""}`} onClick={() => setOrderType("takeaway")}>
                Takeaway/Delivery
              </button>
            )}
            {!activeTab && orderType !== "" && (
              <button className="mini-btn" style={{ whiteSpace: "nowrap" }} onClick={resetOrderType}>
                Change
              </button>
            )}
          </div>
          {!activeTab && orderType === "dine_in" && (
            <div>
              <select className="order-input" value={tableChoice} onChange={(e) => setTableChoice(e.target.value)}>
                <option value="">Table / Order Name…</option>
                {TABLES.filter((t) => !occupiedTables.has(t)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value={CUSTOM}>Custom…</option>
              </select>
              {tableChoice === CUSTOM && (
                <input
                  className="order-input"
                  type="text"
                  autoFocus
                  value={customTable}
                  onChange={(e) => setCustomTable(e.target.value)}
                  placeholder="Name (customer, walk-in…)"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
          )}
          {!activeTab && orderType === "takeaway" && (
            <input
              className="order-input"
              type="text"
              value={customTable}
              onChange={(e) => setCustomTable(e.target.value)}
              placeholder="Name / Address"
            />
          )}
        </div>
        {showLoyaltyStep && (attachedCustomer || !loyaltySkipped) && (attachedCustomer ? (
          <div style={{ background: "var(--cream-2)", borderRadius: 8, padding: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>
                {attachedCustomer.name}
                <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}> · {attachedCustomer.points} pts</span>
              </strong>
              <button className="link-btn" onClick={detachCustomer}>
                Remove
              </button>
            </div>
            <div className="form-field">
              <label>Redeem points (₦{NAIRA_PER_POINT_REDEEM} off per point)</label>
              <input
                type="number"
                min="0"
                max={attachedCustomer.points}
                value={online ? redeemPoints : ""}
                disabled={!online}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setRedeemPoints("");
                    return;
                  }
                  setRedeemPoints(String(Math.max(0, Math.min(Number(raw) || 0, attachedCustomer.points))));
                }}
                placeholder={online ? "0" : "unavailable offline"}
              />
              {!online && (
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
                  Redeeming is off while offline — this sale still earns points.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--cream-2)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div className="form-field" style={{ marginBottom: 6 }}>
              <label>Customer name or phone (loyalty)</label>
              <input type="text" value={custSearchPhone} onChange={(e) => setCustSearchPhone(e.target.value)} placeholder="Name or 0803…" />
            </div>
            {custSuggestions.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 6, overflow: "hidden" }}>
                {custSuggestions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => attachSuggestion(c)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderTop: "1px solid var(--line)", cursor: "pointer", fontSize: 13 }}
                  >
                    <strong>{c.name}</strong>
                    <span style={{ color: "var(--ink-soft)" }}> · {c.phone} · {c.points} pts</span>
                  </button>
                ))}
              </div>
            )}
            <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5, marginTop: 0 }} onClick={searchCustomer}>
              Find customer
            </button>
            {!loyaltySkipped && (
              <button
                className="mini-btn"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => {
                  setLoyaltySkipped(true);
                  if (activeTab) markTabLoyaltySkipped(activeTab.id);
                }}
              >
                Skip loyalty
              </button>
            )}
            {custSearchResult === "notfound" && (
              <div style={{ marginTop: 10 }}>
                <div className="error-text" style={{ marginBottom: 6 }}>No customer with that number yet.</div>
                <div className="form-field" style={{ marginBottom: 6 }}>
                  <label>Name for new customer</label>
                  <input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Full name" />
                </div>
                {custFormError && <div className="error-text" style={{ marginBottom: 6 }}>{custFormError}</div>}
                <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5 }} onClick={quickAddCustomer}>
                  Add and attach
                </button>
              </div>
            )}
          </div>
        ))}

        {setupDone && (
          <>
        {cart.length > 0 &&
          cart.map((c, idx) => {
            const { base, mods } = splitItem(c.name);
            const parts = mods ? mods.split(", ") : [];
            const choices = parts.filter((m) => !m.startsWith("+ "));
            const extras = parts.filter((m) => m.startsWith("+ "));
            return (
            <div className="cart-line" key={idx}>
              <div className="info">
                <div className="n">{drinkFullName(base, c.category)}</div>
                {choices.length > 0 && <div className="mods">{choices.join(", ")}</div>}
                {extras.map((e, i) => (
                  <div className="mods extra" key={i}>{e}</div>
                ))}
                <div className="p" style={{ cursor: "default", textDecoration: "none" }}>
                  {fmt(c.price)}
                </div>
              </div>
              <div className="qty-ctrl">
                <button onClick={() => changeQty(idx, -1)}>−</button>
                <span>{c.qty}</span>
                <button onClick={() => changeQty(idx, 1)}>+</button>
              </div>
              <button className="remove-btn" onClick={() => removeLine(idx)}>
                Remove
              </button>
            </div>
            );
          })}

        {cart.length > 0 && (
          <textarea
            className="order-input"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Note / special request (e.g. no lettuce)"
            rows={2}
            style={{ width: "100%", resize: "vertical", marginTop: 8, marginBottom: 0 }}
          />
        )}

        {discount > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-soft)", paddingTop: 8 }}>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--sage)" }}>
              <span>Loyalty discount</span>
              <span>-{fmt(discount)}</span>
            </div>
            <div className="cart-total">
              <span>Total</span>
              <span>{fmt(finalTotal)}</span>
            </div>
          </>
        ) : (
          <div className="cart-total">
            <span>Total</span>
            <span>{fmt(finalTotal)}</span>
          </div>
        )}

        <button
          className="log-btn"
          style={{ width: "100%", marginTop: 0, marginBottom: 10 }}
          disabled={cart.length === 0 || tabBusy}
          onClick={startSaveTab}
        >
          {tabBusy ? "Saving…" : "Save Ticket"}
        </button>
        <div className="pay-row">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              className={`pay-btn ${payMethod === method ? "selected" : ""}`}
              onClick={() => setPayMethod(method)}
            >
              {method}
            </button>
          ))}
        </div>
        {chargeError && <div className="error-text" style={{ marginBottom: 8 }}>{chargeError}</div>}
        {tabError && <div className="error-text" style={{ marginBottom: 8 }}>{tabError}</div>}
        <button className="charge-btn" disabled={cart.length === 0 || !payMethod || chargeStatus === "submitting"} onClick={charge}>
          {chargeStatus === "submitting" ? "Charging…" : `Charge ${fmt(finalTotal)}`}
        </button>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="mini-btn" style={{ flex: 1 }} disabled={cart.length === 0} onClick={printCurrentOrder}>
            Reprint Order
          </button>
          <button className="mini-btn" style={{ flex: 1 }} disabled={cart.length === 0} onClick={printCurrentBill}>
            Print Bill
          </button>
        </div>
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)", marginTop: 8, cursor: "pointer" }}
          title="Send prints straight to RawBT as ESC/POS so the paper cuts automatically. Turn off to use the normal print dialog."
        >
          <input type="checkbox" checked={directPrint} onChange={toggleDirectPrint} />
          Direct print (auto-cut)
        </label>
        {activeTab &&
          (confirmingClose ? (
            <div style={{ marginTop: 10, background: "var(--cream-2)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 8 }}>
                Void this ticket? Anything on it goes back into stock.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="mini-btn danger" onClick={cancelTab} disabled={tabBusy}>
                  {tabBusy ? "Voiding…" : "Yes, void it"}
                </button>
                <button className="mini-btn" onClick={() => setConfirmingClose(false)}>
                  Keep ticket
                </button>
              </div>
            </div>
          ) : (
            <button className="void-btn" onClick={() => setConfirmingClose(true)} disabled={tabBusy}>
              Void ticket
            </button>
          ))}
          </>
        )}
        {toast && (
          <div className="toast">
            {toast}
            {lastReceipt && (
              <>
                {" "}
                <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => printReceipt(lastReceipt)}>
                  Print receipt
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {modifierProduct && (
        <ModifierPicker
          product={modifierProduct}
          onAdd={addModifierLine}
          onCancel={() => setModifierProduct(null)}
        />
      )}
      {pendingApproval && (
        <ApprovalModal
          actionLabel={pendingApproval.label}
          approvers={approvers}
          onApprove={() => {
            const run = pendingApproval.run;
            setPendingApproval(null);
            run();
          }}
          onCancel={() => setPendingApproval(null)}
        />
      )}
    </div>
  );
}
