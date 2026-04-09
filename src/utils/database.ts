// src/utils/database.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('buyoyo_offline.db');

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripStatus = 'active' | 'completed' | 'template';

export interface Trip {
  id:           number;
  name:         string;
  store:        string | null;
  budget:       number;
  status:       TripStatus;
  scheduled_at: string | null;
  created_at:   string;
  completed_at: string | null;
}

export interface TripItem {
  id:         number;
  trip_id:    number;
  product:    string;
  price:      string;       // formatted display e.g. "₱52.00" or "---"
  unit_price: number;       // 0 means no price set yet
  quantity:   number;
  is_checked: number;       // 0 | 1
  is_synced:  number;
  added_at:   string;
}

export interface CatalogueEntry {
  id:           number;
  name:         string;
  last_price:   number;
  last_seen_at: string;
  scan_count:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const addColumnIfMissing = async (table: string, column: string, definition: string) => {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch { /* already exists */ }
};

const tableExists = async (name: string): Promise<boolean> => {
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`, [name],
  );
  return (row?.cnt ?? 0) > 0;
};

export const formatPrice = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Init + Migration ─────────────────────────────────────────────────────────

export const initDatabase = async () => {
  try {
    // ── Create tables ─────────────────────────────────────────────────────────
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS Trips (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        store        TEXT,
        budget       REAL DEFAULT 2000,
        status       TEXT DEFAULT 'active',
        scheduled_at DATETIME,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS TripItems (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id    INTEGER NOT NULL REFERENCES Trips(id) ON DELETE CASCADE,
        product    TEXT NOT NULL,
        price      TEXT NOT NULL DEFAULT '---',
        unit_price REAL DEFAULT 0,
        quantity   INTEGER DEFAULT 1,
        is_checked INTEGER DEFAULT 0,
        is_synced  INTEGER DEFAULT 0,
        added_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ProductCatalogue (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL UNIQUE,
        last_price   REAL DEFAULT 0,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scan_count   INTEGER DEFAULT 1
      );
    `);

    // ── Safe column migrations for installs that have old schemas ─────────────
    await addColumnIfMissing('TripItems', 'added_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    // Remove stale columns gracefully — SQLite can't DROP COLUMN before 3.35,
    // so we just ignore is_planned / note if they exist; they cause no harm.

    // ── Migrate old ScannedItems table (very first version of the app) ────────
    if (await tableExists('ScannedItems')) {
      await addColumnIfMissing('ScannedItems', 'unit_price', 'REAL DEFAULT 0');
      await addColumnIfMissing('ScannedItems', 'quantity',   'INTEGER DEFAULT 1');
      await db.execAsync(`
        UPDATE ScannedItems
        SET unit_price = CAST(
          REPLACE(REPLACE(REPLACE(price,'₱',''),',',''),' ','') AS REAL
        ) WHERE unit_price = 0 AND price != '---';
      `);
      const oldItems = await db.getAllAsync<any>('SELECT * FROM ScannedItems');
      if (oldItems.length > 0) {
        const already = await db.getFirstAsync<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM Trips WHERE name = 'My First List'`,
        );
        if ((already?.cnt ?? 0) === 0) {
          const r = await db.runAsync(
            `INSERT INTO Trips (name, status, created_at) VALUES ('My First List', 'completed', ?)`,
            [oldItems[0]?.scanned_at ?? new Date().toISOString()],
          );
          for (const item of oldItems) {
            await db.runAsync(
              `INSERT INTO TripItems (trip_id, product, price, unit_price, quantity, is_synced, added_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [r.lastInsertRowId, item.product, item.price,
               item.unit_price ?? 0, item.quantity ?? 1, item.is_synced ?? 0, item.scanned_at],
            );
          }
        }
      }
      await db.execAsync('DROP TABLE IF EXISTS ScannedItems;');
    }

    // ── Ensure at least one active list exists (for the scanner) ──────────────
    const cnt = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM Trips WHERE status = 'active'`,
    );
    if ((cnt?.cnt ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO Trips (name, status) VALUES (?, 'active')`,
        [`My List — ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`],
      );
    }

    console.log('[DB] Ready ✓');
  } catch (e) {
    console.error('[DB] Init error:', e);
  }
};

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export const getAllTrips = async (): Promise<Trip[]> => {
  try {
    return await db.getAllAsync<Trip>('SELECT * FROM Trips ORDER BY created_at DESC');
  } catch (e) { return []; }
};

export const getTripById = async (id: number): Promise<Trip | null> => {
  try {
    return await db.getFirstAsync<Trip>('SELECT * FROM Trips WHERE id = ?', [id]);
  } catch (e) { return null; }
};

// The scanner always saves into the most-recently-created active list
export const getActiveTrip = async (): Promise<Trip | null> => {
  try {
    return await db.getFirstAsync<Trip>(
      `SELECT * FROM Trips WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
    );
  } catch (e) { return null; }
};

export const createTrip = async (
  name: string,
  budget: number = 2000,
  store?: string,
  status: TripStatus = 'active',
): Promise<number | null> => {
  try {
    const r = await db.runAsync(
      `INSERT INTO Trips (name, store, budget, status) VALUES (?, ?, ?, ?)`,
      [name, store ?? null, budget, status],
    );
    return r.lastInsertRowId;
  } catch (e) { console.error('[DB] createTrip:', e); return null; }
};

export const updateTrip = async (
  id: number,
  fields: Partial<Pick<Trip, 'name' | 'store' | 'budget' | 'status' | 'completed_at'>>,
): Promise<boolean> => {
  try {
    const keys = Object.keys(fields);
    if (!keys.length) return true;
    const set = keys.map(k => `${k} = ?`).join(', ');
    await db.runAsync(`UPDATE Trips SET ${set} WHERE id = ?`, [...Object.values(fields), id]);
    return true;
  } catch (e) { console.error('[DB] updateTrip:', e); return false; }
};

export const completeTrip = (id: number) =>
  updateTrip(id, { status: 'completed', completed_at: new Date().toISOString() });

export const deleteTrip = async (id: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM Trips WHERE id = ?', [id]);
    return true;
  } catch (e) { return false; }
};

export const duplicateTripAsTemplate = async (tripId: number, newName: string): Promise<number | null> => {
  try {
    const trip = await getTripById(tripId);
    if (!trip) return null;
    const newId = await createTrip(newName, trip.budget, trip.store ?? undefined, 'template');
    if (!newId) return null;
    const items = await getTripItems(tripId);
    // Copy items without prices (it's a template / checklist skeleton)
    for (const item of items) {
      await addItem(newId, item.product);
    }
    return newId;
  } catch (e) { return null; }
};

// ─── TRIP ITEMS ───────────────────────────────────────────────────────────────

export const getTripItems = async (tripId: number): Promise<TripItem[]> => {
  try {
    return await db.getAllAsync<TripItem>(
      `SELECT * FROM TripItems WHERE trip_id = ? ORDER BY added_at ASC`, [tripId],
    );
  } catch (e) { return []; }
};

// Add any item — price is optional (defaults to 0 / '---' = not set yet)
export const addItem = async (
  tripId: number,
  product: string,
  unitPrice: number = 0,
  quantity: number = 1,
): Promise<number | null> => {
  try {
    const price = unitPrice > 0 ? formatPrice(unitPrice) : '---';
    const r = await db.runAsync(
      `INSERT INTO TripItems (trip_id, product, price, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [tripId, product.trim(), price, unitPrice, quantity],
    );
    if (unitPrice > 0) upsertCatalogue(product, unitPrice).catch(() => {});
    return r.lastInsertRowId;
  } catch (e) { console.error('[DB] addItem:', e); return null; }
};

// Update an existing item (name + price + qty)
export const updateItem = async (
  id: number,
  product: string,
  unitPrice: number,
  quantity: number,
): Promise<boolean> => {
  try {
    const price = unitPrice > 0 ? formatPrice(unitPrice) : '---';
    await db.runAsync(
      `UPDATE TripItems SET product=?, price=?, unit_price=?, quantity=?, is_synced=0 WHERE id=?`,
      [product.trim(), price, unitPrice, quantity, id],
    );
    if (unitPrice > 0) upsertCatalogue(product, unitPrice).catch(() => {});
    return true;
  } catch (e) { return false; }
};

export const deleteItem = async (id: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM TripItems WHERE id = ?', [id]);
    return true;
  } catch (e) { return false; }
};

export const toggleItemChecked = async (id: number, checked: boolean): Promise<boolean> => {
  try {
    await db.runAsync('UPDATE TripItems SET is_checked=? WHERE id=?', [checked ? 1 : 0, id]);
    return true;
  } catch (e) { return false; }
};

export const clearItems = async (tripId: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM TripItems WHERE trip_id=?', [tripId]);
    return true;
  } catch (e) { return false; }
};

// ─── PRODUCT CATALOGUE ────────────────────────────────────────────────────────

const upsertCatalogue = async (name: string, unitPrice: number) => {
  await db.runAsync(
    `INSERT INTO ProductCatalogue (name, last_price, last_seen_at, scan_count)
     VALUES (?, ?, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(name) DO UPDATE SET
       last_price=excluded.last_price,
       last_seen_at=CURRENT_TIMESTAMP,
       scan_count=scan_count+1`,
    [name.trim(), unitPrice],
  );
};

export const searchCatalogue = async (query: string): Promise<CatalogueEntry[]> => {
  try {
    return await db.getAllAsync<CatalogueEntry>(
      `SELECT * FROM ProductCatalogue WHERE name LIKE ? ORDER BY scan_count DESC LIMIT 8`,
      [`%${query}%`],
    );
  } catch (e) { return []; }
};

// ─── LEGACY SHIMS (keep ScannerScreen working unchanged) ─────────────────────

export const saveItemToDB = async (product: string, unitPrice: number, quantity = 1) => {
  const trip = await getActiveTrip();
  if (!trip) return null;
  return addItem(trip.id, product, unitPrice, quantity);
};

export const getOfflineItems  = async () => { const t = await getActiveTrip(); return t ? getTripItems(t.id) : []; };
export const updateItemInDB   = (id: number, p: string, up: number, q: number) => updateItem(id, p, up, q);
export const deleteItemFromDB = (id: number) => deleteItem(id);

// Keep old name used by TripDetailScreen
export const saveTripItem    = addItem;
export const updateTripItem  = updateItem;
export const deleteTripItem  = deleteItem;
export const toggleTripItemChecked = toggleItemChecked;
export const clearTripItems  = clearItems;