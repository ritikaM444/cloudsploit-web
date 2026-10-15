# Testing Guide & Final Report Template

This document explains **where to get accounts to test with** and how to produce a
**final testing report**.

---

## 1. Where to get test accounts

You do **not** need production data. Use free/read-only sandboxes.

### Recommended: your own GCP project (free tier)
1. Create a project in the Google Cloud Console (new accounts get free credits).
2. Create a **read-only** service account using `docs/gcp-setup.md`.
3. Deploy a few small resources so the scanner has something to inspect.

### Other free cloud sandboxes
| Provider | Free option | What to enable so there is something to scan |
| --- | --- | --- |
| Google Cloud | $300 free trial / always-free tier | Compute Engine VM, Cloud Storage bucket, VPC firewall rule |
| AWS | Free Tier (12 months) | 1 EC2 instance, 1 S3 bucket, 1 security group |
| Microsoft Azure | Free account + $200 credit | 1 App Service, 1 Storage account |
| IBM Cloud | Lite plan | 1 VKS/Cloud Foundry service |
| Firebase | Spark (free) plan | Auth + Firestore project |

> The web app currently connects **Google Cloud only** (see section 4). The other rows are
> useful if/when multi-provider support is enabled.

### Create intentional misconfigurations (safely)
To prove the scanner detects problems, deliberately create a few *harmless* issues in your
sandbox project, then delete them after testing:
- A firewall rule that allows SSH/RDP (port 22/3389) from `0.0.0.0/0`.
- A Cloud Storage bucket without uniform access / public access prevention.
- A VM without a project-wide SSH key restriction or without OS Login.
- A service account key older than 90 days.

These map to real checks (e.g. `openSSH`, `openRDP`, `excessiveFirewallRules`) and give
you both PASS and FAIL evidence for the report.

### Do NOT use
- Real production accounts you do not own.
- Accounts without permission.
- Someone else's credentials.

---

## 2. Suggested test scenarios

| # | Scenario | Expected result |
| --- | --- | --- |
| T1 | Register the first user | User created, becomes admin |
| T2 | Register a second user | Second user is a normal user |
| T3 | Login with wrong password | `InvalidCredentials`, no cookie |
| T4 | Add account via **file upload** | Account listed, project detected |
| T5 | Add account via **drag & drop** | Same as T4 |
| T6 | Add account with invalid JSON | Friendly validation error |
| T7 | Run a single-plugin scan | Completes, findings listed |
| T8 | Run a full scan | Completes within timeout |
| T9 | Open a finding drawer | Shows message, description, remediation, link |
| T10 | Filter by High severity | Only High-severity findings shown |
| T11 | Export CSV / JSON | File downloads with filtered rows |
| T12 | Remove an account | Row disappears + deletion notice; credentials gone |
| T13 | Sign out | Returns to centered login page; protected routes blocked |

Automated coverage already exists: run the end-to-end smoke test in the server:

```
npm --prefix server run smoke
```

It exercises register → me → create account → scan → findings (with severity +
remediation) → delete account → logout.

---

## 3. Final testing report template

Copy this into your report and fill it in.

```
Title:           CloudSploit Web — Test Report
Author / Team:
Date:
Version tested:  <git commit / build id>

1. Scope
   - Features tested: auth, account upload, scanning, findings UI, export, account deletion
   - Out of scope: <e.g. AWS/Azure providers, scheduled scans>

2. Environment
   - OS / browser:
   - Node version:
   - Cloud sandbox used:

3. Test results
   | ID | Scenario | Steps | Expected | Actual | Pass/Fail | Evidence |
   |----|----------|-------|----------|--------|-----------|----------|
   | T1 | ...      | ...   | ...      | ...    | Pass      | screenshot/scan id |

4. Automated test summary
   - Smoke test result: 10/10 PASS (or attach output)
   - Typecheck: pass/fail
   - Client build: pass/fail

5. Defects found
   | ID | Severity | Description | Status |
   |----|----------|-------------|--------|

6. Coverage / metrics
   - Checks executed per full scan: <n>
   - Findings: <x FAIL / y WARN / z OK>

7. Conclusion
   - Overall result, remaining risks, and next steps
```

---

## 4. Cloud technology coverage (compliance)

The underlying **CloudSploit engine** ships plugins for **AWS, Azure, Google Cloud,
Oracle (OCI), GitHub and Alibaba Cloud**, and the deployment is containerised (Docker).

However, the **web application currently wires up Google Cloud only** — the account form,
credential validation, and scanner configuration are implemented for GCP. AWS/Azure/IBM
can be added by extending the provider layer (credential schema per provider + passing that
provider's config to the scanner, which already supports them).

| Area | Status |
| --- | --- |
| GCP (Compute, Storage, IAM, Spanner, …) | Supported end-to-end |
| AWS / Azure / Oracle / GitHub / Alibaba | Engine supports; web wiring pending |
| Docker containerisation | Provided (`Dockerfile`, `docker-compose.yml`) |
| Kubernetes | Not included |

See `README.md` for the architecture and `docs/gcp-setup.md` for GCP permissions.
