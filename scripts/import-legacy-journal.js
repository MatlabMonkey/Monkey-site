/**
 * Import legacy journal data from CSV (e.g. Google Forms export) into Supabase.
 * Uses mapping JSON: CSV column header → question_catalog.key (+ optional type, wording).
 * See scripts/LEGACY_IMPORT.md for format and usage.
 *
 * Usage: node scripts/import-legacy-journal.js <csv-path> <mapping-path> [--timestamp-column "Col"] [--date-column "Col"]
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

/** Parse CSV string into array of objects (first row = headers).
 * Handles quoted fields with newlines inside them.
 */
function parseCSV(csvContent) {
  const rows = [];
  const fields = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  while (i < csvContent.length) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote ("")
        currentField += '"';
        i += 2;
      } else if (insideQuotes && (nextChar === "," || nextChar === "\n" || nextChar === "\r" || i === csvContent.length - 1)) {
        // End of quoted field
        insideQuotes = false;
        i++;
      } else {
        // Start or end of quoted field
        insideQuotes = !insideQuotes;
        i++;
      }
    } else if (char === "," && !insideQuotes) {
      // Field separator
      fields.push(currentField.trim());
      currentField = "";
      i++;
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !insideQuotes) {
      // Row separator (only when not inside quotes)
      if (char === "\r" && nextChar === "\n") {
        i += 2; // Skip \r\n
      } else {
        i++; // Skip \n
      }
      if (currentField.trim() !== "" || fields.length > 0) {
        fields.push(currentField.trim());
        if (fields.length > 0) {
          rows.push(fields.slice());
        }
        fields.length = 0;
        currentField = "";
      }
    } else {
      // Regular character (including newlines inside quoted fields)
      currentField += char;
      i++;
    }
  }

  // Don't forget the last field/row
  if (currentField.trim() !== "" || fields.length > 0) {
    fields.push(currentField.trim());
  }
  if (fields.length > 0) {
    rows.push(fields);
  }

  if (rows.length === 0) return [];

  // First row is headers
  const headers = rows[0].map((h) => h.trim());
  const dataRows = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = rows[r][i] !== undefined ? String(rows[r][i]).trim() : "";
    });
    dataRows.push(obj);
  }

  return dataRows;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const QUESTION_TYPES = ["text", "number", "rating", "boolean", "multiselect", "date"];

/** Parse checklist format (with or without braces) into array. Handles:
 * - "{item1, item2, ...}" → ["item1", "item2", ...]
 * - "item1, item2, ..." → ["item1", "item2", ...]
 * - "single item" → ["single item"]
 */
function parseChecklist(value) {
  if (Array.isArray(value)) return value;
  const str = String(value).trim();
  if (!str) return null;
  // Check for {item1, item2, ...} format
  if (str.startsWith("{") && str.endsWith("}")) {
    const inner = str.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // If it's comma-separated (no braces), split it
  if (str.includes(",")) {
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Single value as array
  return [str];
}

function toValueCols(value, answerType) {
  const out = { value_text: null, value_number: null, value_boolean: null, value_json: null };
  if (value === null || value === undefined || value === "") return out;
  const type = QUESTION_TYPES.includes(answerType) ? answerType : "text";
  switch (type) {
    case "text":
    case "date":
      out.value_text = typeof value === "string" ? value : String(value);
      break;
    case "number":
    case "rating": {
      const n = typeof value === "number" ? value : Number(value);
      out.value_number = Number.isNaN(n) ? null : n;
      break;
    }
    case "boolean":
      out.value_boolean = value === true || value === "true" || String(value).toLowerCase() === "yes";
      break;
    case "multiselect": {
      const parsed = parseChecklist(value);
      out.value_json = parsed !== null ? parsed : null;
      break;
    }
    default:
      out.value_text = typeof value === "string" ? value : String(value);
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let csvPath = null;
  let mappingPath = null;
  let timestampColumn = "Timestamp";
  let dateColumn = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--timestamp-column" && args[i + 1]) {
      timestampColumn = args[++i];
    } else if (args[i] === "--date-column" && args[i + 1]) {
      dateColumn = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (!csvPath) {
      csvPath = args[i];
    } else if (!mappingPath) {
      mappingPath = args[i];
    }
  }
  if (!csvPath || !mappingPath) {
    console.error("Usage: node scripts/import-legacy-journal.js <csv-path> <mapping-path> [--timestamp-column \"Col\"] [--date-column \"Col\"] [--dry-run]");
    process.exit(1);
  }
  return { csvPath, mappingPath, timestampColumn, dateColumn, dryRun };
}

function normalizeMapping(raw) {
  const out = {};
  for (const [csvHeader, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      if (val === "_skip") {
        // Skip this column
        continue;
      }
      out[csvHeader] = { key: val, type: "text", wording: csvHeader };
    } else if (val && val.split) {
      // Split configuration - keep as-is
      out[csvHeader] = val;
    } else if (val && typeof val.key === "string") {
      out[csvHeader] = {
        key: val.key,
        type: QUESTION_TYPES.includes(val.type) ? val.type : "text",
        wording: val.wording != null ? val.wording : csvHeader,
      };
    }
  }
  return out;
}

/** Split checklist items into workouts vs daily habits based on keywords. */
function splitChecklist(items, workoutKeywords) {
  const workouts = [];
  const habits = [];
  const keywordsLower = workoutKeywords.map((k) => k.toLowerCase());
  for (const item of items) {
    const itemLower = String(item).toLowerCase();
    const isWorkout = keywordsLower.some((kw) => itemLower.includes(kw));
    if (isWorkout) {
      workouts.push(item);
    } else {
      habits.push(item);
    }
  }
  return { workouts, habits };
}

function getEntryDate(row, mapping, timestampColumn, dateColumn) {
  if (dateColumn && row[dateColumn]) {
    const raw = String(row[dateColumn]).trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const tsCol = timestampColumn && row[timestampColumn] ? row[timestampColumn] : row["Timestamp"];
  if (tsCol) {
    const d = new Date(tsCol);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

async function ensureQuestion(key, type, wording, displayOrder) {
  const { data: existing } = await supabase.from("question_catalog").select("id").eq("key", key).maybeSingle();
  if (existing) return existing.id;
  const { data: inserted, error } = await supabase
    .from("question_catalog")
    .insert({ key, question_type: type, wording, description: null, display_order: displayOrder, metadata: {} })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

async function main() {
  const { csvPath, mappingPath, timestampColumn, dateColumn, dryRun } = parseArgs();
  const csvAbs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const mappingAbs = path.isAbsolute(mappingPath) ? mappingPath : path.join(process.cwd(), mappingPath);

  if (!fs.existsSync(csvAbs)) {
    console.error("CSV file not found:", csvAbs);
    process.exit(1);
  }
  if (!fs.existsSync(mappingAbs)) {
    console.error("Mapping file not found:", mappingAbs);
    process.exit(1);
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE — no data will be written\n");
  }

  const rawMapping = JSON.parse(fs.readFileSync(mappingAbs, "utf8"));
  const mapping = normalizeMapping(rawMapping);

  const timestampKey = Object.entries(rawMapping).find(([, v]) => v === "_timestamp" || (v && v.key === "_timestamp"));
  const timestampCol = timestampKey ? timestampKey[0] : timestampColumn;

  const csvContent = fs.readFileSync(csvAbs, "utf8");
  const rows = parseCSV(csvContent);
  
  if (rows.length === 0) {
    console.error("No data rows found in CSV (first row is headers, rest should be data)");
    process.exit(1);
  }

  console.log(`📊 CSV loaded: ${rows.length} data rows (first row = headers)`);
  console.log(`📋 Headers found: ${Object.keys(rows[0] || {}).join(", ")}\n`);

  const answerColumns = Object.entries(mapping).filter(([_, spec]) => {
    if (!spec || spec.key === "_timestamp") return false;
    if (spec.split) return true; // Include split configs
    return true;
  });
  
  // Collect all question keys (including from splits)
  const allKeys = new Set();
  for (const [csvHeader, spec] of answerColumns) {
    if (spec.split) {
      // Add keys from split config
      if (spec.split.workouts) allKeys.add(spec.split.workouts.key);
      if (spec.split.daily_habits) allKeys.add(spec.split.daily_habits.key);
    } else if (spec.key) {
      allKeys.add(spec.key);
    }
  }
  
  let displayOrder = 1000;
  const keyToId = new Map();
  
  if (!dryRun) {
    for (const key of allKeys) {
      // Find spec for this key (could be from split or regular mapping)
      let spec = null;
      for (const [csvHeader, s] of answerColumns) {
        if (s.split) {
          if (s.split.workouts && s.split.workouts.key === key) spec = s.split.workouts;
          if (s.split.daily_habits && s.split.daily_habits.key === key) spec = s.split.daily_habits;
        } else if (s.key === key) {
          spec = s;
        }
      }
      if (!spec) spec = { key, type: "text", wording: key };
      const id = await ensureQuestion(spec.key, spec.type, spec.wording, displayOrder++);
      keyToId.set(key, id);
    }
  } else {
    // In dry-run, just assign fake IDs for preview
    Array.from(allKeys).forEach((key, idx) => {
      keyToId.set(key, `fake-id-${idx}`);
    });
  }

  let entriesCreated = 0;
  let answersCreated = 0;
  let rowsSkipped = 0;
  let emptyRowsSkipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const entryDate = getEntryDate(row, mapping, timestampCol, dateColumn);
    if (!entryDate) {
      console.warn(`⚠️  Row ${i + 2} skipped: no date (timestamp or date column)`);
      rowsSkipped++;
      continue;
    }

    // Check if row has any non-empty answer values
    const hasAnyAnswers = answerColumns.some(([csvHeader]) => {
      const raw = row[csvHeader];
      return raw !== undefined && String(raw).trim() !== "";
    });

    if (!hasAnyAnswers) {
      console.warn(`⚠️  Row ${i + 2} (${entryDate}) skipped: all answer columns are empty`);
      emptyRowsSkipped++;
      continue;
    }

    if (dryRun) {
      console.log(`📅 Row ${i + 2}: ${entryDate}`);
      answerColumns.forEach(([csvHeader, spec]) => {
        const raw = row[csvHeader];
        if (raw === undefined || (typeof raw === "string" && raw.trim() === "")) return;

        // Handle split configs in dry-run
        if (spec.split) {
          const items = parseChecklist(raw);
          if (!items || items.length === 0) return;
          const workoutKeywords = spec.split.workouts?.keywords || [];
          const { workouts, habits } = splitChecklist(items, workoutKeywords);
          if (workouts.length > 0 && spec.split.workouts) {
            console.log(`   ${spec.split.workouts.key} (multiselect): ${JSON.stringify(workouts)}`);
          }
          if (habits.length > 0 && spec.split.daily_habits) {
            console.log(`   ${spec.split.daily_habits.key} (multiselect): ${JSON.stringify(habits)}`);
          }
          return;
        }

        // Regular columns
        if (!spec.key) return;
        const { value_text, value_number, value_boolean, value_json } = toValueCols(raw, spec.type);
        const display = value_text ?? value_number ?? value_boolean ?? JSON.stringify(value_json) ?? "(empty)";
        console.log(`   ${spec.key} (${spec.type}): ${display}`);
      });
      entriesCreated++;
      // Count answers (including splits)
      let count = 0;
      answerColumns.forEach(([csvHeader, spec]) => {
        const raw = row[csvHeader];
        if (raw === undefined || (typeof raw === "string" && raw.trim() === "")) return;
        if (spec.split) {
          const items = parseChecklist(raw);
          if (items && items.length > 0) {
            const workoutKeywords = spec.split.workouts?.keywords || [];
            const { workouts, habits } = splitChecklist(items, workoutKeywords);
            if (workouts.length > 0) count++;
            if (habits.length > 0) count++;
          }
        } else if (spec.key) {
          count++;
        }
      });
      answersCreated += count;
      continue;
    }

    const { data: entryRow, error: entryErr } = await supabase
      .from("journal_entry")
      .upsert(
        {
          date: entryDate,
          is_draft: false,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (entryErr) {
      console.error(`❌ Row ${i + 2} entry upsert failed:`, entryErr.message);
      continue;
    }
    entriesCreated++;

    for (const [csvHeader, spec] of answerColumns) {
      const raw = row[csvHeader];
      if (raw === undefined || (typeof raw === "string" && raw.trim() === "")) continue;

      // Handle split configuration (e.g., Checklist → workouts + daily_habits)
      if (spec.split) {
        const items = parseChecklist(raw);
        if (!items || items.length === 0) continue;

        const workoutKeywords = spec.split.workouts?.keywords || [];
        const { workouts, habits } = splitChecklist(items, workoutKeywords);

        // Insert workouts answer
        if (workouts.length > 0 && spec.split.workouts) {
          const workoutId = keyToId.get(spec.split.workouts.key);
          if (workoutId) {
            const { value_json } = toValueCols(workouts, "multiselect");
            const answerRow = {
              entry_id: entryRow.id,
              question_id: workoutId,
              ...(value_json != null && { value_json }),
            };
            const { error: err } = await supabase.from("journal_answer").upsert(answerRow, {
              onConflict: "entry_id,question_id",
              ignoreDuplicates: false,
            });
            if (err) {
              console.warn(`⚠️  Row ${i + 2} answer ${spec.split.workouts.key}:`, err.message);
            } else {
              answersCreated++;
            }
          }
        }

        // Insert daily_habits answer
        if (habits.length > 0 && spec.split.daily_habits) {
          const habitsId = keyToId.get(spec.split.daily_habits.key);
          if (habitsId) {
            const { value_json } = toValueCols(habits, "multiselect");
            const answerRow = {
              entry_id: entryRow.id,
              question_id: habitsId,
              ...(value_json != null && { value_json }),
            };
            const { error: err } = await supabase.from("journal_answer").upsert(answerRow, {
              onConflict: "entry_id,question_id",
              ignoreDuplicates: false,
            });
            if (err) {
              console.warn(`⚠️  Row ${i + 2} answer ${spec.split.daily_habits.key}:`, err.message);
            } else {
              answersCreated++;
            }
          }
        }
        continue;
      }

      // Regular (non-split) column processing
      if (!spec.key) continue;
      const questionId = keyToId.get(spec.key);
      if (!questionId) continue;

      const { value_text, value_number, value_boolean, value_json } = toValueCols(raw, spec.type);
      const answerRow = {
        entry_id: entryRow.id,
        question_id: questionId,
        ...(value_text != null && { value_text }),
        ...(value_number != null && { value_number }),
        ...(value_boolean != null && { value_boolean }),
        ...(value_json != null && { value_json }),
      };

      const { error: ansErr } = await supabase.from("journal_answer").upsert(answerRow, {
        onConflict: "entry_id,question_id",
        ignoreDuplicates: false,
      });
      if (ansErr) {
        console.warn(`⚠️  Row ${i + 2} answer ${spec.key}:`, ansErr.message);
      } else {
        answersCreated++;
      }
    }
  }

  console.log("\n✅ Done!");
  console.log(`   Entries: ${entriesCreated}`);
  console.log(`   Answers: ${answersCreated}`);
  if (rowsSkipped > 0) console.log(`   Skipped (no date): ${rowsSkipped}`);
  if (emptyRowsSkipped > 0) console.log(`   Skipped (empty): ${emptyRowsSkipped}`);
  if (dryRun) console.log("\n💡 This was a dry run. Remove --dry-run to actually import.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
