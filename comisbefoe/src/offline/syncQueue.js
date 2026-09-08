/**
 * Offline-first sync queue using IndexedDB (via the `idb` package).
 * Transactions created while offline are stored locally with a
 * `synced: false` flag, then pushed to the API in order once back online.
 * TODO: implement openDB(), queueTransaction(), and flushQueue().
 */
import { openDB } from "idb";

const DB_NAME = "comis_offline_db";
const DB_VERSION = 1;

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending_purchases")) {
        db.createObjectStore("pending_purchases", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached_sellers")) {
        db.createObjectStore("cached_sellers", { keyPath: "id" });
      }
    },
  });
}

export async function queueOfflinePurchase(commodity, payload) {
  const db = await getDb();
  return db.add("pending_purchases", {
    commodity,
    payload,
    queued_at: new Date().toISOString(),
  });
}

export async function getPendingPurchases() {
  const db = await getDb();
  return db.getAll("pending_purchases");
}

export async function clearPendingPurchase(id) {
  const db = await getDb();
  return db.delete("pending_purchases", id);
}

export async function cacheSellers(sellers) {
  if (!sellers || !sellers.length) return;
  const db = await getDb();
  const tx = db.transaction("cached_sellers", "readwrite");
  for (const seller of sellers) {
    await tx.store.put(seller);
  }
  await tx.done;
}

export async function getCachedSellers() {
  const db = await getDb();
  return db.getAll("cached_sellers");
}

export async function flushSyncQueue(apiClient) {
  const items = await getPendingPurchases();
  const results = { synced: 0, failed: 0 };

  for (const item of items) {
    try {
      const endpoint = `/${item.commodity}/`;
      await apiClient.post(endpoint, item.payload);
      await clearPendingPurchase(item.id);
      results.synced++;
    } catch (err) {
      console.error("Failed to sync item:", item, err);
      results.failed++;
    }
  }

  return results;
}
