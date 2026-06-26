import { describe, it, expect } from "vitest";
import { formatMarkdown } from "./markdown";

describe("Markdown Formatter", () => {
  it("should escape basic HTML tags to prevent XSS injection", () => {
    const raw = "Hello <script>alert('xss')</script>";
    const formatted = formatMarkdown(raw);
    expect(formatted).not.toContain("<script>");
    expect(formatted).toContain("&lt;script&gt;");
  });

  it("should format inline code blocks properly", () => {
    const raw = "Run `pbicli workspace list` to get started.";
    const formatted = formatMarkdown(raw);
    expect(formatted).toContain("<code");
    expect(formatted).toContain("pbicli workspace list");
  });

  it("should format multi-line code blocks properly", () => {
    const raw = "Here is the code:\n```\nconsole.log('hello');\n```";
    const formatted = formatMarkdown(raw);
    expect(formatted).toContain("<pre");
    expect(formatted).toContain("<code>console.log('hello');</code>");
  });

  it("should format bold text", () => {
    const raw = "This is **important** info.";
    const formatted = formatMarkdown(raw);
    expect(formatted).toContain("<strong>important</strong>");
  });

  it("should format markdown links", () => {
    const raw = "Go to [Google](https://google.com) for searching.";
    const formatted = formatMarkdown(raw);
    expect(formatted).toContain('<a href="https://google.com"');
    expect(formatted).toContain("Google");
  });

  it("should parse and structure lists", () => {
    const raw = "* First Item\n* Second Item";
    const formatted = formatMarkdown(raw);
    expect(formatted).toContain("<ul");
    expect(formatted).toContain("<li>First Item</li>");
    expect(formatted).toContain("<li>Second Item</li>");
  });

  it("should parse markdown tables and skip divider rows", () => {
    const tableMarkdown = `
| Workspace Name | ID |
|----------------|----|
| WorkGroup A    | 123|
| WorkGroup B    | 456|
    `;
    const formatted = formatMarkdown(tableMarkdown);
    expect(formatted).toContain("<div class='table-wrapper'>");
    expect(formatted).toContain("<table>");
    expect(formatted).toContain("<th>Workspace Name</th>");
    expect(formatted).toContain("<th>ID</th>");
    expect(formatted).toContain("<td>WorkGroup A</td>");
    expect(formatted).toContain("<td>123</td>");
    expect(formatted).not.toContain("---"); // should skip divider
  });
});
