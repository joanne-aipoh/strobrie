import { useOfflineStatus } from "./useOfflineStatus.js";

// A thin status strip shown only when it matters: the till is offline, sales are
// waiting to sync, or some couldn't be posted. Always mounted (in PosShell) so
// it also drives auto-sync whenever Flow is open.
export default function OfflineBar() {
  const { online, count, failed, syncing, syncNow } = useOfflineStatus();

  if (online && count === 0 && failed === 0) return null;

  let bg = "#b3500a"; // offline / attention
  let text = "#fff";
  let message;

  if (!online) {
    message =
      count > 0
        ? `Offline — ${count} sale${count === 1 ? "" : "s"} saved here, will sync when you're back online.`
        : "Offline — you can still ring up sales; they'll sync when you're back online.";
  } else if (syncing) {
    bg = "#1d4f8c";
    message = `Back online — syncing ${count} sale${count === 1 ? "" : "s"}…`;
  } else if (count > 0) {
    bg = "#1d4f8c";
    message = `${count} sale${count === 1 ? "" : "s"} waiting to sync.`;
  } else {
    // online, queue empty, but some sales failed to post
    message = null;
  }

  return (
    <div
      style={{
        background: bg,
        color: text,
        padding: "8px 14px",
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 13.5,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {message && <span>{message}</span>}
      {failed > 0 && (
        <span style={{ fontWeight: 700 }}>
          ⚠ {failed} sale{failed === 1 ? "" : "s"} couldn't be synced — needs a manager to review.
        </span>
      )}
      {online && count > 0 && !syncing && (
        <button
          onClick={syncNow}
          style={{
            background: "rgba(255,255,255,0.2)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: 6,
            padding: "3px 10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sync now
        </button>
      )}
    </div>
  );
}
