import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { getPendingPurchases, flushSyncQueue } from "../../offline/syncQueue.js";
import client from "../../api/client.js";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const checkPending = async () => {
    try {
      const items = await getPendingPurchases();
      setPendingCount(items.length);
    } catch (e) {}
  };

  useEffect(() => {
    checkPending();
    const handleOnline = () => {
      setIsOnline(true);
      handleAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(checkPending, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      const res = await flushSyncQueue(client);
      await checkPending();
      if (res.synced > 0) {
        setSyncMessage(`Synced ${res.synced} offline transaction(s)`);
        setTimeout(() => setSyncMessage(""), 4000);
      }
    } catch (e) {
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0 && !syncMessage) {
    return null;
  }

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-200" />
            <span>Offline Mode — Purchases will be saved locally</span>
          </>
        ) : syncMessage ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{syncMessage}</span>
          </>
        ) : (
          <span>{pendingCount} offline transaction(s) queued</span>
        )}
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleAutoSync}
          disabled={syncing}
          className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded flex items-center gap-1 transition"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}

