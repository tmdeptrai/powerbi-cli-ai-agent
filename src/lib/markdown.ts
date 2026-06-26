export function formatMarkdown(text: string): string {
  if (!text) return "";

  // Escape HTML tags to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre style="background: #000; padding: 1rem; border: 1px solid #27272a; overflow-x: auto; margin: 1rem 0;"><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, "<code style='background: #18181b; padding: 0.15rem 0.3rem; border: 1px solid #27272a; font-family: monospace;'>$1</code>");

  // Bold text: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: inherit;">$1</a>');

  // Bullet points: * item or - item
  html = html.replace(/^\s*[\*\-]\s+(.+)$/gm, "<li>$1</li>");

  // Wrap list items in <ul> (handles consecutive lists simply)
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul style='margin-left: 1.5rem; margin-bottom: 1rem;'>$1</ul>");

  // Parse Markdown Tables
  const lines = html.split("\n");
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      lines[i] = ""; // Remove raw line
    } else {
      if (inTable && tableRows.length > 0) {
        let tableHtml = "<div class='table-wrapper'><table>";
        let isFirstRow = true;

        tableRows.forEach((row) => {
          // Skip divider rows (containing only pipes, dashes, colons, or spaces)
          if (/^[|:\-\s]+$/.test(row.trim())) return;

          const cols = row.split("|").slice(1, -1).map((c) => c.trim());

          tableHtml += "<tr>";
          cols.forEach((col) => {
            if (isFirstRow) {
              tableHtml += `<th>${col}</th>`;
            } else {
              tableHtml += `<td>${col}</td>`;
            }
          });
          tableHtml += "</tr>";
          isFirstRow = false;
        });

        tableHtml += "</table></div>";
        lines[i - 1] = tableHtml;
        inTable = false;
        tableRows = [];
      }
    }
  }

  // Handle case where file ends during table
  if (inTable && tableRows.length > 0) {
    let tableHtml = "<div class='table-wrapper'><table>";
    let isFirstRow = true;
    tableRows.forEach((row) => {
      if (/^[|:\-\s]+$/.test(row.trim())) return;
      const cols = row.split("|").slice(1, -1).map((c) => c.trim());
      tableHtml += "<tr>";
      cols.forEach((col) => {
        if (isFirstRow) {
          tableHtml += `<th>${col}</th>`;
        } else {
          tableHtml += `<td>${col}</td>`;
        }
      });
      tableHtml += "</tr>";
      isFirstRow = false;
    });
    tableHtml += "</table></div>";
    lines[lines.length - 1] = tableHtml;
  }

  html = lines.filter(l => l !== "").join("\n");

  // Paragraph breaks (double newlines to <p>)
  html = html.split("\n\n").map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith("<table") || trimmed.startsWith("<pre") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol")) {
      return trimmed;
    }
    return `<p style="margin-bottom: 1rem; line-height: 1.6;">${trimmed.replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");

  return html;
}
