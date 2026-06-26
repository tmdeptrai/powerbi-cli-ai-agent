export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateCommand(command: string): ValidationResult {
  const trimmed = command.trim();
  if (!trimmed.startsWith("pbicli")) {
    return {
      isValid: false,
      error: "Error: Permission Denied. You are only allowed to run commands starting with 'pbicli'.",
    };
  }
  if (/[;&|`$\n]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Error: Shell injection characters (;, &, |, \`, $) are not allowed.",
    };
  }
  return { isValid: true };
}
