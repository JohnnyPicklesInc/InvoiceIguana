/**
 * Local-first storage for the generators. Everything the user saves — draft
 * and finalized invoices/receipts, saved clients, saved businesses, saved
 * products — lives in IndexedDB in the current browser. There is no server,
 * no sync; the durable-link mechanism is still what moves a document between
 * people. Backup/restore covers the "clear browser data" and "new device"
 * cases (see exportAll / importAll below).
 *
 * Standards-only: native IndexedDB + crypto.randomUUID(). No polyfills.
 *
 * Object stores (v1):
 *   invoices    — { id, kind:'invoice'|'receipt', status, number, updatedAt, doc }
 *   clients     — { id, name, address, contact, updatedAt }
 *   businesses  — { id, name, address, contact, logoUrl, logoData, updatedAt }
 *   products    — { id, name, priceMinor, currency, updatedAt }
 *   meta        — { key, value }   (counters like next invoice number)
 *
 * Callers decide their own record shape beyond `id` (and `key` for `meta`).
 * This module only guarantees the plumbing: put/get/list/remove per store,
 * plus a single-shot JSON export/import of the whole DB.
 */

const DB_NAME = 'invoiceiguana';
const DB_VERSION = 1;
export const STORES = ['invoices', 'clients', 'businesses', 'products', 'meta'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('invoices')) {
        const s = db.createObjectStore('invoices', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
        s.createIndex('kind', 'kind');
        s.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('clients')) {
        const s = db.createObjectStore('clients', { keyPath: 'id' });
        s.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('businesses')) {
        const s = db.createObjectStore('businesses', { keyPath: 'id' });
        s.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('products')) {
        const s = db.createObjectStore('products', { keyPath: 'id' });
        s.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
  return dbPromise;
}

// Wrap a request/transaction pair as a single promise. IDB's onerror bubbles
// to the transaction, so listening on both is redundant — but the transaction
// oncomplete is the real "durably written" signal for writes.
function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB tx aborted'));
  });
}

function newId() {
  return crypto.randomUUID();
}

// ---- generic per-store API -----------------------------------------------

export async function put(store, record) {
  if (!STORES.includes(store)) throw new Error(`unknown store: ${store}`);
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const s = tx.objectStore(store);
  // meta uses 'key' as its keyPath; everything else uses 'id'.
  const keyField = store === 'meta' ? 'key' : 'id';
  const now = Date.now();
  const withMeta = {
    ...record,
    [keyField]: record[keyField] ?? newId(),
    ...(store === 'meta' ? {} : { updatedAt: now, createdAt: record.createdAt ?? now }),
  };
  s.put(withMeta);
  await txDone(tx);
  return withMeta;
}

export async function get(store, key) {
  if (!STORES.includes(store)) throw new Error(`unknown store: ${store}`);
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return reqAsPromise(tx.objectStore(store).get(key));
}

export async function remove(store, key) {
  if (!STORES.includes(store)) throw new Error(`unknown store: ${store}`);
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await txDone(tx);
}

export async function list(store, { index, direction = 'next' } = {}) {
  if (!STORES.includes(store)) throw new Error(`unknown store: ${store}`);
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
  return reqAsPromise(source.getAll(null, undefined))
    .then((rows) => (direction === 'prev' ? rows.reverse() : rows));
}

// ---- meta helper (counters, etc.) ----------------------------------------

export async function getMeta(key, fallback = null) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await put('meta', { key, value });
}

// ---- backup / restore ----------------------------------------------------

/**
 * Serializes every store into a single JSON-safe object. The `version` field
 * lets a future importer detect and migrate older backup files.
 */
export async function exportAll() {
  const db = await openDb();
  const tx = db.transaction(STORES, 'readonly');
  const data = {};
  await Promise.all(STORES.map(async (name) => {
    data[name] = await reqAsPromise(tx.objectStore(name).getAll());
  }));
  return {
    app: 'invoiceiguana',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Restore from a backup. Two merge modes:
 *   'merge'   — put every record, overwriting on id collision (safe default)
 *   'replace' — clear every store first, then put
 * Returns { imported: {store: count, ...} }.
 */
export async function importAll(backup, { mode = 'merge' } = {}) {
  if (!backup || backup.app !== 'invoiceiguana' || !backup.data) {
    throw new Error('not an InvoiceIguana backup file');
  }
  if (backup.version > DB_VERSION) {
    throw new Error(`backup version ${backup.version} is newer than app version ${DB_VERSION}`);
  }
  const db = await openDb();
  const tx = db.transaction(STORES, 'readwrite');
  const counts = {};
  for (const name of STORES) {
    const rows = backup.data[name] || [];
    const store = tx.objectStore(name);
    if (mode === 'replace') store.clear();
    for (const row of rows) store.put(row);
    counts[name] = rows.length;
  }
  await txDone(tx);
  return { imported: counts };
}
