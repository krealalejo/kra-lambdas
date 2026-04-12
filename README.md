# kra-lambdas

AWS Lambda functions for KRA project.

## Functions

### thumbnail-generator
Generates WebP thumbnails (300px width) when images are uploaded to S3 `images/` prefix.

## Development

```bash
npm install
npm run typecheck
npm run build
```

## Deployment
Deployed via Terraform in `kra-infra/terraform/lambda.tf`.
