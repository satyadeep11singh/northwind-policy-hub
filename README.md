# NorthWind Insurance — Policy Hub

A production-grade customer self-service portal for Ontario auto and home insurance policies. Built as a showcase of Azure cloud engineering skills: Terraform IaC, Jenkins CI/CD on Azure VM, Docker + ACR, App Service deployment slots, Key Vault, and Application Insights.

---

## What It Does

Existing NorthWind customers log in to:

| Feature | Detail |
|---|---|
| **Policy Dashboard** | View all active auto and home policies in one place |
| **Coverage Management** | Toggle optional coverages on/off; adjust collision and comprehensive deductibles |
| **Claims** | View claim history with adjuster notes and status tracker; open new claims |
| **Billing** | See next payment date/amount, payment frequency, and full payment history per policy |

Demo accounts (password `Demo@1234`):

| Account | Policies | Claims |
|---|---|---|
| `sarah.chen@email.com` | 2022 Honda CR-V + Toronto condo | Settled collision + active water damage |
| `marco.rossi@email.com` | 2020 Toyota RAV4 + 2019 Ford F-150 | New windshield claim |
| `priya.sharma@email.com` | 2023 Hyundai Tucson + Ottawa semi-detached | Clean record |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       GitHub Repository                         │
│                  (source of truth, webhooks)                    │
└────────────────────────────┬───────────────────────────────────┘
                             │ webhook on push to main
                             ▼
┌────────────────────────────────────────────────────────────────┐
│          Jenkins VM  (Standard_B2s · Azure VM)                  │
│          Terraform-provisioned · Ubuntu 22.04 · cloud-init      │
│                                                                  │
│  CI Pipeline (Jenkinsfile.ci)                                   │
│    checkout → npm install (parallel) → lint → test →            │
│    npm run build (React/Vite) → docker build → push ACR         │
│                                                                  │
│  CD Pipeline (Jenkinsfile.cd) — triggered by CI                 │
│    az login (SP) → deploy dev slot → smoke test →              │
│    swap dev→staging → smoke test →                              │
│    swap staging→production → health check → rollback if fail    │
└──────────┬─────────────────┬──────────────────────────────────┘
           │                 │
           ▼                 ▼
    ┌────────────┐   ┌───────────────────────────────────────┐
    │    ACR     │   │    Azure App Service  (Standard S1)    │
    │  (Basic)   │   │                                        │
    │ Docker img │   │  production slot  → nw-policy-hub.    │
    │ tagged by  │   │                     azurewebsites.net │
    │ build#-SHA │   │  staging slot     → nw-policy-hub-    │
    └────────────┘   │                     staging.azurewebsites.net │
                     │  dev slot         → nw-policy-hub-    │
                     │                     dev.azurewebsites.net     │
                     │                                        │
                     │  System-assigned Managed Identity      │
                     └──────────┬────────────────────────────┘
                                │ MI reads secrets at startup
                                ▼
                     ┌────────────────────┐
                     │    Key Vault       │
                     │  mongodb-uri       │
                     │  jwt-secret        │
                     │  appinsights-conn  │
                     └────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
            ┌──────────────┐    ┌──────────────────────┐
            │ MongoDB Atlas│    │  Application Insights │
            │  (free M0)  │    │  + Log Analytics WS   │
            │ switchable  │    │  custom events:       │
            │ to Cosmos DB│    │  customer.login       │
            └─────────────┘    │  claim.opened         │
                               │  coverage.changed     │
                               │  policy.viewed        │
                               └──────────────────────┘
```

---

## Azure Services Used

| Service | Role | Enterprise Pattern |
|---|---|---|
| **Azure App Service** (Linux, S1) | Runtime for Node.js + React app | Deployment slots for zero-downtime promotion |
| **App Service Deployment Slots** | dev / staging / production | Zero-downtime swap; instant rollback |
| **Azure Container Registry** (Basic) | Docker image store | SP-based push from Jenkins; MI-based pull by App Service |
| **Azure Key Vault** | Secret store | Managed Identity access — no passwords in code or env vars |
| **Managed Identity** | App Service identity | AcrPull + Key Vault Get/List — zero credential rotation |
| **Application Insights** | APM + custom telemetry | Node.js SDK auto-instruments HTTP, MongoDB, and custom events |
| **Log Analytics Workspace** | Backing store for App Insights | Workspace-based AI (not classic) |
| **Azure VM** (Standard_B2s) | Self-hosted Jenkins | Terraform + cloud-init provisioned; NSG-restricted |
| **Terraform remote state** | State backend | Azure Blob Storage shared with NorthWind project suite |

---

## Repository Structure

```
northwind-policy-hub/
├── server/                    # Express API
│   ├── index.js               # Boot sequence (Key Vault → DB → listen)
│   ├── models/                # Mongoose schemas
│   │   ├── Customer.js
│   │   ├── Policy.js          # Auto + home coverage sub-schemas
│   │   ├── Billing.js
│   │   └── Claim.js
│   ├── routes/                # REST endpoints
│   │   ├── auth.js            # POST /api/auth/login|logout
│   │   ├── policies.js        # GET/PATCH /api/policies
│   │   ├── billing.js         # GET /api/billing
│   │   ├── claims.js          # GET/POST /api/claims
│   │   └── health.js          # GET /health (Jenkins CD pings this)
│   ├── middleware/
│   │   ├── auth.js            # JWT Bearer verification
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── appInsights.js     # Application Insights init + trackEvent
│   │   ├── keyVault.js        # Managed Identity secret loader
│   │   ├── db.js              # Mongoose connect (Atlas or Cosmos DB)
│   │   └── logger.js          # Winston (JSON in prod, pretty in dev)
│   └── seed/index.js          # Seed 3 customers, 6 policies, billing, claims
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx            # Router + protected routes
│   │   ├── context/AuthContext.jsx
│   │   ├── services/api.js    # Axios instance + auth interceptor
│   │   ├── components/AppShell.jsx  # Sidebar + topbar layout
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── DashboardPage.jsx
│   │       ├── PoliciesPage.jsx
│   │       ├── PolicyDetailPage.jsx  # Coverage toggles + deductible selector
│   │       ├── ClaimsPage.jsx        # List + new claim form
│   │       ├── ClaimDetailPage.jsx   # Progress tracker + adjuster notes
│   │       └── BillingPage.jsx
│   └── vite.config.js
├── infra/                     # Terraform
│   ├── main.tf                # Root: RGs, module calls, KV secrets, MI access policy
│   ├── variables.tf
│   ├── outputs.tf
│   └── modules/
│       ├── acr/               # Azure Container Registry
│       ├── app_service/       # App Service Plan + Web App + 2 slots
│       ├── app_insights/      # Application Insights + Log Analytics Workspace
│       ├── key_vault/         # Key Vault + deployer access policy
│       └── jenkins_vm/        # VM + VNet + subnet + NSG + public IP
├── jenkins/
│   ├── Jenkinsfile.ci         # CI: install → lint → test → build → push ACR
│   ├── Jenkinsfile.cd         # CD: az login → deploy dev → swap → prod health check
│   ├── cloud-init.yml         # Jenkins VM first-boot provisioning
│   └── jenkins-credentials-setup.md
├── Dockerfile                 # Multi-stage: React build + Node server
├── .env.example
└── package.json
```

---

## Local Development Setup

```bash
# 1. Clone
git clone https://github.com/satyadeep11singh/northwind-policy-hub.git
cd northwind-policy-hub

# 2. Install dependencies
npm install
npm install --prefix client

# 3. Configure environment
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET (leave KEY_VAULT_URI blank for local)

# 4. Seed the database
npm run seed

# 5. Start dev server (Express API + Vite HMR concurrently)
npm run dev
# App: http://localhost:5173   API: http://localhost:3001
```

---

## Deployment Runbook

### Step 1 — Provision infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Fill in: mongodb_uri, jwt_secret, jenkins_admin_password

terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Capture outputs
terraform output -json > ../docs/tf-outputs.json
```

### Step 2 — Set up Jenkins VM

```bash
# SSH into the Jenkins VM
ssh azureuser@$(terraform output -raw jenkins_public_ip)

# Initial admin password
cat /var/log/cloud-init-jenkins.log

# Open http://<public-ip>:8080 and complete setup wizard
# Install plugins: Pipeline, Git, Docker Pipeline, Credentials Binding, JUnit, HTML Publisher
```

Configure credentials per [jenkins/jenkins-credentials-setup.md](jenkins/jenkins-credentials-setup.md).

### Step 3 — Create Jenkins jobs

In Jenkins UI:
1. **New Item** → `northwind-policy-hub-ci` → Pipeline → SCM: this repo → Script Path: `jenkins/Jenkinsfile.ci`
2. **New Item** → `northwind-policy-hub-cd` → Pipeline → Script Path: `jenkins/Jenkinsfile.cd`
3. Configure GitHub webhook: `http://<jenkins-ip>:8080/github-webhook/`

### Step 4 — First pipeline run

Push to `main` or trigger the CI job manually. The CD pipeline is triggered automatically on success.

**Expected flow:**
```
CI:  checkout → install → lint → test → build → docker build → push ACR → trigger CD
CD:  az login → deploy dev slot → health check → swap dev→staging → swap staging→prod → health check
```

### Step 5 — Verify

```bash
curl https://$(terraform output -raw app_service_url)/health
# Expected: {"status":"ok","version":"1.0.0","buildId":"<build-tag>","db":"connected"}
```

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

**Included**:
- Dwelling (replacement cost), Detached Structures, Personal Property, Additional Living Expenses, Personal Liability

**Optional add-ons**:
- Sewer Backup, Overland Water (flooding), Home-Based Business, Jewellery Floater, Identity Theft Protection

---

## Observability — Application Insights

Custom events tracked server-side (visible in Azure Monitor → Application Insights → Custom Events):

| Event | Triggered by |
|---|---|
| `customer.login` | Successful authentication |
| `policy.viewed` | GET /api/policies/:id |
| `coverage.changed` | PATCH /api/policies/:id/coverage |
| `claim.opened` | POST /api/claims |

Build an Azure Monitor Workbook over these events for a live dashboard showing login volume, claim frequency, and coverage change trends.

---

## Security design

- **No secrets in code or environment variables** — all secrets fetched from Key Vault at startup via Managed Identity
- **JWT authentication** — 8h expiry, rate-limited login endpoint (10 req / 15 min per IP)
- **Helmet.js** — sets CSP, X-Frame-Options, HSTS, and other security headers
- **Non-root container** — app runs as `appuser` (UID unpredictable) inside the container
- **ACR admin disabled** — registry auth uses Service Principal (Jenkins) and Managed Identity (App Service), never admin credentials

### Production path: Azure AD B2C

The current JWT implementation is intentional for portfolio clarity. In a real BelairDirect-scale deployment this would use **Azure AD B2C** for:
- Customer identity federation (social login, MFA)
- Self-service password reset
- Branded login page
- Claims-based token enrichment

See branch `feature/b2c-auth` (future) for the full Passport.js + B2C tenant integration.

---

## Cost management

| Resource | SKU | ~Monthly cost (CAD) |
|---|---|---|
| App Service Plan | Standard S1 | ~$75 |
| Jenkins VM | Standard_B2s | ~$45 |
| Container Registry | Basic | ~$6 |
| Key Vault | Standard | ~$0.50 |
| App Insights + Log Analytics | Pay-per-use | ~$2 |
| **Total while running** | | **~$130/month** |

**Cost discipline:** Destroy the Jenkins VM (`terraform destroy -target module.jenkins_vm`) between sessions. The App Service can be stopped (not destroyed) to save ~$75/month when not demoing.

---

## Switching from MongoDB Atlas to Cosmos DB for MongoDB

Change `DB_PROVIDER` and `MONGODB_URI` in your Key Vault secret or `.env`:

```
DB_PROVIDER=cosmosdb
MONGODB_URI=mongodb://<account>:<key>@<account>.mongo.cosmos.azure.com:10255/<db>?ssl=true&replicaSet=globaldb
```

No application code changes required — the Mongoose driver is protocol-compatible with Cosmos DB for MongoDB.
