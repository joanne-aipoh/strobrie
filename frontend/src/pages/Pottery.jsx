import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const ACCENT = "#b5713e";
const ACCENT_DARK = "#8a5428";
const CREAM = "#fdf6ee";
const INK = "#2e2218";
const SOFT = "#7c6a58";
const LINE = "#ead9c6";

const PRICE = 15000; // public, per person

function fmt(n) {
  return "₦" + n.toLocaleString("en-NG");
}
function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const card = {
  background: "#fff",
  border: `1px solid ${LINE}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 16px rgba(46,34,24,0.06)",
};
const label = { display: "block", fontSize: 13, fontWeight: 600, color: SOFT, marginBottom: 6 };
const field = {
  width: "100%",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 15,
  background: CREAM,
  color: INK,
};

// --- Calendar --------------------------------------------------------------
function Calendar({ availableSet, selected, onSelect, minMonth, maxMonth }) {
  const [view, setView] = useState(() => {
    if (selected) {
      const [y, m] = selected.split("-").map(Number);
      return { y, m: m - 1 };
    }
    return minMonth;
  });

  const monthStart = new Date(view.y, view.m, 1);
  const startWeekday = monthStart.getDay(); // 0=Sun
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const atMin = view.y === minMonth.y && view.m === minMonth.m;
  const atMax = view.y === maxMonth.y && view.m === maxMonth.m;
  const step = (delta) => setView((v) => {
    const nd = new Date(v.y, v.m + delta, 1);
    return { y: nd.getFullYear(), m: nd.getMonth() };
  });

  const monthName = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, background: CREAM, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" onClick={() => step(-1)} disabled={atMin}
          style={{ border: "none", background: "none", fontSize: 20, color: atMin ? "#cbb79f" : ACCENT, cursor: atMin ? "default" : "pointer", padding: "0 8px" }}>‹</button>
        <div style={{ fontWeight: 700, color: INK, fontSize: 15 }}>{monthName}</div>
        <button type="button" onClick={() => step(1)} disabled={atMax}
          style={{ border: "none", background: "none", fontSize: 20, color: atMax ? "#cbb79f" : ACCENT, cursor: atMax ? "default" : "pointer", padding: "0 8px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, color: SOFT, fontWeight: 600, padding: "2px 0" }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const ds = iso(view.y, view.m, d);
          const available = availableSet.has(ds);
          const on = selected === ds;
          return (
            <button
              key={ds}
              type="button"
              disabled={!available}
              onClick={() => onSelect(ds)}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 9,
                border: on ? `1.5px solid ${ACCENT}` : "1px solid transparent",
                background: on ? ACCENT : available ? "#fff" : "transparent",
                color: on ? "#fff" : available ? INK : "#c9bba9",
                fontWeight: available ? 700 : 400,
                fontSize: 14,
                cursor: available ? "pointer" : "default",
                boxShadow: available && !on ? `0 0 0 1px ${LINE} inset` : "none",
              }}
              title={available ? "Available" : ""}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: SOFT, marginTop: 8, textAlign: "center" }}>
        Highlighted dates have open slots (Tue · Fri · Sat)
      </div>
    </div>
  );
}

// --- Video hero ------------------------------------------------------------
// Full-bleed autoplay/muted/looping clip. Drop a web-optimised file at
// public/pottery-hero.mp4 (and an optional first-frame poster at
// public/pottery-hero-poster.jpg). Until then the clay-toned gradient shows,
// so the hero still looks intentional with no video present.
function VideoHero() {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        minHeight: "clamp(360px, 60vh, 560px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 55%, ${INK} 100%)`,
      }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/pottery-hero-poster.jpg"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      >
        <source src="/pottery-hero.mp4" type="video/mp4" />
      </video>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(30,22,14,0.30) 0%, rgba(30,22,14,0.22) 42%, rgba(30,22,14,0.68) 100%)",
        }}
      />
      <div style={{ position: "relative", textAlign: "center", color: "#fff", padding: "52px 20px", maxWidth: 660 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase", opacity: 0.92 }}>
          Pottery at Strobriē
        </div>
        <h1
          style={{
            fontSize: "clamp(30px, 6vw, 52px)",
            lineHeight: 1.05,
            margin: "10px 0 14px",
            textWrap: "balance",
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          Sit at the wheel. Make something that's yours.
        </h1>
        <p
          style={{
            fontSize: "clamp(15px, 2.4vw, 18px)",
            lineHeight: 1.5,
            margin: "0 auto 26px",
            maxWidth: 540,
            opacity: 0.95,
            textShadow: "0 1px 12px rgba(0,0,0,0.35)",
          }}
        >
          Hands-on pottery in Abuja — from a relaxed 2-hour taster to a full multi-week course.
          No experience needed; your finished piece is yours to keep.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="#book"
            style={{
              background: "#fff",
              color: ACCENT_DARK,
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 22px",
              borderRadius: 12,
              textDecoration: "none",
              boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
            }}
          >
            Book a session — {fmt(PRICE)}
          </a>
          <a
            href="#courses"
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 22px",
              borderRadius: 12,
              textDecoration: "none",
              border: "1.5px solid rgba(255,255,255,0.75)",
            }}
          >
            Explore the courses
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Pottery() {
  const [days, setDays] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState(1);
  const [glaze, setGlaze] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    api.getPotteryAvailability().then(setDays).catch((e) => setLoadErr(e.message));
  }, []);

  // Public-only: days/slots with a public opening.
  const availableDays = useMemo(
    () => (days || []).filter((d) => d.slots.some((s) => s.public_available)),
    [days],
  );
  const availableSet = useMemo(() => new Set(availableDays.map((d) => d.date)), [availableDays]);

  const { minMonth, maxMonth } = useMemo(() => {
    const now = new Date();
    let min = { y: now.getFullYear(), m: now.getMonth() };
    let max = min;
    if (availableDays.length) {
      const first = availableDays[0].date.split("-").map(Number);
      const last = availableDays[availableDays.length - 1].date.split("-").map(Number);
      min = { y: first[0], m: first[1] - 1 };
      max = { y: last[0], m: last[1] - 1 };
    }
    return { minMonth: min, maxMonth: max };
  }, [availableDays]);

  const selectedDay = availableDays.find((d) => d.date === dateStr) || null;
  const selectedSlot = selectedDay?.slots.find((s) => s.time === time) || null;
  const maxSeats = selectedSlot ? selectedSlot.public_remaining : 6;
  const total = PRICE * seats + (glaze ? 10000 * seats : 0);
  const canBook = dateStr && time && name.trim() && email.trim() && phone.trim();

  async function book() {
    if (!canBook) {
      setError("Fill in the slot and your details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.bookPottery({
        date: dateStr,
        time_slot: time,
        session_type: "public",
        seats: Math.min(seats, maxSeats),
        glaze,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        callback_url: `${window.location.origin}/pottery/confirmation`,
      });
      window.location.href = res.authorization_url;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ background: CREAM, minHeight: "70vh" }}>
      <VideoHero />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 56px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: SOFT, fontSize: "clamp(11px, 3vw, 15px)", margin: 0 }}>
            Tuesdays, Fridays &amp; Saturdays · 2-hour slots · ₦15,000 per person · limited seats
          </p>
        </div>

        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 21, margin: "0 0 10px", color: INK }}>Make something with your own hands</h2>
          <p style={{ color: SOFT, fontSize: 14.5, lineHeight: 1.6, margin: "0 0 12px" }}>
            No experience needed — just bring yourself. In a relaxed 2-hour session you'll sit at the wheel
            with our guide and throw your very own piece from a lump of clay. Feel it spin beneath your
            fingers, centre it, and shape it into something that's completely yours.
          </p>
          <p style={{ color: SOFT, fontSize: 14.5, lineHeight: 1.6, margin: "0 0 16px" }}>
            Once it has dried, we <strong style={{ color: INK }}>fire it in the kiln</strong> for you —
            and your finished pot is <strong style={{ color: INK }}>yours to take home and keep</strong>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              ["Throw it", "Shape your piece on the wheel"],
              ["We fire it", "Kiln-fired for you"],
              ["Keep it", "Your creation, yours to keep"],
            ].map(([t, d]) => (
              <div
                key={t}
                style={{
                  background: CREAM,
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: "16px 12px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ color: ACCENT, fontWeight: 700, fontSize: 13.5 }}>{t}</div>
                <div style={{ color: SOFT, fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{d}</div>
              </div>
            ))}
          </div>
          <p style={{ color: INK, fontSize: 15, fontWeight: 600, margin: "16px 0 0" }}>
            Pick a slot below, bring a friend, and make something you'll actually use.
          </p>
        </div>

        <div id="book" style={{ scrollMarginTop: 72 }} />
        {loadErr && <div style={{ ...card, color: "#9c2626" }}>Couldn't load slots right now ({loadErr}).</div>}

        {days && (
          <div style={card}>
            <label style={label}>Pick a date</label>
            {availableDays.length === 0 ? (
              <div style={{ fontSize: 14, color: SOFT, marginBottom: 18 }}>
                No open slots in the next few weeks — request a private time below and we'll sort you out.
              </div>
            ) : (
              <Calendar
                availableSet={availableSet}
                selected={dateStr}
                onSelect={(ds) => {
                  setDateStr(ds);
                  setTime("");
                }}
                minMonth={minMonth}
                maxMonth={maxMonth}
              />
            )}

            {selectedDay && (
              <>
                <label style={label}>Time (2 hours)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {selectedDay.slots.map((s) => {
                    const ok = s.public_available;
                    const on = time === s.time;
                    return (
                      <button
                        key={s.time}
                        disabled={!ok}
                        onClick={() => setTime(s.time)}
                        style={{
                          flex: "1 1 30%",
                          border: `1.5px solid ${on ? ACCENT : LINE}`,
                          background: on ? ACCENT : ok ? "#fff" : "#f3ece3",
                          color: on ? "#fff" : ok ? INK : "#b3a695",
                          borderRadius: 10,
                          padding: "10px 6px",
                          cursor: ok ? "pointer" : "not-allowed",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {s.label}
                        {ok ? (
                          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{s.public_remaining} left</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500 }}>Full</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {selectedSlot && (
              <div style={{ marginBottom: 18 }}>
                <label style={label}>People</label>
                <select value={seats} onChange={(e) => setSeats(Number(e.target.value))} style={field}>
                  {Array.from({ length: Math.max(1, maxSeats) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label style={label}>Your name</label>
            <input style={{ ...field, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={label}>Email</label>
                <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={label}>Phone</label>
                <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0801…" />
              </div>
            </div>

            {selectedSlot && (
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  border: `1px solid ${glaze ? ACCENT : LINE}`,
                  background: glaze ? "#fff7ef" : CREAM,
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 14,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={glaze} onChange={(e) => setGlaze(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: ACCENT }} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>Glaze my pot ✨</span>
                  <span style={{ display: "block", fontSize: 12.5, color: SOFT }}>
                    Take home a finished, glazed piece — not just the plain (bisque) firing. We glaze &amp; fire it for you.
                  </span>
                </span>
                <span style={{ fontWeight: 700, color: ACCENT_DARK, whiteSpace: "nowrap" }}>+{fmt(10000)}{seats > 1 ? " ea" : ""}</span>
              </label>
            )}

            {error && <div style={{ color: "#9c2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}

            <button
              onClick={book}
              disabled={busy || !canBook}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                padding: 15,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: busy || !canBook ? "#d8c3ac" : ACCENT,
                cursor: busy || !canBook ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Taking you to payment…" : `Book & Pay ${fmt(total)}`}
            </button>
          </div>
        )}

        {/* Private / different time */}
        <div style={{ ...card, marginTop: 16 }}>
          {!showRequest ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: INK }}>Want a private session or a different time?</div>
                <div style={{ fontSize: 13.5, color: SOFT }}>Private sessions are ₦20,000 — tell us your preferred time and we'll work with your schedule.</div>
              </div>
              <button
                onClick={() => setShowRequest(true)}
                style={{ border: `1.5px solid ${ACCENT}`, background: "#fff", color: ACCENT_DARK, borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                Request a time
              </button>
            </div>
          ) : (
            <PrivateRequestForm onClose={() => setShowRequest(false)} />
          )}
        </div>

        <div id="courses" style={{ scrollMarginTop: 72 }} />
        <CourseBooking />
      </div>
    </div>
  );
}

// --- Multi-week courses ----------------------------------------------------
const COURSE_TIMES = [
  { time: "10:00", label: "10:00 AM" },
  { time: "12:00", label: "12:00 PM" },
  { time: "14:00", label: "2:00 PM" },
];
const COURSE_DETAILS = {
  "4week": {
    name: "Pottery Fundamentals",
    tag: "4 weeks · 12 sessions",
    price: 180000,
    blurb: "A complete starter course — from clay and hand-building to the wheel, finishing and firing.",
    weeks: [
      "Introduction to pottery, tools, clay preparation & basic hand-building",
      "Hand-building — pinch pots, coil building & slab building",
      "Functional pieces (bowls, cups, plates) + introduction to the wheel",
      "Wheel throwing, shaping, trimming, decoration, finishing & prep for bisque firing",
    ],
  },
  "8week": {
    name: "Extended Pottery Experience",
    tag: "8 weeks · 24 sessions",
    price: 350000,
    blurb: "The full journey, in depth — more time to practise the wheel, refine technique and explore glazing.",
    weeks: [
      "Introduction to pottery, tools, clay preparation & wedging",
      "Hand-building — pinch pots, coil & slab",
      "Functional pottery (bowls, cups, plates, trays), shaping & refining",
      "Introduction to wheel throwing — centering, opening & basic forms",
      "Developing wheel skills — consistent shapes & different forms",
      "Trimming, refining, handles, attachments, surface decoration & textures",
      "Individual projects, drying process, kiln safety & intro to bisque firing",
      "Glazing — types, colours & application; final review & prep for firing",
    ],
  },
};

function upcomingClassDays(weeksAhead = 10) {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // from tomorrow
  const end = new Date();
  end.setDate(end.getDate() + weeksAhead * 7);
  while (d <= end) {
    const wd = d.getDay(); // 2 Tue, 5 Fri, 6 Sat
    if (wd === 2 || wd === 5 || wd === 6) {
      out.push({
        iso: iso(d.getFullYear(), d.getMonth(), d.getDate()),
        label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function CourseBooking() {
  const [selected, setSelected] = useState("");
  const [time, setTime] = useState("");
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showWeeks, setShowWeeks] = useState("");

  const starts = useMemo(() => upcomingClassDays(10), []);
  const info = selected ? COURSE_DETAILS[selected] : null;
  const canBook = selected && time && start && name.trim() && email.trim() && phone.trim();

  async function bookCourse() {
    if (!canBook) {
      setError("Pick a course, a time, a start date and fill in your details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.bookPotteryCourse({
        course_type: selected,
        time_slot: time,
        start_date: start,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        callback_url: `${window.location.origin}/pottery/confirmation`,
      });
      window.location.href = res.authorization_url;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 24, margin: "0 0 4px", color: INK, textAlign: "center" }}>Pottery Courses</h2>
      <p style={{ color: SOFT, fontSize: 14.5, textAlign: "center", margin: "0 0 18px" }}>
        Private, one-on-one training — Tuesday, Friday &amp; Saturday, 1½ hours each. Pick your time and start date.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 16 }}>
        {Object.entries(COURSE_DETAILS).map(([key, c]) => {
          const on = selected === key;
          return (
            <div
              key={key}
              onClick={() => setSelected(key)}
              style={{
                ...card,
                cursor: "pointer",
                border: `1.5px solid ${on ? ACCENT : LINE}`,
                boxShadow: on ? "0 0 0 3px rgba(181,113,62,.18)" : card.boxShadow,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: ACCENT }}>{c.tag}</div>
              <h3 style={{ margin: "6px 0 2px", fontSize: 18, color: INK }}>{c.name}</h3>
              <div style={{ fontSize: 13, color: SOFT, marginBottom: 8 }}>{c.blurb}</div>
              <div style={{ fontSize: 23, fontWeight: 700, color: INK }}>{fmt(c.price)}</div>
              <div style={{ display: "inline-block", background: "#edf5e8", color: "#4f7a3d", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, marginTop: 10 }}>
                Private · 1 student
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowWeeks(showWeeks === key ? "" : key); }}
                style={{ display: "block", marginTop: 10, background: "none", border: "none", color: ACCENT_DARK, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}
              >
                {showWeeks === key ? "Hide curriculum ▲" : "See week-by-week ▼"}
              </button>
              {showWeeks === key && (
                <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: INK }}>
                  {c.weeks.map((w, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{w}</li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {info && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontWeight: 700, color: INK }}>
            Book the {info.name} · {fmt(info.price)}
          </p>

          <label style={label}>Class time — same every session</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {COURSE_TIMES.map((t) => (
              <button
                key={t.time}
                onClick={() => setTime(t.time)}
                style={{
                  flex: "1 1 28%",
                  border: `1.5px solid ${time === t.time ? ACCENT : LINE}`,
                  background: time === t.time ? ACCENT : "#fff",
                  color: time === t.time ? "#fff" : INK,
                  borderRadius: 10,
                  padding: "10px 6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label style={label}>Start date (Tue / Fri / Sat)</label>
          <select value={start} onChange={(e) => setStart(e.target.value)} style={{ ...field, marginBottom: 16 }}>
            <option value="">Choose a start date…</option>
            {starts.map((s) => (
              <option key={s.iso} value={s.iso}>{s.label}</option>
            ))}
          </select>

          <label style={label}>Your name</label>
          <input style={{ ...field, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={label}>Email</label>
              <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label style={label}>Phone</label>
              <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0801…" />
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: SOFT, margin: "0 0 12px" }}>
            Your {COURSE_TIMES.find((t) => t.time === time)?.label || "chosen"} slot on Tue/Fri/Sat is reserved just for you for the full programme. Bisque firing is included; glaze firing is ₦10,000 per item.
          </p>

          {error && <div style={{ color: "#9c2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}

          <button
            onClick={bookCourse}
            disabled={busy || !canBook}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              background: busy || !canBook ? "#d8c3ac" : ACCENT,
              cursor: busy || !canBook ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Taking you to payment…" : `Book & Pay ${fmt(info.price)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function PrivateRequestForm({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferred, setPreferred] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || !phone.trim() || !preferred.trim()) {
      setError("Please fill in your details and a preferred time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.requestPrivatePottery({
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        preferred: preferred.trim(),
        message: message.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (done)
    return (
      <div>
        <div style={{ fontWeight: 700, color: INK, marginBottom: 4 }}>Request sent 🎉</div>
        <div style={{ fontSize: 14, color: SOFT }}>We'll reach out to arrange your private session. Thank you!</div>
      </div>
    );

  return (
    <div>
      <div style={{ fontWeight: 700, color: INK, marginBottom: 10 }}>Request a private session time</div>
      <input style={{ ...field, marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input style={{ ...field, flex: "1 1 200px" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input style={{ ...field, flex: "1 1 150px" }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      </div>
      <input style={{ ...field, marginBottom: 10 }} value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="Preferred day & time (e.g. Sun 16 Nov, afternoon)" />
      <textarea style={{ ...field, marginBottom: 10 }} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else? (group size, occasion…)" />
      {error && <div style={{ color: "#9c2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submit} disabled={busy} style={{ border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, color: "#fff", background: busy ? "#d8c3ac" : ACCENT, cursor: "pointer" }}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button onClick={onClose} style={{ border: "none", background: "none", color: SOFT, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
