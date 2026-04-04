# Tools -- Finnish Energy Regulation MCP

8 tools for searching and retrieving Finnish energy sector regulations.

All data is in Finnish. Tool descriptions and parameter names are in English.

---

## 1. fi_energy_search_regulations

Search across Finnish energy regulations from Energiavirasto, TEM, and Tukes. Returns laki (acts), asetus (decrees), maarays (regulations/orders), and ohje (guidance). Supports Finnish-language queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Finnish or English (e.g., `sahkomarkkina`, `energiatehokkuus`, `sahkoturvallisuus`, `maakaasu`) |
| `regulator` | string | No | Filter by regulator: `energiavirasto`, `tem`, `tukes` |
| `type` | string | No | Filter by regulation type: `laki`, `asetus`, `maarays`, `ohje` |
| `status` | string | No | Filter by status: `in_force`, `repealed`, `draft`. Defaults to all. |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching regulations with reference, title, text, type, status, effective date, and URL.

**Example:**

```json
{
  "query": "sahkomarkkina",
  "regulator": "energiavirasto",
  "status": "in_force"
}
```

**Data sources:** Energiavirasto (energiavirasto.fi), TEM (tem.fi), Tukes (tukes.fi), finlex.fi.

**Limitations:** Summaries, not full legal text. Finnish-language content only.

---

## 2. fi_energy_get_regulation

Get a specific Finnish energy regulation by its reference string. Returns the full record including text, metadata, and URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reference` | string | Yes | Regulation reference (e.g., `588/2013`) |

**Returns:** Single regulation record with all fields, or an error if not found.

**Example:**

```json
{
  "reference": "588/2013"
}
```

**Data sources:** finlex.fi, energiavirasto.fi, tem.fi, tukes.fi.

**Limitations:** Exact match on reference string. Partial matches are not supported -- use `fi_energy_search_regulations` for fuzzy search.

---

## 3. fi_energy_search_grid_codes

Search Fingrid grid codes, balancing rules, reserve market regulations, and Datahub requirements.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `taajuus`, `reservi`, `liittyma`, `datahub`, `kantaverkko`) |
| `code_type` | string | No | Filter by code type: `technical_regulation`, `market_regulation`, `grid_connection`, `balancing`, `ancillary_services` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching grid code documents with reference, title, text, code type, version, effective date, and URL.

**Example:**

```json
{
  "query": "taajuus",
  "code_type": "balancing"
}
```

**Data sources:** Fingrid (fingrid.fi).

**Limitations:** Summaries of technical regulations, not the full PDF documents. Finnish-language content only.

---

## 4. fi_energy_get_grid_code

Get a specific Fingrid grid code document by its database ID. The ID is returned in search results from `fi_energy_search_grid_codes`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | number | Yes | Grid code document ID (from search results) |

**Returns:** Single grid code record with all fields, or an error if not found.

**Example:**

```json
{
  "document_id": 2
}
```

**Data sources:** Fingrid (fingrid.fi).

**Limitations:** Requires a valid database ID. Use `fi_energy_search_grid_codes` to find IDs.

---

## 5. fi_energy_search_decisions

Search Energiavirasto network pricing decisions, market supervision rulings, and emissions trading decisions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `verkkopalvelu`, `siirtohinta`, `paastooikeus`, `sahkonmyynti`) |
| `decision_type` | string | No | Filter by decision type: `tariff`, `revenue_cap`, `methodology`, `benchmark`, `complaint`, `market_monitoring` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching decisions with reference, title, text, decision type, date decided, parties, and URL.

**Example:**

```json
{
  "query": "verkkopalvelu",
  "decision_type": "tariff"
}
```

**Data sources:** Energiavirasto (energiavirasto.fi).

**Limitations:** Summaries of decisions, not full legal text. Finnish-language content only.

---

## 6. fi_energy_about

Return metadata about this MCP server: version, list of regulators covered, tool list, and data coverage summary. Takes no parameters.

**Parameters:** None.

**Returns:** Server name, version, description, list of regulators (id, name, URL), and tool list (name, description).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 7. fi_energy_list_sources

List data sources with record counts, provenance URLs, and last refresh dates.

**Parameters:** None.

**Returns:** Array of data sources with id, name, URL, record count, data type, last refresh date, and refresh frequency.

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 8. fi_energy_check_data_freshness

Check data freshness for each source. Reports staleness status and provides update instructions.

**Parameters:** None.

**Returns:** Freshness table with source, last refresh date, frequency, and status (Current/Due/OVERDUE).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.
