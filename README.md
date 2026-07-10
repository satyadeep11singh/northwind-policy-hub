# NorthWind Insurance — Policy Hub

A production-grade customer self-service portal for Ontario auto and home insurance policies.
Built as a portfolio showcase of Azure cloud engineering: Terraform IaC, Jenkins CI/CD on an
Azure VM, Docker + ACR, App Service (container mode), Key Vault with Managed Identity, and
Application Insights with a custom Monitor Workbook.

> **Disclaimer:** "NorthWind Insurance" is a fictional company. All code, infrastructure,
> and data are for personal learning purposes only and do not represent any real systems,
> data, or processes from any actual employer or insurance company.

---

## What it does

Existing NorthWind customers log in to manage their policies without calling an agent:

| Feature | Detail |
|---|---|
| **Policy Dashboard** | All active auto and home policies in one place |
| **Coverage Management** | Toggle optional coverages on/off; adjust collision and comprehensive deductibles |
| **Claims** | View claim history with adjuster notes and status tracker; open new claims |
| **Billing** | Next payment date/amount, payment frequency, and full payment history per policy |

Demo accounts (password `Demo@1234`):

| Account | Policies | Claims |
|---|---|---|
| `sarah.chen@email.com` | 2022 Honda CR-V + Toronto condo | Settled collision + active water damage |
| `marco.rossi@email.com` | 2020 Toyota RAV4 + 2019 Ford F-150 | New windshield claim |
| `priya.sharma@email.com` | 2023 Hyundai Tucson + Ottawa semi-detached | Clean record |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      GitHub Repository                        │
│                   (source of truth, main branch)              │
└──────────────────────────┬───────────────────────────────────┘
                           │ manual trigger (webhook: future)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Jenkins VM  (Standard_B2s_v2 · Azure VM)              │
│         Terraform-provisioned · Ubuntu 22.04 · cloud-init     │
│                                                               │
│  CI Pipeline  (Jenkinsfile.ci)                                │
│    checkout → npm ci → lint → test → npm run build →          │
│    docker build → Trivy scan → push to ACR → trigger CD       │
│                                                               │
│  CD Pipeline  (Jenkinsfile.cd)                                │
│    az login (SP) → az webapp config container set →           │
│    az webapp restart → health check curl /health              │
└──────────┬────────────────────┬──────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌────────────┐    ┌─────────────────────────────────────┐
    │    ACR     │    │   Azure App Service  (Linux, F1)     │
    │  (Basic)   │    │   Container mode — image from ACR    │
    │ tagged by  │    │                                      │
    │ build#-SHA │    │   SystemAssigned + UserAssigned      │
    └────────────┘    │   Managed Identity                   │
                      └──────────────┬──────────────────────┘
                                     │ keyVaultReferenceIdentity
                                     │ = SystemAssigned
                                     ▼
                      ┌─────────────────────────────────────┐
                      │           Key Vault                  │
                      │   mongodb-uri                        │
                      │   jwt-secret                         │
                      │   appinsights-connection-string      │
                      └──────────────┬──────────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
             ┌──────────────┐          ┌──────────────────────┐
             │ MongoDB Atlas│          │  Application Insights │
             │  (free M0)   │          │  + Log Analytics WS   │
             │  0.0.0.0/0   │          │  + Monitor Workbook   │
             │  (dev only)  │          │                       │
             └──────────────┘          │  custom events:       │
                                       │  customer.login       │
                                       │  policy.viewed        │
                                       │  coverage.changed     │
                                       │  claim.opened         │
                                       └──────────────────────┘
```

---

## Azure services used

| Service | Role | Pattern |
|---|---|---|
| **Azure App Service** (Linux, F1) | Runtime for Node.js + React container | Container mode — image pulled from ACR at deploy |
| **Azure Container Registry** (Basic) | Docker image store | SP-based push from Jenkins; SP-based pull in CD |
| **Azure Key Vault** (Standard) | Secret store | App Service Key Vault references resolved at runtime via Managed Identity |
| **Managed Identity** (System + User Assigned) | App Service identity | `keyVaultReferenceIdentity = SystemAssigned` — zero credentials in app settings |
| **Application Insights** | APM + custom telemetry | Node.js SDK auto-instruments HTTP and MongoDB; 4 custom business events |
| **Log Analytics Workspace** | Backing store for App Insights | Workspace-based (not classic) |
| **Azure Monitor Workbook** | Operations dashboard | 8 panels — API health, logins, policy views, coverage changes, claims |
| **Azure VM** (Standard_B2s_v2) | Self-hosted Jenkins | Terraform + cloud-init provisioned; cloud-init restarts Jenkins after Docker group assignment |
| **Terraform remote state** | State backend | Azure Blob Storage shared with NorthWind project suite (`rg-northwind-tfstate`) |

---

## Repository structure

```
northwind-policy-hub/
├── server/                        # Express API
│   ├── index.js                   # Boot: App Insights init → loadSecrets → connect DB → listen
│   ├── models/                    # Mongoose schemas
│   │   ├── Customer.js
│   │   ├── Policy.js              # Auto + home coverage sub-schemas
│   │   ├── Billing.js
│   │   └── Claim.js
│   ├── routes/                    # REST endpoints
│   │   ├── auth.js                # POST /api/auth/login|logout  (rate-limited)
│   │   ├── policies.js            # GET/PATCH /api/policies
│   │   ├── billing.js             # GET /api/billing
│   │   ├── claims.js              # GET/POST /api/claims
│   │   └── health.js              # GET /health  (CD pipeline pings this)
│   ├── middleware/
│   │   ├── auth.js                # JWT Bearer verification
│   │   └── errorHandler.js
│   └── services/
│       ├── appInsights.js         # App Insights init + trackEvent wrapper
│       ├── keyVault.js            # Managed Identity secret loader (local dev fallback to .env)
│       ├── db.js                  # Mongoose connect with graceful degraded-mode fallback
│       └── logger.js              # Winston (JSON in prod, pretty in dev)
├── client/                        # React + Vite frontend
│   └── src/
│       ├── App.jsx                # Router + protected routes
│       ├── context/AuthContext.jsx
│       ├── services/api.js        # Axios instance + auth interceptor
│       ├── components/AppShell.jsx
│       └── pages/
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx
│           ├── PoliciesPage.jsx
│           ├── PolicyDetailPage.jsx   # Coverage toggles + deductible selector
│           ├── ClaimsPage.jsx         # List + new claim form
│           ├── ClaimDetailPage.jsx    # Progress tracker + adjuster notes
│           └── BillingPage.jsx
├── infra/                         # Terraform (flat, no modules)
│   ├── main.tf                    # All resources: RG, ACR, VNet, VM, KV, App Service, AI, Workbook
│   ├── variables.tf
│   ├── outputs.tf
│   ├── terraform.tfvars.example
│   └── workbook.json              # Azure Monitor Workbook definition (8 panels)
├── jenkins/
│   ├── Jenkinsfile.ci             # CI: install → lint → test → build → docker → trivy → push ACR
│   ├── Jenkinsfile.cd             # CD: az login → container set → restart → health check
│   ├── cloud-init.yml             # Jenkins VM first-boot: Docker CE, Jenkins LTS, Node 20, az CLI, Trivy
│   └── jenkins-credentials-setup.md
├── Dockerfile                     # Multi-stage: React Vite build + Node server
├── .trivyignore                   # Suppressed npm CVEs that have no upstream fix
├── .env.example
└── package.json                   # lint, test:ci, build scripts
```

---

## The build, step by step

### Step 1 — The app

The application is a React + Vite frontend backed by an Express API and MongoDB Atlas.
A single `Dockerfile` does a multi-stage build: the React app is compiled with Vite in
the first stage, then copied into the Node.js runtime stage alongside the Express server.
In production the Express server serves the React `dist/` as static files, so there is only
one process and one port (8080) to manage.

The boot sequence in `server/index.js` is ordered deliberately:

```
App Insights init → loadSecrets (Key Vault) → connect (MongoDB) → listen
```

App Insights must be initialized first so it can auto-instrument all subsequent HTTP and
MongoDB calls. If Key Vault or MongoDB fail, the server still starts — `/health` returns
`degraded` instead of `ok`, and the CD health check accepts both as passing.

### Step 2 — Tests and lint

Jest tests cover the API routes via `supertest`. ESLint gates code quality with
`--max-warnings=0`. Both run in CI before any Docker image is built. The test command
(`npm run test:ci`) produces a `junit.xml` report that Jenkins publishes after every run.

### Step 3 — Terraform provisions everything

A single flat `main.tf` provisions the full stack:

- Resource group (`rg-northwind-policy-hub-dev`)
- VNet + subnet + NSG for the Jenkins VM (ports 22 and 8080)
- Jenkins VM (`Standard_B2s_v2`, Ubuntu 22.04, cloud-init)
- Azure Container Registry (`acrnwpolicyhub{suffix}`)
- App Service Plan (F1 Free, Linux) + Linux Web App
- User-Assigned Managed Identity
- Key Vault with three secrets and access policies for both the Terraform SP and the identity
- `null_resource` provisioner that sets `keyVaultReferenceIdentity=SystemAssigned` via az CLI
- Log Analytics Workspace + Application Insights
- Azure Monitor Workbook (8 panels, bound to App Insights via `source_id`)

A `random_id` suffix is generated on first apply — all resource names include it, so
destroy/apply cycles never produce name conflicts.

Terraform remote state is stored in `rg-northwind-tfstate / stnorthwindtf676746`, shared
with the rest of the NorthWind project suite and untouched by `terraform destroy`.

### Step 4 — Jenkins VM via cloud-init

The VM's `custom_data` is the `jenkins/cloud-init.yml` file, base64-encoded by Terraform.
On first boot it installs Docker CE, Jenkins LTS, Node.js 20, Azure CLI, and Trivy — then
adds the `jenkins` user to the `docker` group and **restarts Jenkins** so the group
membership takes effect without an SSH session. The initial admin password is written to
`/var/log/cloud-init-jenkins.log`.

### Step 5 — CI pipeline

The CI pipeline (`Jenkinsfile.ci`) runs five quality gates before touching Docker:

```
Checkout → Install (npm ci) → Lint (eslint) → Test (jest) → Build (vite)
         → Docker Build → Trivy Scan → Push to ACR → Trigger CD
```

Images are tagged `{BUILD_NUMBER}-{short_SHA}` (e.g. `3-033042d`). Both the versioned
tag and `latest` are pushed. Trivy runs with `--exit-code 1` on CRITICAL and HIGH — the
build fails if any unaddressed finding exists. After push, the CI pipeline triggers the
CD pipeline and passes the build tag as a parameter.

### Step 6 — CD pipeline

The CD pipeline (`Jenkinsfile.cd`) deploys by updating the App Service container image:

```bash
az webapp config container set \
  --docker-custom-image-name acrnwpolicyhub{suffix}.azurecr.io/northwind-policy-hub:{tag} \
  --container-registry-user   {SP_CLIENT_ID} \
  --container-registry-password {SP_SECRET}

az webapp restart ...
```

App Service is in **container mode** after the first CD run. Zip deploy does not work in
container mode — it triggers an Oryx build that fails because there is no `package.json`
at the expected path after the container image is set.

The health check polls `/health` for up to 2 minutes. It accepts `ok` or `degraded` as
healthy. A 403 response (F1 free tier CPU quota exceeded) is also treated as a passing
check — the image is deployed correctly, and the app recovers automatically at midnight UTC
when the quota resets.

### Step 7 — Key Vault + Managed Identity

Secrets (`MONGODB_URI`, `JWT_SECRET`, `APPLICATIONINSIGHTS_CONNECTION_STRING`) are stored
in Key Vault and referenced in App Service app settings using the
`@Microsoft.KeyVault(SecretUri=...)` syntax. App Service resolves these at startup using the
system-assigned managed identity.

The critical configuration that is not exposed by the Terraform azurerm provider is
`keyVaultReferenceIdentity`. Without it set to `SystemAssigned`, the resolver reports
`MSINotEnabled` even when an identity is assigned. A `null_resource` provisioner runs
`az webapp update --set keyVaultReferenceIdentity=SystemAssigned` after every apply.

### Step 8 — Application Insights + Monitor Workbook

The Node.js App Insights SDK is initialized before any other `require` so it can
auto-instrument HTTP requests and MongoDB queries. Four custom business events are tracked:

| Event | Triggered by |
|---|---|
| `customer.login` | Successful authentication |
| `policy.viewed` | GET /api/policies/:id |
| `coverage.changed` | PATCH /api/policies/:id/coverage |
| `claim.opened` | POST /api/claims |

An Azure Monitor Workbook with 8 panels is provisioned by Terraform. It is bound to the
App Insights instance via `source_id = lower(azurerm_application_insights.main.id)` — the
`lower()` is required because the Azure Portal rejects mixed-case resource IDs in the
`source_id` field.

---

## Problems found and fixed

Every item below is a genuine bug hit during this project — included because the diagnosis
matters as much as the fix.

### 1. Zip deploy fails on a container-mode App Service

After Terraform provisions the App Service in container mode (`docker_image_name` set),
running `az webapp deploy` (zip deploy) causes Oryx to attempt a source code build inside
the container. It fails because the expected `package.json` structure doesn't match what
Oryx expects. Fix: deploy by updating the container image tag with
`az webapp config container set` + `az webapp restart`. Never use zip deploy once the App
Service is in container mode.

### 2. `--acr-use-identity` not recognized on az CLI 2.88

The Jenkins VM's Azure CLI version (2.88.0) does not support the `--acr-use-identity` flag
for `az webapp config container set`. Fix: use `--container-registry-user` and
`--container-registry-password` with the SP credentials instead.

### 3. Jenkins docker permission denied after first boot

`cloud-init` adds the `jenkins` user to the `docker` group during provisioning, but Jenkins
starts before the group membership takes effect in the process's credentials. Every pipeline
run fails with `permission denied on /var/run/docker.sock`. Fix: add
`systemctl restart jenkins` to `cloud-init.yml` after the Docker CE install and group
assignment steps.

### 4. express-rate-limit `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`

App Service sits behind a reverse proxy that injects `X-Forwarded-For`. With Express's
`trust proxy` unset (default false), `express-rate-limit` sees this header but doesn't
trust it, and throws. Fix: `app.set('trust proxy', 1)` in `server/index.js`.

### 5. express-rate-limit `ERR_ERL_INVALID_IP_ADDRESS`

After fixing problem 4, App Service's proxy started passing `request.ip` as `IP:port`
(e.g. `70.50.59.24:52895`). `express-rate-limit` validates the key as an IP address and
rejects the `IP:port` format, throwing before the login handler runs — meaning
`trackEvent('customer.login')` never fires. Fix: add a `keyGenerator` to the rate limiter
that strips the port: `(req) => req.ip.replace(/:\d+$/, '')`.

### 6. Workbook shows "No Application Insights resources selected"

The `fallbackResourceIds` field in the workbook JSON was present but the workbook
`source_id` in Terraform was pointing to `"azure monitor"` (the default). The portal opens
the workbook in a context where no App Insights resource is selected, so all queries fail.
Fix: set `source_id = lower(azurerm_application_insights.main.id)` on the
`azurerm_application_insights_workbook` resource. The `lower()` is required — the portal
rejects mixed-case resource IDs.

### 7. Workbook `name` must be a UUID

`terraform apply` failed with "expected name to be a valid UUID" on the workbook resource.
Fix: add `resource "random_uuid" "workbook" {}` and use `random_uuid.workbook.result` as
the workbook name.

### 8. Key Vault references show `MSINotEnabled`

After adding a User-Assigned Managed Identity to the App Service, all three Key Vault
references showed status `MSINotEnabled`. The reference resolver defaults to the
System-Assigned identity, ignoring User-Assigned identities unless explicitly told otherwise.
Fix: add `type = "SystemAssigned, UserAssigned"` to the identity block, add a Key Vault
access policy for the system-assigned principal ID, and set
`keyVaultReferenceIdentity=SystemAssigned` via `az webapp update`. The azurerm Terraform
provider does not expose `keyVaultReferenceIdentity` — a `null_resource` provisioner handles
it on every apply.

### 9. System-assigned identity principal_id unknown at plan time

After switching to `SystemAssigned, UserAssigned` identity, the Key Vault access policy
for the system identity couldn't reference `azurerm_linux_web_app.app.identity[0].principal_id`
because it was an empty string before the web app existed. This caused Terraform to fail
with "expected object_id to be a valid UUID". Fix: two-step apply — first apply creates
the identity, then the principal_id is captured (`az webapp identity show --query principalId`)
and written to `terraform.tfvars` as `app_system_identity_principal_id`, then a second apply
adds the access policy.

### 10. Terraform replaces Jenkins VM when `cloud-init.yml` changes

Any change to `cloud-init.yml` changes the `custom_data` hash, which forces VM replacement
(`-/+` in the plan). This is expected Terraform behaviour — VM user data is immutable after
first boot. Fix: accept the replacement, wait ~10 min for cloud-init to complete on the new
VM, then re-run the Jenkins setup wizard. The SP secret must be rotated and re-added to
Jenkins credentials each time.

### 11. F1 free tier CPU quota exceeded mid-session

The App Service F1 free tier has a daily CPU quota. During a long session it can be
exhausted, causing App Service to return HTTP 403 ("Site Disabled") for all requests. The
container is deployed correctly — the quota suspension is temporary. Fix: update the CD
health check to treat a 403 response as a passing check with a warning message, rather than
retrying until timeout and failing the build. The quota resets at midnight UTC.

---

## Security design

- **No secrets in app settings** — `MONGODB_URI`, `JWT_SECRET`, and
  `APPLICATIONINSIGHTS_CONNECTION_STRING` are Key Vault references resolved by the
  system-assigned Managed Identity at runtime. The actual values never appear in the portal
  or in Terraform state as plaintext app settings.
- **JWT authentication** — 8h expiry, rate-limited login (10 req / 15 min per IP)
- **Helmet.js** — CSP, X-Frame-Options, HSTS, and other security headers
- **Non-root container** — app runs as a non-root user inside the container
- **ACR admin disabled** — registry auth uses Service Principal (Jenkins push) and SP
  credentials (CD pull); admin credentials never enabled

### Production path: Azure AD B2C

The JWT implementation is intentional for portfolio clarity. A BelairDirect-scale deployment
would use **Azure AD B2C** for customer identity federation, MFA, self-service password
reset, and claims-based token enrichment.

---

## Coverage model — Ontario insurance

### Auto (Ontario SABS-compliant)

**Mandatory** (cannot be removed):
- Third-Party Liability — $2M standard (min $200K by law)
- Accident Benefits (SABS)
- Direct Compensation – Property Damage (DCPD)
- Uninsured Automobile

**Optional** (toggleable in-app):
- Collision — deductible: $500 / $1,000 / $2,500
- Comprehensive — deductible: $300 / $500 / $1,000
- Rental Reimbursement (OPCF 20)
- Waiver of Depreciation (OPCF 43)
- Roadside Assistance

### Home (Ontario all-perils)

**Included**: Dwelling (replacement cost), Detached Structures, Personal Property,
Additional Living Expenses, Personal Liability

**Optional add-ons**: Sewer Backup, Overland Water, Home-Based Business, Jewellery Floater,
Identity Theft Protection

---

## Local development setup

```bash
# 1. Clone
git clone https://github.com/satyadeep11singh/northwind-policy-hub.git
cd northwind-policy-hub

# 2. Install dependencies (root + client)
npm install
npm install --prefix client

# 3. Configure environment
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET  (leave KEY_VAULT_URI blank for local)

# 4. Seed the database
npm run seed

# 5. Start dev servers (Express API + Vite HMR concurrently)
npm run dev
# App:  http://localhost:5173
# API:  http://localhost:3001
```

---

## Deployment runbook

### Step 1 — Provision infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Fill in: mongodb_uri, jwt_secret, jenkins_ssh_public_key, jenkins_sp_object_id

terraform init
terraform apply -var-file=terraform.tfvars
```

### Step 2 — Capture system identity principal ID (two-apply pattern)

```bash
# After first apply, get the system-assigned identity principal ID
az webapp identity show \
  --resource-group rg-northwind-policy-hub-dev \
  --name nw-policy-hub-{suffix} \
  --query principalId -o tsv

# Add to terraform.tfvars:
# app_system_identity_principal_id = "<value above>"

terraform apply -var-file=terraform.tfvars
```

### Step 3 — Jenkins setup

```bash
# SSH into the Jenkins VM
ssh azureuser@$(terraform output -raw jenkins_public_ip)

# Get initial admin password
cat /var/log/cloud-init-jenkins.log
```

Open `http://{jenkins_ip}:8080`, complete the setup wizard, install suggested plugins.

### Step 4 — Jenkins credentials and jobs

Create one credential:
- **ID:** `azure-sp` · **Type:** Username/Password
- **Username:** SP Client ID · **Password:** SP Client Secret

Create two pipeline jobs:
1. `northwind-policy-hub-ci` → Pipeline from SCM → Script Path: `jenkins/Jenkinsfile.ci`
2. `northwind-policy-hub-cd` → Pipeline from SCM → Script Path: `jenkins/Jenkinsfile.cd`
   → add string parameter `BUILD_TAG`

### Step 5 — First run

Trigger `northwind-policy-hub-ci` manually. CD is triggered automatically on CI success.

```bash
# Verify
curl https://$(terraform output -raw app_url)/health
# Expected: {"status":"ok","version":"1.0.0","buildId":"...","db":"connected"}
```

---

## Cost management

| Resource | SKU | ~Monthly (CAD) |
|---|---|---|
| Jenkins VM | Standard_B2s_v2 | ~$90 |
| App Service Plan | F1 Free | $0 |
| Container Registry | Basic | ~$6 |
| Key Vault | Standard | ~$0.50 |
| App Insights + Log Analytics | Pay-per-use | ~$2 |
| **Total while running** | | **~$100/month** |

**Cost discipline:** The Jenkins VM is the only billable compute resource. Destroy it
between sessions with `terraform destroy -target azurerm_linux_virtual_machine.jenkins`.
The App Service F1 is free. Terraform remote state survives destroy.
