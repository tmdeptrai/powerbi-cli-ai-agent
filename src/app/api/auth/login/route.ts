import { NextResponse } from "next/server";
import { exec } from "child_process";

// Keep track of active login processes to prevent overlapping runs
let loginInProgress = false;

export async function POST() {
  if (loginInProgress) {
    return NextResponse.json({
      started: true,
      message: "Login process is already active. Please check your browser tabs to complete the login.",
    });
  }

  loginInProgress = true;

  // Run 'az login' which opens a new browser window/tab on the host system.
  // It runs in the background so we don't block the API response.
  exec("az login --allow-no-subscriptions", (azErr, azStdout, azStderr) => {
    if (azErr) {
      console.error("az login error:", azErr.message);
      loginInProgress = false;
      return;
    }

    console.log("az login succeeded. Linking to Power BI CLI...");

    // Once az login is successful, link the pbicli to the az cli session
    exec("pbicli login --azurecli", (pbiErr, pbiStdout, pbiStderr) => {
      loginInProgress = false;
      if (pbiErr) {
        console.error("pbicli login link error:", pbiErr.message);
      } else {
        console.log("pbicli session successfully linked!");
      }
    });
  });

  return NextResponse.json({
    started: true,
    message: "Authentication started. A browser window has been opened. Please log in there.",
  });
}
