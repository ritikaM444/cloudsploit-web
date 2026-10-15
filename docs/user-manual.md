# CloudSploit Web — User Manual

This guide is for anyone using the CloudSploit web app, even if you have never used a
security tool before. It walks through everything step by step.

---

## 1. What is this app?

CloudSploit Web is a dashboard that checks your cloud account for **security
misconfigurations** — for example, firewalls open to the whole internet, missing
encryption, or weak logging. It reads your cloud configuration (read-only) and gives you
a report of what is safe, what is risky, and exactly how to fix it.

Nothing is changed in your cloud account. The app only **reads** settings.

---

## 2. Signing up and signing in

1. Open the app in your browser (by default http://localhost:5173 during development).
2. On the first screen, click **Create one**.
3. Enter your email and a password of **at least 10 characters**, then click
   **Create account**.
4. The **first account ever created becomes the administrator**. Everyone after that is a
   normal user.
5. Later, to return, use **Sign in** with the same email and password.

To leave, click **Sign out** in the top-right corner. This clears your login token from
the browser.

---

## 3. Connecting your cloud account

Before you can scan, you must give the app a **read-only key** for your cloud project.

### 3.1 Create the key in Google Cloud (one time)

Follow `docs/gcp-setup.md` for the detailed, permission-by-permission instructions. In
short: create a service account, give it the read-only roles, and download its **JSON key
file**.

### 3.2 Add it to the app

1. Go to **Accounts** in the top menu.
2. Under **Add a GCP account**, type a friendly **Display name** (e.g. "Production").
3. Provide the key in **either** of these ways — you do **not** need to copy-paste:
   - Click **Upload file…** and pick the `.json` key file you downloaded, **or**
   - **Drag and drop** the `.json` file onto the box, **or**
   - Paste the JSON text if you prefer.
4. When a file is loaded, its name appears (for example `Loaded: my-project-key.json`).
   The display name is filled in automatically from the project if you left it blank.
5. Click **Add account**.

Your key is **encrypted with AES-256-GCM** before it is written to the database. It is
never stored as readable text.

### 3.3 Removing an account

1. In **Connected accounts**, click **Remove** next to the account.
2. Confirm the prompt.
3. You will see a message confirming the account **and its credential file were permanently
   deleted from the database**. Nothing is retained and no data is left behind.

> Removing an account also removes its scan history (findings) from the database.

---

## 4. Running a scan

1. Go to **Scans** in the top menu.
2. Choose the account you want to scan.
3. (Optional) Limit the scan to a single check by its plugin name.
4. Click **Run scan**. The scan is queued and processed in the background.
5. The status updates automatically: `queued → running → succeeded`.
   A scan of a single check usually finishes in under a minute; a **full scan** can take
   several minutes.

---

## 5. Reading your results

Open a finished scan from the **Scans** list (or the Dashboard) to see the results page.

- **Security score** — the percentage of checks that passed. Green = 90%+, amber = 70–89%,
  red = below 70%.
- **Total / Failed / Warnings / Passed** cards — quick counts.
- **Status filters** — All, Failures, Warnings, Passed, Unknown.
- **Severity filters** — All, High, Medium, Low (the risk level of each check).
- **Findings table** — one row per check.

### Understanding statuses

| Status | Meaning |
| --- | --- |
| **OK** | The check passed — this setting looks safe. |
| **FAIL** | A real security problem was found. Fix it. |
| **WARN** | Something worth reviewing; may not be critical. |
| **UNKNOWN** | The check could not be completed (often a permissions issue). |

### Fixing a finding

1. Click any row in the table (or press Enter on it).
2. A panel opens on the right showing:
   - **Why it failed** — what the scanner actually observed.
   - **Description** and **More information** — background.
   - **Recommended action** — the exact fix (highlighted in green).
   - The affected **resource**, **region**, and a link to **reference documentation**.
3. Apply the fix in your cloud console, then run the scan again to confirm.

### Exporting a report

At the top-right of the results page use **Export CSV** or **Export JSON**. The export
contains exactly the rows currently shown (so filter first, then export). CSV opens in
Excel/Google Sheets; JSON is handy for scripts.

---

## 6. Privacy and security

- Cloud keys are encrypted at rest with AES-256-GCM.
- Passwords are stored only as salted scrypt hashes — never in plain text.
- Login uses a signed token in a secure, HTTP-only cookie.
- The scanner runs in a separate process and only ever reads your cloud.
- Deleting an account deletes its stored credentials from the database.

---

## 7. Troubleshooting

| Symptom | What to do |
| --- | --- |
| "The service account is not valid JSON" | Make sure you selected the `.json` **key** file, not a `.txt` or the wrong file. |
| Account added but scan shows mostly **UNKNOWN** | The service account is missing read permissions. Re-check the roles in `docs/gcp-setup.md`. |
| Scan failed immediately | Check the error message on the results page; usually a missing API or role. |
| Signed out unexpectedly | Your login token expired (7 days). Sign in again. |
| "Add account" button does nothing | Fill in the display name and provide the key (upload or paste). |

---

## 8. Glossary

- **Service account** — a robot user in Google Cloud used by tools instead of a person.
- **Plugin / check** — a single security rule the scanner evaluates.
- **Finding** — the result of one check against one resource.
- **Remediation** — the fix for a finding.
