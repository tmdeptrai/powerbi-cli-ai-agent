# Power BI CLI (`pbicli`) Reference Manual

The Power BI command-line interface (`pbicli`) is a cross-platform tool developed by the community to interact with the Power BI Service REST APIs. It is designed to simplify and automate administrative, deployment, and content management tasks in Power BI.

---

## 1. Authentication & Setup

`pbicli` supports two primary methods of authentication: **Azure CLI integration** (for user accounts) and **Service Principals** (for automated pipelines).

### Method A: Azure CLI login (Recommended for users)
This leverages an existing active session from the Azure CLI.

1. Authenticate with Azure CLI:
   ```bash
   az login --allow-no-subscriptions
   ```
2. Link the Power BI CLI to the Azure CLI session:
   ```bash
   pbicli login --azurecli
   ```

### Method B: Service Principal (Recommended for CI/CD)
To use a Service Principal, you must set up an App Registration in Microsoft Entra ID (Azure AD), configure scopes, place the app in a Security Group, and enable the developer setting in the Power BI Admin Portal.

#### API Permission Scopes
The Service Principal requires the following scopes depending on the commands you wish to execute:

| Command Group | Required Scopes |
|---|---|
| `admin` | `Tenant.Read.All`, `Tenant.ReadWrite.All` (Requires Admin Consent) |
| `app` | `App.Read.All` |
| `capacity` | `Capacity.Read.All`, `Capacity.ReadWrite.All` |
| `dashboard` | `Dashboard.Read.All`, `Dashboard.ReadWrite.All`, `Content.Create` |
| `dataflow` | `Dataflow.Read.All`, `Dataflow.ReadWrite.All` |
| `dataset` | `Dataset.Read.All`, `Dataset.ReadWrite.All` |
| `gateway` | `Dataset.Read.All`, `Dataset.ReadWrite.All` |
| `import` | `Dataset.ReadWrite.All` |
| `report` | `Report.Read.All`, `Report.ReadWrite.All`, `Dataset.Read.All`, `Dataset.ReadWrite.All` |
| `workspace` | `Workspace.Read.All`, `Workspace.ReadWrite.All` |

---

## 2. Global Parameters

Every `pbicli` command accepts these options:

* `--output -o [json|tsv|yml]`: Set output format (default is `json`).
* `--output-file <file>`: Redirect response body to a file.
* `--query <query>`: Apply a JMESPath query to filter output (e.g., retrieve IDs only).
* `--verbose` / `--debug`: Control verbosity.
* `--help -h`: Display context-sensitive help.

---

## 3. Command Subgroup Reference

### Workspace Management (`workspace`)
Manage Power BI Collaborative Workspaces and permissions.

* **List Workspaces**:
  ```bash
  pbicli workspace list
  ```
* **Create Workspace**:
  ```bash
  pbicli workspace create --workspace "Sales Demographics"
  ```
* **Delete Workspace**:
  ```bash
  pbicli workspace delete --workspace "Sales Demographics"
  ```
* **Manage Permissions**:
  ```bash
  # Grant Access
  pbicli workspace user add --workspace "Sales Demographics" --email user@company.com --access-right Contributor --principal-type User
  # List Access
  pbicli workspace user list --workspace "Sales Demographics"
  ```

### Reports (`report`)
Operations on Power BI reports.

* **List Reports**:
  ```bash
  pbicli report list --workspace "Sales Demographics"
  ```
* **Clone Report**:
  ```bash
  pbicli report clone --workspace "Sales Demographics" --report "Q1 Report" --name "Q1 Backup"
  ```
* **Rebind to Dataset**:
  ```bash
  pbicli report rebind --workspace "Sales" --report "Q1 Report" --target-dataset "<new-dataset-id>"
  ```
* **Export Reports (PDF, PPTX, PBIX, CSV, XLSX)**:
  ```bash
  # Start the export job
  pbicli report export start --workspace "Sales" --report "Q1 Report" --format PDF
  # Check status
  pbicli report export status --workspace "Sales" --report "Q1 Report" --export "<export-job-id>"
  # Download report
  pbicli report export download --workspace "Sales" --report "Q1 Report" --export "<export-job-id>"
  ```

### Datasets (`dataset`)
Manage connections, parameters, schemas, DAX execution, and refreshes.

* **List Datasets**:
  ```bash
  pbicli dataset list --workspace "Sales Demographics"
  ```
* **Query Premium/XMLA Dataset (Execute DAX)**:
  ```bash
  pbicli dataset query --workspace "Sales" --dataset "Q1 Data" --dax "EVALUATE(TOPN(10, 'Customer'))"
  ```
* **Dataset Refresh**:
  ```bash
  # Trigger refresh
  pbicli dataset refresh start --workspace "Sales" --dataset "Q1 Data"
  # Get refresh history
  pbicli dataset refresh history --workspace "Sales" --dataset "Q1 Data"
  ```
* **Update Parameters**:
  ```bash
  pbicli dataset parameter update --workspace "Sales" --dataset "Q1 Data" --parameter '[{"name": "ServerName", "newValue": "prod-sql-srv"}]'
  ```

### Imports (`import`)
Upload files to the Power BI Service.

* **Upload PBIX (< 1GB)**:
  ```bash
  pbicli import pbix --workspace "Sales" --file "./sales_model.pbix" --conflict Overwrite
  ```
* **Upload Large PBIX (> 1GB, < 10GB)**:
  ```bash
  pbicli import pbix-large --workspace "Sales" --name "Large Dataset" --url "<blob-sas-url>"
  ```
* **Upload Paginated Reports (RDL)**:
  ```bash
  pbicli import rdl --workspace "Sales" --file "./monthly_invoices.rdl"
  ```

### Deployment Pipelines (`pipeline`)
Deploy content programmatically across environments (Dev, Test, Prod).

* **Create Pipeline**:
  ```bash
  pbicli pipeline create --pipeline "Sales Deployment Lifecycle"
  ```
* **Assign Workspace**:
  ```bash
  pbicli pipeline assign --pipeline "Sales Deployment Lifecycle" --stage 0 --workspace "Sales Dev"
  ```
* **Deploy Content**:
  ```bash
  pbicli pipeline deploy --pipeline "Sales Deployment Lifecycle" --partial
  ```

### Scorecards (`scorecard`)
Manage business metrics and goals.

* **Create Scorecard**:
  ```bash
  pbicli scorecard create --workspace "Executive Board" --scorecard "Corporate KPIs"
  ```
* **Check-In Goal Value**:
  ```bash
  pbicli scorecard goal value create --workspace "Executive Board" --scorecard "Corporate KPIs" --goal "Revenue Goal" --definition '{"value": 15000000, "timestamp": "2026-06-26T00:00:00Z"}'
  ```

### Admin Operations (`admin`)
Tenant-wide monitoring and governance (requires tenant admin consent).

* **Extract Activity Logs**:
  ```bash
  pbicli admin activity --date "2026-06-25" --start-time "09:00:00" --end-time "18:00:00"
  ```
* **Audit Workspaces**:
  ```bash
  pbicli admin workspace list --expand users,reports,datasets
  ```
* **Restore Deleted Workspace**:
  ```bash
  pbicli admin workspace restore --workspace "<deleted-workspace-id>" --owner "admin@company.com" --name "Restored Sales"
  ```

---

## 4. Scripting Examples

### Example 1: Exporting all Workspace IDs to a TSV file
Useful for creating a quick inventory list.
```bash
pbicli workspace list --query "[*].{name:name, id:id}" --output tsv > workspaces.tsv
```

### Example 2: Checking dataset refresh history and alerting
```bash
# Retrieve the latest refresh status
latest_status=$(pbicli dataset refresh history --workspace "Finance" --dataset "Revenue Model" --query "[0].status" --output tsv)

if [ "$latest_status" == "Failed" ]; then
    echo "Alert: Revenue Model dataset refresh failed!"
    # Insert notification logic here (e.g., Slack curl or Email)
fi
```

### Example 3: Loop through all Workspaces and list Reports
```bash
# Fetch list of workspace IDs
workspace_ids=$(pbicli workspace list --query "[*].id" --output tsv)

for id in $workspace_ids
do
    echo "--- Reports in Workspace ID: $id ---"
    pbicli report list --workspace "$id" --query "[*].{name:name, id:id}" --output json
done
```
