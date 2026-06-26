import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    // 1. Check Azure CLI login state
    let azOutput;
    try {
      const { stdout } = await execAsync("az account show");
      azOutput = JSON.parse(stdout);
    } catch {
      return NextResponse.json({
        loggedIn: false,
        step: "az",
        message: "Not authenticated with Azure CLI.",
      });
    }

    const username = azOutput?.user?.name || "Unknown User";
    const tenantId = azOutput?.tenantId || "Unknown Tenant";

    // 2. Check if Power BI CLI is authenticated/linked
    let pbiLinked = false;
    try {
      // Run a fast lightweight query to check if linked
      await execAsync("pbicli workspace list --query \"[0].id\"");
      pbiLinked = true;
    } catch {
      pbiLinked = false;
    }

    return NextResponse.json({
      loggedIn: true,
      user: username,
      tenantId: tenantId,
      linked: pbiLinked,
      message: pbiLinked 
        ? `Authenticated as ${username} (linked to pbicli).`
        : `Authenticated as ${username} (Azure CLI only). Power BI session not linked.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { loggedIn: false, error: error.message },
      { status: 500 }
    );
  }
}
