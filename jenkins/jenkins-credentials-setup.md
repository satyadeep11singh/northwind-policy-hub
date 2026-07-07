# Jenkins Credentials Setup

After first login, go to **Manage Jenkins → Credentials → System → Global credentials → Add Credential**.

| Credential ID            | Type              | Value                                       |
|--------------------------|-------------------|---------------------------------------------|
| `azure-sp`               | Username/Password | Username = SP Client ID, Password = SP Secret |
| `azure-tenant-id`        | Secret text       | Azure Tenant ID                              |
| `azure-subscription-id`  | Secret text       | Azure Subscription ID                        |
| `azure-resource-group`   | Secret text       | e.g. `rg-northwind-policy-hub-dev`           |
| `acr-name`               | Secret text       | e.g. `nwpolicyhubXXXXXX`                    |
| `acr-login-server`       | Secret text       | e.g. `nwpolicyhubXXXXXX.azurecr.io`         |
| `webapp-name`            | Secret text       | e.g. `nw-policy-hub-XXXXXX`                 |

## Service Principal permissions required

The SP used by Jenkins needs the following role assignments (all scoped to the app resource group):

- `AcrPush` on the Azure Container Registry
- `Contributor` on the App Service (for `az webapp config container set` and slot swap)
- `Reader` on the subscription (for `az account set`)

Create the SP:
```bash
az ad sp create-for-rbac \
  --name "sp-northwind-jenkins" \
  --role Contributor \
  --scopes /subscriptions/<sub-id>/resourceGroups/rg-northwind-policy-hub-dev \
  --sdk-auth
```

Then assign AcrPush separately:
```bash
az role assignment create \
  --assignee <sp-client-id> \
  --role AcrPush \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-northwind-policy-hub-dev/providers/Microsoft.ContainerRegistry/registries/<acr-name>
```
