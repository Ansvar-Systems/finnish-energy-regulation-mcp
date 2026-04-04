/**
 * Combined ingestion for all 4 Finnish energy regulators.
 *
 * Inserts regulatory content sourced from:
 *   - Energiavirasto (energiavirasto.fi) — market regulation, network pricing
 *   - TEM (tem.fi) — energy policy, legislation
 *   - Fingrid (fingrid.fi) — grid codes, Datahub, reserve markets
 *   - Tukes (tukes.fi) — electrical and gas safety rules
 *
 * Usage:
 *   npx tsx scripts/ingest-all.ts
 *   npx tsx scripts/ingest-all.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["FI_ENERGY_DB_PATH"] ?? "data/fi-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

// ===================================================================
// REGULATORS
// ===================================================================

const regulators = [
  { id: "energiavirasto", name: "Energiavirasto", full_name: "Energiavirasto (Energy Authority)", url: "https://energiavirasto.fi", description: "Finnish Energy Authority — market regulation, network pricing, emissions trading, renewable energy support, energy efficiency supervision, NIS2 competent authority for energy sector" },
  { id: "fingrid", name: "Fingrid", full_name: "Fingrid Oyj (Finnish TSO)", url: "https://fingrid.fi", description: "Finnish TSO — main grid (kantaverkko) management, grid codes, balancing, reserve markets, Datahub, grid connection requirements" },
  { id: "tem", name: "TEM", full_name: "Tyo- ja elinkeinoministrio (Ministry of Economic Affairs and Employment)", url: "https://tem.fi", description: "Ministry of Economic Affairs and Employment — energy policy, energy legislation, climate strategy, renewable energy, nuclear energy licensing" },
  { id: "tukes", name: "Tukes", full_name: "Turvallisuus- ja kemikaalivirasto (Tukes)", url: "https://tukes.fi", description: "Safety and Chemicals Agency — electrical safety, gas safety, mining safety, pressure equipment, energy equipment market surveillance" },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ===================================================================
// REGULATIONS (Energiavirasto + TEM + Tukes)
// ===================================================================

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: populated by full ingestion from finlex.fi, energiavirasto.fi, tukes.fi
const allRegs: string[][] = [];

const insertRegBatch = db.transaction(() => {
  for (const r of allRegs) {
    insertRegulation.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
  }
});
insertRegBatch();
console.log(`Inserted ${allRegs.length} regulations`);

// ===================================================================
// GRID CODES (Fingrid)
// ===================================================================

db.prepare("DELETE FROM grid_codes").run();

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: populated by full ingestion from fingrid.fi
const allGridCodes: string[][] = [];

const insertGCBatch = db.transaction(() => {
  for (const g of allGridCodes) {
    insertGridCode.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6]);
  }
});
insertGCBatch();
console.log(`Inserted ${allGridCodes.length} Fingrid grid codes`);

// ===================================================================
// DECISIONS (Energiavirasto)
// ===================================================================

db.prepare("DELETE FROM decisions").run();

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Placeholder: populated by full ingestion from energiavirasto.fi
const allDecisions: string[][] = [];

const insertDecBatch = db.transaction(() => {
  for (const d of allDecisions) {
    insertDecision.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
  }
});
insertDecBatch();
console.log(`Inserted ${allDecisions.length} Energiavirasto decisions`);

// ===================================================================
// REBUILD FTS INDEXES
// ===================================================================

db.exec("INSERT INTO regulations_fts(regulations_fts) VALUES('rebuild')");
db.exec("INSERT INTO grid_codes_fts(grid_codes_fts) VALUES('rebuild')");
db.exec("INSERT INTO decisions_fts(decisions_fts) VALUES('rebuild')");

// ===================================================================
// DB METADATA
// ===================================================================

db.exec(`CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
)`);

const stats = {
  regulators: (db.prepare("SELECT count(*) as n FROM regulators").get() as { n: number }).n,
  regulations: (db.prepare("SELECT count(*) as n FROM regulations").get() as { n: number }).n,
  grid_codes: (db.prepare("SELECT count(*) as n FROM grid_codes").get() as { n: number }).n,
  decisions: (db.prepare("SELECT count(*) as n FROM decisions").get() as { n: number }).n,
  ev: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'energiavirasto'").get() as { n: number }).n,
  tukes: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'tukes'").get() as { n: number }).n,
  tem: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'tem'").get() as { n: number }).n,
};

const insertMeta = db.prepare("INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)");
insertMeta.run("schema_version", "1.0");
insertMeta.run("tier", "free");
insertMeta.run("domain", "finnish-energy-regulation");
insertMeta.run("build_date", new Date().toISOString().split("T")[0]);
insertMeta.run("regulations_count", String(stats.regulations));
insertMeta.run("grid_codes_count", String(stats.grid_codes));
insertMeta.run("decisions_count", String(stats.decisions));
insertMeta.run("total_records", String(stats.regulations + stats.grid_codes + stats.decisions));

console.log(`\nDatabase summary:`);
console.log(`  Regulators:         ${stats.regulators}`);
console.log(`  Regulations:        ${stats.regulations} (EV: ${stats.ev}, Tukes: ${stats.tukes}, TEM: ${stats.tem})`);
console.log(`  Grid codes:         ${stats.grid_codes} (Fingrid)`);
console.log(`  Decisions:          ${stats.decisions} (Energiavirasto)`);
console.log(`  Total documents:    ${stats.regulations + stats.grid_codes + stats.decisions}`);
console.log(`\nDone. Database at ${DB_PATH}`);

db.close();
