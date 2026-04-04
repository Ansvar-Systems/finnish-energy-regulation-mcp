# Coverage -- Finnish Energy Regulation MCP

Current coverage of Finnish energy sector regulatory data.

**Last updated:** 2026-04-04

---

## Sources

| Source | Authority | Records | Content |
|--------|-----------|---------|---------|
| **Finlex** | Finnish legislation database | 59 regulations | Sahkomarkkinalaki (588/2013), maakaasumarkkinalaki, energiatehokkuuslaki, energy acts |
| **Energiavirasto** | Energy Authority | 32 regulations | Network pricing methodology, market monitoring rules, emissions trading, metering |
| **TEM** | Ministry of Economic Affairs and Employment | 22 regulations | Energy policy, climate targets, renewable energy support, energy efficiency |
| **Tukes** | Safety and Chemicals Agency | 19 regulations | Electrical safety, gas safety, pressure equipment, product safety |
| **Fingrid** | Finnish TSO | 53 grid codes | Frequency regulation, reserve markets, Datahub requirements, grid connection, balancing |
| **Energiavirasto (decisions)** | Energy Authority | 66 decisions | Network pricing, methodology approvals, emissions trading, tariff determinations |
| **Total** | | **251 records** | ~328 KB SQLite database |

---

## Regulation Types

| Type | Finnish Term | Count | Regulators |
|------|-------------|-------|------------|
| `ohje` | Ohje (Guidance) | 55 | Energiavirasto, TEM, Tukes |
| `laki` | Laki (Act) | 35 | Finlex |
| `asetus` | Asetus (Decree) | 24 | Finlex, TEM |
| `maarays` | Maarays (Order/Regulation) | 18 | Energiavirasto, Tukes |

## Grid Code Types

| Type | Description | Count |
|------|-------------|-------|
| `market_regulation` | Market rules for electricity trading, Datahub, and settlement | 28 |
| `balancing` | Balancing market rules, frequency reserves (FCR, aFRR, mFRR) | 11 |
| `technical_regulation` | Technical requirements for generation, consumption, and storage | 10 |
| `grid_connection` | Grid connection requirements for transmission and distribution | 4 |

## Decision Types

| Type | Description | Count |
|------|-------------|-------|
| `methodology` | Methodology approvals for network pricing and emissions trading | 54 |
| `tariff` | Network tariff (siirtohinta) approvals | 5 |
| `revenue_cap` | Revenue cap determinations for network operators | 3 |
| `benchmark` | Benchmarking of network operator efficiency | 2 |
| `complaint` | Consumer and industry complaint rulings | 1 |
| `market_monitoring` | Market monitoring and surveillance reports | 1 |

---

## What Is NOT Included

This is a seed dataset. The following are not yet covered:

- **Full text of original documents** -- records contain summaries, not complete legal text from finlex.fi
- **Court decisions** -- Hallinto-oikeus and KHO energy rulings are not included
- **Historical and repealed regulations** -- only current in-force regulations are covered
- **EU energy directives** -- EU Electricity Directive, Gas Directive, Renewable Energy Directive, etc. are covered by the [EU Regulations MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP), not this server
- **Parliamentary proceedings** -- Eduskunta committee reports and motions are not included
- **Municipal energy plans** -- local authority energy and climate plans are not covered
- **Individual tariff schedules** -- utility-specific tariff sheets are not included (only Energiavirasto approval decisions)

---

## Limitations

- **Seed dataset** -- 251 records across regulations, grid codes, and decisions
- **Finnish text only** -- all regulatory content is in Finnish. English search queries may return limited results.
- **Summaries, not full legal text** -- records contain representative summaries, not the complete official text from finlex.fi or regulator websites.
- **Quarterly manual refresh** -- data is updated manually. Recent regulatory changes may not be reflected.
- **No real-time tracking** -- amendments and repeals are not tracked automatically.

---

## Planned Improvements

Full automated ingestion is planned from:

- **finlex.fi** -- Finnish legislation (laki, asetus)
- **energiavirasto.fi** -- Energiavirasto regulations, network pricing decisions, methodology documents
- **fingrid.fi** -- Fingrid grid codes, Datahub specifications, balancing rules
- **tem.fi** -- Ministry energy policy publications, energy efficiency guidance
- **tukes.fi** -- Safety regulations, electrical and gas safety rules

---

## Language

All content is in Finnish. The following search terms are useful starting points:

| Finnish Term | English Equivalent |
|-------------|-------------------|
| sahkomarkkina | electricity market |
| siirtohinta | network tariff |
| verkkopalvelu | network service |
| energiatehokkuus | energy efficiency |
| taajuus | frequency |
| reservi | reserve |
| liittyma | grid connection |
| datahub | datahub |
| kantaverkko | transmission grid |
| paastokauppa | emissions trading |
| uusiutuva energia | renewable energy |
| kaukolampo | district heating |
| maakaasu | natural gas |
| sahkoturvallisuus | electrical safety |
