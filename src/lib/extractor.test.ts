import { describe, it, expect } from "vitest";
import { extractPbiCommand } from "./extractor";

describe("Command Extractor helper", () => {
  it("should extract command from exact valid JSON format", () => {
    const jsonStr = JSON.stringify({
      name: "execute_pbicli_command",
      parameters: { command: "pbicli workspace list" },
    });
    expect(extractPbiCommand(jsonStr)).toBe("pbicli workspace list");
  });

  it("should extract command from markdown fenced json blocks", () => {
    const rawText = "```json\n" +
      JSON.stringify({
        name: "execute_pbicli_command",
        parameters: { command: "pbicli report list --workspace 123" },
      }) +
      "\n```";
    expect(extractPbiCommand(rawText)).toBe("pbicli report list --workspace 123");
  });

  it("should extract command from loose JSON format in the body text", () => {
    const text = 'Here is the tool call: {"name": "execute_pbicli_command", "parameters": {"command": "pbicli dataset list"}} Please run it.';
    expect(extractPbiCommand(text)).toBe("pbicli dataset list");
  });

  it("should fall back to extract raw pbicli text if JSON is completely malformed or unescaped", () => {
    const text = '"command": "pbicli report list --query \\"[*]\\""';
    expect(extractPbiCommand(text)).toBe('pbicli report list --query "[*]"');
  });

  it("should remove unescaped workspace empty quotes in fallback", () => {
    const text = '"command": "pbicli report list --workspace \\"\\""';
    expect(extractPbiCommand(text)).toBe("pbicli report list");
  });

  it("should fall back to raw match when no JSON is present but pbicli command starts in text", () => {
    const text = "Sure, I can list reports. Just run: pbicli report list --output json";
    expect(extractPbiCommand(text)).toBe("pbicli report list --output json");
  });

  it("should return null when no command is present", () => {
    expect(extractPbiCommand("Hello, how are you today?")).toBeNull();
  });

  it("should extract command with nested unescaped double quotes and parentheses", () => {
    const text = '{"name": "execute_pbicli_command", "parameters": {"command": "pbicli dataset query --workspace "My workspace" --dataset "CoffeeSales" --dax "EVALUATE(TOPN(10, \'Sales\'))""}}';
    expect(extractPbiCommand(text)).toBe("pbicli dataset query --workspace \"My workspace\" --dataset \"CoffeeSales\" --dax \"EVALUATE(TOPN(10, 'Sales'))\"");
  });

  it("should extract command with parentheses, commas and backslashes in text search fallback", () => {
    const text = 'Run this: pbicli dataset query --dataset "CoffeeSales" --dax "EVALUATE(TOPN(10, \'Sales\'))"';
    expect(extractPbiCommand(text)).toBe("pbicli dataset query --dataset \"CoffeeSales\" --dax \"EVALUATE(TOPN(10, 'Sales'))\"");
  });
});
