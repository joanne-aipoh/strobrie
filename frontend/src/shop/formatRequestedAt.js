function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// Spelled out with a 12-hour clock, so there's no day/month mix-up or
// 24-hour misread when reading it at a glance.
export function formatRequestedAt(iso) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday}, ${ordinal(d.getDate())} of ${month} ${d.getFullYear()} at ${time}`;
}
