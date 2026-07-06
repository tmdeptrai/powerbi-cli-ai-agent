import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

/**
 * Safely executes a Power BI CLI (pbicli) command by checking permissions 
 * and automatically injecting required workarounds (such as fixing the 
 * dataset query bug).
 * 
 * @param rawCommand The raw command string to execute.
 * @returns Promise resolving to the combined stdout/stderr output.
 */
export async function executeSafePbiCommand(rawCommand: string): Promise<string> {
  let command = rawCommand.trim();

  // 1. Enforce safety prefix check
  if (!command.startsWith("pbicli")) {
    throw new Error("Security Violation: Only commands starting with 'pbicli' are allowed.");
  }

  // 2. Fix the pbicli dataset query bug automatically
  // Appends `--script "{}"` to bypass the buggy fallback evaluation that causes a silent crash.
  if (command.startsWith("pbicli dataset query") && 
      !command.includes("--script") && 
      !command.includes("--script-file")) {
    command += ' --script "{}"';
  }

  try {
    const { stdout, stderr } = await execAsync(command);
    return stdout + (stderr ? `\n\nStderr:\n${stderr}` : "");
  } catch (err: any) {
    const stdout = err.stdout || "";
    const stderr = err.stderr || err.message;
    return stdout + (stderr ? `\n\nStderr:\n${stderr}` : "");
  }
}
