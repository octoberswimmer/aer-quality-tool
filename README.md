# aer quality tool for Copado

This repository packages a Copado quality tool that runs `aer test` inside Copado infrastructure.

## What this package includes

- a Copado function (`run_aer_qif`) that downloads and runs [`aer`](https://github.com/octoberswimmer/aer-dist/)
- a Copado job template + function step to execute `aer test`
- a static resource bundle (`aer`) for "Generate Extension Records"
- custom metadata for:
  - test tool registration (`aer`)
  - ui sections using `c:aerConfiguration`
  - default quality gate actions:
    - after commit (block)
    - after promotion (report)
- a configurable LWC with options to configure the `aer test` execution:
  - `source`
  - `flags`
  - `default-namespace`
  - `version`
- an LWC-based custom result viewer (`c:aerResultViewerPanel`) that reads:
  - `aer-test-results.xml` (junit)
  - `aer-coverage.json`
  - `aer-results-summary.json`
    and renders a detailed test/coverage summary on the Copado Result record.

## Prerequisites

- Copado user permissions for quality gates and functions
- Copado packages compatible with function-based quality tools

## Setup

1. deploy this metadata to your org.
2. add picklist values:
   - `Extension Configuration > Extension Tool`: `aer`
   - `Copado Test Tool` global value set: `aer`
3. open **Copado Extensions**, select `aer`, click **Generate Extension Records**.
4. open **Functions** and verify the generated function `run aer qif`.
5. verify `copado__Image_Name__c` is set to `copado-function-core:v1`.
6. create quality gates using the packaged defaults:
   - after commit (block)
   - after promotion (report)
7. run a test execution and open the generated **Result** record:
   - the custom viewer renders status, test counts, duration, coverage, failures, and attached artifacts.

## configuration

The configuration is managed in the Copado Extension Configuration settings UI and passed to the function as JSON:

```json
{
  "source": "force-app",
  "flags": "",
  "default-namespace": "",
  "version": "latest"
}
```

## License Key

An `aer` license key is required to run more than 100 tests at a time. Visit
https://www.octoberswimmer.com/tools/aer/subscribe/ to purchase a license.

To use a licensed version of `aer`, create a System Property to store the license key:

1. navigate to **System Properties** and click **New**.
2. set **API Name** to `AER_LICENSE_KEY`.
3. paste your license key in the **Value** field.
4. check **Hide Value** to protect the key.
5. optionally link the property to specific **Pipeline** or **Environment** records.

The function includes a parameter that reads `{$Global.Property.AER_LICENSE_KEY}` and exports it as `AER_LICENSE_KEY` to the shell environment.

## Runtime image

The packaged function uses:

```text
copado-function-core:v1
```

## Troubleshooting

- `source cannot be empty`: set a non-empty `source` value.
- version resolution/download failures: verify network access from Copado worker to GitHub releases.
