# InvisiThreat CI Runner Action

This composite action runs the official scanner script and uploads results to the platform.

## Inputs

- `upload-token` (required): short-lived upload token obtained from the backend.
- `api-url` (optional): API base URL, default `http://localhost:8000`.
- `scan-path` (optional): path to scan, default `.`.
- `python-version` (optional): Python version, default `3.12`.

## Example

```yaml
name: Security Scan

on: [push]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Normally you fetch upload-token from your platform API before this step.
      - name: Run InvisiThreat scan
        uses: ./.github/actions/invisithreat-scan
        with:
          upload-token: ${{ secrets.INVISITHREAT_UPLOAD_TOKEN }}
          api-url: https://your-invisithreat.example.com
          scan-path: .
```
