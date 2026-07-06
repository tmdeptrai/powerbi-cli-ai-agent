# Power BI CLI Agent Skill

This folder contains a modular agent skill for managing Power BI Service resources, workflows, and executing DAX queries using the Power BI command-line interface (pbicli).

## Folder Structure

* SKILL.md: Main instruction file containing agent guidelines and CLI command definitions.
* scripts/: Safe execution utility scripts (e.g. executeSafePbi.ts wrapper).
* examples/: Sample scripts and DAX query templates.
* references/: Offline manuals and documentation copies (e.g. POWERBICLI_MANUAL.md).

## Setup Prerequisites

To utilize this skill, ensure the following are installed and configured:
1. Node.js (v18 or higher)
2. Power BI CLI: `npm i -g @powerbi-cli/powerbi-cli`
3. Azure CLI: Logged in via `az login --allow-no-subscriptions`

## Authentication Linking

Before executing commands, link your Azure CLI session to the Power BI CLI:
```bash
pbicli login --azurecli
```

## Integrating into an Agent

To equip an AI agent with this skill, configure the agent to point to this directory. The agent should read `SKILL.md` to learn about the command schemas, parameters, and the necessary workarounds for known pbicli bugs (such as appending `--script "{}"` to prevent silent query execution failures).
