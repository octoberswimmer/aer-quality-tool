# aer function image

This image is used by the Copado function that runs `aer test`.

## build

```bash
docker build -t ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag> -f copado/images/Dockerfile .
```

## publish

```bash
docker buildx build --platform linux/amd64 --push -t ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag> -f copado/images/Dockerfile .
```

## verify architecture

```bash
docker buildx imagetools inspect ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag>
```

Confirm the manifest includes `linux/amd64`.

After publishing, set the same `ghcr.io/octoberswimmer/aer-copado-quality-tool:<tag>` value in:

- `copado__Function__c.copado__Image_Name__c` inside `force-app/main/default/staticresources/aer_extension_bundle.json`
