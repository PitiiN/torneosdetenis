# Docker Build Issues: Missing Public Directory

When using a multi-stage Dockerfile for Next.js (especially the standard `standalone` output template), the build may fail if the `public` directory is empty or missing.

## Symptom
`COPY --from=builder /app/public ./public` fails with "file not found" or similar errors.

## Root Cause
Git does not track empty directories. if the `public` folder is empty, it won't exist in the repository, and thus won't exist in the Docker build context.

## Solution
Add a placeholder file (like `robots.txt` or `.gitkeep`) inside the `public` directory to ensure Git tracks it.

```text
# public/robots.txt
User-agent: *
Allow: /
```
