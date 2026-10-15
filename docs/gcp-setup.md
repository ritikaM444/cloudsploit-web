# GCP Setup (permits, roles, and keys)

CloudSploit only needs **read-only** access to your GCP project. This guide
creates a dedicated service account, grants it read-only roles, enables the
APIs the scanner queries, and produces the JSON key you upload to the web app.

> Cost: enabling APIs and read-only `list`/`get` calls are free. This setup
> creates no billable resources. A billing account may still be required by
> Google to *enable* some APIs, but you do not need to spend anything.

---

## 1. Pick or create a project

```bash
# Use an existing project
gcloud config set project YOUR_PROJECT_ID

# …or create a new, free one
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID
```

`gcloud` is the Google Cloud CLI. Install: https://cloud.google.com/sdk/docs/install

## 2. Enable the APIs the scanner reads from

CloudSploit reports `"Service is not enabled"` for any API it cannot reach, so
enable the services you actually use. This is the recommended baseline:

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  serviceusage.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com \
  spanner.googleapis.com \
  logging.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudkms.googleapis.com \
  sqladmin.googleapis.com \
  bigquery.googleapis.com \
  container.googleapis.com \
  dns.googleapis.com \
  monitoring.googleapis.com \
  --project YOUR_PROJECT_ID
```

Add more services (e.g. `run.googleapis.com`, `dataflow.googleapis.com`,
`pubsub.googleapis.com`, `secretmanager.googleapis.com`, `redis.googleapis.com`)
if you want those categories scanned.

## 3. Create a dedicated service account

```bash
gcloud iam service-accounts create cloudsploit-readonly \
  --display-name "CloudSploit Read-Only Scanner" \
  --project YOUR_PROJECT_ID
```

The email will be:

```
cloudsploit-readonly@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 4. Grant read-only roles (least privilege)

```bash
SA=cloudsploit-readonly@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Broad read-only visibility across services:
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/viewer" --condition=None

# Security-focused read access (IAM policies, audit config):
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/iam.securityReviewer" --condition=None

# Needed only if you use the "Spanner" / data plugins:
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/spanner.viewer" --condition=None
```

`roles/viewer` is the standard read-only built-in role and grants no write,
delete, or admin capability. For tighter scope, replace it with per-service
`*.viewer` roles (e.g. `roles/compute.viewer`, `roles/storage.objectViewer`).

### Permissions you need to grant these roles

To create the service account and its key you must have, on the project:

| Action | Role |
|---|---|
| Create service account | `roles/iam.serviceAccountAdmin` |
| Create a JSON key for it | `roles/iam.serviceAccountKeyAdmin` |
| Grant project IAM roles | `roles/resourcemanager.projectIamAdmin` |

On a personal project, `roles/owner` covers all three.

## 5. Create a JSON key

```bash
gcloud iam service-accounts keys create cloudsploit-key.json \
  --iam-account $SA \
  --project YOUR_PROJECT_ID
```

This downloads `cloudsploit-key.json`. **Treat it as a password.**

## 6. Add it to the web app

1. Open the web app and register/log in.
2. Go to **Accounts → Add account**.
3. Give it a name, choose provider **Google Cloud**, and paste or upload the
   contents of `cloudsploit-key.json`.
4. Save, then run a scan.

The server encrypts the key with AES-256-GCM *before* storing it in SQLite. The
plaintext key is only decrypted in memory, in the scan worker, for the duration
of a scan.

---

## Security notes

- **Never commit** `cloudsploit-key.json`. The repo `.gitignore` already blocks
  `*.json` keys named `gcp-key.json` and `credentials.json`; add your filename if
  it differs.
- **Rotate keys** regularly:
  ```bash
  gcloud iam service-accounts keys list --iam-account $SA
  gcloud iam service-accounts keys delete KEY_ID --iam-account $SA
  ```
- **Production hardening:** for long-lived deployments prefer
  [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
  over static JSON keys, or restrict the key with an org policy that disables key
  creation. Static keys are the pragmatic choice for a self-hosted, single-tenant
  deployment.
- **Keep `MASTER_KEY`** (in `server/.env`) safe and backed up. If it is lost, all
  stored credentials become undecryptable and must be re-added.
- Audit what the service account can do at any time:
  ```bash
  gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:$SA" --format="table(bindings.role)"
  ```
