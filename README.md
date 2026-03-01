# aer quality tool for copado

This repository packages a Copado quality tool that runs `aer test` inside Copado infrastructure.

## what this package includes

- a Copado function (`run_aer_qif`) that downloads and runs `aer`
- a Copado job template + function step to execute `aer test`
- a static resource bundle (`aer_extension_bundle`) for "Generate Extension Records"
- custom metadata for:
  - test tool registration (`aer`)
  - ui sections using `c:aerConfiguration`
  - default quality gate actions:
    - after commit (block)
    - after promotion (report)
- a configurable lwc with options aligned to the github action inputs:
  - `source`
  - `flags`
  - `default-namespace`
  - `version`

## prerequisites

- Copado user permissions for quality gates and functions
- Copado packages compatible with function-based quality tools
- an image published from `copado/images/Dockerfile`

## setup

1. deploy this metadata to your org.
2. add picklist values:
   - `Extension Configuration > Extension Tool`: `aer`
   - `Copado Test Tool` global value set: `aer`
3. open **Copado Extensions**, select `aer_extension_bundle`, click **Generate Extension Records**.
4. open **Functions** and verify the generated function `run aer qif`.
5. update the function image name in generated records if needed.
6. create quality gates using the packaged defaults:
   - after commit (block)
   - after promotion (report)

## configuration

The configuration is stored as json in `copado__AcceptanceCriteria__c` and follows:

```json
{
  "source": "force-app",
  "flags": "",
  "default-namespace": "",
  "version": "latest"
}
```

## container image

Default image:

```text
copado-function-core:v1
```

Optional custom image workflow:

```bash
docker build -t ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag> -f copado/images/Dockerfile .
docker push ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag>
```

If you use a custom image, set `copado__Image_Name__c` in `force-app/main/default/staticresources/aer_extension_bundle.json` to that image.

## troubleshooting

- `source cannot be empty`: set a non-empty `source` value.
- version resolution/download failures: verify network access from Copado worker to github releases.
- function fails before running `aer`: verify image includes `bash`, `curl`, `jq`, `git`, and `unzip`.
