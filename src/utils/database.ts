// src/utils/database.ts
import * as SQLite from 'expo-sqlite';

// Open (or create) the database synchronously 
const db = SQLite.openDatabaseSync('buyoyo_offline.db');

export const initDatabase = async () => {
  try {
    // Create the table if it doesn't exist.
    // is_synced is an integer (0 = false, 1 = true) because SQLite doesn't have a strict boolean type.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ScannedItems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product TEXT NOT NULL,
        price TEXT NOT NULL,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_synced INTEGER DEFAULT 0 
      );
    `);
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const saveItemToDB = async (product: string, price: string) => {
  try {
    // We use runAsync to securely inject the variables and prevent SQL injection
    const result = await db.runAsync(
      'INSERT INTO ScannedItems (product, price, is_synced) VALUES (?, ?, 0)',
      [product, price]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error saving item:', error);
    return null;
  }
};

// A helper to check our offline inventory during development
export const getOfflineItems = async () => {
  try {
    const allRows = await db.getAllAsync('SELECT * FROM ScannedItems ORDER BY scanned_at DESC');
    return allRows;
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};

// Update
export const updateItemInDB = async (id: number, product: string, price: string) => {
  try {
    // We set is_synced back to 0 so future cloud syncs know this was modified
    await db.runAsync(
      'UPDATE ScannedItems SET product = ?, price = ?, is_synced = 0 WHERE id = ?',
      [product, price, id]
    );
    return true;
  } catch (error) {
    console.error('Error updating item:', error);
    return false;
  }
};

// Delete
export const deleteItemFromDB = async (id: number) => {
  try {
    await db.runAsync('DELETE FROM ScannedItems WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
};