import { describe, it, expect } from "vitest";
import { formatJsonToMarkdownTable } from "./tableFormatter";

describe("JSON to Markdown Table Formatter", () => {
  it("should format a JSON array of objects into a table", () => {
    const json = JSON.stringify([
      { id: 1, name: "Item A", webUrl: "https://example.com/a" },
      { id: 2, name: "Item B", embedUrl: "https://example.com/b" },
    ]);
    const markdown = formatJsonToMarkdownTable(json);

    // Headers
    expect(markdown).toContain("| Id | Name | Web Url | Embed Url |");
    // Values
    expect(markdown).toContain("| 1 | Item A | [Open Link](https://example.com/a) | - |");
    expect(markdown).toContain("| 2 | Item B | - | [Embed](https://example.com/b) |");
  });

  it("should format a single JSON object into a key-value table", () => {
    const json = JSON.stringify({
      id: 100,
      status: "Active",
      isOwnedByMe: true,
    });
    const markdown = formatJsonToMarkdownTable(json);

    expect(markdown).toContain("| Property | Value |");
    expect(markdown).toContain("| **Id** | 100 |");
    expect(markdown).toContain("| **Status** | Active |");
    expect(markdown).toContain("| **Is Owned By Me** | Yes |");
  });

  it("should return the raw text if parsing fails", () => {
    const rawText = "Just some random text from CLI";
    const result = formatJsonToMarkdownTable(rawText);
    expect(result).toBe(rawText);
  });
});
