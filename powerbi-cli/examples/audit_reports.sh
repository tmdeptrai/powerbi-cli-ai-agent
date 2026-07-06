#!/usr/bin/env bash

# ==============================================================================
# Power BI Report Auditor
# 
# Description:
#   Logs in, loops through all accessible Power BI workspaces, and retrieves
#   the metadata of all reports located in each workspace. 
# ==============================================================================

set -eo pipefail

echo "=== Authenticating with Power BI CLI ==="
# Note: Ensure you are logged into Azure CLI ('az login') first
pbicli login --azurecli

echo -e "\n=== Fetching Workspace IDs ==="
# Retrieve only the workspace ID array using a JMESPath query
workspace_ids=$(pbicli workspace list --query "[*].id" --output tsv)

if [ -z "$workspace_ids" ]; then
    echo "No collaborative workspaces found (or you only have 'My workspace')."
    echo "Auditing personal sandbox ('My workspace') reports:"
    pbicli report list --query "[*].{reportName:name, reportId:id}" --output json
    exit 0
fi

echo -e "\n=== Auditing Reports across Workspaces ==="
for id in $workspace_ids
do
    workspace_name=$(pbicli workspace list --query "[?id=='$id'].name | [0]" --output tsv)
    echo "--------------------------------------------------"
    echo "Workspace: $workspace_name (ID: $id)"
    echo "--------------------------------------------------"
    
    # List all reports in the workspace formatted in JSON
    pbicli report list --workspace "$id" --query "[*].{reportName:name, reportId:id}" --output json
done
