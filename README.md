# Finnish Energy Regulation MCP

MCP server for Finnish energy sector regulations -- Energiavirasto market rules, Fingrid grid codes, TEM energy policy, Tukes safety rules.

[![npm version](https://badge.fury.io/js/@ansvar%2Ffinnish-energy-regulation-mcp.svg)](https://www.npmjs.com/package/@ansvar/finnish-energy-regulation-mcp)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Covers four Finnish energy regulators with full-text search across regulations, grid codes, and regulatory decisions. All data is in Finnish.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Regulators Covered

| Regulator | Role | Website |
|-----------|------|---------|
| **Energiavirasto** (Energy Authority) | Energy market regulation, network pricing, emissions trading, consumer protection | [energiavirasto.fi](https://energiavirasto.fi) |
| **Fingrid Oyj** (Finnish TSO) | Electricity transmission, grid codes, Datahub, balancing market, frequency regulation | [fingrid.fi](https://fingrid.fi) |
| **TEM** (Ministry of Economic Affairs and Employment) | Energy policy, renewable energy support, energy efficiency, climate targets | [tem.fi](https://tem.fi) |
| **Tukes** (Safety and Chemicals Agency) | Electrical safety, gas safety, pressure equipment, product safety | [tukes.fi](https://tukes.fi) |

---

## Quick Start

### Use Remotely (No Install Needed)

**Endpoint:** `https://mcp.ansvar.eu/finnish-energy-regulation/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude Desktop** | Add to `claude_desktop_config.json` (see below) |
| **Claude Code** | `claude mcp add finnish-energy-regulation --transport http https://mcp.ansvar.eu/finnish-energy-regulation/mcp` |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "finnish-energy-regulation": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/finnish-energy-regulation/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/finnish-energy-regulation-mcp
```

Or add to Claude Desktop config for stdio:

```json
{
  "mcpServers": {
    "finnish-energy-regulation": {
      "command": "npx",
      "args": ["-y", "@ansvar/finnish-energy-regulation-mcp"]
    }
  }
}
```

---

## Tools

| Tool | Description |
|------|-------------|
| `fi_energy_search_regulations` | Full-text search across energy regulations from Energiavirasto, TEM, and Tukes |
| `fi_energy_get_regulation` | Get a specific regulation by reference string (e.g., `588/2013`) |
| `fi_energy_search_grid_codes` | Search Fingrid grid codes, Datahub requirements, and balancing rules |
| `fi_energy_get_grid_code` | Get a specific grid code document by database ID |
| `fi_energy_search_decisions` | Search Energiavirasto network pricing decisions and emissions trading rulings |
| `fi_energy_about` | Return server metadata: version, regulators, tool list, data coverage |
| `fi_energy_list_sources` | List data sources with record counts and provenance URLs |
| `fi_energy_check_data_freshness` | Check data freshness and staleness status for each source |

Full tool documentation: [TOOLS.md](TOOLS.md)

---

## Data Coverage

| Source | Records | Content |
|--------|---------|---------|
| Finlex | 59 regulations | Sahkomarkkinalaki, maakaasumarkkinalaki, energy acts and decrees |
| Energiavirasto | 32 regulations | Network pricing methodology, market monitoring, emissions trading |
| TEM | 22 regulations | Energy policy, climate targets, renewable energy support |
| Tukes | 19 regulations | Electrical safety, gas safety, product safety |
| Fingrid | 53 grid codes | Frequency regulation, reserve markets, Datahub, grid connection |
| Energiavirasto (decisions) | 66 decisions | Methodology approvals, tariff determinations, revenue caps |
| **Total** | **251 records** | ~328 KB database |

**Language note:** All regulatory content is in Finnish. Search queries work best in Finnish (e.g., `sahkomarkkina`, `siirtohinta`, `taajuus`, `datahub`).

Full coverage details: [COVERAGE.md](COVERAGE.md)

---

## Data Sources

See [sources.yml](sources.yml) for machine-readable provenance metadata.

---

## Docker

```bash
docker build -t finnish-energy-regulation-mcp .
docker run --rm -p 3000:3000 -v /path/to/data:/app/data finnish-energy-regulation-mcp
```

Set `FI_ENERGY_DB_PATH` to use a custom database location (default: `data/fi-energy.db`).

---

## Development

```bash
npm install
npm run build
npm run seed         # populate sample data
npm run dev          # HTTP server on port 3000
```

---

## Further Reading

- [TOOLS.md](TOOLS.md) -- full tool documentation with examples
- [COVERAGE.md](COVERAGE.md) -- data coverage and limitations
- [sources.yml](sources.yml) -- data provenance metadata
- [DISCLAIMER.md](DISCLAIMER.md) -- legal disclaimer
- [PRIVACY.md](PRIVACY.md) -- privacy policy
- [SECURITY.md](SECURITY.md) -- vulnerability disclosure

---

## License

Apache-2.0 -- [Ansvar Systems AB](https://ansvar.eu)

See [LICENSE](LICENSE) for the full license text.

See [DISCLAIMER.md](DISCLAIMER.md) for important legal disclaimers about the use of this regulatory data.

---

[ansvar.ai/mcp](https://ansvar.ai/mcp) -- Full MCP server catalog
