# aer function image

This image is used by the Copado function that runs `aer test`.

## build

```bash
docker build -t <registry>/aer-function:<tag> -f copado/images/Dockerfile .
```

## publish

```bash
docker push <registry>/aer-function:<tag>
```

After publishing, set the same `<registry>/aer-function:<tag>` value in:

- `copado__Function__c.copado__Image_Name__c` inside `force-app/main/default/staticresources/aer_extension_bundle.json`
