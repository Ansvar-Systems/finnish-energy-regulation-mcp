/**
 * Seed the Finnish Energy Regulation database with sample data for testing.
 *
 * Inserts representative regulations, grid codes, and decisions from:
 *   - Energiavirasto (market regulation, network pricing)
 *   - TEM (energy policy, legislation)
 *   - Fingrid (grid codes, Datahub)
 *   - Tukes (electrical/gas safety)
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["FI_ENERGY_DB_PATH"] ?? "data/fi-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted existing database at ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

console.log(`Database initialised at ${DB_PATH}`);

// -- Regulators --

const regulators = [
  {
    id: "energiavirasto",
    name: "Energiavirasto",
    full_name: "Energiavirasto (Energy Authority)",
    url: "https://energiavirasto.fi",
    description:
      "Finnish Energy Authority — market regulation, network pricing, emissions trading, renewable energy support schemes, energy efficiency supervision.",
  },
  {
    id: "fingrid",
    name: "Fingrid",
    full_name: "Fingrid Oyj (Finnish TSO)",
    url: "https://fingrid.fi",
    description:
      "Finnish transmission system operator — manages the main grid (kantaverkko), sets grid codes, balancing rules, reserve market regulations, and operates Datahub for electricity retail market data exchange.",
  },
  {
    id: "tem",
    name: "TEM",
    full_name: "Tyo- ja elinkeinoministrio (Ministry of Economic Affairs and Employment)",
    url: "https://tem.fi",
    description:
      "Ministry of Economic Affairs and Employment — responsible for energy policy, energy legislation, climate strategy, renewable energy strategy, and nuclear energy licensing.",
  },
  {
    id: "tukes",
    name: "Tukes",
    full_name: "Turvallisuus- ja kemikaalivirasto (Tukes)",
    url: "https://tukes.fi",
    description:
      "Safety and Chemicals Agency — responsible for electrical safety, gas safety, mining safety, pressure equipment, and energy equipment market surveillance in Finland.",
  },
];

const insertRegulator = db.prepare(
  "INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)",
);

for (const r of regulators) {
  insertRegulator.run(r.id, r.name, r.full_name, r.url, r.description);
}
console.log(`Inserted ${regulators.length} regulators`);

// -- Regulations (Energiavirasto + TEM + Tukes) --

const regulations = [
  // TEM — energy legislation
  {
    regulator_id: "tem",
    reference: "588/2013",
    title: "Sahkomarkkinalaki (Electricity Market Act)",
    text: "Sahkomarkkinalaki saatelee sahkon tuotantoa, siirtoa, jakelua ja myyntia Suomessa. Laki maarittelee sahkoverkkolupien myontamisen edellytykset, verkkopalvelujen hinnoittelun periaatteet, sahkon toimitusvarmuusvaatimukset ja kuluttajansuojan sahkomarkkinoilla. Energiavirasto valvoo lain noudattamista. Verkonhaltijan on kehitettava sahkoverkkoa siten, etta sahkon kayttopaikkoihin pystytaan liittamaan sahkon tuotantoa ja kulutusta asiakkaiden kohtuullisten tarpeiden mukaisesti.",
    type: "laki",
    status: "in_force",
    effective_date: "2013-09-01",
    url: "https://finlex.fi/fi/laki/ajantasa/2013/20130588",
  },
  {
    regulator_id: "tem",
    reference: "1261/1996",
    title: "Sahkoturvallisuuslaki (Electrical Safety Act)",
    text: "Sahkoturvallisuuslaki maarittelee sahkolaitteiden ja -laitteistojen turvallisuusvaatimukset seka sahkoalan toiden tekemista koskevat vaatimukset. Sahkolaitteet ja -laitteistot on suunniteltava, rakennettava ja huollettava niin, etta ne eivat aiheuta hengen, terveyden tai omaisuuden vaaraa. Tukes valvoo lain noudattamista ja voi maarata sahkolaitteiston kayttokieltoon, jos se ei tayta turvallisuusvaatimuksia.",
    type: "laki",
    status: "in_force",
    effective_date: "1997-01-01",
    url: "https://finlex.fi/fi/laki/ajantasa/1996/19961261",
  },
  {
    regulator_id: "tem",
    reference: "587/2013",
    title: "Laki Energiavirastosta (Act on the Energy Authority)",
    text: "Laissa saadetaan Energiavirastosta, joka toimii tyo- ja elinkeinoministerion alaisena viranomaisena. Energiavirasto valvoo sahko- ja maakaasumarkkinoiden toimintaa, sahko- ja maakaasuverkkojen hinnoittelua, paastokauppaa, uusiutuvan energian tukijarjestelmia seka energiatehokkuutta. Energiavirastolla on oikeus saada valvontatehtaviensa suorittamiseksi tarpeellisia tietoja ja tehdä tarkastuksia.",
    type: "laki",
    status: "in_force",
    effective_date: "2013-09-01",
    url: "https://finlex.fi/fi/laki/ajantasa/2013/20130587",
  },
  // Energiavirasto — market regulation
  {
    regulator_id: "energiavirasto",
    reference: "EV/2024/SAHKO/001",
    title: "Sahkonjakeluverkon valvontamenetelmat 2024-2031 (6. valvontajakso)",
    text: "Energiavirasto on vahvistanut sahkonjakeluverkon valvontamenetelmat kuudennelle valvontajaksolle 2024-2031. Menetelmissa maaritellaan verkonhaltijoiden sallitun tuoton laskentaperusteet, tehostamisvaatimukset, investointikannustimet ja toimitusvarmuuskannustimet. Kohtuullisen tuoton laskennassa kaytetaan WACC-mallia (painotettu keskimaarainen paomakustannus). Verkonhaltijan on julkaistava verkkopalveluhinnastonsa ja sen muutokset Energiaviraston saantelemin tavoin.",
    type: "maarays",
    status: "in_force",
    effective_date: "2024-01-01",
    url: "https://energiavirasto.fi/sahkoverkkojen-valvonta",
  },
  // Tukes — safety
  {
    regulator_id: "tukes",
    reference: "TUKES/SAHKO/2023/001",
    title: "Sahkoasennusten turvallisuusvaatimukset — standardi SFS 6000",
    text: "Tukes on vahvistanut pienjannitesahkoasennusten turvallisuusvaatimukset SFS 6000 -standardiin perustuen. Sahkoasennusten on taytettava turvallisuusvaatimukset suunnittelun, asennuksen ja kayton osalta. Sahkoasennustoita saavat tehda vain sahkourakoitsijat, joille on myonnetty oikeudet Tukesin sahkourakoitsijarekisteriin. Kayttoonottotarkastus on tehtava ennen asennusten kayttoonottoa.",
    type: "maarays",
    status: "in_force",
    effective_date: "2023-06-01",
    url: "https://tukes.fi/sahko/sahkoasennukset",
  },
];

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRegsAll = db.transaction(() => {
  for (const r of regulations) {
    insertRegulation.run(
      r.regulator_id, r.reference, r.title, r.text, r.type, r.status, r.effective_date, r.url,
    );
  }
});
insertRegsAll();
console.log(`Inserted ${regulations.length} regulations`);

// -- Grid codes (Fingrid) --

const gridCodes = [
  {
    reference: "VJV2022:1",
    title: "Voimalaitosten jarjestelmatekniset vaatimukset (VJV)",
    text: "Fingridin voimalaitosten jarjestelmatekniset vaatimukset maarittelevat tekniset vaatimukset voimalaitoksille, jotka liittyvat Suomen sahkojarjestelmaan. Vaatimukset kattavat taajuuden saaton, janniteensaadon, patomoishallintakyvyn (fault ride-through), sahkon laadun (harmoniset yliaallot, valinta), tiedonvaihdon jarjestelmaoperaattorin kanssa seka valvontajarjestelmat. Voimalaitoksen on kyettava antamaan jannitteentukea verkkohairion aikana ja palautumaan normaalitilaan sekunnissa hairion jalkeen.",
    code_type: "technical_regulation",
    version: "2022.1",
    effective_date: "2022-06-01",
    url: "https://fingrid.fi/kantaverkko/liittymat/tekniset-vaatimukset/",
  },
  {
    reference: "FINGRID/DATAHUB/2022",
    title: "Datahub — keskitetty tiedonvaihtojärjestelmä sahkon vahittaismarkkinoille",
    text: "Fingridin operoima Datahub on keskitetty tiedonvaihtojärjestelmä, joka sisaltaa kaikkien Suomen sahkon kayttopaikkojen mittaustiedot, sopimustiedot ja sahkonmyyjatiedot. Sahkon myyjat ja jakeluverkonhaltijat ovat velvollisia kayttamaan Datahubia kaikessa sahkon vahittaismarkkinoiden tiedonvaihdossa. Datahub mahdollistaa sahkonmyyjan vaihdon 14 vuorokauden sisalla ja tarjoaa asiakkaille mahdollisuuden seurata sahkonkulutustaan.",
    code_type: "market_regulation",
    version: "2.0",
    effective_date: "2022-02-21",
    url: "https://fingrid.fi/sahkomarkkinat/datahub/",
  },
  {
    reference: "FINGRID/RESERVI/2024",
    title: "Reservimarkkinoiden saannot — taajuuden yllapitoreservit (FCR, aFRR, mFRR)",
    text: "Fingridin reservimarkkinoiden saannot maarittelevat taajuuden yllapitoreservien (FCR-N, FCR-D, aFRR, mFRR) hankinnan, aktivoinnin ja selvityksen. Reserveja hankitaan markkinalasiin perustuvilla mekanismeilla. Reservimarkkinoille osallistuminen edellyttaa ennakkohyvaksyntaa ja teknisten vaatimusten tayttamista. Aktivointiviive FCR-N-reserville on enintaan 3 minuuttia, aFRR-reserville 5 minuuttia ja mFRR-reserville 15 minuuttia.",
    code_type: "ancillary_services",
    version: "2024.1",
    effective_date: "2024-01-01",
    url: "https://fingrid.fi/sahkomarkkinat/reservimarkkinat/",
  },
];

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertGridAll = db.transaction(() => {
  for (const g of gridCodes) {
    insertGridCode.run(g.reference, g.title, g.text, g.code_type, g.version, g.effective_date, g.url);
  }
});
insertGridAll();
console.log(`Inserted ${gridCodes.length} grid codes`);

// -- Decisions (Energiavirasto) --

const decisions = [
  {
    reference: "EV/2024/VV/001",
    title: "Paatos Carunan sahkonjakeluverkon siirtohinnoittelusta 2024",
    text: "Energiavirasto on tehnyt paatoksen Caruna Oy:n sahkonjakeluverkon siirtohinnoittelusta valvontajaksolle 2024-2027. Paatoksessa vahvistetaan Carunan sallittu tuotto, tehostamisvelvoitteet ja investointikannustimet. Energiavirasto katsoo, etta Carunan siirtohinnat ovat kohtuulliset ottaen huomioon verkon kehittamistarpeet ja toimitusvarmuusvaatimukset. Paatokseen voi hakea muutosta markkinaoikeudelta 30 paivan kuluessa.",
    decision_type: "revenue_cap",
    date_decided: "2024-03-15",
    parties: "Caruna Oy",
    url: "https://energiavirasto.fi/paatokset",
  },
  {
    reference: "EV/2023/PAASTO/001",
    title: "Paatos paastokaupan todentajan hyvaksymisesta",
    text: "Energiavirasto on hyvaksynyt todentajan paastokauppalainsaadannon mukaisten paastoraporttien todentamiseen. Todentajan on taytettava eurooppalaisen todentamisasetuksen (EU) 2018/2067 mukaiset patevyys- ja riippumattomuusvaatimukset. Todentajan hyvaksyminen on voimassa viisi vuotta.",
    decision_type: "methodology",
    date_decided: "2023-12-01",
    parties: "Paastokaupan todentajat",
    url: "https://energiavirasto.fi/paastokauppa",
  },
  {
    reference: "EV/2024/SAHKO/VALITUS/001",
    title: "Paatos valituksesta koskien sahkon siirtohinnan korotusta",
    text: "Energiavirasto on kasitellyt kuluttajan valituksen sahkonjakeluverkonhaltijan siirtohinnan korotuksesta. Valituksessa vaadittiin hinnankorotuksen kumoamista kohtuuttomana. Energiavirasto toteaa, etta verkonhaltija on noudattanut vahvistettuja valvontamenetelmia ja etta hinnankorotus on valvontamenetelmien mukainen. Valitus hylätään. Paatokseen voi hakea muutosta markkinaoikeudelta.",
    decision_type: "complaint",
    date_decided: "2024-05-20",
    parties: "Kuluttaja (anonymisoitu) vs. sahkonjakeluverkonhaltija",
    url: "https://energiavirasto.fi/paatokset",
  },
];

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertDecAll = db.transaction(() => {
  for (const d of decisions) {
    insertDecision.run(d.reference, d.title, d.text, d.decision_type, d.date_decided, d.parties, d.url);
  }
});
insertDecAll();
console.log(`Inserted ${decisions.length} decisions`);

// -- Summary --

const stats = {
  regulators: (db.prepare("SELECT count(*) as cnt FROM regulators").get() as { cnt: number }).cnt,
  regulations: (db.prepare("SELECT count(*) as cnt FROM regulations").get() as { cnt: number }).cnt,
  grid_codes: (db.prepare("SELECT count(*) as cnt FROM grid_codes").get() as { cnt: number }).cnt,
  decisions: (db.prepare("SELECT count(*) as cnt FROM decisions").get() as { cnt: number }).cnt,
  regulations_fts: (db.prepare("SELECT count(*) as cnt FROM regulations_fts").get() as { cnt: number }).cnt,
  grid_codes_fts: (db.prepare("SELECT count(*) as cnt FROM grid_codes_fts").get() as { cnt: number }).cnt,
  decisions_fts: (db.prepare("SELECT count(*) as cnt FROM decisions_fts").get() as { cnt: number }).cnt,
};

console.log(`\nDatabase summary:`);
console.log(`  Regulators:       ${stats.regulators}`);
console.log(`  Regulations:      ${stats.regulations} (FTS: ${stats.regulations_fts})`);
console.log(`  Grid codes:       ${stats.grid_codes} (FTS: ${stats.grid_codes_fts})`);
console.log(`  Decisions:        ${stats.decisions} (FTS: ${stats.decisions_fts})`);
console.log(`\nDone. Database ready at ${DB_PATH}`);

db.close();
