---
name: powerbi-cli
description: Agent skill for managing Power BI resources, workflows, and executing queries via the Power BI CLI (pbicli).
---

# Power BI CLI (`pbicli`) Agent Skill

This skill documents how to interact with the Power BI Service via the community-built command-line interface (`pbicli`). It includes authentication setup, resource management command groups, scripting, and critical bug workarounds necessary for successful automation.

---

## 1. Authentication & Setup

`pbicli` supports two primary methods of authentication: **Azure CLI integration** (ideal for user accounts) and **Service Principals** (ideal for automated CI/CD pipelines).

### Method A: Azure CLI Login (Recommended for Users)
Leverages an active Azure CLI session to access the Power BI service.
1. Authenticate with Azure CLI:
   ```bash
   az login --allow-no-subscriptions
   ```
2. Link the Power BI CLI to the Azure CLI session:
   ```bash
   pbicli login --azurecli
   ```

### Method B: Service Principal Login (Recommended for CI/CD)
To use a Service Principal, you must set up an App Registration in Microsoft Entra ID (Azure AD), configure scopes, and enable service principal access in the Power BI Admin Portal.

#### Required Scopes by Module
| module | Scopes Required |
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

## 2. Command Reference

### Global Parameters (Accepted by all commands)
* `--output -o [json|tsv|yml]`: Set output format (default is `json`).
* `--output-file <file>`: Redirect output payload to a file.
* `--query <query>`: Apply a JMESPath filter expression to select or format output (e.g., retrieving only ID arrays).
* `--verbose` / `--debug`: Control log verbosity.
* `--help -h`: Display context-sensitive help.

### Workspace Module (`workspace`)
Used to manage collaborative workspaces and access rights.
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
  pbicli workspace user add --workspace "Sales" --email user@company.com --access-right Contributor --principal-type User
  # List Workspace Users
  pbicli workspace user list --workspace "Sales"
  ```

### Reports Module (`report`)
Used to manage Power BI report definitions and exports.
* **List Reports**:
  ```bash
  pbicli report list --workspace "Sales"
  ```
* **Clone Report**:
  ```bash
  pbicli report clone --workspace "Sales" --report "Q1 Report" --name "Q1 Backup"
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

### Datasets Module (`dataset`)
Allows triggering refreshes, querying data, and modifying parameters.
* **List Datasets**:
  ```bash
  pbicli dataset list --workspace "Sales"
  ```
* **Dataset Refresh**:
  ```bash
  # Trigger refresh
  pbicli dataset refresh start --workspace "Sales" --dataset "Q1 Data"
  # Get refresh history
  pbicli dataset refresh history --workspace "Sales" --dataset "Q1 Data"
  ```
* **Update Dataset Parameters**:
  ```bash
  pbicli dataset parameter update --workspace "Sales" --dataset "Q1 Data" --parameter '[{"name": "ServerName", "newValue": "prod-sql-srv"}]'
  ```

### Imports Module (`import`)
Used for publishing templates and report models to a workspace.
* **Upload PBIX (< 1GB)**:
  ```bash
  pbicli import pbix --workspace "Sales" --file "./model.pbix" --conflict Overwrite
  ```
* **Upload Paginated Reports (RDL)**:
  ```bash
  pbicli import rdl --workspace "Sales" --file "./monthly_invoices.rdl"
  ```

### Deployment Pipelines Module (`pipeline`)
Automates promotion of content across environments (Dev, Test, Prod).
* **Create Pipeline**:
  ```bash
  pbicli pipeline create --pipeline "Lifecycle"
  ```
* **Assign Workspace**:
  ```bash
  pbicli pipeline assign --pipeline "Lifecycle" --stage 0 --workspace "Sales Dev"
  ```
* **Deploy Content**:
  ```bash
  pbicli pipeline deploy --pipeline "Lifecycle" --partial
  ```

---

## 3. Critical CLI Bugs & Workarounds

> [!IMPORTANT]
> When automating or integrating `pbicli` in an AI agent, middleware, or scripting pipeline, you **must** apply these workarounds to avoid silent failures and crashing.

### Bug A: The Dataset Query Silent Crash (`pbicli dataset query`)
* **The Bug**: Executing `pbicli dataset query --dax "..."` without providing a script option (either `--script` or `--script-file`) causes `powerbi-cli` to evaluate its internal script fallback template as `@undefined`. It tries to read a file named `"undefined"` from the local directory using `fs.readFileSync`, throwing an `ENOENT` exception. The CLI's global error handler swallows this exception and exits silently with code `0` and empty outputs.
* **The Workaround**: Always append a dummy `--script "{}"` argument to the query command. This bypasses the buggy fallback file path evaluation.
  ```bash
  # INCORRECT (returns 0 output silently)
  pbicli dataset query --dataset "MyDataset" --dax "EVALUATE TOPN(10, 'Table')"

  # CORRECT (returns query output successfully)
  pbicli dataset query --dataset "MyDataset" --dax "EVALUATE TOPN(10, 'Table')" --script "{}"
  ```

### Bug B: Raw DAX JSON Interpolation Issues
* **The Bug**: `pbicli` interpolates the query string directly into a raw JSON string template `body` without escaping. If your DAX query contains newlines (e.g. from multi-line pasted queries) or double quotes, it corrupts the POST payload JSON sent to the Power BI REST API, causing a 400 Bad Request or malformed data payload error.
* **The Workaround**: Sanitize query strings programmatically before executing them in the shell.
  1. Replace all consecutive whitespaces/newlines with a single space: `.replace(/\s+/g, " ")`.
  2. Normalize double quotes to single quotes: `.replace(/"/g, "'")`.

### Bug C: Workspace Naming Convention for "My workspace"
* **The Bug**: Specifying `--workspace "My workspace"` in commands throws a `No workspace found` error.
* **The Workaround**: To target the user's personal sandbox workspace, **omit the `--workspace` parameter entirely** from the command.

---

## 4. Middleware/Wrapper Implementation Example

To safely invoke `pbicli` in node/typescript pipelines, implement a wrapper like the following:

```typescript
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export async function executeSafePbiCommand(rawCommand: string): Promise<string> {
  let command = rawCommand.trim();

  // 1. Enforce pbicli prefix check
  if (!command.startsWith("pbicli")) {
    throw new Error("Invalid command prefix");
  }

  // 2. Fix the pbicli dataset query bug automatically
  if (command.startsWith("pbicli dataset query") && 
      !command.includes("--script") && 
      !command.includes("--script-file")) {
    command += ' --script "{}"';
  }

  const result = await execAsync(command);
  return result.stdout + (result.stderr ? `\n\nStderr:\n${result.stderr}` : "");
}
```

---

## 5. Scripting Automation Examples

### Example A: Exporting Workspace Metadata to TSV (using JMESPath)
```bash
pbicli workspace list --query "[*].{name:name, id:id}" --output tsv > workspaces.tsv
```

### Example B: Loop and Audit Reports in all Workspaces
```bash
# Get all workspace IDs
workspace_ids=$(pbicli workspace list --query "[*].id" --output tsv)

for id in $workspace_ids
do
    echo "Auditing Workspace ID: $id"
    pbicli report list --workspace "$id" --query "[*].{reportName:name, reportId:id}" --output json
done
```
