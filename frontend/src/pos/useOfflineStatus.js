import { useEffect, useState } from "react";
import { subscribe, syncQueue, queuedCount, failedCount } from "./offline.js";

// App-wide offline state for the till: whether we're online, how many sales are
// waiting to sync, and a trigger to sync now. Mounting this (via the banner)
// also drives auto-sync: on reconnect and on load it flushes the queue.
export function useOfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [count, setCount] = useState(queuedCount());
  const [failed, setFailed] = useState(failedCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCount(queuedCount());
      setFailed(failedCount());
    };
    const unsub = subscribe(refresh);

    async function flush() {
      if (!navigator.onLine || queuedCount() === 0) return;
      setSyncing(true);
      await syncQueue();
      setSyncing(false);
      refresh();
    }

    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    refresh();
    flush();

    return () => {
      unsub();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function syncNow() {
    setSyncing(true);
    await syncQueue();
    setSyncing(false);
    setCount(queuedCount());
    setFailed(failedCount());
  }

  return { online, count, failed, syncing, syncNow };
}
