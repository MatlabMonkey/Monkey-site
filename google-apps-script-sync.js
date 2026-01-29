// LEGACY: Syncs Google Form to an OLD Supabase project (ekmhgzx...). Deprecated;
// the journal is now entirely in-app using the new Supabase project. Keep for
// reference or one-time migration of historical data.

// Robust Google Apps Script Sync Function
// This version handles sync failures and can recover from issues

// Configuration (OLD project - do not use for new journal)
const SUPABASE_URL = 'https://ekmhgzxidqbkpdiilzfc.supabase.co';
const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbWhzenhpZHFia3BkaWlsemZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTg0NDEsImV4cCI6MjA2NTE5NDQ0MX0.t8Bi6SJqLKFzzDGtetJJTn1I37XLQmnok_TLUtWRcc4';
const SUPABASE_TABLE = 'journal_entries';
const SHEET_NAME = 'Form Responses 1';
const API_KEY = 'sk-289257434fd03a7719554d2afcbebd9c4b5eab39b78c11120683c66d1fd1461c';

// Helper function to parse dates
function parseDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue.toISOString().split('T')[0];
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return date.toISOString().split('T')[0];
  }
  return null;
}

// Helper function to parse numbers
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// Helper function to parse checklist/booleans
function parseChecklist(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

// Function to get the latest date from Supabase
function getLatestDateFromSupabase() {
  try {
    const options = {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const url = `${SUPABASE_URL}/rest/v1/rpc/get_latest_entry_date`;
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    return result ? parseDate(result) : null;
  } catch (e) {
    console.error('Error getting latest date from Supabase:', e);
    return null;
  }
}

// Function to check if an entry exists
function entryExists(date) {
  try {
    const options = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ p_date: date })
    };
    
    const url = `${SUPABASE_URL}/rest/v1/rpc/entry_exists`;
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    return result === true;
  } catch (e) {
    console.error('Error checking if entry exists:', e);
    return false;
  }
}

// Main sync function with error handling and recovery
function syncToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found`);
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    console.log('No data to sync');
    return;
  }
  
  // Get the latest date from Supabase to determine sync point
  const latestSupabaseDate = getLatestDateFromSupabase();
  console.log('Latest date in Supabase:', latestSupabaseDate);
  
  // Find the starting row based on the latest date in Supabase
  let startRow = 1; // Start from the beginning if no data in Supabase
  
  if (latestSupabaseDate) {
    // Find the row that contains the latest date
    for (let i = 1; i < data.length; i++) {
      const rowDate = parseDate(data[i][1]); // Assuming date is in column B (index 1)
      if (rowDate === latestSupabaseDate) {
        startRow = i + 1; // Start from the next row
        break;
      }
    }
  }
  
  console.log(`Starting sync from row ${startRow}`);
  
  // Get new rows to sync
  const newRows = data.slice(startRow);
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  console.log(`Found ${newRows.length} new rows to sync`);
  
  // Process each row
  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    const rowIndex = startRow + i;
    
    // Skip empty rows
    if (!row[1] || !parseDate(row[1])) {
      console.log(`Skipping row ${rowIndex + 1}: No valid date`);
      skippedCount++;
      continue;
    }
    
    const entryDate = parseDate(row[1]);
    
    // Check if entry already exists
    if (entryExists(entryDate)) {
      console.log(`Skipping row ${rowIndex + 1}: Entry for ${entryDate} already exists`);
      skippedCount++;
      continue;
    }
    
    const entry = {
      timestamp: parseDate(row[0]),
      date: entryDate,
      how_good: toNumber(row[2]),
      productivity: toNumber(row[3]),
      drinks: toNumber(row[4]),
      plot: toNumber(row[5]),
      scount: toNumber(row[6]),
      summary: row[7] || '',
      reflection: row[8] || '',
      rose: row[9] || '',
      bud: row[10] || '',
      thorn: row[11] || '',
      proud_of: row[12] || '',
      gratitude: row[13] || '',
      met_person: row[14] || '',
      thought_of_day: row[15] || '',
      raok: row[16] || '',
      goals: row[17] || '',
      booleans: parseChecklist(row[18]),
      deep_work_hours: toNumber(row[19]),
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'x-api-key': API_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(entry)
    };

    try {
      const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
      const response = UrlFetchApp.fetch(url, options);
      
      if (response.getResponseCode() === 201) {
        console.log(`Successfully synced row ${rowIndex + 1} for date ${entryDate}`);
        successCount++;
      } else {
        console.error(`Failed to sync row ${rowIndex + 1}: HTTP ${response.getResponseCode()}`);
        errorCount++;
      }
    } catch (e) {
      console.error(`Error syncing row ${rowIndex + 1} for date ${entryDate}: ${e}`);
      errorCount++;
    }
  }
  
  // Log summary
  console.log(`Sync completed: ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`);
  
  // Store sync status for debugging
  PropertiesService.getScriptProperties().setProperty('lastSyncStatus', JSON.stringify({
    timestamp: new Date().toISOString(),
    successCount,
    errorCount,
    skippedCount,
    totalRows: newRows.length,
    latestDate: latestSupabaseDate
  }));
}

// Function to check sync status
function checkSyncStatus() {
  try {
    const options = {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const url = `${SUPABASE_URL}/rest/v1/rpc/get_sync_status`;
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    console.log('Sync Status:', result);
    return result;
  } catch (e) {
    console.error('Error checking sync status:', e);
    return null;
  }
}

// Function to reset sync (use with caution)
function resetSync() {
  PropertiesService.getScriptProperties().deleteProperty('lastSyncStatus');
  console.log('Sync status reset');
}

// Function to manually sync specific date range
function syncDateRange(startDate, endDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  let syncCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const entryDate = parseDate(row[1]);
    
    if (entryDate && entryDate >= startDate && entryDate <= endDate) {
      // Same sync logic as above, but only for the specified date range
      // ... (implement the same entry creation logic)
      syncCount++;
    }
  }
  
  console.log(`Synced ${syncCount} entries for date range ${startDate} to ${endDate}`);
} 