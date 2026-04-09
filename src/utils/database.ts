// src/utils/database.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('buyoyo_offline.db');

// ─── Init + Migration ─────────────────────────────────────────────────────────
// Safe to run on every app start. Uses "ADD COLUMN IF NOT EXISTS" pattern:
// SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we catch the error
// if the column already exists — that's fine and expected on existing installs.

const addColumnIfMissing = async (table: string, column: string, definition: string) => {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch {
    // Column already exists — safe to ignore
  }
};

export const initDatabase = async () => {
  try {
    // Create table with full schema (new installs)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ScannedItems (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        product     TEXT NOT NULL,
        price       TEXT NOT NULL,
        unit_price  REAL DEFAULT 0,
        quantity    INTEGER DEFAULT 1,
        scanned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_synced   INTEGER DEFAULT 0
      );
    `);

    // Migration for existing installs that have the old schema (no qty / unit_price)
    await addColumnIfMissing('ScannedItems', 'unit_price', 'REAL DEFAULT 0');
    await addColumnIfMissing('ScannedItems', 'quantity',   'INTEGER DEFAULT 1');

    // Back-fill unit_price from the price string for any rows that pre-date this migration.
    // Strips the ₱ symbol and parses. Runs cheaply — only touches rows where unit_price = 0.
    await db.execAsync(`
      UPDATE ScannedItems
      SET unit_price = CAST(
        REPLACE(REPLACE(REPLACE(price, '₱', ''), ',', ''), ' ', '')
        AS REAL
      )
      WHERE unit_price = 0 AND price != '---';
    `);

    console.log('[DB] Initialized successfully');
  } catch (error) {
    console.error('[DB] Init error:', error);
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────
export const saveItemToDB = async (
  product: string,
  unitPrice: number,    // now a real number, not a string
  quantity: number = 1,
): Promise<number | null> => {
  try {
    // Store the formatted price string for display, AND the raw number for math
    const priceDisplay = `₱${unitPrice.toFixed(2)}`;
    const result = await db.runAsync(
      `INSERT INTO ScannedItems (product, price, unit_price, quantity, is_synced)
       VALUES (?, ?, ?, ?, 0)`,
      [product, priceDisplay, unitPrice, quantity],
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('[DB] Save error:', error);
    return null;
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────
export const getOfflineItems = async (): Promise<any[]> => {
  try {
    return await db.getAllAsync(
      'SELECT * FROM ScannedItems ORDER BY scanned_at DESC',
    );
  } catch (error) {
    console.error('[DB] Fetch error:', error);
    return [];
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateItemInDB = async (
  id: number,
  product: string,
  unitPrice: number,
  quantity: number,
): Promise<boolean> => {
  try {
    const priceDisplay = `₱${unitPrice.toFixed(2)}`;
    await db.runAsync(
      `UPDATE ScannedItems
       SET product = ?, price = ?, unit_price = ?, quantity = ?, is_synced = 0
       WHERE id = ?`,
      [product, priceDisplay, unitPrice, quantity, id],
    );
    return true;
  } catch (error) {
    console.error('[DB] Update error:', error);
    return false;
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteItemFromDB = async (id: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM ScannedItems WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('[DB] Delete error:', error);
    return false;
  }
};

// ─── Dev helper ───────────────────────────────────────────────────────────────
export const getOfflineItemsDev = async () => {
  if (!__DEV__) return;
  const rows = await getOfflineItems();
  console.table(rows);
};