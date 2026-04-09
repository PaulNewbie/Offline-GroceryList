// src/utils/database.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('grocery_offline.db');

// ─── Types ────────────────────────────────────────────────────────────────────

export type TripStatus = 'active' | 'completed' | 'template';

export interface Trip {
  id: number;
  name: string;
  store: string | null;
  budget: number;
  status: TripStatus;
  scheduled_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TripItem {
  id: number;
  trip_id: number;
  product: string;
  price: string;         // formatted display string e.g. "₱52.00"
  unit_price: number;
  quantity: number;
  is_checked: number;    // 0 | 1  — for checklist mode
  is_synced: number;
  scanned_at: string;
}

export interface CatalogueEntry {
  id: number;
  name: string;
  last_price: number;
  last_seen_at: string;
  scan_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const addColumnIfMissing = async (table: string, column: string, definition: string) => {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch {
    // Column already exists — safe to ignore
  }
};

const tableExists = async (name: string): Promise<boolean> => {
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`,
    [name],
  );
  return (row?.cnt ?? 0) > 0;
};

const formatPrice = (unitPrice: number) =>
  `₱${unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Init + Migration ─────────────────────────────────────────────────────────

export const initDatabase = async () => {
  try {
    // ── 1. Create new tables (safe on existing installs) ──────────────────────

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
        price      TEXT NOT NULL,
        unit_price REAL DEFAULT 0,
        quantity   INTEGER DEFAULT 1,
        is_checked INTEGER DEFAULT 0,
        is_synced  INTEGER DEFAULT 0,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // ── 2. Migrate ScannedItems → TripItems (runs once, skips if done) ────────

    const hasOldTable = await tableExists('ScannedItems');
    if (hasOldTable) {
      // Ensure old table has the modern columns before reading
      await addColumnIfMissing('ScannedItems', 'unit_price', 'REAL DEFAULT 0');
      await addColumnIfMissing('ScannedItems', 'quantity',   'INTEGER DEFAULT 1');

      // Back-fill unit_price from price string if needed
      await db.execAsync(`
        UPDATE ScannedItems
        SET unit_price = CAST(
          REPLACE(REPLACE(REPLACE(price, '₱', ''), ',', ''), ' ', '')
          AS REAL
        )
        WHERE unit_price = 0 AND price != '---';
      `);

      const oldItems = await db.getAllAsync<any>('SELECT * FROM ScannedItems');
      if (oldItems.length > 0) {
        // Check if we already migrated (avoid duplicating on re-run)
        const alreadyMigrated = await db.getFirstAsync<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM Trips WHERE name = 'My First List'`,
        );

        if ((alreadyMigrated?.cnt ?? 0) === 0) {
          // Create the default trip
          const tripResult = await db.runAsync(
            `INSERT INTO Trips (name, store, status, created_at) VALUES (?, ?, 'completed', ?)`,
            ['My First List', null, oldItems[0]?.scanned_at ?? new Date().toISOString()],
          );
          const defaultTripId = tripResult.lastInsertRowId;

          // Move all old items into the default trip
          for (const item of oldItems) {
            await db.runAsync(
              `INSERT INTO TripItems
                (trip_id, product, price, unit_price, quantity, is_synced, scanned_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                defaultTripId,
                item.product,
                item.price,
                item.unit_price ?? 0,
                item.quantity   ?? 1,
                item.is_synced  ?? 0,
                item.scanned_at,
              ],
            );
          }

          console.log(`[DB] Migrated ${oldItems.length} items → "My First List" (trip ${defaultTripId})`);
        }
      }

      // Drop the old table now that migration is safe
      await db.execAsync('DROP TABLE IF EXISTS ScannedItems;');
      console.log('[DB] ScannedItems dropped after migration');
    }

    // ── 3. Ensure an active trip always exists ────────────────────────────────
    // This guarantees the scanner always has somewhere to save items.
    const activeTrip = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM Trips WHERE status = 'active'`,
    );
    if ((activeTrip?.cnt ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO Trips (name, status) VALUES (?, 'active')`,
        [`Shopping List — ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`],
      );
      console.log('[DB] Created initial active trip');
    }

    console.log('[DB] Initialized successfully ✓');
  } catch (error) {
    console.error('[DB] Init error:', error);
  }
};

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export const getActiveTrip = async (): Promise<Trip | null> => {
  try {
    return await db.getFirstAsync<Trip>(
      `SELECT * FROM Trips WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
    );
  } catch (error) {
    console.error('[DB] getActiveTrip error:', error);
    return null;
  }
};

export const getAllTrips = async (): Promise<Trip[]> => {
  try {
    return await db.getAllAsync<Trip>(
      `SELECT * FROM Trips ORDER BY created_at DESC`,
    );
  } catch (error) {
    console.error('[DB] getAllTrips error:', error);
    return [];
  }
};

export const createTrip = async (
  name: string,
  budget: number = 2000,
  store?: string,
  scheduledAt?: string,
  status: TripStatus = 'active',
): Promise<number | null> => {
  try {
    const result = await db.runAsync(
      `INSERT INTO Trips (name, store, budget, status, scheduled_at) VALUES (?, ?, ?, ?, ?)`,
      [name, store ?? null, budget, status, scheduledAt ?? null],
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('[DB] createTrip error:', error);
    return null;
  }
};

export const updateTrip = async (
  id: number,
  fields: Partial<Pick<Trip, 'name' | 'store' | 'budget' | 'status' | 'scheduled_at' | 'completed_at'>>,
): Promise<boolean> => {
  try {
    const keys   = Object.keys(fields);
    const values = Object.values(fields);
    if (keys.length === 0) return true;
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    await db.runAsync(
      `UPDATE Trips SET ${setClauses} WHERE id = ?`,
      [...values, id],
    );
    return true;
  } catch (error) {
    console.error('[DB] updateTrip error:', error);
    return false;
  }
};

export const completeTrip = async (id: number): Promise<boolean> =>
  updateTrip(id, { status: 'completed', completed_at: new Date().toISOString() });

export const deleteTrip = async (id: number): Promise<boolean> => {
  try {
    // ON DELETE CASCADE handles TripItems automatically
    await db.runAsync('DELETE FROM Trips WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('[DB] deleteTrip error:', error);
    return false;
  }
};

export const duplicateTripAsTemplate = async (tripId: number, newName: string): Promise<number | null> => {
  try {
    const trip = await db.getFirstAsync<Trip>('SELECT * FROM Trips WHERE id = ?', [tripId]);
    if (!trip) return null;

    const newTripId = await createTrip(newName, trip.budget, trip.store ?? undefined, undefined, 'template');
    if (!newTripId) return null;

    const items = await getTripItems(tripId);
    for (const item of items) {
      await saveTripItem(newTripId, item.product, item.unit_price, item.quantity);
    }
    return newTripId;
  } catch (error) {
    console.error('[DB] duplicateTripAsTemplate error:', error);
    return null;
  }
};

// ─── TRIP ITEMS ───────────────────────────────────────────────────────────────

export const getTripItems = async (tripId: number): Promise<TripItem[]> => {
  try {
    return await db.getAllAsync<TripItem>(
      `SELECT * FROM TripItems WHERE trip_id = ? ORDER BY scanned_at DESC`,
      [tripId],
    );
  } catch (error) {
    console.error('[DB] getTripItems error:', error);
    return [];
  }
};

export const saveTripItem = async (
  tripId: number,
  product: string,
  unitPrice: number,
  quantity: number = 1,
): Promise<number | null> => {
  try {
    const priceDisplay = formatPrice(unitPrice);
    const result = await db.runAsync(
      `INSERT INTO TripItems (trip_id, product, price, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [tripId, product, priceDisplay, unitPrice, quantity],
    );

    // Update product catalogue in the background
    upsertCatalogue(product, unitPrice).catch(() => {});

    return result.lastInsertRowId;
  } catch (error) {
    console.error('[DB] saveTripItem error:', error);
    return null;
  }
};

export const updateTripItem = async (
  id: number,
  product: string,
  unitPrice: number,
  quantity: number,
): Promise<boolean> => {
  try {
    const priceDisplay = formatPrice(unitPrice);
    await db.runAsync(
      `UPDATE TripItems
       SET product = ?, price = ?, unit_price = ?, quantity = ?, is_synced = 0
       WHERE id = ?`,
      [product, priceDisplay, unitPrice, quantity, id],
    );
    upsertCatalogue(product, unitPrice).catch(() => {});
    return true;
  } catch (error) {
    console.error('[DB] updateTripItem error:', error);
    return false;
  }
};

export const deleteTripItem = async (id: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM TripItems WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('[DB] deleteTripItem error:', error);
    return false;
  }
};

export const toggleTripItemChecked = async (id: number, isChecked: boolean): Promise<boolean> => {
  try {
    await db.runAsync(
      'UPDATE TripItems SET is_checked = ? WHERE id = ?',
      [isChecked ? 1 : 0, id],
    );
    return true;
  } catch (error) {
    console.error('[DB] toggleChecked error:', error);
    return false;
  }
};

export const clearTripItems = async (tripId: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM TripItems WHERE trip_id = ?', [tripId]);
    return true;
  } catch (error) {
    console.error('[DB] clearTripItems error:', error);
    return false;
  }
};

// ─── PRODUCT CATALOGUE ────────────────────────────────────────────────────────

const upsertCatalogue = async (name: string, unitPrice: number) => {
  await db.runAsync(
    `INSERT INTO ProductCatalogue (name, last_price, last_seen_at, scan_count)
     VALUES (?, ?, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(name) DO UPDATE SET
       last_price   = excluded.last_price,
       last_seen_at = CURRENT_TIMESTAMP,
       scan_count   = scan_count + 1`,
    [name.trim(), unitPrice],
  );
};

export const getCatalogueEntries = async (limit = 20): Promise<CatalogueEntry[]> => {
  try {
    return await db.getAllAsync<CatalogueEntry>(
      `SELECT * FROM ProductCatalogue ORDER BY scan_count DESC, last_seen_at DESC LIMIT ?`,
      [limit],
    );
  } catch (error) {
    console.error('[DB] getCatalogueEntries error:', error);
    return [];
  }
};

export const searchCatalogue = async (query: string): Promise<CatalogueEntry[]> => {
  try {
    return await db.getAllAsync<CatalogueEntry>(
      `SELECT * FROM ProductCatalogue
       WHERE name LIKE ? ORDER BY scan_count DESC LIMIT 10`,
      [`%${query}%`],
    );
  } catch (error) {
    console.error('[DB] searchCatalogue error:', error);
    return [];
  }
};

// ─── LEGACY SHIM ─────────────────────────────────────────────────────────────
// Keeps ScannerScreen working without changes while we migrate.
// Saves to the current active trip automatically.

export const saveItemToDB = async (
  product: string,
  unitPrice: number,
  quantity: number = 1,
): Promise<number | null> => {
  const trip = await getActiveTrip();
  if (!trip) {
    console.warn('[DB] saveItemToDB: no active trip found');
    return null;
  }
  return saveTripItem(trip.id, product, unitPrice, quantity);
};

// The old getOfflineItems now reads from the active trip
export const getOfflineItems = async (): Promise<TripItem[]> => {
  const trip = await getActiveTrip();
  if (!trip) return [];
  return getTripItems(trip.id);
};

export const updateItemInDB = async (
  id: number,
  product: string,
  unitPrice: number,
  quantity: number,
): Promise<boolean> => updateTripItem(id, product, unitPrice, quantity);

export const deleteItemFromDB = async (id: number): Promise<boolean> =>
  deleteTripItem(id);