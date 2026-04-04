/**
 * Combined ingestion for all Finnish energy regulators.
 *
 * Inserts regulatory content sourced from:
 *   - Energiavirasto (energiavirasto.fi) — market regulation, network pricing, emissions trading, NIS2
 *   - TEM (tem.fi) — energy legislation, policy, strategy
 *   - Fingrid (fingrid.fi) — grid codes, Datahub, reserve markets, balancing
 *   - Tukes (tukes.fi) — electrical and gas safety rules
 *   - Finlex (finlex.fi) — Finnish energy legislation (laki, asetus)
 *
 * Data sourced 2026-04-04 from:
 *   energiavirasto.fi/maaraykset, energiavirasto.fi/paatokset-ja-maaraykset,
 *   fingrid.fi/sahkomarkkinat/saannot-ja-sopimukset,
 *   fingrid.fi/en/grid/grid-connection-agreement-phases/grid-code-specifications,
 *   fingrid.fi/en/electricity-market/reserves/reserve-markets,
 *   fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot,
 *   tukes.fi/sahko, tukes.fi/kaasu, finlex.fi
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
  { id: "tem", name: "TEM", full_name: "Työ- ja elinkeinoministeriö (Ministry of Economic Affairs and Employment)", url: "https://tem.fi", description: "Ministry of Economic Affairs and Employment — energy policy, energy legislation, climate strategy, renewable energy, nuclear energy licensing" },
  { id: "tukes", name: "Tukes", full_name: "Turvallisuus- ja kemikaalivirasto (Tukes)", url: "https://tukes.fi", description: "Safety and Chemicals Agency — electrical safety, gas safety, mining safety, pressure equipment, energy equipment market surveillance" },
  { id: "finlex", name: "Finlex", full_name: "Finlex — Suomen oikeudellinen tietokanta", url: "https://finlex.fi", description: "Official Finnish legal database (Ministry of Justice) — primary legislation (laki), government decrees (asetus), Council of State decisions (valtioneuvoston päätös)" },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ===================================================================
// REGULATIONS
// ===================================================================

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// ---------------------------------------------------------------------------
// 1. FINLEX — Primary Energy Legislation (laki)
// ---------------------------------------------------------------------------

const finlexLaki: string[][] = [
  // --- Electricity Market ---
  ["finlex", "588/2013", "Sähkömarkkinalaki",
    "Sähkömarkkinalaki (588/2013) säätelee sähkömarkkinoiden toimintaa Suomessa. Laki kattaa sähkön tuotannon, siirron, jakelun ja myynnin. Laki asettaa vaatimukset sähköverkkoluville, verkonhaltijoiden velvollisuuksille, sähkön vähittäismyynnille, toimitusvelvollisuudelle, kuluttajansuojalle, sähkön alkuperän varmentamiselle sekä Energiaviraston valvontavaltuuksille. Laki on Suomen sähkömarkkinoiden perussäädös ja toimeenpanee EU:n sähkömarkkinadirektiivin (EU) 2019/944.",
    "laki", "in_force", "2013-09-01", "https://www.finlex.fi/fi/laki/ajantasa/2013/20130588"],

  ["finlex", "497/2023", "Laki sähkömarkkinalain muuttamisesta",
    "Laki sähkömarkkinalain muuttamisesta (497/2023) toteuttaa merkittäviä muutoksia sähkömarkkinoiden sääntelyyn. Muutokset koskevat jakeluverkonhaltijoiden joustopalveluiden hankintaa, energiavarastojen käyttöä, kuluttajien oikeuksia, aktiivisten asiakkaiden asemaa, aggregaattoritoimintaa, toimitusvarmuusvaatimuksia sekä jakeluverkon kehittämissuunnitelmia. Laki toimeenpanee EU:n puhtaan energian paketin säännökset Suomen lainsäädäntöön.",
    "laki", "in_force", "2023-07-01", "https://www.finlex.fi/fi/laki/alkup/2023/20230497"],

  ["finlex", "498/2023", "Laki sähköntoimitussopimusten hintakatosta",
    "Laki sähköntoimitussopimusten hintakatosta (498/2023) on väliaikainen laki, joka rajoittaa sähkön vähittäismyyjien oikeutta korottaa toistaiseksi voimassa olevien sopimusten hintoja. Laki tuli voimaan energiakriisin seurauksena Venäjän sähkötuonnin loputtua toukokuussa 2022.",
    "laki", "in_force", "2023-07-01", "https://www.finlex.fi/fi/laki/alkup/2023/20230498"],

  ["finlex", "590/2013", "Laki sähkö- ja maakaasumarkkinoiden valvonnasta",
    "Laki sähkö- ja maakaasumarkkinoiden valvonnasta (590/2013) määrittelee Energiaviraston tehtävät ja valtuudet sähkö- ja maakaasumarkkinoiden valvonnassa. Laki sisältää säännökset verkkotoiminnan hinnoittelun kohtuullisuuden valvontamenetelmistä, jälkikäteisvalvonnasta, seuraamusmaksuista sekä muutoksenhausta. Laki toteuttaa EU:n kolmannen energiapaketin valvontaviranomaisvaatimukset.",
    "laki", "in_force", "2013-09-01", "https://www.finlex.fi/fi/laki/ajantasa/2013/20130590"],

  ["finlex", "499/2023", "Laki sähkö- ja maakaasumarkkinoiden valvonnasta annetun lain muuttamisesta",
    "Laki sähkö- ja maakaasumarkkinoiden valvonnasta annetun lain muuttamisesta (499/2023) laajentaa Energiaviraston valvontavaltuuksia. Muutokset koskevat jakeluverkonhaltijoiden joustopalveluiden hankintaehtojen vahvistamista, korotuskattovalvonnan tarkennuksia, verkkotoiminnan tunnuslukujen julkaisemista sekä uusia seuraamusmaksusäännöksiä.",
    "laki", "in_force", "2023-07-01", "https://www.finlex.fi/fi/laki/alkup/2023/20230499"],

  // --- Natural Gas ---
  ["finlex", "587/2017", "Maakaasumarkkinalaki",
    "Maakaasumarkkinalaki (587/2017) säätelee maakaasun siirtoa, jakelua, varastointia, toimitusta ja hankintaa Suomessa. Laki sisältää määräykset maakaasuverkkoluville, verkonhaltijoiden velvollisuuksille, LNG-terminaalien käyttöehdoille, maakaasun vähittäismyynnille ja Gasgrid Finland Oy:n asemalle siirtoverkonhaltijana. Laki toteuttaa EU:n kaasumarkkinadirektiivin 2009/73/EY vaatimukset.",
    "laki", "in_force", "2018-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2017/20170587"],

  // --- Nuclear Energy ---
  ["finlex", "990/1987", "Ydinenergialaki",
    "Ydinenergialaki (990/1987) säätelee ydinenergian käyttöä Suomessa. Laki kattaa ydinlaitosten rakentamis- ja käyttöluvat, ydinpolttoaineen hallinnan, ydinjätteen käsittelyn, ydinvastuun, turva- ja valmiusjärjestelyt sekä STUK:in valvontatehtävät. Lakia on muutettu useita kertoja, viimeksi vuonna 2023 EU:n ydinturvallisuusdirektiivin muutosten täytäntöönpanemiseksi.",
    "laki", "in_force", "1988-03-01", "https://www.finlex.fi/fi/laki/ajantasa/1987/19870990"],

  // --- Emissions Trading ---
  ["finlex", "1270/2023", "Päästökauppalaki",
    "Päästökauppalaki (1270/2023) korvaa aiemman päästökauppalain (311/2011). Laki säätelee EU:n päästökauppajärjestelmää (EU ETS) Suomessa. Soveltamisala kattaa laitosten, meriliikenteen ja ilmailun päästökaupan sekä uuden rakennusten, tieliikenteen ja muiden sektoreiden päästökauppajärjestelmän (ETS2) raportoinnin. Laki toteuttaa päästökauppadirektiivin 2003/87/EY muutokset (Fit for 55 -paketti).",
    "laki", "in_force", "2024-01-01", "https://www.finlex.fi/fi/laki/alkup/2023/20231270"],

  ["finlex", "311/2011", "Päästökauppalaki (kumottu)",
    "Päästökauppalaki (311/2011) sisälsi EU:n päästökauppajärjestelmän kansalliset toimeenpanosäännökset kaudelle 2013–2020 ja siirtymäsäännökset kaudelle 2021–2030. Laki kumottiin lailla 1270/2023. Lain nojalla Energiavirasto toimi päästökaupan valvontaviranomaisena, myönsi päästölupia ja hallinnoi päästöoikeuksia.",
    "laki", "repealed", "2011-08-01", "https://www.finlex.fi/fi/laki/ajantasa/kumotut/2011/20110311"],

  // --- Renewable Energy Support ---
  ["finlex", "1396/2010", "Laki uusiutuvilla energialähteillä tuotetun sähkön tuotantotuesta",
    "Laki uusiutuvilla energialähteillä tuotetun sähkön tuotantotuesta (1396/2010) säätelee syöttötariffijärjestelmää tuulivoimalle, biokaasulle, puupolttoaineelle ja metsähakkeelle. Tuotantotukea maksetaan 12 vuoden ajan. Syöttötariffijärjestelmä suljettiin uusille tuulivoimaloille 1.11.2017, uusille biokaasu- ja puupolttoainelaitoksille 1.1.2019 ja metsähakevoimaloille 15.3.2021. Energiavirasto hallinnoi tukijärjestelmää SATU-sähköisen asiointijärjestelmän kautta.",
    "laki", "in_force", "2011-03-25", "https://www.finlex.fi/fi/laki/ajantasa/2010/20101396"],

  ["finlex", "1145/2020", "Laki uusiutuvan energian tuotantolaitosten lupamenettelyistä",
    "Laki uusiutuvan energian tuotantolaitosten lupamenettelyistä (1145/2020) yksinkertaistaa uusiutuvan energian hankkeiden lupaprosesseja. Lupamenettelyjen ja muiden hallinnollisten hyväksymisten yhteiskesto ei saa ylittää kahta vuotta. Laki toteuttaa RED II -direktiivin vaatimukset lupamenettelyjen nopeuttamisesta.",
    "laki", "in_force", "2021-06-01", "https://www.finlex.fi/fi/laki/alkup/2020/20201145"],

  ["finlex", "38/2023", "Laki uusiutuvan energian tuotantolaitosten lupamenettelyistä annetun lain muuttamisesta",
    "Laki uusiutuvan energian tuotantolaitosten lupamenettelyistä annetun lain muuttamisesta (38/2023) lyhentää edelleen uusiutuvan energian hankkeiden lupamenettelyjä. Muutokset koskevat erityisesti tuulivoimahankkeiden ympäristövaikutusten arvioinnin ja kaavoituksen yhteensovittamista.",
    "laki", "in_force", "2023-06-01", "https://www.finlex.fi/fi/laki/alkup/2023/20230038"],

  // --- Energy Efficiency ---
  ["finlex", "1429/2014", "Energiatehokkuuslaki",
    "Energiatehokkuuslaki (1429/2014) säätelee energiatehokkuuden edistämistä Suomessa. Laki velvoittaa suuryritykset tekemään energiakatselmuksia neljän vuoden välein, asettaa vaatimukset energianhallintajärjestelmille ja energiatehokkuussopimuksille. Laki toteuttaa EU:n energiatehokkuusdirektiivin 2012/27/EU. Hallituksen esitys HE 85/2025 lain muuttamisesta on eduskunnan käsittelyssä.",
    "laki", "in_force", "2015-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2014/20141429"],

  // --- Guarantees of Origin ---
  ["finlex", "1050/2021", "Laki energian alkuperätakuista",
    "Laki energian alkuperätakuista (1050/2021) toteuttaa EU:n uusiutuvan energian direktiivin (RED II) alkuperätakuuvaatimukset. Laki korvaa aiemman sähkön alkuperän varmentamisesta ja ilmoittamisesta annetun lain (1129/2003). Alkuperätakuujärjestelmä kattaa uusiutuvilla energialähteillä tuotetun sähkön, kaasun, vedyn, lämmön ja jäähdytyksen. Fingrid toimii sähkön alkuperätakuujen myöntäjänä.",
    "laki", "in_force", "2021-12-03", "https://www.finlex.fi/fi/laki/alkup/2021/20211050"],

  // --- Supply Security ---
  ["finlex", "1390/1992", "Laki huoltovarmuuden turvaamisesta",
    "Laki huoltovarmuuden turvaamisesta (1390/1992) on Suomen huoltovarmuuden perussäädös. Laki asettaa puitteet huoltovarmuusrahastolle, johon kerätään huoltovarmuusmaksuja sähköstä, kivihiilestä, maakaasusta ja öljytuotteista. Huoltovarmuuskeskus koordinoi varautumistoimintaa. Energiasektori kuuluu huoltovarmuuden kriittiseen infrastruktuuriin.",
    "laki", "in_force", "1993-01-01", "https://www.finlex.fi/fi/laki/ajantasa/1992/19921390"],

  ["finlex", "1215/2021", "Laki sähkön ja eräiden polttoaineiden valmisteverosta annetun lain muuttamisesta",
    "Laki sähkön ja eräiden polttoaineiden valmisteverosta annetun lain muuttamisesta (1215/2021) päivittää huoltovarmuusmaksut. Huoltovarmuusmaksua peritään sähköstä, kivihiilestä, maakaasusta, biokaasusta, mäntyöljystä ja eräistä tuotteista huoltovarmuusrahastoon.",
    "laki", "in_force", "2022-01-01", "https://www.finlex.fi/fi/laki/alkup/2021/20211215"],

  // --- Electrical Safety ---
  ["finlex", "1135/2016", "Sähköturvallisuuslaki",
    "Sähköturvallisuuslaki (1135/2016) säätelee sähkölaitteiden ja -laitteistojen turvallisuutta Suomessa. Laki kattaa sähkölaitteiden vaatimustenmukaisuuden, sähkölaitteistojen turvallisuusvaatimukset, sähkötöiden tekemisen edellytykset, sähköurakoitsijan pätevyysvaatimukset, määräaikaistarkastukset, Tukesin valvontatehtävät ja seuraamukset. Laki korvasi aiemman sähköturvallisuuslain (410/1996).",
    "laki", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161135"],

  ["finlex", "410/1996", "Sähköturvallisuuslaki (kumottu)",
    "Sähköturvallisuuslaki (410/1996) oli Suomen sähköturvallisuuden perussäädös vuosina 1996–2016. Laki kumottiin uudella sähköturvallisuuslailla (1135/2016). Lain nojalla annetut Tukesin määräykset (ST-ohjeet) olivat sähköalan keskeisiä teknisiä ohjeita.",
    "laki", "repealed", "1996-09-01", "https://www.finlex.fi/fi/laki/ajantasa/kumotut/1996/19960410"],

  // --- Pressure Equipment ---
  ["finlex", "1144/2016", "Painelaitelaki",
    "Painelaitelaki (1144/2016) säätelee painelaitteiden suunnittelua, valmistusta, markkinoille saattamista, asennusta, korjausta, käyttöä ja tarkastusta. Laki kattaa höyrykattilat, paineastiat, putkistot ja LNG-varastojen painelaitteet. Tukes valvoo painelaiteturvallisuutta ja ylläpitää painelaiterekisteriä. Laki toteuttaa painelaitedirektiivin 2014/68/EU.",
    "laki", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161144"],

  // --- Building Energy ---
  ["finlex", "50/2013", "Laki rakennuksen energiatodistuksesta",
    "Laki rakennuksen energiatodistuksesta (50/2013) velvoittaa esittämään energiatodistuksen rakennuslupaa haettaessa, rakennusta myytäessä ja vuokrattaessa. Energiatodistus on työkalu rakennusten energiatehokkuuden vertailuun ja parantamiseen. Laki toteuttaa EU:n rakennusten energiatehokkuusdirektiivin (EPBD) vaatimukset.",
    "laki", "in_force", "2013-06-01", "https://www.finlex.fi/fi/laki/ajantasa/2013/20130050"],

  // --- EV Charging ---
  ["finlex", "733/2020", "Laki rakennusten varustamisesta sähköajoneuvojen latauspisteillä",
    "Laki rakennusten varustamisesta sähköajoneuvojen latauspisteillä ja latauspistevalmiuksilla sekä automaatio- ja ohjausjärjestelmillä (733/2020) velvoittaa varustamaan uudet ja laajasti korjattavat rakennukset sähköajoneuvojen latauspisteillä tai -valmiuksilla. Laki toteuttaa rakennusten energiatehokkuusdirektiivin (EPBD) sähköliikkuvuusvaatimukset.",
    "laki", "in_force", "2021-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2020/20200733"],

  // --- Temporary crisis measures ---
  ["finlex", "275/2023", "Laki takautuvasti maksettavasta väliaikaisesta sähkötuesta",
    "Laki takautuvasti maksettavasta väliaikaisesta sähkötuesta (275/2023) mahdollisti sähkötuen maksamisen kotitalouksille takautuvasti tammi-huhtikuulta 2023 sähköenergiakriisin vuoksi. Venäjän sähkötuonti Suomeen päättyi 14.5.2022, mikä nosti sähkön hintaa merkittävästi.",
    "laki", "in_force", "2023-03-06", "https://www.finlex.fi/fi/laki/ajantasa/2023/20230275"],

  // --- Cybersecurity (NIS2) ---
  ["finlex", "HE 324/2022", "Hallituksen esitys kyberturvallisuuslaiksi (NIS2)",
    "Hallituksen esitys eduskunnalle kyberturvallisuuslaiksi ja siihen liittyviksi laeiksi (HE 324/2022) toimeenpanee EU:n NIS2-direktiivin (EU) 2022/2555. Energiasektorilla Energiavirasto toimii valvontaviranomaisena sähkö-, kaukolämpö-, kaasu-, öljy- ja vetysektoreilla. Kyberturvallisuuslaki tuli voimaan 8.4.2025.",
    "laki", "in_force", "2025-04-08", "https://www.finlex.fi/fi/esitykset/he/2022/20220324"],

  // --- Elevator Safety ---
  ["finlex", "1134/2016", "Hissiturvallisuuslaki",
    "Hissiturvallisuuslaki (1134/2016) säätelee hissien ja liukuportaiden turvallisuutta. Laki kattaa hissien suunnittelun, asennuksen, huollon, tarkastuksen ja käytön turvallisuusvaatimukset. Tukes valvoo hissiturvallisuutta. Hissiturvallisuuslaki on osa samaa sähköturvallisuuslainsäädännön kokonaisuudistusta kuin sähköturvallisuuslaki (1135/2016).",
    "laki", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161134"],

  // --- Climate & Carbon Neutrality ---
  ["finlex", "423/2022", "Ilmastolaki",
    "Ilmastolaki (423/2022) on Suomen ilmastotyön perussäädös. Laki asettaa päästövähennystavoitteet vuosille 2030, 2040 ja 2050 sekä ensimmäistä kertaa tavoitteen Suomen hiilineutraalisuudesta vuoteen 2035 mennessä. Laki kattaa nyt myös maankäyttösektorin (LULUCF) ja asettaa tavoitteen hiilinielujen vahvistamisesta. Laki edellyttää pitkän aikavälin ilmastopoliittista suunnitelmaa, keskipitkän aikavälin ilmastopolitiikan suunnitelmaa ja maankäyttösektorin ilmastosuunnitelmaa.",
    "laki", "in_force", "2022-07-01", "https://www.finlex.fi/fi/laki/ajantasa/2022/20220423"],

  // --- Energy Intensive Industry Support ---
  ["finlex", "493/2022", "Laki energiaintensiivisen teollisuuden sähköistämistuesta",
    "Laki energiaintensiivisen teollisuuden sähköistämistuesta (493/2022) säätelee sähköistämistuen myöntämistä energia-intensiivisille yrityksille. Tuki kompensoi EU:n päästökauppajärjestelmästä aiheutuvia epäsuoria sähkökustannuksia.",
    "laki", "in_force", "2022-07-01", "https://www.finlex.fi/fi/laki/alkup/2022/20220493"],

  // --- Land Use & Building ---
  ["finlex", "132/1999", "Maankäyttö- ja rakennuslaki (alueidenkäyttölaki)",
    "Maankäyttö- ja rakennuslaki (132/1999, nyttemmin alueidenkäyttölaki) säätelee maankäytön suunnittelua, kaavoitusta ja rakentamista. Energiasektorin kannalta merkitys koskee tuulivoimaloiden, aurinkovoimaloiden ja energiainfrastruktuurin sijoittamista ja kaavoitusta.",
    "laki", "in_force", "2000-01-01", "https://www.finlex.fi/fi/laki/ajantasa/1999/19990132"],

  // --- Electricity market decree ---
  ["finlex", "VNA 65/2009", "Valtioneuvoston asetus sähkömarkkinoista",
    "Valtioneuvoston asetus sähkömarkkinoista (65/2009) tarkentaa sähkömarkkinalain säännöksiä verkkotoiminnasta, sähköntuotannosta, voimalaitosten rakentamisesta ja käytöstäpoistosta sekä sähköntuottajan ilmoitusvelvollisuudesta.",
    "asetus", "in_force", "2009-02-01", "https://www.finlex.fi/fi/laki/alkup/2009/20090065"],

  // --- Energy community ---
  ["finlex", "VNA 1115/2023", "Valtioneuvoston asetus energiatuen myöntämisen yleisistä ehdoista (muutos 2023)",
    "Valtioneuvoston asetus energiatuen myöntämisen yleisistä ehdoista annetun asetuksen muuttamisesta (1115/2023). Kattaa energiayhteisöjen tukikelpoisuuden, uusiutuvan energian pientuotannon ja vetytalouden investointien tukiehdot vuosille 2023–2027.",
    "asetus", "in_force", "2023-12-01", "https://www.finlex.fi/fi/laki/alkup/2023/20231115"],

  // --- Traffic services (energy infrastructure) ---
  ["finlex", "1087/2023", "Laki liikenteen palveluista annetun lain muuttamisesta (latausinfrastruktuuri)",
    "Laki liikenteen palveluista annetun lain muuttamisesta (1087/2023) sisältää vaatimuksia sähköajoneuvojen julkiselle latausinfrastruktuurille ja vetytankkausasemille. Toteuttaa AFIR-asetuksen (EU) 2023/1804 kansalliset vaatimukset.",
    "laki", "in_force", "2024-01-01", "https://www.finlex.fi/fi/laki/alkup/2023/20231087"],

  // --- Energy market surveillance & monitoring ---
  ["finlex", "1211/2009", "Laki energiamarkkinoilla toimivien yritysten energiatehokkuuspalveluista (kumottu)",
    "Laki energiamarkkinoilla toimivien yritysten energiatehokkuuspalveluista (1211/2009) velvoitti energiayhtiöitä tarjoamaan energiatehokkuuspalveluja asiakkailleen. Kumottu energiatehokkuuslain (1429/2014) voimaantulolla.",
    "laki", "repealed", "2010-01-01", "https://www.finlex.fi/fi/laki/ajantasa/kumotut/2009/20091211"],

  // --- Sähkön ja kaasun toimitusvarmuus ---
  ["finlex", "VNA 958/2012", "Laki maankäyttö- ja rakennuslain muuttamisesta (tuulivoiman kaavoitus)",
    "Laki maankäyttö- ja rakennuslain muuttamisesta (958/2012) sisältää tuulivoimarakentamista koskevia erityissäännöksiä. Tuulivoimaloiden rakentaminen edellyttää yleiskaavaa tai asemakaavaa, ja tuulivoiman yleiskaava voidaan laatia suoraan rakentamisen ohjausta varten.",
    "laki", "in_force", "2012-10-01", "https://www.finlex.fi/fi/laki/alkup/2012/20120958"],

  // --- Ydinvastuulaki ---
  ["finlex", "484/1972", "Ydinvastuulaki",
    "Ydinvastuulaki (484/1972) säätelee ydinenergian käytöstä aiheutuvien vahinkojen korvausvastuuta. Luvanhaltija on tuottamuksestaan riippumatta vastuussa ydinvahingosta. Vastuun enimmäismäärä on 1 200 miljoonaa euroa Pariisin yleissopimuksen mukaisesti.",
    "laki", "in_force", "1972-07-01", "https://www.finlex.fi/fi/laki/ajantasa/1972/19720484"],

  // --- Energiaverolaki ---
  ["finlex", "1260/1996", "Laki sähkön ja eräiden polttoaineiden valmisteverosta",
    "Laki sähkön ja eräiden polttoaineiden valmisteverosta (1260/1996) määrittelee sähköveron, kivihiiliveron ja maakaasuveron perusteet. Sähkö verotetaan kahdessa veroluokassa: teollisuus ja kasvihuoneet (veroluokka II, alennettu) ja muu kulutus (veroluokka I). Vero sisältää myös huoltovarmuusmaksun.",
    "laki", "in_force", "1997-01-01", "https://www.finlex.fi/fi/laki/ajantasa/1996/19961260"],

  // --- Kaivoslaki (energia-mineraalit) ---
  ["finlex", "621/2011", "Kaivoslaki",
    "Kaivoslaki (621/2011) säätelee kaivosmineraalien etsintää, kaivostoimintaa ja kaivosturvallisuutta. Energiasektorin kannalta merkitys koskee akkumineraalien (litium, koboltti, nikkeli) louhintaa energiavarastoihin ja energiateollisuuden raaka-aineisiin. Tukes toimii kaivosviranomaisena ja valvoo kaivosturvallisuutta.",
    "laki", "in_force", "2011-07-01", "https://www.finlex.fi/fi/laki/ajantasa/2011/20110621"],

  // --- Ympäristönsuojelu (energia) ---
  ["finlex", "527/2014", "Ympäristönsuojelulaki",
    "Ympäristönsuojelulaki (527/2014) säätelee ympäristölupia voimalaitoksille, teollisuuslaitoksille ja jätteenkäsittelylaitoksille. Energiasektorin voimalaitokset (polttolaitokset, jätevoimalalinossit) edellyttävät ympäristölupaa. Laki toteuttaa teollisuuspäästödirektiivin (IED) vaatimukset.",
    "laki", "in_force", "2014-09-01", "https://www.finlex.fi/fi/laki/ajantasa/2014/20140527"],

  // --- Laki Energiavirastosta ---
  ["finlex", "870/2013", "Laki Energiavirastosta",
    "Laki Energiavirastosta (870/2013) määrittelee Energiaviraston tehtävät, organisaation ja toimivaltuudet. Energiavirasto toimii sähkö- ja maakaasumarkkinoiden, päästökaupan, uusiutuvan energian tukijärjestelmien, energiatehokkuuden ja energia-alan kyberturvallisuuden valvontaviranomaisena.",
    "laki", "in_force", "2014-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2013/20130870"],
];

// ---------------------------------------------------------------------------
// 2. FINLEX — Government Decrees (asetus)
// ---------------------------------------------------------------------------

const finlexAsetus: string[][] = [
  ["finlex", "VNA 1434/2016", "Valtioneuvoston asetus sähkölaitteistoista",
    "Valtioneuvoston asetus sähkölaitteistoista (1434/2016) tarkentaa sähköturvallisuuslain vaatimuksia sähkölaitteistojen luokittelusta, käyttöönotosta, määräaikaistarkastuksista ja kunnossapidosta. Asetuksessa määritellään sähkölaitteistoluokat (1–3), tarkastusvälit ja sähkölaitteiston haltijan velvollisuudet.",
    "asetus", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161434"],

  ["finlex", "VNA 1435/2016", "Valtioneuvoston asetus sähkötyöstä ja käyttötyöstä",
    "Valtioneuvoston asetus sähkötyöstä ja käyttötyöstä (1435/2016) tarkentaa sähkötöiden tekemisen edellytyksiä, sähkötyöturvallisuusvaatimuksia, pätevyysluokkia (S1, S2, S3) ja sähkötöiden johtajan vastuita. Asetus määrittelee myös sähkölaitteiden korjaustöiden edellytykset.",
    "asetus", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161435"],

  ["finlex", "VNA 1437/2016", "Valtioneuvoston asetus sähkölaitteiden turvallisuudesta",
    "Valtioneuvoston asetus sähkölaitteiden turvallisuudesta (1437/2016) sisältää sähkölaitteiden olennaiset turvallisuusvaatimukset, vaatimustenmukaisuuden arviointimenettelyt ja CE-merkintää koskevat säännökset. Asetus toteuttaa pienjännitedirektiivin 2014/35/EU.",
    "asetus", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161437"],

  ["finlex", "VNA 1549/2016", "Valtioneuvoston asetus painelaiteturvallisuudesta",
    "Valtioneuvoston asetus painelaiteturvallisuudesta (1549/2016) tarkentaa painelaitelain vaatimuksia painelaitteiden rekisteröinnistä, käytönvalvojista, määräaikaistarkastuksista, painelaitteen sijoituksesta ja käytön turvallisuudesta. Asetus kattaa höyrykattilat, paineastiat, putkistot ja LNG-laitteistot.",
    "asetus", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2016/20161549"],

  ["finlex", "VNA 852/2018", "Valtioneuvoston asetus kaasulaitteiden käyttötarvikkeista ja käyttöpaineista",
    "Valtioneuvoston asetus kaasulaitteiden käyttötarvikkeista ja käyttöpaineista (852/2018) säätelee kaasulaitteiden käytössä sallittuja käyttöpaineita ja käyttötarvikkeita. Asetus koskee nesteytetyn maakaasun (LNG), nestekaasun ja biokaasun laitteiden turvallisuutta.",
    "asetus", "in_force", "2018-11-01", "https://www.finlex.fi/fi/laki/ajantasa/2018/20180852"],

  ["finlex", "VNA 20/2015", "Valtioneuvoston asetus energiakatselmuksista",
    "Valtioneuvoston asetus energiakatselmuksista (20/2015) tarkentaa energiatehokkuuslain vaatimuksia suuryritysten pakollisista energiakatselmuksista. Asetus määrittelee katselmuksen sisällön, laajuuden, tekijän pätevyysvaatimukset ja raportointivelvoitteet.",
    "asetus", "in_force", "2015-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2015/20150020"],

  ["finlex", "VNA 658/2022", "Valtioneuvoston asetus energiaintensiivisen teollisuuden sähköistämistuesta",
    "Valtioneuvoston asetus energiaintensiivisen teollisuuden sähköistämistuesta (658/2022) säätelee sähköistämistuen myöntämisen edellytyksiä. Tuki kompensoi päästökaupasta aiheutuvia epäsuoria kustannuksia energiaintensiiviselle teollisuudelle. Vuonna 2025 tukea maksettiin 149,9 miljoonaa euroa.",
    "asetus", "in_force", "2022-08-01", "https://www.finlex.fi/fi/laki/alkup/2022/20220658"],

  ["finlex", "VNA 262/2023", "Valtioneuvoston asetus energiatuen myöntämisen yleisistä ehdoista",
    "Valtioneuvoston asetus energiatuen myöntämisen yleisistä ehdoista (262/2023) säätelee investointitukia energiatehokkuustoimenpiteille, uusiutuvan polttoaineen tuotannolle, biopolttoaineen ja biokaasun tuotannolle sekä akkuinvestoinneille.",
    "asetus", "in_force", "2023-03-01", "https://www.finlex.fi/fi/laki/alkup/2023/20230262"],

  ["finlex", "VNA 178/2022", "Valtioneuvoston asetus sähköisen liikenteen infrastruktuurituesta",
    "Valtioneuvoston asetus sähköisen liikenteen, uusiutuvan kaasun ja uusiutuvan vedyn liikennekäytön infrastruktuurituesta vuosina 2022–2025 (178/2022) säätelee tukea latausinfrastruktuurille, kaasutankkausasemille ja vetytankkausasemille.",
    "asetus", "in_force", "2022-03-01", "https://www.finlex.fi/fi/laki/alkup/2022/20220178"],

  ["finlex", "VNP 857/2013", "Valtioneuvoston päätös huoltovarmuuden tavoitteista",
    "Valtioneuvoston päätös huoltovarmuuden tavoitteista (857/2013) asettaa kansalliset huoltovarmuuden tavoitteet. Energiasektoria koskevat tavoitteet sisältävät sähkön ja lämmön tuotantokapasiteetin turvaamisen, polttoainevarastojen ylläpidon ja kriittisen energiainfrastruktuurin suojaamisen.",
    "asetus", "in_force", "2013-12-05", "https://www.finlex.fi/fi/laki/alkup/2013/20130857"],

  ["finlex", "Kaasulaiteasetus 1434/1993", "Kaasulaiteasetus (kumottu)",
    "Kaasulaiteasetus (1434/1993) säänteli kaasulaitteita ja -asennuksia. Asetus kumottiin uudella painelaitelainsäädännöllä ja EU:n kaasulaiteasetuksella (EU) 2016/426. Asetus kattoi nesteytetyn kaasun (nestekaasu ja LNG), maakaasun ja biokaasun laitteistojen tekniset vaatimukset.",
    "asetus", "repealed", "1994-01-01", "https://www.finlex.fi/fi/laki/alkup/1993/19931434"],

  ["finlex", "VNA 551/2009", "Valtioneuvoston asetus maakaasun käsittelyn turvallisuudesta",
    "Valtioneuvoston asetus maakaasun käsittelyn turvallisuudesta (551/2009) säätelee maakaasun käsittely-, varastointi- ja jakelulaitteiden turvallisuutta. Asetus sisältää vaatimukset maakaasuputkistojen, kompressoriasemien ja LNG-laitosten suunnittelulle ja käytölle.",
    "asetus", "in_force", "2009-07-01", "https://www.finlex.fi/fi/laki/ajantasa/2009/20090551"],

  // --- Additional decrees ---
  ["finlex", "VNA 536/2022", "TEM:n asetus rakennusten energiatodistuksesta",
    "Työ- ja elinkeinoministeriön asetus rakennuksen energiatodistuksesta annetun asetuksen muuttamisesta (536/2022). Päivittää energiatodistuksen laskentamenetelmää ja energialuokkien rajoja.",
    "asetus", "in_force", "2022-07-01", "https://www.finlex.fi/fi/laki/alkup/2022/20220536"],

  ["finlex", "YMA 1010/2017", "Ympäristöministeriön asetus uuden rakennuksen energiatehokkuudesta",
    "Ympäristöministeriön asetus uuden rakennuksen energiatehokkuudesta (1010/2017). Asettaa lähes nollaenergiavaatimukset (nZEB) uudisrakennuksille. Rakennusten energiatehokkuus on keskeinen osa Suomen ilmastotavoitteita.",
    "asetus", "in_force", "2018-01-01", "https://www.finlex.fi/fi/laki/alkup/2017/20171010"],

  ["finlex", "VNA 1048/2016", "Valtioneuvoston asetus voimalaitosten tehoreservistä",
    "Valtioneuvoston asetus voimalaitosten tehoreservistä. Tehoreservijärjestelmä varmistaa sähkön riittävyyden huippukulutustilanteissa. Energiavirasto kilpailuttaa tehoreservin ja Fingrid vastaa sen käytöstä.",
    "asetus", "in_force", "2017-01-01", "https://www.finlex.fi/fi/laki/alkup/2016/20161048"],

  ["finlex", "VNA 66/2009", "Valtioneuvoston asetus sähkön alkuperän varmentamisesta",
    "Valtioneuvoston asetus sähkön alkuperän varmentamisesta ja ilmoittamisesta (66/2009). Kumottu lailla 1050/2021 (laki energian alkuperätakuista).",
    "asetus", "repealed", "2009-02-01", "https://www.finlex.fi/fi/laki/alkup/2009/20090066"],

  ["finlex", "VNA 1243/2018", "Valtioneuvoston asetus tuulivoimaloiden melutason ohjearvoista",
    "Valtioneuvoston asetus tuulivoimaloiden ulkomelutason ohjearvoista (1243/2018). Asettaa tuulivoimaloiden melutason ohjearvot asuin- ja loma-asuntoalueille: päiväajan ohjearvo 45 dB ja yöajan 40 dB.",
    "asetus", "in_force", "2019-01-01", "https://www.finlex.fi/fi/laki/alkup/2018/20181243"],

  ["finlex", "VNA 1048/2017", "Valtioneuvoston asetus ydinvoimalaitoksen turvallisuudesta",
    "Valtioneuvoston asetus ydinvoimalaitoksen turvallisuudesta. Sisältää yksityiskohtaiset turvallisuusvaatimukset ydinvoimalaitoksen suunnittelulle, rakentamiselle, käyttökuntoisuudelle ja käytölle. STUK valvoo vaatimusten noudattamista.",
    "asetus", "in_force", "2018-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2017/20171048"],

  ["finlex", "VNA 717/2013", "Valtioneuvoston asetus ydinenergia-asetuksesta",
    "Ydinenergia-asetus (717/2013) tarkentaa ydinenergialain (990/1987) säännöksiä ydinlaitosten lupamenettelyistä, ydinmateriaalivalvonnasta ja ydinjätehuollosta.",
    "asetus", "in_force", "2013-10-01", "https://www.finlex.fi/fi/laki/ajantasa/2013/20130717"],

  ["finlex", "VNA 1065/2008", "Valtioneuvoston asetus sähköntoimitusten selvityksestä ja mittauksesta",
    "Valtioneuvoston asetus sähköntoimitusten selvityksestä ja mittauksesta (1065/2008) säätelee sähkön mittauksen, etäluentajärjestelmien ja taseselvityksen teknisiä vaatimuksia.",
    "asetus", "in_force", "2009-01-01", "https://www.finlex.fi/fi/laki/ajantasa/2008/20081065"],

  ["finlex", "VNA 798/2021", "Valtioneuvoston asetus sähkö- ja maakaasumarkkinoiden valvonnasta",
    "Valtioneuvoston asetus sähkö- ja maakaasumarkkinoiden valvonnasta (798/2021) tarkentaa Energiaviraston valvontavaltuuksia ja raportointivelvoitteita.",
    "asetus", "in_force", "2021-09-01", "https://www.finlex.fi/fi/laki/alkup/2021/20210798"],

  ["finlex", "VNA 309/2014", "Valtioneuvoston asetus rakennusten energiatehokkuudesta",
    "Valtioneuvoston asetus rakennusten energiatehokkuudesta (309/2014) tarkentaa rakennusten energiatehokkuusvaatimuksia. Asetus kattaa lämpöhäviövaatimukset, ilmanvaihtojärjestelmien energiatehokkuuden ja uusiutuvan energian käytön rakennuksissa.",
    "asetus", "in_force", "2014-07-01", "https://www.finlex.fi/fi/laki/alkup/2014/20140309"],
];

// ---------------------------------------------------------------------------
// 3. ENERGIAVIRASTO — Määräykset (Regulations/Orders)
// ---------------------------------------------------------------------------

const evMaaraykset: string[][] = [
  ["energiavirasto", "2340/000002/2025", "Määräys sähkönjakelupalvelutuotteiden maksukomponenttien määräytymisperusteista",
    "Energiaviraston määräys sähkönjakelupalvelutuotteiden maksukomponenttien määräytymisperusteista. Määräys asettaa vaatimukset sähkönjakelun hinnoittelun rakenteelle ja kustannusvastaavuudelle. Tavoitteena on edistää kustannusvastaavaa hinnoittelua ja sähköjärjestelmän joustavuutta.",
    "maarays", "in_force", "2026-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "3510/000002/2025", "Määräys joustavista liittymissopimuksista",
    "Energiaviraston määräys joustavista liittymissopimuksista. Määräys mahdollistaa joustavan liittymän, jossa verkonhaltija voi rajoittaa liittymän tehoa järjestelmän kuormitustilanteen mukaan vastineena alennetusta liittymismaksusta. Edistää hajautetun tuotannon ja sähkövarastojen liittämistä verkkoon.",
    "maarays", "in_force", "2026-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "144/000002/2024", "Määräys maakaasuverkkoliiketoiminnan tunnusluvuista ja niiden julkaisemisesta",
    "Energiaviraston määräys maakaasuverkkoliiketoiminnan tunnusluvuista ja niiden julkaisemisesta. Määräys velvoittaa maakaasuverkonhaltijat julkaisemaan tunnuslukuja verkkotoiminnastaan, mukaan lukien toimitusvarmuustiedot, asiakastiedot ja taloudelliset tunnusluvut.",
    "maarays", "in_force", "2025-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "143/000002/2024", "Määräys sähköverkkoliiketoiminnan tunnusluvuista ja niiden julkaisemisesta",
    "Energiaviraston määräys sähköverkkoliiketoiminnan tunnusluvuista ja niiden julkaisemisesta. Määräys velvoittaa sähköverkonhaltijat julkaisemaan tunnuslukuja verkkotoiminnastaan, mukaan lukien toimitusvarmuustiedot (SAIDI, SAIFI, CAIDI), asiakastiedot ja taloudelliset tunnusluvut.",
    "maarays", "in_force", "2025-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "3780/000002/2023", "Määräys sähkön myyntiä ja jakelua koskevien laskujen erittelystä",
    "Energiaviraston määräys sähkön myyntiä ja sähkön jakelua koskevien laskujen erittelystä. Määräys määrittelee, mitä tietoja sähkölaskuissa on esitettävä kuluttajille, mukaan lukien energian hinta, siirtomaksut, verot ja sähkön alkuperä.",
    "maarays", "in_force", "2024-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "3167/000002/2023", "Määräys jakeluverkon kehittämissuunnitelmasta",
    "Energiaviraston määräys jakeluverkon kehittämissuunnitelmasta. Sähkömarkkinalain (497/2023) mukaan jakeluverkonhaltijan on laadittava kahden vuoden välein jakeluverkon kehittämissuunnitelma, joka sisältää investointisuunnitelman, joustopalveluiden hankinnan arvioinnin ja toimitusvarmuussuunnitelman.",
    "maarays", "in_force", "2024-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "2495/000002/2022", "Määräys sähkön vähittäismyyjän hintojen ja ehtojen toimittamisesta",
    "Energiaviraston määräys sähkön vähittäismyyjän sähkön vähittäismyyntihintojen ja -ehtojen toimittamisesta Energiavirastolle. Toimitusvelvollisuusmyyjien on toimitettava hinta- ja sopimusehtotiedot Energiavirastolle ennen niiden käyttöönottoa.",
    "maarays", "in_force", "2023-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "3019/002/2021", "Määräys sähkönjakeluverkon kehittämissuunnitelmista",
    "Energiaviraston määräys sähkönjakeluverkon kehittämissuunnitelmista. Edeltävä versio kehittämissuunnitelmamääräyksestä, joka korvattiin määräyksellä 3167/000002/2023.",
    "maarays", "repealed", "2022-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "2588/002/2019", "Määräys korotuskattovalvonnan uusien asiakasryhmien soveltamisesta",
    "Energiaviraston määräys sähkön jakeluverkkojen uusien asiakasryhmien soveltamisesta sähkömarkkinalain mukaisessa korotuskattovalvonnassa. Määräys tarkentaa, miten korotuskattoa sovelletaan, kun verkonhaltija ottaa käyttöön uusia hinnoittelurakenteita.",
    "maarays", "in_force", "2020-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "743/002/2018", "Määräys maakaasuverkonhaltijan verkkopalveluehtojen ja -hintojen ilmoittamisesta",
    "Energiaviraston määräys maakaasuverkonhaltijan verkkopalveluehtojen ja -hintojen ilmoittamisesta Energiavirastolle. Velvoittaa maakaasuverkonhaltijat raportoimaan verkkopalveluehtonsa ja -hintansa valvontaviranomaisen käyttöön.",
    "maarays", "in_force", "2019-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "742/002/2018", "Määräys sähköverkonhaltijan verkkopalveluehtojen ja -hintojen ilmoittamisesta",
    "Energiaviraston määräys sähköverkonhaltijan verkkopalveluehtojen ja -hintojen ilmoittamisesta Energiavirastolle. Velvoittaa sähköverkonhaltijat raportoimaan verkkopalveluehtonsa ja siirtohintansa.",
    "maarays", "in_force", "2019-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "2167/002/2016", "Määräys sähköverkkotoiminnan tunnusluvuista ja niiden julkaisemisesta (kumottu)",
    "Energiaviraston aiempi määräys sähköverkkotoiminnan tunnusluvuista ja niiden julkaisemisesta. Korvattu uudella määräyksellä 143/000002/2024.",
    "maarays", "repealed", "2017-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "1731/002/2015", "Määräys maakaasuverkkotoiminnan tunnusluvuista ja niiden julkaisemisesta (kumottu)",
    "Energiaviraston aiempi määräys maakaasuverkkotoiminnan tunnusluvuista ja niiden julkaisemisesta. Korvattu uudella määräyksellä 144/000002/2024.",
    "maarays", "repealed", "2016-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "823/002/2013", "Määräys sähkönjakeluverkon kehittämissuunnitelmasta (2013)",
    "Energiaviraston alkuperäinen määräys sähkönjakeluverkon kehittämissuunnitelmasta. Korvattu myöhemmillä määräyksillä.",
    "maarays", "repealed", "2014-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "1184/002/2013", "Määräys maakaasuenergiaa ja maakaasun siirtoa koskevien laskujen erittelystä",
    "Energiaviraston määräys maakaasuenergiaa ja maakaasun siirtoa koskevien laskujen erittelystä. Määräys asettaa vaatimukset maakaasulaskujen erittelylle kuluttajille.",
    "maarays", "in_force", "2014-01-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "122/002/2014", "Määräys sähkönmyyntiehtojen ja -hintojen ilmoittamisesta",
    "Energiaviraston määräys sähkön vähittäismyyjän sähkönmyyntiehtojen ja -hintojen ilmoittamisesta Energiavirastolle.",
    "maarays", "in_force", "2014-07-01", "https://energiavirasto.fi/maaraykset"],

  ["energiavirasto", "1185/002/2013", "Määräys vähittäismyyjän tunnuslukujen julkaisemisesta ja ilmoittamisesta",
    "Energiaviraston määräys sähkön vähittäismyyjän tunnuslukujen julkaisemisesta ja ilmoittamisesta. Velvoittaa sähkönmyyjät julkaisemaan tunnuslukuja toiminnastaan.",
    "maarays", "in_force", "2014-01-01", "https://energiavirasto.fi/maaraykset"],
];

// ---------------------------------------------------------------------------
// 4. ENERGIAVIRASTO — Valvontamenetelmät (Supervision Methods)
// ---------------------------------------------------------------------------

const evValvonta: string[][] = [
  ["energiavirasto", "EV-VM-SAHKO-2024-2031", "Sähkön jakeluverkkotoiminnan valvontamenetelmät 2024–2031",
    "Energiaviraston vahvistamat valvontamenetelmät sähkön jakeluverkkotoiminnan hinnoittelun kohtuullisuuden arvioimiseksi kuudennella valvontajaksolla 2024–2031. Menetelmät perustuvat tuottopohjaisen regulaation ja kannustinpohjaisen sääntelyn hybridimalliin. Valvontamenetelmät sisältävät kohtuullisen tuoton laskentaperusteet (WACC), tehostamisvelvoitteet, laatukannustimet (SAIDI, SAIFI), toimitusvarmuuskannustimet, investointikannustimet ja innovaatiokannustimet. Vahvistettu 29.12.2023.",
    "ohje", "in_force", "2024-01-01", "https://energiavirasto.fi/en/pricing-regulation"],

  ["energiavirasto", "EV-VM-SAHKO-KANTA-2024-2031", "Sähkön kantaverkkotoiminnan valvontamenetelmät 2024–2031",
    "Energiaviraston vahvistamat valvontamenetelmät sähkön kantaverkkotoiminnan (Fingrid Oyj) hinnoittelun kohtuullisuuden arvioimiseksi kuudennella valvontajaksolla 2024–2031.",
    "ohje", "in_force", "2024-01-01", "https://energiavirasto.fi/en/pricing-regulation"],

  ["energiavirasto", "EV-VM-KAASU-JAK-2024-2027", "Maakaasuverkkotoiminnan valvontamenetelmät — jakelu 2024–2027",
    "Energiaviraston vahvistamat valvontamenetelmät maakaasun jakeluverkkotoiminnan hinnoittelun kohtuullisuuden arvioimiseksi viidennellä valvontajaksolla 2024–2027.",
    "ohje", "in_force", "2024-01-01", "https://energiavirasto.fi/en/pricing-regulation"],

  ["energiavirasto", "EV-VM-KAASU-SIIRTO-2024-2027", "Maakaasuverkkotoiminnan valvontamenetelmät — siirto (Gasgrid) 2024–2027",
    "Energiaviraston vahvistamat valvontamenetelmät maakaasun siirtoverkkotoiminnan (Gasgrid Finland Oy) hinnoittelun kohtuullisuuden arvioimiseksi. WACC-parametrit 2025: oman pääoman kustannus 7,20 %, vieraan pääoman kustannus 5,42 %, WACC ennen veroja 7,61 %. Poistoajat: putkistot 65 vuotta, kompressoriasemat 60 vuotta.",
    "ohje", "in_force", "2024-01-01", "https://energiavirasto.fi/en/pricing-regulation"],

  ["energiavirasto", "EV-VM-SAHKO-2016-2023", "Sähkön jakeluverkkotoiminnan valvontamenetelmät 2016–2023 (edellinen)",
    "Energiaviraston aiemmat valvontamenetelmät neljännellä ja viidennellä valvontajaksolla 2016–2023. Korvattu uusilla menetelmillä 2024–2031.",
    "ohje", "repealed", "2016-01-01", "https://energiavirasto.fi/en/pricing-regulation"],
];

// ---------------------------------------------------------------------------
// 5. ENERGIAVIRASTO — Ohjeet (Guidance)
// ---------------------------------------------------------------------------

const evOhjeet: string[][] = [
  ["energiavirasto", "EV-OHJE-NIS2-2025", "Ohje Energiaviraston valvomille toimijoille kyberturvallisuuslain noudattamiseksi",
    "Energiaviraston ohje kyberturvallisuuslain (NIS2-direktiivin kansallinen toimeenpano) noudattamiseksi energia-alan yrityksille. Ohje kattaa sähkö-, kaukolämpö-, kaasu-, öljy- ja vetysektorin. Toimijat jaetaan tärkeisiin ja keskeisiin toimijoihin. Rekisteröityminen VERTTI-valvontatietojärjestelmään vaaditaan kuukauden kuluessa kriteerien täyttymisestä. Tietoturvapoikkeaman ilmoitus: alkuvaiheen ilmoitus 24 h, jatkoilmoitus 72 h, loppuraportti 1 kk.",
    "ohje", "in_force", "2025-04-08", "https://energiavirasto.fi/kyberturvallisuus"],

  ["energiavirasto", "EV-OHJE-NIS1-ILMOITUS", "Ohje tietoturvallisuuteen liittyvän häiriön ilmoittamisesta (NIS1)",
    "Energiaviraston aiempi ohje NIS1-direktiivin mukaisesta tietoturvallisuuteen liittyvän häiriön ilmoittamisesta. Korvattu NIS2-ohjeella.",
    "ohje", "repealed", "2020-01-01", "https://energiavirasto.fi/kyberturvallisuus"],

  ["energiavirasto", "EV-OHJE-TODENTAJA-2019", "Todentajaohje — päästökauppa, tuotantotuki, kestävyys",
    "Energiaviraston todentajaohje päästökaupan, tuotantotuen ja kestävyyskriteerien todentamiseen. Ohje määrittelee todentajien pätevyysvaatimukset, todentamismenettelyn ja raportoinnin.",
    "ohje", "in_force", "2019-01-01", "https://energiavirasto.fi/documents/11120570/12760579/2019-todentajaohje.pdf"],

  ["energiavirasto", "EV-OHJE-REMIT", "REMIT-markkinavalvontaohje",
    "Energiaviraston ohje EU:n REMIT-asetuksen (EU) N:o 1227/2011 soveltamisesta tukkuenergia-alan markkinaosapuolille. Ohje kattaa sisäpiiritiedon julkistamisen, kauppatapahtumien raportoinnin ACER:n ARIS-järjestelmään ja rekisteröitymisen CEREMP-rekisteriin. Energiavirasto valvoo tukkumarkkinoiden eheyttä.",
    "ohje", "in_force", "2015-01-01", "https://energiavirasto.fi/en/market-supervision"],

  ["energiavirasto", "EV-OHJE-TOIMITUSVELV", "Ohje sähkön toimitusvelvollisuushinnan arvioinnista",
    "Energiaviraston ohje sähkön toimitusvelvollisuushinnan kohtuullisuuden arvioinnista. Toimitusvelvollisuus edellyttää, että tiettyjen sähkön vähittäismyyjien on tarjottava sähköä kohtuulliseen hintaan kuluttajille ja muille loppukäyttäjille jakeluverkkonsa alueella.",
    "ohje", "in_force", "2023-01-01", "https://energiavirasto.fi/-/paatoksia-sahkon-toimitusvelvollisuus"],

  ["energiavirasto", "EV-OHJE-SAHKONMITTAUS", "Sähkön mittaus — mittarointivaatimukset",
    "Energiaviraston ohje sähkön mittauksesta. Suomessa etäluenta kattaa yli 99 % kaikista mittauslaitteista. Vuoden 2026 alusta uudet etämittauslaitteet luetaan vähintään kuuden tunnin välein. Tuntimittaus tarkoittaa sähkön kulutuksen tai tuotannon kirjaamista tuntijaksoissa, ja varttimittaus 15 minuutin jaksoissa.",
    "ohje", "in_force", "2026-01-01", "https://energiavirasto.fi/sahkon-mittaus"],

  ["energiavirasto", "EV-OHJE-ENERGIATEHOKKUUS", "Energiatehokkuussopimukset 2026–2035",
    "Energiaviraston hallinnoima energiatehokkuussopimusjärjestelmä vuosille 2026–2035. Valtio ja toimialat sopivat energiatehokkuudesta neljäntenä sopimuskautena. 169 yritystä ja yhteisöä liittyi uusiin sopimuksiin heti niiden alkaessa. Sopimukset kattavat elinkeinoelämän, kiinteistöalan ja julkisen sektorin.",
    "ohje", "in_force", "2026-01-01", "https://energiavirasto.fi/energiatehokkuussopimukset"],

  ["energiavirasto", "EV-OHJE-ENERGIANEUVONTA", "Energianeuvonta kuluttajille",
    "Energiaviraston koordinoima energianeuvontapalvelu tarjoaa puolueetonta tietoa energiansäästöstä, uusiutuvasta energiasta ja energiaremonteista kotitalouksille ja pk-yrityksille.",
    "ohje", "in_force", "2020-01-01", "https://energiavirasto.fi/energianeuvonta"],

  ["energiavirasto", "EV-OHJE-HINTATILASTOT", "Sähkön hintatilastot ja markkinatiedot",
    "Energiavirasto kerää ja julkaisee sähkön hintatilastoja. Tilastot kattavat sähkön vähittäismyyntihinnat, siirtomaksut ja kokonaishinnat eri asiakasryhmille. Tiedot ovat osa EU:n energiahintaraportointia.",
    "ohje", "in_force", "2013-09-01", "https://energiavirasto.fi/sahkon-hintatilastot"],

  ["energiavirasto", "EV-OHJE-CEREMP", "CEREMP-rekisteri — tukkuenergia-alan markkinaosapuolten rekisteröinti",
    "Energiavirasto ylläpitää CEREMP-rekisteriä (Centralised European Register of Energy Market Participants) REMIT-asetuksen nojalla. Tukkuenergia-alan markkinaosapuolten on rekisteröidyttävä ennen kaupankäyntiä tukkuenergiatuotteilla.",
    "ohje", "in_force", "2015-01-01", "https://energiavirasto.fi/en/market-supervision"],
];

// ---------------------------------------------------------------------------
// 6. TUKES — Safety Regulations
// ---------------------------------------------------------------------------

const tukesRegs: string[][] = [
  ["tukes", "TUKES-SAHKO-LAITTEISTO-LUOKAT", "Sähkölaitteistoluokat ja tarkastusvaatimukset",
    "Tukesin ohje sähkölaitteistoluokista (luokat 1a, 1b, 1c, 1d, 2a, 2b, 2c, 2d, 3a, 3b, 3c) ja niiden tarkastusvaatimuksista. Sähkölaitteiston haltijalle on määrättävä käytönjohtaja, kun laitteisto sisältää suurjännitteisiä (> 1000 V) osia (luokat 2C ja 3C) tai pienjännitelaitteiston liittymisteho ylittää 1600 kVA (luokka 2D). Asuinrakennuksia lukuun ottamatta kaikki sähkölaitteistot on tarkastettava määräajoin, jos pääsulakekoko ylittää 35 A.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/en/electricity/electrical-installations"],

  ["tukes", "TUKES-SAHKO-KAYTTOONOTTO", "Sähkölaitteistojen käyttöönottotarkastukset",
    "Tukesin vaatimus sähkölaitteistojen käyttöönottotarkastuksista. Sähkötöiden tekijän on suoritettava yksityiskohtainen käyttöönottotarkastus osana työtä varmistaakseen, että laitteisto on turvallinen ja vaatimusten mukainen käyttöön otettaessa. Tarkastuksen dokumentointi on toimitettava laitteiston haltijalle.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/en/electricity/electrical-works-and-contracting/commissioning-stage-inspections-of-electrical-installations"],

  ["tukes", "TUKES-SAHKO-URAKOITSIJA", "Sähköurakoitsijan rekisteröintivelvollisuus",
    "Tukesin vaatimus sähköurakoitsijoiden rekisteröinnistä. Sähkötöiden tekemisen oikeus edellyttää, että henkilö tai yritys tekee ilmoituksen Tukesin rekisteriin ja nimeää sähköalan pätevyyden omaavan henkilön töiden johtajaksi. Tukes ylläpitää julkista sähköalan rekisteriä (rekisterit.tukes.fi).",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/en/electricity/electrical-works-and-contracting"],

  ["tukes", "TUKES-SAHKO-TURVALLISUUS", "Sähköturvallisuuden perusperiaatteet",
    "Tukesin ohje sähköturvallisuuden perusperiaatteista. Sähkölaitteet ja -asennukset on suunniteltava, rakennettava ja huollettava siten, ettei niistä aiheudu vaaraa ihmisille, kotieläimille tai omaisuudelle. Ohjeet kattavat suojausmenetelmät, eristysvaatimukset, maadoituksen ja vikavirtasuojauksen.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/en/electricity/electrical-works-and-contracting/basic-principles-of-electrical-safety"],

  ["tukes", "TUKES-SAHKO-MAARINTALOUS", "Sähköturvallisuus maa- ja puutarhatalouksissa",
    "Tukesin opas sähköturvallisuudesta maa- ja puutarhatalouksissa. Opas kattaa maatalousrakennusten sähköasennusten erityisvaatimukset, kosteuden- ja pölysuojauksen, eläinsuojien sähköturvallisuuden ja ulkoalueiden sähköasennukset.",
    "ohje", "in_force", "2018-01-01", "https://tukes.fi/documents/5470659/8237195/Sähköturvallisuus+maa-+ja+puutarhatalouksissa+2018"],

  ["tukes", "TUKES-SAHKO-KONEET", "Koneiden sähkölaitteistoja koskevat turvallisuusvaatimukset",
    "Tukesin ohje koneiden sähkölaitteistoja koskevista turvallisuusvaatimuksista ja sähkötöistä. Koneisiin asennettavien sähkölaitteistojen on täytettävä sekä konedirektiivin että sähköturvallisuuslain vaatimukset.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/sahko/sahkotyot-ja-urakointi/koneiden-sahkolaitteistoja-koskevat-turvallisuusvaatimukset-ja-sahkotyot"],

  ["tukes", "TUKES-SAHKO-VANHAT-MAARAYKSET", "Vanhat sähkömääräykset (ST-ohjeet) — historiallinen viite",
    "Tukesin vanhat sähkömääräykset (ST-ohjeet) olivat sähköalan keskeisiä teknisiä ohjeita sähköturvallisuuslain (410/1996) nojalla. Uuden sähköturvallisuuslain (1135/2016) myötä ne korvattiin standardeilla (SFS 6000 -sarjan standardit). Vanhoja ST-ohjeita voidaan edelleen soveltaa olemassa oleviin asennuksiin.",
    "ohje", "repealed", "2017-01-01", "https://tukes.fi/en/electricity/electrical-works-and-contracting/technical-requirements-for-electrical-installations/old-regulations"],

  ["tukes", "TUKES-KAASU-NESTEKAASU", "Nestekaasulaitosten turvallisuusvalvonta",
    "Tukesin valvontaprojekti nestekaasulaitosten turvallisuudesta (2024). Tukes valvoi 15 nestekaasulaitosta ja havaitsi puutteita valmistuksen säädösosaamisessa ja käytön aikaisen turvallisuuden varmistamisessa. Havaitut puutteet koskivat painelaitteiden käytön valvontaa, omistajien ja haltijoiden velvollisuuksia sekä käyttö- ja huolto-ohjeiden noudattamista.",
    "ohje", "in_force", "2024-01-01", "https://tukes.fi/-/tukes-selvitti-valvontaprojektissa-nestekaasulaitosten-turvallisuutta"],

  ["tukes", "TUKES-PAINELAITE-REKISTERI", "Painelaitteen rekisteröintivelvollisuus",
    "Tukesin ohje painelaitteen rekisteröinnistä. Rekisteröitävien painelaitteiden omistajat, haltijat ja käytönvalvojat vastaavat painelaitteiden turvallisesta käytöstä. Omistajan tai haltijan on koottava painelaitteen hyväksymiseen ja tarkastukseen liittyvät asiakirjat yhtenäiseksi painelaitteen kirjaksi. Tukes otti käyttöön automaattisen päätöksenteon painelaiterekisterin muutosilmoituksissa 4.11.2024.",
    "ohje", "in_force", "2024-11-04", "https://tukes.fi/tuotteet-ja-palvelut/painelaitteet/painelaitteen-kaytto/painelaitteen-rekisterointi"],

  ["tukes", "TUKES-KAASU-MAAKAASU", "Maakaasun käsittelyn turvallisuusvaatimukset",
    "Tukesin ja VNA 551/2009:n mukaiset vaatimukset maakaasun käsittely-, varastointi- ja jakelulaitteiden turvallisuudelle. Kattaa maakaasuputkistojen suunnittelun, kompressoriasemien, LNG-laitosten ja biokaasulaitosten turvallisuusvaatimukset.",
    "ohje", "in_force", "2009-07-01", "https://tukes.fi/kaasu"],

  ["tukes", "TUKES-PAINELAITE-SAIRAALA", "Sairaaloiden painelaitteiden tekninen turvallisuusvalvonta",
    "Tukesin valvontaprojekti sairaaloiden teknisestä turvallisuudesta. Painelaitteiden (höyrykattilat, autoklaavit, lääketieteelliset kaasujärjestelmät) säännöllinen tarkastus ja kunnossapito on välttämätöntä potilasturvallisuuden kannalta.",
    "ohje", "in_force", "2024-01-01", "https://tukes.fi/-/tukes-valvoo-sairaaloiden-teknista-turvallisuutta"],

  ["tukes", "TUKES-EMC", "Sähkömagneettinen yhteensopivuus (EMC)",
    "Tukesin vaatimukset sähkömagneettisesta yhteensopivuudesta (EMC). EMC:n tarkoituksena on varmistaa, etteivät sähkölaitteet tai -laitteistot aiheuta häiriöitä, jotka vaikuttaisivat muihin laitteisiin, ja etteivät ne ole herkkiä muiden laitteiden aiheuttamille häiriöille. Sähkömagneettista yhteensopivuutta säätelevät sähköturvallisuuslaki ja EMC-direktiivi 2014/30/EU.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/en/products-and-services/electrical-products/electromagnetic-compatibility-emc"],

  ["tukes", "TUKES-ATEX", "ATEX — Räjähdysvaarallisten tilojen laitteet ja suojausjärjestelmät",
    "Tukesin vaatimukset räjähdysvaarallisten tilojen laitteille ja suojausjärjestelmille. ATEX-laitedirektiivin (2014/34/EU) mukaisesti räjähdysvaarallisissa tiloissa käytettävien laitteiden valmistaja vastaa laitteiden vaatimustenmukaisuudesta. Koskee energiasektoria: LNG-terminaalit, biokaasulaitokset, maakaasulaitteistot.",
    "ohje", "in_force", "2016-04-20", "https://tukes.fi/en/industry/potentially-explosive-atmospheres/atex-equipment-for-potentially-explosive-atmospheres"],

  ["tukes", "TUKES-ATEX-TILAT", "Räjähdysvaarallisten tilojen sähköasennukset",
    "Tukesin vaatimukset räjähdysvaarallisten tilojen sähköasennuksille. Sähköasennusten on täytettävä sekä sähköturvallisuuslain että ATEX-direktiivin vaatimukset. Räjähdysvaarallisten tilojen luokittelu ja Ex-laitteiden valinta perustuu standardisarjaan SFS-EN 60079.",
    "ohje", "in_force", "2017-01-01", "https://tukes.fi/teollisuus/rajahdysvaaralliset-tilat/rajahdysvaarallisten-tilojen-sahkosennukset"],

  ["tukes", "TUKES-ATEX-KUNNOSSAPITO", "Räjähdysvaarallisten tilojen kunnossapito — valvontaprojekti 2025",
    "Tukesin valvontaprojekti räjähdysvaarallisten tilojen kunnossapidosta (kevät 2025). Projektin tavoitteena on kartoittaa yritysten käytäntöjä ATEX-tilojen ja niissä olevien laitteiden kunnossapidossa.",
    "ohje", "in_force", "2025-01-01", "https://tukes.fi/-/tukes-kiinnittaa-huomiota-rajahdysvaarallisten-tilojen-kunnossapitoon"],

  ["tukes", "TUKES-SAHKO-LVD", "Sähkölaitteiden turvallisuus — pienjännitedirektiivi (LVD)",
    "Tukesin vaatimukset sähkölaitteiden turvallisuudelle pienjännitedirektiivin (2014/35/EU) nojalla. Kattaa sähkölaitteet, joiden nimellisjännite on 50–1000 V AC tai 75–1500 V DC. Valmistajan on varmistettava vaatimustenmukaisuus ja laadittava EU-vaatimustenmukaisuusvakuutus.",
    "ohje", "in_force", "2016-04-20", "https://tukes.fi/en/products-and-services/electrical-products/electrical-safety-lvd"],

  ["tukes", "TUKES-SAHKO-TUOTTEET", "Sähkölaitteiden markkinavalvonta",
    "Tukesin sähkölaitteiden markkinavalvonta. Tukes valvoo Suomen markkinoilla olevia sähkötuotteita ja puuttuu tuotteisiin, jotka eivät täytä vaatimuksia. PLC-adaptereista löytyi puutteita yhteiseurooppalaisessa valvontaprojektissa (EMC-häiriöt).",
    "ohje", "in_force", "2024-01-01", "https://tukes.fi/-/plc-adaptereista-loytyi-puutteita-yhteiseurooppalaisessa-valvontaprojektissa"],

  ["tukes", "TUKES-KAASU-LNG-TUKES6506", "Päätös TUKES 6506/03.02.00/2024 — LNG-laitosturvallisuus",
    "Tukesin päätös 6506/03.02.00/2024 LNG-laitoksen turvallisuusvaatimuksista. Nesteytetyn maakaasun (LNG) käsittelyä, varastointia ja jakelua koskevat erityiset turvallisuusvaatimukset.",
    "maarays", "in_force", "2024-01-01", "https://tukes.fi/documents/5470659/0/ST1+Vantaa+päätös.pdf"],

  ["tukes", "TUKES-PAINELAITE-VARAENERGIA", "Painelaitteet ja varaenergiamuotojen käyttöönotto",
    "Tukesin muistutus teollisuuslaitoksille lupamenettelyistä ja painelaitevelvoitteista varaenergiamuotojen käyttöönottoa suunniteltaessa. Esimerkiksi varavoiman höyrykattiloiden ja paineilmajärjestelmien käyttöönotto edellyttää painelaitelain mukaisia lupia ja tarkastuksia.",
    "ohje", "in_force", "2024-01-01", "https://tukes.fi/-/tukes-muistuttaa-teollisuuslaitoksia-lupamenettelyista-ja-painelaitevelvoitteista-varaenergiamuotojen-kayttoonottoa-suunniteltaessa"],
];

// ---------------------------------------------------------------------------
// 7. TEM — Energy Policy and Strategy
// ---------------------------------------------------------------------------

const temRegs: string[][] = [
  ["tem", "TEM-ENERGIASTRATEGIA-2022", "Kansallinen energia- ja ilmastostrategia 2022",
    "Työ- ja elinkeinoministeriön kansallinen energia- ja ilmastostrategia. Strategia asettaa tavoitteet uusiutuvan energian osuuden kasvattamiselle, fossiilisten polttoaineiden käytön vähentämiselle, energiatehokkuuden parantamiselle ja hiilineutraalisuuden saavuttamiselle vuoteen 2035 mennessä. Suomi tavoittelee hiilineutraalisuutta vuoteen 2035 mennessä.",
    "ohje", "in_force", "2022-06-01", "https://tem.fi/energia-ja-ilmastostrategia"],

  ["tem", "TEM-NECP-2024", "Suomen integroitu kansallinen energia- ja ilmastosuunnitelma (NECP)",
    "Suomen EU:lle toimittama integroitu kansallinen energia- ja ilmastosuunnitelma EU:n hallintoasetuksen (EU) 2018/1999 mukaisesti. Suunnitelma kattaa uusiutuvan energian tavoitteet, energiatehokkuustavoitteet, kasvihuonekaasupäästöjen vähentämistavoitteet ja energiaturvallisuusnäkökohdat.",
    "ohje", "in_force", "2024-06-30", "https://tem.fi/kansallinen-energia-ja-ilmastosuunnitelma"],

  ["tem", "TEM-SAHKOVERO", "Sähköveron alennus 2022–2023 (väliaikainen)",
    "Työ- ja elinkeinoministeriön esittämä sähkön arvonlisäveron väliaikainen alennus 24 prosentista 10 prosenttiin 1.12.2022–30.4.2023 energiakriisin seurauksena.",
    "ohje", "repealed", "2022-12-01", "https://tem.fi/energia"],

  ["tem", "TEM-VOIMALAITOSVEROLAKI", "Laki voimalaitosverosta (väliaikainen windfall-vero)",
    "Työ- ja elinkeinoministeriön valmistelema laki väliaikaisesta 30 %:n verosta sähköalan yritysten voittoihin verovuodelle 2023. Lisäksi 33 %:n väliaikainen vero fossiilisten polttoaineiden alan yrityksille, joiden liikevaihdosta yli 75 % tulee öljyn, maakaasun tai hiilen tuotannosta tai jalostuksesta.",
    "ohje", "repealed", "2023-01-01", "https://tem.fi/energia"],

  ["tem", "TEM-YDINENERGIA-STUK", "Ydinenergian sääntely — STUK:n rooli",
    "Ydinenergialain (990/1987) mukainen sääntelykehys. Säteilyturvakeskus (STUK) valvoo ydinturvallisuutta ja -turvajärjestelyjä. TEM myöntää ydinlaitoksen rakentamis- ja käyttöluvat eduskunnan periaatepäätöksen jälkeen. Suomessa toimii viisi ydinreaktoria (Olkiluoto 1, 2 ja 3, Loviisa 1 ja 2).",
    "ohje", "in_force", "1988-03-01", "https://tem.fi/ydinenergia"],

  ["tem", "TEM-LNG-TERMINAALIT", "LNG-terminaalien sääntelykehys",
    "Maakaasumarkkinalain (587/2017) mukainen LNG-terminaalien sääntely. Floating LNG Terminal Finland Oy operoi Inkoon kelluvaa LNG-terminaalia, Gasum LNG Oy ja Hamina LNG Oy operoivat kiinteitä terminaaleja. Energiavirasto vahvistaa terminaalien käyttöehdot ja -tariffit.",
    "ohje", "in_force", "2018-01-01", "https://tem.fi/maakaasu"],

  ["tem", "TEM-SAHKOISTAMISTUKI", "Energiaintensiivisen teollisuuden sähköistämistuki",
    "Sähköistämistukijärjestelmä kompensoi päästökaupasta aiheutuvia epäsuoria sähkökustannuksia energiaintensiiviselle teollisuudelle. VNA 658/2022 sääntelee tuen myöntämisen edellytyksiä. Vuonna 2025 tukea maksettiin 149,9 miljoonaa euroa.",
    "ohje", "in_force", "2022-08-01", "https://tem.fi/sahkoistamistuki"],

  ["tem", "TEM-TARJOUSKILPAILU-RE", "Uusiutuvan energian tuotantotuen tarjouskilpailu",
    "Energiaviraston toteuttama uusiutuvan energian tuotantotuen tarjouskilpailu. Teknologianeutraali kilpailutus korvasi kiinteän syöttötariffin. Energiavirasto arvioi tarjouskilpailun tuloksia syyskuussa 2024.",
    "ohje", "in_force", "2019-01-01", "https://energiavirasto.fi/documents/11120570/199257651/Uusiutuvan+energian+tuen+tarjouskilpailun+arviointi+2024.pdf"],

  ["tem", "TEM-VETYSTRATEGIA", "Suomen vetystrategia",
    "Työ- ja elinkeinoministeriön vetystrategia. Suomi tavoittelee puhtaan vedyn tuotannon ja käytön merkittävää kasvua osana energiasiirtymää ja teollisuuden dekarbonisaatiota. Vetytalous liittyy EU:n REPowerEU-suunnitelmaan ja EU:n vetystrategiaan.",
    "ohje", "in_force", "2023-01-01", "https://tem.fi/vetytalous"],

  ["tem", "TEM-KAUKOLAMPO", "Kaukolämmön sääntelykehys",
    "Kaukolämpömarkkinoiden sääntely Suomessa. Kaukolämpötoiminta ei edellytä erillistä toimilupaa, mutta Kilpailu- ja kuluttajavirasto (KKV) valvoo hinnoittelun kohtuullisuutta. NIS2-direktiivin myötä kaukolämpösektori kuuluu Energiaviraston kyberturvallisuusvalvontaan vuodesta 2025.",
    "ohje", "in_force", "2025-04-08", "https://tem.fi/kaukolampo"],

  ["tem", "TEM-ENERGIAYHTEISOT", "Energiayhteisöt — sääntelykehys",
    "Sähkömarkkinalain (497/2023) mukainen energiayhteisöjen sääntelykehys. Energiayhteisöt (kansalaisenergiayhteisöt ja uusiutuvan energian yhteisöt) voivat tuottaa, varastoida ja myydä energiaa. EU:n puhtaan energian paketin toimeenpano.",
    "ohje", "in_force", "2023-07-01", "https://www.motiva.fi/ratkaisut/energiayhteisot/energiayhteisoon_liittyvat_saadokset_ja_verotus"],

  ["tem", "TEM-OFFSHORE-TUULIVOIMA", "Merituulivoiman sääntelykehys",
    "Merituulivoiman kehittämisen sääntelykehys Suomessa. Merituulivoiman rakentaminen Suomen talousvyöhykkeellä edellyttää valtioneuvoston suostumuslupaa ja ympäristövaikutusten arviointia. Suomi tavoittelee merkittävää merituulivoimakapasiteettia 2030-luvulle.",
    "ohje", "in_force", "2024-01-01", "https://tem.fi/merituulivoima"],

  ["tem", "TEM-LIIKENTEEN-INFRATUKI", "Liikenteen infrastruktuurituki (EV, kaasu, vety)",
    "Energiaviraston hallinnoima liikenteen infrastruktuurituki sähköajoneuvojen latausinfrastruktuurille, kaasutankkausasemille ja vetytankkausasemille. VNA 178/2022 sääntelee tukia vuosille 2022–2025. Toteuttaa AFIR-asetuksen vaatimuksia.",
    "ohje", "in_force", "2022-03-01", "https://energiavirasto.fi/liikenteen-infratuki"],

  ["tem", "TEM-ENERGIAKATSELMUS", "Suuryritysten pakolliset energiakatselmukset",
    "Energiatehokkuuslain (1429/2014) mukainen suuryritysten pakollinen energiakatselmus neljän vuoden välein. TEM ja Energiavirasto valvovat katselmointivelvoitteen noudattamista. Katselmuksen voi tehdä vain pätevä energiakatselmoija.",
    "ohje", "in_force", "2015-01-01", "https://tem.fi/energiakatselmukset"],

  ["tem", "TEM-HUOLTOVARMUUS-ENERGIA", "Energiasektorin huoltovarmuus",
    "Energiasektorin huoltovarmuus osana kansallista huoltovarmuutta. Huoltovarmuuskeskus koordinoi varautumistoimintaa. Energiasektorin tavoitteisiin kuuluvat sähkön ja lämmön tuotantokapasiteetin turvaaminen, polttoainevarastojen ylläpito, kriittisen infrastruktuurin suojaaminen ja varavoimalajärjestelmät. Venäjän-tuonnin päättyminen 5/2022 korosti energiaomavaraisuuden merkitystä.",
    "ohje", "in_force", "2022-05-14", "https://tem.fi/huoltovarmuus"],

  ["tem", "TEM-RED-III", "Uusiutuvan energian direktiivin (RED III) kansallinen toimeenpano",
    "EU:n uusiutuvan energian direktiivin (EU) 2023/2413 (RED III) kansallinen toimeenpano. Direktiivi nostaa EU:n uusiutuvan energian tavoitteen 42,5 %:iin vuoteen 2030 mennessä. Suomen uusiutuvan energian osuus on jo yli 40 %. Toimeenpano edellyttää muutoksia sähkömarkkinalakiin ja uusiutuvan energian tukijärjestelmiin.",
    "ohje", "in_force", "2024-11-21", "https://tem.fi/uusiutuva-energia"],

  ["tem", "TEM-SAHKOJARJESTELMA-RIITTAVYYS", "Sähköjärjestelmän riittävyys ja tehoreservi",
    "Sähköjärjestelmän riittävyyden varmistaminen tehoreservijärjestelmällä. Energiavirasto kilpailuttaa tehoreservin, jota käytetään äärimmäisissä huippukulutustilanteissa. Fingrid vastaa tehoreservin käytöstä. Tehoreserviin kuuluvat voimalaitokset, joita ei normaalisti käytetä markkinaehtoisessa tuotannossa.",
    "ohje", "in_force", "2017-01-01", "https://tem.fi/tehoreservi"],

  ["tem", "TEM-BIOKAASU", "Biokaasun sääntelykehys",
    "Biokaasun tuotannon ja käytön sääntelykehys Suomessa. Biokaasu on uusiutuva energialähde, jonka tuotanto maataloussekttorin jätteistä ja yhdyskuntajätteestä kasvaa. Biokaasulaitosten turvallisuutta valvoo Tukes. Liikennekäytön biokaasun verotus noudattaa lakia 1260/1996.",
    "ohje", "in_force", "2022-01-01", "https://tem.fi/biokaasu"],

  ["tem", "TEM-AURINKOSAHKO", "Aurinkosähkön sääntelykehys",
    "Aurinkosähkön pientuotannon ja suurten aurinkovoimaloiden sääntely Suomessa. Sähkömarkkinalain muutos 497/2023 helpottaa aurinkosähkön tuottajien markkinoille pääsyä aggregaattoritoiminnan ja energiayhteisöjen kautta. Nettolaskutus korvattiin markkinaehtoisella mallilla.",
    "ohje", "in_force", "2023-07-01", "https://tem.fi/aurinkosahko"],

  ["tem", "TEM-PIENYDINVOIMA", "Pienydinvoimaloiden (SMR) sääntelykehys",
    "Pienydinvoimaloiden (Small Modular Reactors, SMR) sääntelykehys Suomessa. Ydinenergialaki (990/1987) koskee myös pienydinvoimaloita. TEM ja STUK arvioivat SMR-teknologioiden lupamenettelyjä. Suomi on yksi EU:n SMR-teollisuusliiton jäsenmaista.",
    "ohje", "in_force", "2024-01-01", "https://tem.fi/pienydinvoima"],

  ["tem", "TEM-SAHKOVARASTOT", "Sähkövarastojen sääntelykehys",
    "Sähkövarastojen sääntelykehys Suomessa. Sähkömarkkinalain muutos (497/2023) selvensi sähkövarastojen asemaa markkinoilla. Sähkövarastot eivät ole tuotantolaitoksia eivätkä kulutuskohteita vaan itsenäinen markkinatoimija. Jakeluverkonhaltijat eivät saa pääsääntöisesti omistaa sähkövarastoja. Fingridin SJV2024 asettaa sähkövarastojen tekniset vaatimukset.",
    "ohje", "in_force", "2023-07-01", "https://tem.fi/sahkovarastot"],

  ["tem", "TEM-ENERGIAYHTEISO-OPAS", "Energiayhteisöjen perustamisopas",
    "TEM:n ja Motivan opas energiayhteisöjen perustamisesta. Sähkömarkkinalain mukaiset energiayhteisömallit: kansalaisenergiayhteisö ja uusiutuvan energian yhteisö. Verotuskäsittely, verkkoon liittäminen ja mittarointivaatimukset.",
    "ohje", "in_force", "2024-01-01", "https://tem.fi/energiayhteisot"],
];

// ---------------------------------------------------------------------------
// Combine all regulations
// ---------------------------------------------------------------------------

const allRegs: string[][] = [
  ...finlexLaki,
  ...finlexAsetus,
  ...evMaaraykset,
  ...evValvonta,
  ...evOhjeet,
  ...tukesRegs,
  ...temRegs,
];

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

const allGridCodes: string[][] = [
  // --- Grid Code Specifications (VJV, SJV, KJV, HVDC) ---
  ["VJV2024", "Voimalaitosten järjestelmätekniset vaatimukset (Grid Code Specifications for Power Generating Facilities)",
    "Fingridin voimalaitosten järjestelmätekniset vaatimukset VJV2024. Vaatimukset koskevat kaikkia Suomen sähköjärjestelmään liitettyjä voimalaitoksia, joiden nimellisteho on vähintään 0,8 kW. Vaatimukset perustuvat EU:n verkkosääntöön (komission asetus 2016/631), johon Fingrid on tehnyt kansallisia lisäyksiä ja tarkennuksia. Energiavirasto vahvisti vaatimukset 20.3.2025. Vaatimukset koskevat uusia voimalaitoksia ja olemassa olevia, mikäli laitoksen järjestelmäteknisiä ominaisuuksia muutetaan.",
    "technical_regulation", "2024", "2025-03-20", "https://www.fingrid.fi/globalassets/dokumentit/fi/palvelut/kulutuksen-ja-tuotannon-liittaminen-kantaverkkoon/vjv2024.pdf"],

  ["SJV2024", "Sähkövarastojen järjestelmätekniset vaatimukset (Grid Code Specifications for Grid Energy Storage Systems)",
    "Fingridin sähkövarastojen järjestelmätekniset vaatimukset SJV2024. Vaatimukset koskevat kaikkia Suomen sähköjärjestelmään liitettyjä sähkövarastoja, joiden nimellisteho on vähintään 0,8 kW. Energiavirasto vahvisti vaatimukset 20.3.2025.",
    "technical_regulation", "2024", "2025-03-20", "https://www.fingrid.fi/globalassets/dokumentit/fi/palvelut/kulutuksen-ja-tuotannon-liittaminen-kantaverkkoon/sjv2024.pdf"],

  ["KJV", "Kulutuksen liittymisen järjestelmätekniset vaatimukset (Grid Code Specifications for Demand Connections)",
    "Fingridin kulutuksen liittymisen järjestelmätekniset vaatimukset (KJV). Vaatimukset koskevat sähkön käyttäjien liittämistä kantaverkkoon. Uusi versio KJV2026 on valmisteilla.",
    "technical_regulation", "current", "2020-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/grid-code-specifications/"],

  ["HVDC", "Tasasähköjärjestelmien (HVDC) järjestelmätekniset vaatimukset",
    "Fingridin HVDC-järjestelmien (tasasähköjärjestelmien) järjestelmätekniset vaatimukset. Vaatimukset koskevat suurtaajuusjohtoyhteyksiä (esim. Suomi-Viro, Suomi-Ruotsi tasasähköyhteydet). Saatavilla vain suomeksi.",
    "technical_regulation", "current", "2020-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/grid-code-specifications/"],

  // --- Main Grid Contract ---
  ["FINGRID-KANTAVERKKOSOP", "Kantaverkkosopimus ja palvelumaksut (Main Grid Contract and Service Fees)",
    "Fingridin kantaverkkosopimus määrittelee asiakkaan oikeudet siirtää sähköä kantaverkosta ja kantaverkkoon liityntäpisteensä kautta, palveluehdot ja -hinnat, loistehon toimituksen, loistehoreservien ylläpidon sekä reaaliaikaisen tiedonvaihdon järjestelmäturvallisuuden ylläpitämiseksi. Fingrid luopui kantaverkkopalvelumaksuista ja tarkisti liittymismaksujen tasoa vuodesta 2024.",
    "grid_connection", "2024", "2024-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/main-grid-contract-and-service-fees/"],

  ["FINGRID-TARIFFIUUDISTUS", "Kantaverkkotariffin rakenneuudistus (Main Grid Tariff Structure Reform)",
    "Fingridin kantaverkkotariffin rakenneuudistus. Uudistuksella pyritään kustannusvastaavampaan kantaverkon hinnoitteluun, joka huomioi hajautetun tuotannon kasvun ja sähkövarastojen yleistymisen vaikutukset kantaverkon kuormitukseen.",
    "grid_connection", "2024", "2024-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/main-grid-contract-and-service-fees/the-main-grid-tariff-structure-reform/"],

  ["FINGRID-SIIRTOJENHALLINTA", "Siirtojenhallintasopimus (Transmission Management Agreement)",
    "Fingridin siirtojenhallintasopimus, jossa tuotannon tai kulutuksen joustavuutta sovitaan tarvittaessa kantaverkon siirtojen hallintaan. Kumppaneiksi sopivat vähintään 10 megawatin sähköntuotannon tai kulutuksen säätökyvyn omaavat toimijat. Otettu käyttöön 2024.",
    "grid_connection", "2024", "2024-01-01", "https://www.fingrid.fi/ajankohtaista/tiedotteet/2024/fingrid-ottaa-kayttoon-siirtojenhallintasopimuksen"],

  // --- Complementary documents ---
  ["FINGRID-TAYD-DOK", "Järjestelmäteknisiä vaatimuksia täydentävät dokumentit",
    "Fingridin järjestelmäteknisiä vaatimuksia täydentävät dokumentit. Sisältävät mallinnusohjeet, loistehon toimituksen ja loistehoreservien ylläpitoon liittyvät vaatimukset sekä reaaliaikaisen tiedonvaihdon vaatimukset.",
    "technical_regulation", "current", "2025-01-01", "https://www.fingrid.fi/kantaverkko/liitynta-kantaverkkoon/tekniset-vaatimukset/jarjestelmateknisia-vaatimuksia-taydentavat-dokumentit/"],

  ["FINGRID-LIITTYJAN-OPAS", "Kantaverkkoon liittyjän opas",
    "Fingridin opas kantaverkkoon liittymisestä. Kuvaa liittymisprosessin vaiheet: liittymisselvitys, liittymissopimus, tekniset vaatimukset (VJV/SJV/KJV/HVDC), verkkoon liittymisvaihe ja käyttöönotto.",
    "grid_connection", "current", "2020-06-09", "https://www.fingrid.fi/globalassets/dokumentit/fi/palvelut/kulutuksen-ja-tuotannon-liittaminen-kantaverkkoon/kantaverkkoon-liittyjan-opas.pdf"],

  // --- Reserve Market Products ---
  ["FINGRID-FCR-N", "Taajuusohjattu käyttöreservi FCR-N (Frequency Containment Reserve for Normal Operation)",
    "Fingridin taajuusohjatun käyttöreservin (FCR-N) markkinasäännöt. FCR-N ylläpitää taajuutta normaalialueella 49,9–50,1 Hz. Symmetrinen tuote, joka vaatii sekä ylös- että alassäätökykyä. Minimtarjous 0,1 MW. Kaupankäynti tunti- ja vuosimarkkinoilla marginaalihinnoittelulla. Reservintoimittajan on tehtävä sopimus eSett Oy:n kanssa.",
    "balancing", "2025", "2025-02-10", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-products/frequency-containment-reserves-fcr-products/"],

  ["FINGRID-FCR-D-UP", "Taajuusohjattu häiriöreservi FCR-D ylös (Frequency Containment Reserve for Disturbances Up)",
    "Fingridin FCR-D ylös -reservin markkinasäännöt. Aktivoituu, kun taajuus laskee alle normaalialueen. Tavoitteena pitää taajuus välillä 49,5–50,5 Hz. Minimtarjous 1 MW. Tehon aktivointivaatimus: 86 % 7,5 sekunnissa.",
    "balancing", "2025", "2025-02-10", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-products/frequency-containment-reserves-fcr-products/"],

  ["FINGRID-FCR-D-DOWN", "Taajuusohjattu häiriöreservi FCR-D alas (Frequency Containment Reserve for Disturbances Down)",
    "Fingridin FCR-D alas -reservin markkinasäännöt. Aktivoituu, kun taajuus nousee yli normaalialueen. Minimtarjous 1 MW. Samat aktivointivaatimukset kuin FCR-D ylös.",
    "balancing", "2025", "2025-02-10", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-products/frequency-containment-reserves-fcr-products/"],

  ["FINGRID-FFR", "Nopea taajuusreservi FFR (Fast Frequency Reserve)",
    "Fingridin nopean taajuusreservin (FFR) markkinasäännöt. Kapasiteettimarkkina marginaalihinnoittelulla. Gate closure time (GCT) klo 18:00 EET/EEST. Gate opening time (GOT) 31 päivää etukäteen. FFR on nopein reservituote, joka reagoi suuriin taajuushäiriöihin.",
    "balancing", "2025", "2025-01-01", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-markets/"],

  ["FINGRID-AFRR", "Automaattinen taajuuden palautusreservi aFRR (Automatic Frequency Restoration Reserve)",
    "Fingridin automaattisen taajuuden palautusreservin (aFRR) markkinasäännöt. Kapasiteetti- ja energiamarkkinat. GCT: 08:30 kapasiteetille, 25 minuuttia ennen energialle. Marginaali- ja pay-as-bid-hinnoittelu. aFRR palauttaa taajuuden normaalitasolle FCR-aktivoinnin jälkeen.",
    "balancing", "2025", "2025-01-01", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-markets/"],

  ["FINGRID-MFRR", "Manuaalinen taajuuden palautusreservi mFRR (Manual Frequency Restoration Reserve)",
    "Fingridin manuaalisen taajuuden palautusreservin (mFRR) markkinasäännöt. Kapasiteetti- ja energiamarkkinat. GCT: 08:30 kapasiteetille, 45 minuuttia ennen energialle. Marginaali- ja pay-as-bid-hinnoittelu. mFRR:n palveluehdot uudistettiin 21.12.2020.",
    "balancing", "2025", "2025-01-01", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-markets/"],

  ["FINGRID-RESERVI-KAYTTOVARMUUS", "Reservien käyttövarmuusvaatimukset 2025",
    "Fingridin reservien käyttövarmuusvaatimukset (12.5.2025). Asettaa vaatimukset reserviresurssien saatavuudelle, luotettavuudelle ja tekniselle suorituskyvylle. Reservintoimittajien on varmistettava, että reserviresurssit ovat käytettävissä sopimusehtojen mukaisesti.",
    "balancing", "2025", "2025-05-12", "https://www.fingrid.fi/globalassets/reservien-kayttovarmuusvaatimukset-2025_5.pdf"],

  ["FINGRID-FCR-MARKKINASOP-2025", "FCR-markkinasopimuksen ehdot 2025",
    "Taajuusohjatun käyttö- ja häiriöreservin markkinasopimuksen ehdot, liite 1. Uudistettu 10.2.2025 alkaen. Muutokset koskevat reserviyksikköjen säätöominaisuuksien tarkastusta ja FCR-N-aktivoinnin aiheuttaman taseen korjausta tasevastaavalle.",
    "balancing", "2025", "2025-02-10", "https://www.fingrid.fi/globalassets/dokumentit/fi/sahkomarkkinat/reservit/liite-1-fcr-ehdot-2025_2.pdf"],

  ["FINGRID-FCR-TEKNISET", "FCR-reservin tekniset vaatimukset ja hyväksyttämisprosessi",
    "Taajuuden vakautusreservien (FCR) teknisten vaatimusten todentaminen ja hyväksyttämisprosessi. Automaattisten reserviresurssien (FFR, FCR, aFRR) säätöominaisuudet ja tekninen suorituskyky testataan esikvalifiointitesteissä.",
    "balancing", "2025", "2025-01-01", "https://www.fingrid.fi/globalassets/dokumentit/fi/sahkomarkkinat/reservit/fcr-liite2---teknisten-vaatimusten-todentaminen-ja-hyvaksyttamisprosessi.pdf"],

  ["FINGRID-AFRR-EHDOT", "aFRR-reservin ehdot ja edellytykset toimittajalle",
    "Ehdot ja edellytykset automaattisen taajuuden palautusreservin (aFRR) toimittajalle. Voimassa 5.6.2025 alkaen.",
    "balancing", "2025", "2025-06-05", "https://www.fingrid.fi/globalassets/dokumentit/fi/sahkomarkkinat/reservit/liite-1-afrr-ehdot-ja-edellytykset-automaattisen-taajuuden-palautusreservin-afrr-toimittajalle-voimassa-5.6.2025.pdf"],

  // --- Balance Service ---
  ["FINGRID-TASESOP-2021", "Tasesopimus (Balance Agreement)",
    "Fingridin tasesopimus tasevastaavien kanssa (voimassa 1.11.2021 alkaen). Avoin toimitus Fingridin ja tasevastaavan välillä sovitaan tasesopimuksella, jonka ehdot ovat julkiset ja yhtäläiset kaikille. Tasevastaava allekirjoittaa taseselvityssopimuksen eSett Oy:n kanssa.",
    "market_regulation", "2021", "2021-11-01", "https://www.fingrid.fi/en/electricity-market/balance-service/"],

  ["FINGRID-TASE-LIITE1-1", "Tasesopimuksen liite 1, osa 1 — Yleiset tasehallintaehdot",
    "Tasesopimuksen liite 1, osa 1: yleiset ehdot tasehallinnan osalta (voimassa 1.10.2025 alkaen).",
    "market_regulation", "2025", "2025-10-01", "https://www.fingrid.fi/en/electricity-market/balance-service/"],

  ["FINGRID-TASE-LIITE1-2", "Tasesopimuksen liite 1, osa 2 — Yleiset taseselvitysehdot",
    "Tasesopimuksen liite 1, osa 2: yleiset ehdot taseselvityksen osalta (voimassa 25.4.2025 alkaen).",
    "market_regulation", "2025", "2025-04-25", "https://www.fingrid.fi/en/electricity-market/balance-service/"],

  ["FINGRID-TASE-LIITE2", "Tasesopimuksen liite 2 — Maksukomponentit ja hinnoittelu",
    "Tasesopimuksen liite 2: maksukomponentit ja maksujen määräytymisperusteet (voimassa 1.10.2025 alkaen).",
    "market_regulation", "2025", "2025-10-01", "https://www.fingrid.fi/en/electricity-market/balance-service/"],

  ["FINGRID-ESETT", "eSett Oy — Pohjoismainen taseselvitys",
    "eSett Oy hoitaa sähkömarkkinoiden taseselvityksen Fingridin, Svenska kraftnätin ja Statnettin puolesta. Taseselvitysmalli uudistui 2021: erilliset tuotanto- ja kulutustaseet yhdistettiin yhteen taseeseen. Tasevastaavien on noudatettava kulloinkin voimassa olevaa Nordic Imbalance Settlement Handbook -käsikirjaa.",
    "market_regulation", "2021", "2021-05-01", "https://www.fingrid.fi/en/electricity-market/balance-service/imbalance-settlement/"],

  // --- Datahub ---
  ["FINGRID-DATAHUB", "Datahub — Sähkön vähittäismarkkinoiden keskitetty tiedonvaihtojärjestelmä",
    "Fingridin Datahub on sähkön vähittäismarkkinoiden keskitetty tiedonvaihtojärjestelmä. Datahub tallentaa tiedot noin 4 miljoonasta sähkön käyttöpaikasta. Noin 80 jakeluverkonhaltijaa, 80 sähkönmyyjää ja 60 palveluntarjoajaa käyttävät järjestelmää. Sähkömarkkinalain mukaan Datahub vastaa sähkömarkkinoiden asiakkaita ja sähkön laskentapisteitä koskevien tietojen ylläpidosta, myynti- ja jakelusopimusten tiedonvaihdosta sekä mittaustietojen tiedonvaihdosta. Järjestelmä otettiin käyttöön 21.2.2022.",
    "market_regulation", "2022", "2022-02-21", "https://www.fingrid.fi/en/electricity-market/datahub/"],

  // --- EU Network Codes (applicable in Finland) ---
  ["EU-CACM-2015/1222", "CACM-suuntaviiva — Kapasiteetin jakaminen ja ylikuormituksenhallinta",
    "EU:n CACM-suuntaviiva (komission asetus (EU) 2015/1222) edistää eurooppalaisten sähkömarkkinoiden yhtenäisyyttä varmistamalla, että maiden väliset siirtoyhteydet ovat markkinaosapuolten käytettävissä mahdollisimman tehokkaasti. Velvoittaa vähintään yhden nimetyn sähkömarkkinaoperaattorin (NEMO) per tarjousalue.",
    "market_regulation", "2015", "2015-08-14", "https://www.fingrid.fi/en/electricity-market/market-integration/network-codes/market-codes/"],

  ["EU-FCA", "FCA-suuntaviiva — Pitkän aikavälin kapasiteetin jakaminen",
    "EU:n FCA-suuntaviiva (hyväksytty 30.10.2015) luo puitteet pitkäaikaisille siirto-oikeuksille ja kapasiteetin jakamiselle pohjoismaissa.",
    "market_regulation", "2015", "2015-10-30", "https://www.fingrid.fi/en/electricity-market/market-integration/network-codes/market-codes/"],

  ["EU-EB-2017/2195", "EB-verkkosääntö — Sähkön tasehallinta",
    "EU:n sähkön tasehallintaverkkosääntö (komission asetus (EU) 2017/2195) edistää rajat ylittävää reservikauppaa ja yhdenmukaistaa taseselvitysmenettelyjä. Laajentaa tasesähkömarkkinat rajojen yli, ottaa käyttöön yhdenmukaiset eurooppalaiset tuotteet ja ehdottaa 15 minuutin taseselvitysjaksoja.",
    "market_regulation", "2017", "2017-12-18", "https://www.fingrid.fi/en/electricity-market/market-integration/network-codes/market-codes/"],

  ["EU-SOGL", "SOGL — Järjestelmän käytön suuntaviiva",
    "EU:n järjestelmän käytön suuntaviiva (System Operation Guideline) säätelee siirtoverkonhaltijoiden operatiivista toimintaa, taajuudenhallintaa, reservien mitoitusta ja tiedonvaihtoa.",
    "market_regulation", "2017", "2017-08-14", "https://www.fingrid.fi/en/electricity-market/market-integration/network-codes/"],

  ["EU-NC-ER", "Verkkosääntö hätätilanteista ja palautumisesta (Network Code on Emergency and Restoration)",
    "EU:n verkkosääntö sähköjärjestelmän hätätilanteista ja palautumisesta. Määrittelee menettelyt järjestelmähäiriö-, blackout- ja palautumistilanteissa.",
    "market_regulation", "2017", "2017-11-24", "https://www.fingrid.fi/en/electricity-market/market-integration/network-codes/"],

  ["EU-NC-RfG-2016/631", "Verkkosääntö voimalaitosten verkkoonliittämisvaatimuksista (NC RfG)",
    "EU:n verkkosääntö voimalaitosten verkkoonliittämisvaatimuksista (komission asetus (EU) 2016/631). VJV2024 ja SJV2024 perustuvat tähän verkkosääntöön Fingridin kansallisilla tarkennuksilla.",
    "technical_regulation", "2016", "2016-05-17", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32016R0631"],

  ["EU-NC-DCC", "Verkkosääntö kuormien liittämisvaatimuksista (NC DCC — Demand Connection Code)",
    "EU:n verkkosääntö kuormien liittämisvaatimuksista (Demand Connection Code). KJV perustuu tähän verkkosääntöön.",
    "technical_regulation", "2016", "2016-09-18", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32016R1388"],

  ["EU-NC-HVDC", "Verkkosääntö HVDC-yhteyksien vaatimuksista",
    "EU:n verkkosääntö HVDC-yhteyksien vaatimuksista. Fingridin HVDC-vaatimukset perustuvat tähän verkkosääntöön.",
    "technical_regulation", "2016", "2016-09-26", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32016R1447"],

  ["EU-REMIT-1227/2011", "REMIT-asetus — Energian tukkumarkkinoiden eheys ja läpinäkyvyys",
    "EU:n REMIT-asetus (EU) N:o 1227/2011 kieltää sisäpiiritiedon väärinkäytön ja markkinoiden manipuloinnin tukkuenergiamarkkinoilla. Energiavirasto valvoo Suomen tukkumarkkinoita ja ylläpitää CEREMP-rekisteriä.",
    "market_regulation", "2011", "2011-12-28", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32011R1227"],

  ["EU-TRANSPARENCY-543/2013", "Läpinäkyvyysasetus (EU) N:o 543/2013",
    "EU:n läpinäkyvyysasetus (komission asetus (EU) N:o 543/2013) velvoittaa siirtoverkonhaltijat julkaisemaan tuotanto-, kulutus- ja siirtokapasiteettitiedot ENTSO-E:n Transparency Platformilla.",
    "market_regulation", "2013", "2013-07-01", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32013R0543"],

  // --- Additional Fingrid operational documents ---
  ["FINGRID-RESERVI-KAUPPASOPIMUS", "Reservikaupan ja tiedonvaihdon ohje",
    "Fingridin reservikaupan ja tiedonvaihdon ohje reservintoimittajille. Ohje määrittelee tiedonvaihtoprosessit reservimarkkinoilla, signaalilistat reaaliaikaisille reservisignaaleille ja raportointivaatimukset.",
    "balancing", "2025", "2025-01-01", "https://www.fingrid.fi/en/electricity-market/reserves/reserve-markets/"],

  ["FINGRID-OSUUSVOIMA", "Osuusvoimalaitoksen taseselvitysohje",
    "Fingridin ohje osuusvoimalaitoksen taseselvityksestä yhteispohjoismaisessa taseselvitysmallissa. Osuusvoimalaitos on useamman omistajan yhteisesti omistama voimalaitos, jonka tuotanto jaetaan omistajien taseisiin.",
    "market_regulation", "2022", "2022-01-01", "https://www.fingrid.fi/globalassets/dokumentit/fi/palvelut/tasesahkokauppa-ja-taseselvitys/osuusvoimaohje.pdf"],

  ["FINGRID-ALKUPERATAKUU", "Sähkön alkuperätakuut — Fingridin rooli",
    "Fingrid toimii sähkön alkuperätakuujen myöntäjänä lain 1050/2021 nojalla. Alkuperätakuut ovat sähköisiä asiakirjoja, jotka todistavat sähkön tuotetun uusiutuvilla energialähteillä. Yksi alkuperätakuu vastaa yhtä megawattituntia (MWh) tuotettua sähköä.",
    "market_regulation", "2022", "2022-01-01", "https://www.fingrid.fi/en/electricity-market/guarantees-of-origin/"],

  ["FINGRID-SAHKOMARKKINAT-LAKI", "Sähkömarkkinalainsäädäntö — Fingridin näkökulmasta",
    "Fingridin toimintaa säätelevä lainsäädäntökehys. Sähkömarkkinalaki (588/2013, muutoksineen 497/2023) määrittelee kantaverkonhaltijan tehtävät ja velvollisuudet. EU:n sähkömarkkina-asetus (EU) 2019/943 ja sähkömarkkinadirektiivi (EU) 2019/944 asettavat eurooppalaiset puitteet.",
    "market_regulation", "2023", "2023-07-01", "https://www.fingrid.fi/en/electricity-market/"],

  ["FINGRID-LOISTEHORESERVI", "Loistehon toimitus ja loistehoreservien ylläpito",
    "Fingridin kantaverkkosopimukseen kuuluvat loistehon toimituksen ja loistehoreservien ylläpidon ehdot. Liittyjien on ylläpidettävä riittävät loistehoreservit verkon jännitteen hallitsemiseksi.",
    "technical_regulation", "current", "2025-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/grid-code-specifications/"],

  ["FINGRID-REAALIAIKAINEN-TIEDONVAIHTO", "Reaaliaikainen tiedonvaihto kantaverkossa",
    "Fingridin vaatimukset reaaliaikaisesta tiedonvaihdosta kantaverkon asiakkaille. Tiedonvaihtoa tarvitaan järjestelmäturvallisuuden ylläpitämiseksi. Vaihtovälit 4–60 sekuntia riippuen tiedon tyypistä.",
    "technical_regulation", "current", "2025-01-01", "https://www.fingrid.fi/en/grid/grid-connection-agreement-phases/grid-code-specifications/"],

  ["EU-ELECTRICITY-REGULATION-2019/943", "Sähkömarkkina-asetus (EU) 2019/943",
    "EU:n sähkömarkkina-asetus (EU) 2019/943 luo puitteet EU:n sähkön sisämarkkinoille. Asetus säätelee rajat ylittävää sähkökauppaa, kapasiteettimekanismeja, pullonkaulatulojen käyttöä ja sähkön tukkumarkkinoiden toimintaa. Suoraan sovellettava asetus Suomessa.",
    "market_regulation", "2019", "2019-07-04", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32019R0943"],

  ["EU-ELECTRICITY-DIRECTIVE-2019/944", "Sähkömarkkinadirektiivi (EU) 2019/944",
    "EU:n sähkömarkkinadirektiivi (EU) 2019/944 säätelee sähkön tuotantoa, siirtoa, jakelua ja toimitusta. Direktiivi sisältää säännökset kuluttajien oikeuksista, aktiivisista asiakkaista, aggregaattoreista, energiayhteisöistä ja jakeluverkonhaltijoiden joustavuuspalveluista. Toteuttava laki: sähkömarkkinalain muutos 497/2023.",
    "market_regulation", "2019", "2019-07-04", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32019L0944"],

  ["EU-GAS-REGULATION-2024/1789", "Kaasumarkkina-asetus (EU) 2024/1789",
    "EU:n uusi kaasumarkkina-asetus (EU) 2024/1789 säätelee maakaasun, vedyn ja dekarbonisoidun kaasun sisämarkkinoita. Asetus edellyttää siirtoverkonhaltijoiden tulomenetelmien julkaisua 1.8.2025 mennessä. Suomen maakaasuverkon TSO Gasgrid Finland Oy noudattaa asetusta.",
    "market_regulation", "2024", "2024-07-15", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32024R1789"],

  ["EU-NIS2-2022/2555", "NIS2-direktiivi (EU) 2022/2555",
    "EU:n NIS2-direktiivi (EU) 2022/2555 yhdenmukaistaa kyberturvallisuusvaatimuksia EU:ssa. Energiasektori (sähkö, kaukolämpö, kaasu, öljy, vety) kuuluu keskeisiin toimialoihin. Suomessa Energiavirasto valvoo energia-alan kyberturvallisuutta. Kansallinen toimeenpano kyberturvallisuuslaki tuli voimaan 8.4.2025.",
    "market_regulation", "2022", "2023-01-16", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32022L2555"],

  ["EU-RED-II-2018/2001", "Uusiutuvan energian direktiivi (EU) 2018/2001 (RED II)",
    "EU:n uusiutuvan energian direktiivi (RED II) asettaa tavoitteen uusiutuvan energian osuudelle EU:n energiankulutuksesta. RED II toteuttava lainsäädäntö Suomessa: laki energian alkuperätakuista (1050/2021), laki uusiutuvan energian tuotantolaitosten lupamenettelyistä (1145/2020), sähkömarkkinalain muutos (497/2023).",
    "market_regulation", "2018", "2018-12-21", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32018L2001"],

  ["EU-RED-III-2023/2413", "Uusiutuvan energian direktiivi (EU) 2023/2413 (RED III)",
    "EU:n uusiutuvan energian direktiivin muutos (RED III) nostaa uusiutuvan energian tavoitteen 42,5 %:iin vuoteen 2030. Kansallinen toimeenpano käynnissä. Suomen uusiutuvan energian osuus jo yli 40 %.",
    "market_regulation", "2023", "2023-11-20", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32023L2413"],

  ["EU-EED-2023/1791", "Energiatehokkuusdirektiivi (EU) 2023/1791",
    "EU:n energiatehokkuusdirektiivi (uudelleenlaadittu) asettaa EU:n energiatehokkuustavoitteet. Suomen kansallinen toimeenpano: energiatehokkuuslaki (1429/2014) ja sen muutos (HE 85/2025). Suuryritysten energiakatselmusvelvoite, energianhallintajärjestelmät, julkisen sektorin energiansäästövelvoite.",
    "market_regulation", "2023", "2023-10-11", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32023L1791"],

  ["EU-EPBD-2024/1275", "Rakennusten energiatehokkuusdirektiivi (EU) 2024/1275 (EPBD uudelleenlaadittu)",
    "EU:n rakennusten energiatehokkuusdirektiivi (EPBD, uudelleenlaadittu) tuli voimaan 28.5.2024. Kansallinen toimeenpano 24 kk kuluessa. Direktiivi asettaa uudet vaatimukset nollapäästörakennuksille, energiatodistuksille, sähköajoneuvojen latausinfrastruktuurille ja rakennusten automaatiojärjestelmille. Suomen toimeenpano: ympäristöministeriö.",
    "market_regulation", "2024", "2024-05-28", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32024L1275"],

  ["EU-AFIR-2023/1804", "Vaihtoehtoisten polttoaineiden infrastruktuuri-asetus (EU) 2023/1804 (AFIR)",
    "EU:n AFIR-asetus asettaa vähimmäisvaatimukset sähköajoneuvojen julkiselle latausinfrastruktuurille ja vetytankkausasemille EU:n TEN-T-verkolla. Suomen kansallinen toimeenpano: laki liikenteen palveluista (1087/2023). Energiavirasto hallinnoi liikenteen infrastruktuuritukia.",
    "market_regulation", "2023", "2023-10-13", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32023R1804"],

  ["EU-ETS-DIRECTIVE-2003/87", "Päästökauppadirektiivi 2003/87/EY (Fit for 55 muutoksineen)",
    "EU:n päästökauppadirektiivi 2003/87/EY (viimeksi muutettu direktiivillä (EU) 2023/959 osana Fit for 55 -pakettia) on EU:n päästökauppajärjestelmän (EU ETS) perussäädös. Suomen kansallinen toimeenpano: päästökauppalaki (1270/2023). Energiavirasto toimii Suomen päästökauppaviranomaisena. EU ETS kattaa noin 600 laitosta Suomessa.",
    "market_regulation", "2003", "2005-01-01", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32003L0087"],

  ["EU-GOVERNANCE-2018/1999", "EU:n hallintoasetus (EU) 2018/1999 — Energiaunionin ja ilmastotoimien hallinto",
    "EU:n hallintoasetus (EU) 2018/1999 velvoittaa jäsenvaltiot laatimaan kansalliset energia- ja ilmastosuunnitelmat (NECP) ja raportoimaan säännöllisesti edistymisestä. Suomen NECP toimitettu komissiolle 2024.",
    "market_regulation", "2018", "2018-12-21", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32018R1999"],

  ["EU-REMIT-1348/2014", "REMIT-täytäntöönpanoasetus (EU) N:o 1348/2014",
    "EU:n REMIT-täytäntöönpanoasetus (EU) N:o 1348/2014 tarkentaa tukkuenergia-alan markkinaosapuolten kauppatapahtumien ja perustietojen raportointivelvoitteita ACER:ille. Energiavirasto valvoo raportointivelvoitteiden noudattamista Suomessa.",
    "market_regulation", "2014", "2015-04-07", "https://eur-lex.europa.eu/legal-content/FI/TXT/?uri=CELEX:32014R1348"],
];

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

const allDecisions: string[][] = [
  // --- Network Pricing / Revenue Cap Decisions ---
  ["EV-VM-2023-12-29", "Sähkön jakeluverkkotoiminnan hinnoittelun valvontamenetelmien vahvistaminen 2024–2031",
    "Energiavirasto vahvisti 29.12.2023 sähkö- ja maakaasuverkkotoiminnan hinnoittelun kohtuullisuuden valvontamenetelmät vuosille 2024–2031. Uusissa valvontamenetelmissä korostuu kustannusvastaavuus, verkonhaltijoiden tasapuolinen kohtelu investointien rahoituksessa sekä voimassa olevan lainsäädännön tavoitteiden ja hengen toteuttaminen.",
    "methodology", "2023-12-29", "Energiavirasto", "https://energiavirasto.fi/-/uudet-hinnoittelun-kohtuullisuuden-valvontamenetelmat-julkaistaan-29.12"],

  ["MO-2025-11-21", "Markkinaoikeus hylkäsi verkkoyhtiöiden valitukset valvontamenetelmistä 2024–2031",
    "Markkinaoikeus hylkäsi 21.11.2025 kaikki verkkoyhtiöiden valitukset Energiaviraston vahvistamista sähkö- ja maakaasuverkkotoiminnan valvontamenetelmistä vuosille 2024–2031. Päätös vahvistaa Energiaviraston valvontamenetelmien oikeellisuuden.",
    "methodology", "2025-11-21", "Markkinaoikeus, verkkoyhtiöt", "https://energiavirasto.fi/-/markkinaoikeus-hylkasi-verkkoyhtioiden-valitukset-hinnoittelun-valvontamenetelmista-vuosille-2024-2031"],

  // --- Electricity Distribution Decisions ---
  ["3899/040201/2025", "Eriytetyn liiketoiminnan tilinpäätöslomakkeet — Satavakka Oy (2025)",
    "Energiaviraston päätös eriytetyn liiketoiminnan tilinpäätöslomakkeista ja lisätiedoista, Satavakka Oy.",
    "revenue_cap", "2025-01-01", "Satavakka Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["3855/040201/2024", "Eriytetyn liiketoiminnan tilinpäätöslomakkeet — Satavakka Oy (2024)",
    "Energiaviraston päätös eriytetyn liiketoiminnan tilinpäätöslomakkeista ja lisätiedoista, Satavakka Oy.",
    "revenue_cap", "2024-01-01", "Satavakka Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["4387/040303/2024", "Fingrid Oyj:n siirtopalveluehtojen vahvistaminen",
    "Energiaviraston päätös Fingrid Oyj:n siirtopalveluehtojen vahvistamisesta.",
    "tariff", "2025-01-01", "Fingrid Oyj", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["2602/040003/2025", "Pullonkaulatulojen käyttöpäätös 2026 — Fingrid Oyj",
    "Energiaviraston päätös pullonkaulatulojen käytöstä vuonna 2026, Fingrid Oyj. Pullonkaulatuloja syntyy rajat ylittävässä sähkönkaupassa, kun siirtokapasiteetti on rajoitettua.",
    "revenue_cap", "2025-01-01", "Fingrid Oyj", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  // --- Gas Network Decisions ---
  ["3367/050304/2025", "Hamina LNG Oy:n ehdot ja tariffit 2026",
    "Energiaviraston päätös Hamina LNG Oy:n LNG-terminaalin käyttöehdoista ja tariffista vuodelle 2026.",
    "tariff", "2025-01-01", "Hamina LNG Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["3360/050304/2025", "Gasum LNG Oy:n ehdot ja tariffit 2026–2027",
    "Energiaviraston päätös Gasum LNG Oy:n LNG-terminaalin käyttöehdoista ja tariffista vuosille 2026–2027.",
    "tariff", "2025-01-01", "Gasum LNG Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["1984/050304/2025", "Floating LNG Terminal Finland Oy:n käyttöehdot 2026",
    "Energiaviraston päätös Floating LNG Terminal Finland Oy:n Inkoon kelluvan LNG-terminaalin käyttöehdoista vuodelle 2026.",
    "tariff", "2025-01-01", "Floating LNG Terminal Finland Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  // --- Market Supervision Decisions ---
  ["EV-2025-KINECT", "Päätös virheellisestä tarjouksesta day-ahead-markkinoilla — Kinect Energy Sweden AB",
    "Energiaviraston päätös virheellisestä tarjouksesta sähkön day-ahead-markkinoilla, Kinect Energy Sweden AB.",
    "market_monitoring", "2025-01-01", "Kinect Energy Sweden AB", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["2037/040000/2025", "Päätös suojausmahdollisuuksista Suomi-Ruotsi-tarjousaluerajalla",
    "Energiaviraston päätös suojausmahdollisuuksista (hedging options) Suomen ja Ruotsin välisellä tarjousaluerajalla.",
    "methodology", "2025-01-01", "Energiavirasto", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  ["1953/040202/2022", "Toimitusvelvollisuuspäätös — Vaasan Sähkö Oy",
    "Energiaviraston päätös sähkön toimitusvelvollisuudesta, Vaasan Sähkö Oy. Toimitusvelvollisuus edellyttää kohtuullista hinnoittelua kuluttajille.",
    "complaint", "2025-01-01", "Vaasan Sähkö Oy", "https://energiavirasto.fi/paatokset-ja-maaraykset"],

  // --- Flexibility Services ---
  ["EV-2025-JOUSTO-HELEN", "Joustopalveluiden hankintaehtojen vahvistaminen — Helen Sähköverkko Oy",
    "Energiavirasto vahvisti 11.4.2025 ensimmäiset jakeluverkonhaltijan joustopalveluiden hankintaehdot Helen Sähköverkko Oy:lle. Sähkömarkkinalain (497/2023) mukaan verkonhaltija voi hankkia joustopalveluita verkon kehittämisen vaihtoehtona.",
    "methodology", "2025-04-11", "Helen Sähköverkko Oy", "https://energiavirasto.fi/-/energiavirasto-on-vahvistanut-ensimmaiset-verkonhaltijoiden-joustopalveluiden-hankintaehdot"],

  ["EV-2025-JOUSTO-FINGRID", "Joustopalveluiden hankintaehtojen vahvistaminen — Fingrid Oyj",
    "Energiavirasto vahvisti 11.4.2025 ensimmäiset joustopalveluiden hankintaehdot Fingrid Oyj:lle.",
    "methodology", "2025-04-11", "Fingrid Oyj", "https://energiavirasto.fi/-/energiavirasto-on-vahvistanut-ensimmaiset-verkonhaltijoiden-joustopalveluiden-hankintaehdot"],

  // --- Supply Reliability ---
  ["EV-2025-TOIMITUSVARMUUS", "Pitkäjänteinen verkon kehittäminen on parantanut sähkön jakelun toimitusvarmuutta",
    "Energiaviraston arvio sähkön jakelun toimitusvarmuuden kehittymisestä. Verkkoyhtiöiden pitkäjänteinen kehittämistyö on parantanut sähkönjakelun luotettavuutta. Toimitusvarmuusmittarit SAIDI, SAIFI ja CAIDI ovat parantuneet.",
    "benchmark", "2025-01-01", "Energiavirasto", "https://energiavirasto.fi/-/pitkajanteinen-verkon-kehittaminen-on-parantanut-sahkon-jakelun-toimitusvarmuutta"],

  // --- VJV/SJV Confirmation ---
  ["EV-2025-VJV-SJV", "Päätös Fingrid Oyj:n VJV2024- ja SJV2024-vaatimusten vahvistamisesta",
    "Energiavirasto vahvisti 20.3.2025 Fingrid Oyj:n voimalaitosten (VJV2024) ja sähkövarastojen (SJV2024) järjestelmätekniset vaatimukset. Vaatimukset koskevat kaikkia voimalaitoksia ja sähkövarastoja, joiden nimellisteho on vähintään 0,8 kW.",
    "methodology", "2025-03-20", "Fingrid Oyj", "https://www.fingrid.fi/globalassets/dokumentit/fi/palvelut/kulutuksen-ja-tuotannon-liittaminen-kantaverkkoon/paatos-fingrid-oyjn-voimalaitosten-ja-sahkovarastojen-jarjestelmateknisten-vaatimusten-vjv-2024-ja-sjv-2024-vahvistamisesta.pdf"],

  // --- Second connection ---
  ["EV-2025-TOINEN-LIITTYMA", "Ohjeistus toisen sähköliittymän tarjoamisesta asiakkaille",
    "Energiavirasto ohjeistaa jakeluverkonhaltijoita tarjoamaan toisen sähköliittymän asiakkaille. Ohjeistus liittyy sähkövarastojen ja aurinkopaneelien yleistymiseen, jolloin asiakkaat voivat tarvita toisen liittymän tuotantoa varten.",
    "methodology", "2025-01-01", "Energiavirasto", "https://energiavirasto.fi/-/energiavirasto-ohjeistaa-tarjoamaan-toisen-sahkoliittyman-asiakkaille"],

  // --- Emissions Trading ---
  ["EV-PAASTOKAUPPA-LUPA", "Päästölupien hallinta ja päästöoikeuksien myöntäminen",
    "Energiavirasto toimii päästökauppaviranomaisena. Virasto myöntää päästölupia, hallinnoi päästöoikeuksia, valvoo vuosittaista päästöraporttointia ja hallinnoi päästökaupparekisteriä. EU ETS kattaa noin 600 laitosta Suomessa.",
    "methodology", "2024-01-01", "Energiavirasto", "https://energiavirasto.fi/paastokauppa"],

  // --- Renewable Energy Support ---
  ["EV-TUOTANTOTUKI-2025", "Syöttötariffitukien tilanne 2025",
    "Energiaviraston raportti syöttötariffitukijärjestelmän tilanteesta. Ensimmäinen tuulivoimala tippui pois syöttötariffituelta 12 vuoden tukijakson täyttyessä. Syöttötariffijärjestelmä on suljettu uusilta laitoksilta. Tukea hallinnoidaan SATU-järjestelmän kautta.",
    "benchmark", "2025-01-01", "Energiavirasto", "https://energiavirasto.fi/-/ensimmainen-tuulivoimala-tippui-pois-syottotariffituelta"],

  ["EV-METSAHAKE-2019", "Metsähakkeella tuotetun sähkön tuotantotuki — ei makseta tariffijaksolta 1/2019",
    "Energiaviraston päätös, ettei metsähakkeella tuotetun sähkön tuotantotukea makseta tariffijaksolta 1/2019 päästöoikeuksien hintatason vuoksi. Päästöoikeuksien hinta vaikuttaa metsähakesähkön tukitasoon.",
    "tariff", "2019-04-01", "Energiavirasto", "https://energiavirasto.fi/-/metsahakkeella-tuotetun-sahkon-tuotantotukea-ei-makseta-tariffijaksolta-1-2019"],

  // --- Cybersecurity (NIS2) ---
  ["EV-KYBER-VERKKOSAANTO", "Uusi verkkosääntö rajat ylittävän sähkönsiirron kyberturvallisuudesta",
    "Energiaviraston tiedote uudesta EU:n verkkosäännöstä, joka parantaa rajat ylittävän sähkönsiirron kyberturvallisuutta. Verkkosääntö asettaa kyberturvallisuusvaatimukset sähköjärjestelmän operatiivisille järjestelmille.",
    "methodology", "2025-01-01", "Energiavirasto", "https://energiavirasto.fi/-/uusi-verkkosaanto-parantaa-rajat-ylittavan-sahkonsiirron-kyberturvallisuutta"],

  // --- Network code authority decisions (Fingrid/ACER via Energiavirasto) ---
  ["ACER-11/2025", "ACER Decision No 11/2025 — Intraday cross-zonal gate times",
    "ACER-päätös N:o 11/2025 päivän sisäisten rajat ylittävien kaupankäyntiaikojen muuttamisesta CACM-suuntaviivan nojalla.",
    "methodology", "2025-12-19", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-10/2025", "ACER Decision No 10/2025 — Capacity calculation regions",
    "ACER-päätös N:o 10/2025 kapasiteetinlaskenta-alueiden uudelleenmäärityksestä CACM-suuntaviivan nojalla.",
    "methodology", "2025-12-16", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-01/2025", "ACER Decision No 01/2025 — Harmonised cross-zonal allocation (EB)",
    "ACER-päätös N:o 01/2025 yhdenmukaistetusta rajat ylittävästä kapasiteetin jakamisesta EB-suuntaviivan nojalla.",
    "methodology", "2025-01-29", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-12/2024", "ACER Decision No 12/2024 — Day-ahead coupling methodology",
    "ACER-päätös N:o 12/2024 day-ahead-markkinoiden yhdistämismenetelmästä CACM-suuntaviivan nojalla.",
    "methodology", "2024-09-25", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-09/2024", "ACER Decision No 09/2024 — Balancing energy pricing (2nd amendment)",
    "ACER-päätös N:o 09/2024 tasesähkön hinnoittelumenetelmän toisesta muutoksesta EB-suuntaviivan nojalla.",
    "methodology", "2024-07-05", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-08/2024", "ACER Decision No 08/2024 — aFRR platform framework (2nd amendment)",
    "ACER-päätös N:o 08/2024 aFRR-alustan kehyksen toisesta muutoksesta EB-suuntaviivan nojalla.",
    "methodology", "2024-07-05", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-FRR-SIZING-2023", "Taajuuden palautusreservin mitoitus (Pohjoismaat)",
    "Pohjoismainen päätös taajuuden palautusreservin (FRR) mitoitussäännöistä SOGL-suuntaviivan nojalla.",
    "methodology", "2023-04-06", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-FCR-FEATURES-2023", "FCR:n lisäominaisuudet (Pohjoismaat)",
    "Pohjoismainen päätös FCR:n lisäominaisuuksista (additional features) SOGL-suuntaviivan nojalla.",
    "methodology", "2023-03-22", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-FCR-SIZING-2023", "FCR:n mitoitussäännöt (Pohjoismaat)",
    "Pohjoismainen päätös FCR:n mitoitussäännöistä SOGL-suuntaviivan nojalla.",
    "methodology", "2023-03-22", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-BALTIC-CCR-DA-2024", "Baltic CCR day-ahead capacity calculation",
    "Energiaviraston päätös Baltian kapasiteetinlaskenta-alueen day-ahead-kapasiteetinlaskennasta CACM-suuntaviivan nojalla.",
    "methodology", "2024-11-21", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-FI-SE-HEDGING-2025", "Suojausmahdollisuudet Suomi-Ruotsi-rajalla",
    "Energiaviraston päätös suojausmahdollisuuksista Suomen ja Ruotsin välisellä rajalla FCA-suuntaviivan nojalla.",
    "methodology", "2025-12-01", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-RESERVE-15MIN-2023", "Reservintoimittajan 15 minuutin selvitysjakson ehdot",
    "Energiaviraston päätös reservintoimittajan 15 minuutin selvitysjakson ehdoista EBGL:n nojalla.",
    "methodology", "2023-02-17", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  // --- Guarantee of Origin ---
  ["EV-ALKUPERATAKUU", "Sähkön alkuperätakuujärjestelmä",
    "Energiaviraston hallinnoima sähkön alkuperätakuujärjestelmä. Alkuperätakuulain (1050/2021) mukaisesti Fingrid toimii sähkön alkuperätakuujen myöntäjänä. Alkuperätakuut varmentavat uusiutuvilla energialähteillä tuotetun sähkön alkuperän.",
    "methodology", "2021-12-03", "Fingrid Oyj", "https://energiavirasto.fi/en/guarantee-of-origin"],

  // --- Network licensing ---
  ["EV-VERKKOLUVANVARAISUUS", "Verkkotoiminnan luvanvaraisuus",
    "Sähkö- ja maakaasuverkkojen toiminta on Suomessa luvanvaraista. Energiavirasto myöntää sähköverkkoluvat jakeluverkonhaltijoille ja suurjännitteisen jakeluverkon haltijoille. Fingrid Oyj:n kantaverkkoluvasta säädetään sähkömarkkinalaissa.",
    "methodology", "2013-09-01", "Energiavirasto", "https://energiavirasto.fi/verkkotoiminnan-luvanvaraisuus"],

  // --- Additional ACER decisions from Fingrid network code authority decisions page ---
  ["ACER-16/2023", "ACER Decision No 16/2023 — Congestion income distribution (CACM)",
    "ACER-päätös N:o 16/2023 pullonkaulatulojen jakamisesta CACM-suuntaviivan nojalla.",
    "methodology", "2023-12-21", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-11/2023", "ACER Decision No 11/2023 — Harmonised cross-zonal allocation (EB)",
    "ACER-päätös N:o 11/2023 yhdenmukaistetusta rajat ylittävästä kapasiteetin jakamisesta EB-suuntaviivan nojalla.",
    "methodology", "2023-07-19", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-10/2023", "ACER Decision No 10/2023 — Day-ahead scheduled exchanges (CACM)",
    "ACER-päätös N:o 10/2023 day-ahead-markkinoiden suunnitelluista energiavaihdoista CACM-suuntaviivan nojalla.",
    "methodology", "2023-05-30", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-08/2023", "ACER Decision 8-2023 — Capacity calculation regions (CACM)",
    "ACER-päätös 8/2023 kapasiteetinlaskenta-alueiden uudelleenmäärityksestä CACM-suuntaviivan nojalla.",
    "methodology", "2023-03-31", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-07/2023", "ACER Decision 07-2023 — FRC methodology (FCA)",
    "ACER-päätös 07/2023 pitkän aikavälin kapasiteetin jakamismenetelmästä FCA-suuntaviivan nojalla.",
    "methodology", "2023-03-22", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-16/2022", "ACER Decision 16-2022 — Imbalance netting framework (EB)",
    "ACER-päätös 16/2022 epätasapainon nettoutuksen kehyksestä EB-suuntaviivan nojalla.",
    "methodology", "2022-09-30", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-15/2022", "ACER Decision 15-2022 — aFRR platform framework (EB)",
    "ACER-päätös 15/2022 aFRR-alustan kehyksestä EB-suuntaviivan nojalla.",
    "methodology", "2022-09-30", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-14/2022", "ACER Decision 14-2022 — mFRR platform framework (EB)",
    "ACER-päätös 14/2022 mFRR-alustan kehyksestä EB-suuntaviivan nojalla.",
    "methodology", "2022-09-30", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-10/2022", "ACER Decision 10-2022 — Congestion income distribution (FCA)",
    "ACER-päätös 10/2022 pullonkaulatulojen jakamisesta FCA-suuntaviivan nojalla.",
    "methodology", "2022-07-18", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-03/2022", "ACER Decision 03-2022 — Pricing balancing energy (EB)",
    "ACER-päätös 03/2022 tasesähkön hinnoittelumenetelmästä EB-suuntaviivan nojalla.",
    "methodology", "2022-02-25", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-16/2021", "ACER Decision 16-2021 — Congestion income distribution (CACM)",
    "ACER-päätös 16/2021 pullonkaulatulojen jakamisesta CACM-suuntaviivan nojalla.",
    "methodology", "2021-12-17", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-15/2021", "ACER Decision 15/2021 — Long-term allocation rules (FCA)",
    "ACER-päätös 15/2021 pitkän aikavälin kapasiteetin jakamissäännöistä FCA-suuntaviivan nojalla.",
    "methodology", "2021-11-29", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-29/2020", "ACER Decision 29-20 — Bidding zone review",
    "ACER-päätös 29/2020 tarjousalueiden uudelleenarvioinnista.",
    "methodology", "2020-11-24", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-38/2020", "ACER Decision 38-20 — Congestion income use methodology",
    "ACER-päätös 38/2020 pullonkaulatulojen käyttömenetelmästä.",
    "methodology", "2020-12-23", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-MFRR-2020", "mFRR-palveluehdot (Pohjoismaat) 2020",
    "Pohjoismainen päätös manuaalisen taajuuden palautusreservin (mFRR) palveluehdoista.",
    "methodology", "2020-12-21", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-FCR-ENERGY-2020", "FCR-energian selvityssäännöt (Pohjoismaat) 2020",
    "Pohjoismainen päätös FCR-energian vaihtoselvityssäännöistä EB-suuntaviivan nojalla.",
    "methodology", "2020-05-26", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-16/2019", "ACER Decision 16-2019 — Nordic CCR long-term capacity (FCA)",
    "ACER-päätös 16/2019 Pohjoismaisen CCR:n pitkän aikavälin kapasiteetista FCA-suuntaviivan nojalla.",
    "methodology", "2019-10-30", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-CCR-DA-2019", "Nordic CCR capacity calculation methodology (CACM) 2019",
    "Pohjoismaisen CCR:n kapasiteetinlaskentamenetelmä CACM-suuntaviivan nojalla.",
    "methodology", "2019-10-25", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-NC-ER-SIGNIFICANT-2019", "Merkittävien verkonkäyttäjien tunnistaminen (NC ER)",
    "Energiaviraston päätös merkittävien verkonkäyttäjien tunnistamisesta NC ER -verkkosäännön nojalla.",
    "methodology", "2019-06-18", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-NC-ER-RESTORATION-2019", "Järjestelmän palautuspalvelun tarjoajan ehdot (NC ER)",
    "Energiaviraston päätös järjestelmän palautuspalvelun tarjoajan ehdoista NC ER -verkkosäännön nojalla.",
    "methodology", "2019-06-11", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-NC-ER-SUSPENSION-2019", "Markkinatoiminnan väliaikaisen keskeyttämisen säännöt (NC ER)",
    "Energiaviraston päätös markkinatoiminnan väliaikaisen keskeyttämisen säännöistä NC ER -verkkosäännön nojalla.",
    "methodology", "2019-06-11", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-04/2019", "ACER Decision 04-2019 — CCR amendments (CACM)",
    "ACER-päätös 04/2019 kapasiteetinlaskenta-alueiden muutoksista CACM-suuntaviivan nojalla.",
    "methodology", "2019-04-01", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-01/2019", "ACER Decision 01-2019 — Intraday capacity pricing (CACM)",
    "ACER-päätös 01/2019 päivän sisäisen kapasiteetin hinnoittelumenetelmästä CACM-suuntaviivan nojalla.",
    "methodology", "2019-01-24", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-07/2017", "ACER Decision 07-2017 — Congestion income distribution (CACM)",
    "ACER-päätös 07/2017 pullonkaulatulojen jakamisesta CACM-suuntaviivan nojalla.",
    "methodology", "2017-12-14", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-06/2016", "ACER Decision 06-2016 — Capacity calculation regions",
    "ACER-päätös 06/2016 kapasiteetinlaskenta-alueiden määrittämisestä.",
    "methodology", "2016-11-17", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["ACER-07/2024", "ACER Decision No 07/2024 — Operational security analysis coordination (ETSO)",
    "ACER-päätös 07/2024 operatiivisen turvallisuusanalyysin koordinoinnista ETSO-suuntaviivan nojalla.",
    "methodology", "2024-05-13", "ACER", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-RAMP-RATE-2024", "Active power ramp rate limitations (2024)",
    "Energiaviraston päätös pätötehon ramppinopeusrajoituksista ETSO-suuntaviivan nojalla.",
    "methodology", "2024-02-01", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-BALTIC-EB-2024", "Baltic CCR balancing energy cross-zonal capacity (2024)",
    "Energiaviraston päätös Baltian CCR:n tasesähkön rajat ylittävästä kapasiteetista EB-suuntaviivan nojalla.",
    "methodology", "2024-01-29", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-CCR-EB-2023", "Nordic CCR market-based sharing process (EB Art. 41)",
    "Pohjoismaisen CCR:n markkinapohjainen kapasiteetin jakamisprosessi EB-suuntaviivan artiklan 41 nojalla.",
    "methodology", "2023-10-23", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["NORDIC-CCR-EB-XZONAL-2023", "Nordic CCR balancing energy cross-zonal capacity (2023)",
    "Pohjoismaisen CCR:n tasesähkön rajat ylittävä kapasiteetti EB-suuntaviivan nojalla.",
    "methodology", "2023-10-16", "Fingrid, Svenska kraftnät, Statnett, Energinet", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],

  ["EV-BALTIC-EB-41-2023", "Baltic CCR market-based capacity sharing (EB Art. 41)",
    "Energiaviraston päätös Baltian CCR:n markkinapohjaisesta kapasiteetin jakamisesta EB-suuntaviivan artiklan 41 nojalla.",
    "methodology", "2023-09-29", "Energiavirasto", "https://www.fingrid.fi/sahkomarkkinat/markkinoiden-yhtenaisyys/verkkosaannot/verkkosantojen-viranomaispaatokset/"],
];

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
  finlex: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'finlex'").get() as { n: number }).n,
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
console.log(`  Regulations:        ${stats.regulations} (Finlex: ${stats.finlex}, EV: ${stats.ev}, Tukes: ${stats.tukes}, TEM: ${stats.tem})`);
console.log(`  Grid codes:         ${stats.grid_codes} (Fingrid)`);
console.log(`  Decisions:          ${stats.decisions} (Energiavirasto + ACER)`);
console.log(`  Total documents:    ${stats.regulations + stats.grid_codes + stats.decisions}`);
console.log(`\nDone. Database at ${DB_PATH}`);

db.close();
