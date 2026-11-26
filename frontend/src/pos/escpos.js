// Direct ESC/POS printing via RawBT.
//
// Instead of rendering an HTML page and going through Chrome's print dialog
// (which can't send a paper-cut command and often prints narrow), we build the
// raw ESC/POS byte stream ourselves — including a GS V cut at the end — and hand
// it straight to the RawBT app with its documented intent URL:
//
//   intent:base64,<base64 bytes>#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
//
// (format per the escpos-php RawbtPrintConnector). RawBT prints it to the
// Bluetooth printer with no dialog, so the cut fires automatically.
//
// A per-device toggle (localStorage) lets staff turn this on to test and fall
// straight back to the HTML print path if a printer doesn't like it.

// Auto-cut via RawBT ESC/POS is confirmed working on the till, so direct
// printing is always on now (the per-device toggle was removed 26 Nov 2026).
export function directPrintOn() {
  return true;
}

// ---- byte buffer + ESC/POS commands -------------------------------------
const COLS = 48; // 80mm paper, Font A

function Builder() {
  const bytes = [];
  const pushStr = (s) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
  };
  return {
    raw: (...b) => bytes.push(...b),
    rawArr: (arr) => {
      for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
    },
    init: () => bytes.push(0x1b, 0x40),
    align: (n) => bytes.push(0x1b, 0x61, n), // 0 left, 1 center, 2 right
    bold: (on) => bytes.push(0x1b, 0x45, on ? 1 : 0),
    size: (n) => bytes.push(0x1d, 0x21, n), // high nibble=width-1, low=height-1
    text: (s) => pushStr(toAscii(s)),
    line: (s = "") => {
      pushStr(toAscii(s));
      bytes.push(0x0a);
    },
    feed: (n) => bytes.push(0x1b, 0x64, n), // feed n lines
    // Feed past the blade, then cut. GS V 0 = full cut; change to 0x01 for a
    // partial cut if a printer leaves the receipt attached.
    cut: () => bytes.push(0x1b, 0x64, 0x03, 0x1d, 0x56, 0x00),
    bytes: () => bytes,
  };
}

const SIZE_NORMAL = 0x00;
const SIZE_2H = 0x01; // double height
const SIZE_2X = 0x11; // double width + height

// RawBT's default code page is ASCII/CP437, so transliterate the few non-ASCII
// glyphs the receipts use and drop anything else.
function toAscii(s) {
  return String(s)
    .replace(/₦/g, "N")
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/ē/g, "e")
    .replace(/Ē/g, "E")
    .replace(/·/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e\n]/g, ""); // strip remaining non-ASCII
}

const money = (n) => "N" + Math.round(n).toLocaleString();

// Left text + right text padded to the column width (on one printer line).
function twoCol(left, right, cols = COLS) {
  left = toAscii(left);
  right = toAscii(right);
  const space = cols - left.length - right.length;
  if (space < 1) {
    // Truncate the left so the right (price) always shows.
    left = left.slice(0, Math.max(0, cols - right.length - 1));
    return left + " " + right;
  }
  return left + " ".repeat(space) + right;
}

const RULE = "-".repeat(COLS);

function splitItem(name) {
  const parts = String(name).split(" · ");
  return { base: parts[0], mods: parts.slice(1).join(", ") };
}

// Mirrors drinkFullName() in Sell.jsx: show the drink type for bare-flavour
// tiles (milkshakes/lemonades) on the kitchen/bar ticket.
const DRINK_TYPE_LABEL = {
  Juices: "Juice",
  Smoothies: "Smoothie",
  Milkshakes: "Milkshake",
  Lemonades: "Lemonade",
};
function drinkFullName(base, category) {
  const label = DRINK_TYPE_LABEL[category];
  if (label && !base.toLowerCase().includes(label.toLowerCase())) return `${label} - ${base}`;
  return base;
}

const ORDER_TYPE_LABEL = { dine_in: "Dine in", takeaway: "Takeaway/Delivery", delivery: "Takeaway/Delivery" };

// ---- logo raster ---------------------------------------------------------
// The printer can't use the PNG logo directly, so once at startup we render it
// to a 1-bit bitmap and keep the ESC/POS "GS v 0" raster command bytes. If it
// isn't ready (or rendering fails), the receipt falls back to a text header.
let logoBytes = null;
const LOGO_WIDTH = 384; // dots (must be a multiple of 8); ~48mm, centered

export function prepareLogo(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const w = LOGO_WIDTH;
          const h = Math.max(1, Math.round((img.height / img.width) * w));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const px = ctx.getImageData(0, 0, w, h).data;
          const bytesPerRow = w / 8;
          const out = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff];
          for (let y = 0; y < h; y++) {
            for (let xb = 0; xb < bytesPerRow; xb++) {
              let byte = 0;
              for (let bit = 0; bit < 8; bit++) {
                const i = (y * w + (xb * 8 + bit)) * 4;
                const dark = px[i + 3] > 128 && (px[i] + px[i + 1] + px[i + 2]) / 3 < 128;
                if (dark) byte |= 0x80 >> bit;
              }
              out.push(byte);
            }
          }
          logoBytes = out;
        } catch {
          logoBytes = null;
        }
        resolve(logoBytes);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

// ---- receipt / bill ------------------------------------------------------
export function encodeReceipt(r, cafe, vatRate) {
  const b = Builder();
  const tax = Math.round((r.total * vatRate) / (100 + vatRate));
  b.init();

  b.align(1);
  if (logoBytes) {
    // The logo graphic already says "Strobrie By Joanne", so skip the name
    // and tagline text when it's present.
    b.rawArr(logoBytes);
    b.line();
  } else {
    b.size(SIZE_2X);
    b.bold(true);
    b.line(cafe.name.toUpperCase());
    b.bold(false);
    b.size(SIZE_NORMAL);
    b.line(cafe.tagline);
  }
  b.line(cafe.address);
  b.line(cafe.website);
  b.line(cafe.phones);
  if (r.bill) {
    b.size(SIZE_2H);
    b.bold(true);
    b.line("*** BILL - NOT PAID ***");
    b.bold(false);
    b.size(SIZE_NORMAL);
  }

  b.align(0);
  b.line(RULE);
  if (r.orderName) b.line("Order: " + r.orderName);
  b.line("Employee: " + r.staffName);
  b.line(ORDER_TYPE_LABEL[r.orderType] || "Dine in");
  b.line(new Date(r.timestamp).toLocaleString());
  b.line(RULE);

  r.items.forEach((it) => {
    const { base, mods } = splitItem(it.name);
    b.line(twoCol(base, money(it.price * it.qty)));
    b.line("  " + it.qty + " x " + money(it.price));
    if (mods) b.line("  " + mods);
  });

  b.line(RULE);
  if (r.discount > 0) {
    b.line(twoCol("Subtotal", money(r.subtotal)));
    b.line(twoCol("Loyalty discount", "-" + money(r.discount)));
  }
  b.size(SIZE_2H);
  b.bold(true);
  b.line(twoCol("Total", money(r.total)));
  b.bold(false);
  b.size(SIZE_NORMAL);
  b.line(twoCol("Tax inc. " + vatRate + "%", money(tax)));
  if (r.bill) {
    b.bold(true);
    b.line(twoCol("Amount due", money(r.total)));
    b.bold(false);
  } else {
    b.line(twoCol(r.paymentMethod, money(r.total)));
    if (r.customerName) b.line(twoCol(r.customerName, "+" + r.pointsEarned + " pts"));
  }
  b.line(RULE);

  b.align(1);
  if (!r.bill) b.line("Thank you!");
  b.cut();
  return b.bytes();
}

// ---- kitchen / bar ticket -----------------------------------------------
export function encodeKitchen(k) {
  const b = Builder();
  b.init();
  b.feed(5); // top gap so the header clears a receipt-holder clip/spike

  b.align(1);
  b.size(SIZE_2X);
  b.bold(true);
  b.line("*** " + (k.station || "KITCHEN") + " ***");
  if (k.orderNo) b.line("#" + k.orderNo);
  if (k.orderName) b.line(String(k.orderName));
  b.bold(false);
  b.size(SIZE_NORMAL);
  b.line(String(k.staffName || ""));

  b.align(0);
  b.line(RULE);
  b.line(ORDER_TYPE_LABEL[k.orderType] || "Dine in");
  b.line(new Date(k.timestamp).toLocaleString());
  b.line(RULE);

  k.items.forEach((it) => {
    const { base, mods } = splitItem(it.name);
    const shown = drinkFullName(base, it.category);
    const parts = mods ? mods.split(", ") : [];
    const choices = parts.filter((m) => !m.startsWith("+ "));
    const extras = parts.filter((m) => m.startsWith("+ ")).map((m) => m.slice(2));
    b.size(SIZE_2H);
    b.bold(true);
    b.line(it.qty + " x " + shown);
    b.bold(false);
    b.size(SIZE_NORMAL);
    if (choices.length) b.line("   " + choices.join(", "));
    extras.forEach((e) => {
      b.bold(true);
      b.line("   ADD: " + e);
      b.bold(false);
    });
  });
  b.line(RULE);
  if (k.note && k.note.trim()) {
    b.align(1);
    b.size(SIZE_2H);
    b.bold(true);
    b.line("NOTE: " + k.note.trim());
    b.bold(false);
    b.size(SIZE_NORMAL);
    b.align(0);
    b.line(RULE);
  }
  b.cut();
  return b.bytes();
}

// ---- send to RawBT -------------------------------------------------------
// Each job is handed off by navigating to an intent: URL. Only one such
// navigation survives per tick, and a single order can print several tickets
// (receipt + kitchen + bar), so jobs are queued and spaced out to give RawBT
// time to pick up each one.
let queue = [];
let busy = false;

function navigate(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const url = "intent:base64," + btoa(bin) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
  window.location.href = url;
}

function pump() {
  if (!queue.length) {
    busy = false;
    return;
  }
  busy = true;
  navigate(queue.shift());
  setTimeout(pump, 1500);
}

export function sendRaw(bytes) {
  queue.push(bytes);
  if (!busy) pump();
}
