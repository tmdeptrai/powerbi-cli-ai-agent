import { describe, it, expect } from "vitest";
import { validateCommand } from "./validator";

describe("Command Validator (Security Checks)", () => {
  it("should accept valid pbicli commands", () => {
    const res = validateCommand("pbicli workspace list");
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("should reject commands that do not start with pbicli", () => {
    const commands = ["ls -la", "cd ..", "cat /etc/passwd", "sudo rm -rf /", "echo pbicli workspace list"];
    for (const cmd of commands) {
      const res = validateCommand(cmd);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Permission Denied");
    }
  });

  it("should reject commands containing shell injection characters", () => {
    const dangerous = [
      "pbicli workspace list; rm -rf /",
      "pbicli workspace list & reboot",
      "pbicli workspace list | grep test",
      "pbicli dataset list --id $(whoami)",
      "pbicli dataset list --id `whoami`",
      "pbicli workspace list\ncat secret",
    ];
    for (const cmd of dangerous) {
      const res = validateCommand(cmd);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Shell injection characters");
    }
  });
});
