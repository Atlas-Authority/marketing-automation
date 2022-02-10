# Analyzing data shift

The purpose of this task is to detect changes in MPAC data over time, by analyzing recorded data sets.

### When it runs

- Data shift analyzation runs directly after each loop in Docker
- Local dev can run it manually via `npm run analyze-data-shift`

### How it reports

- If Slack is configured via ENV, sends message to Slack error channel
- Always prints to standard out and standard error

### Configuration it runs with

- Can set ENV variable for late-transaction threshold
- Defaults to 30 days (ignores transactions that appear 29 days later)

### What it does

- Checks for missing transactions
- Checks for missing licenses
- Checks for transactions that appear later than claimed
- Checks for altered transactions
- Checks for altered licenses

#### Altered license fields checked

- `addonKey`
- `addonName`
- `hosting`
- `maintenanceStartDate`

#### Altered transaction fields checked

- `saleDate`
- `saleType`
- `addonKey`
- `addonName`
- `hosting`
- `country`
- `region`
- `purchasePrice`
- `vendorAmount`
- `billingPeriod`
- `maintenanceStartDate`
- `maintenanceEndDate`

### Configuration steps required

1. Add persistent volume to Docker
2. Increase Node.js memory as needed via `--max-old-space-size`
