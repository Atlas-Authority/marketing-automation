# Deal Generator Test Engine

`generate-deals.test.js` verifies the deal generation logic. It takes the HubSpot and Marketplace license/transaction data as input, execute the deal generation logic and then verify the generated actions and events.

**Note**: The licenses/transactions input is the result of scoring engine. Deal generator test engine does not verify the scoring mechanism.

### Test cases
All test cases are defined in `test-data` directory at the root of project. Each sub-directory is a test scenario which contains:

| File          | Description                                                                                         |
|---------------|-----------------------------------------------------------------------------------------------------|
| `desc.txt`    | Test scenario description. The first line is scenario name, the second line is scenario description.|
| `deal.json`   | The HubSpot deal data. Must conform to `FullEntity[]` format.                                       |
| `record.json` | Marketplace data. Must conform to `RelatedLicenseSet` format.                                       |
| `event.json`  | The expected events output. Must conform to `DealRelevantEvent[]`                                   |
| `action.json` | The expected actions output. Must conform to `Action[]` format                                      |

The test engine will loop over all sub-directories and execute the test.

### Generate test cases
- Prepare redacted marketplace data:
  ```
  npm run redact
  ```
- Start system in local mode, feed it with redacted data:
  ```
  npm run once -- --in=local --out=local --precomputed
  ```
- Deals, records, events and actions data should be logged in `/data/out`:
    - `deal-generator.txt` human-friendly log.
    - `deal-generator-json.txt` computer-friendly log.
- Use the generated data, make some tweak if needed to create test scenarios.
