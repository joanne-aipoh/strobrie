// Meta (Facebook/Instagram) pixel — tells Meta which ad viewers went on to
// browse, order, book or ask for directions, so ads can be shown to more
// people like them. Server-side copies of the key events are sent by
// backend/app/meta_capi.py with the same event IDs, and Meta counts each once.
//
// Never loaded on Flow (staff till): staff activity isn't customer behaviour.
import { isFlowHost } from "./pos/posBase.js";

export const META_PIXEL_ID = "979447397776892";

const isStaffPage = () => isFlowHost || window.location.pathname.startsWith("/pos");

let loaded = false;

function load() {
  if (loaded || typeof window === "undefined" || isStaffPage()) return loaded;
  /* eslint-disable */
  // Meta's standard base code, unminified only as far as needed to read it.
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", META_PIXEL_ID);
  loaded = true;
  return loaded;
}

// A random id for events that have no natural one (bookings, RSVPs). Sent to
// the backend as the X-Meta-Event-Id header so both copies share it.
export function newEventId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function track(eventName, params = {}, eventId) {
  if (!load()) return;
  window.fbq("track", eventName, params, eventId ? { eventID: eventId } : undefined);
}

export function pageView() {
  if (!load()) return;
  window.fbq("track", "PageView");
}

// Purchase fires on the confirmation page, which a customer can reload or
// reopen from their email — only count it once per payment reference.
export function trackOnce(key, eventName, params, eventId) {
  const storageKey = `meta-pixel-sent:${key}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, "1");
  } catch {
    // localStorage unavailable — Meta still dedupes on eventId
  }
  track(eventName, params, eventId);
}

// One listener for every WhatsApp, phone and map link on the site (footer,
// floating button, Visit page, confirmation pages...) rather than wiring each
// link by hand. For a cafe with no street frontage these are the strongest
// "about to visit" signals we get.
function trackLinkClicks(e) {
  const link = e.target.closest?.("a[href]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (href.startsWith("https://wa.me/")) track("Contact", { content_name: "whatsapp" });
  else if (href.startsWith("tel:")) track("Contact", { content_name: "phone" });
  else if (/^https:\/\/(g\.page\/r\/[^/]+\/?$|www\.google\.com\/maps|maps\.app\.goo\.gl)/.test(href)) {
    track("FindLocation", { content_name: "directions" });
  }
}

export function startPixel() {
  if (!load()) return;
  document.addEventListener("click", trackLinkClicks, { capture: true });
}
