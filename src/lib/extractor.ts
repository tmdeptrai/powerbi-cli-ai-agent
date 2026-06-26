function sanitizeTrailing(cmd: string): string {
  cmd = cmd.trim();
  let changed = true;
  while (changed) {
    changed = false;
    const lastChar = cmd[cmd.length - 1];
    if (!lastChar) break;

    // Strip trailing period if it is punctuation (not part of a filename or option)
    if (lastChar === '.') {
      cmd = cmd.slice(0, -1);
      changed = true;
      continue;
    }

    // Strip trailing double quote if it's unbalanced
    if (lastChar === '"') {
      const quoteCount = (cmd.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        cmd = cmd.slice(0, -1);
        changed = true;
        continue;
      }
    }

    // Strip trailing single quote if it's unbalanced
    if (lastChar === "'") {
      const quoteCount = (cmd.match(/'/g) || []).length;
      if (quoteCount % 2 !== 0) {
        cmd = cmd.slice(0, -1);
        changed = true;
        continue;
      }
    }

    // Strip trailing curly brace if unbalanced
    if (lastChar === '}') {
      const openCount = (cmd.match(/\{/g) || []).length;
      const closeCount = (cmd.match(/\}/g) || []).length;
      if (closeCount > openCount) {
        cmd = cmd.slice(0, -1);
        changed = true;
        continue;
      }
    }

    // Strip trailing square bracket if unbalanced
    if (lastChar === ']') {
      const openCount = (cmd.match(/\[/g) || []).length;
      const closeCount = (cmd.match(/\]/g) || []).length;
      if (closeCount > openCount) {
        cmd = cmd.slice(0, -1);
        changed = true;
        continue;
      }
    }

    // Strip trailing parenthesis if unbalanced
    if (lastChar === ')') {
      const openCount = (cmd.match(/\(/g) || []).length;
      const closeCount = (cmd.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        cmd = cmd.slice(0, -1);
        changed = true;
        continue;
      }
    }
  }
  return cmd.trim();
}

export function extractPbiCommand(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Try to parse as valid JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.name === "execute_pbicli_command" && parsed.parameters?.command) {
      return parsed.parameters.command;
    }
  } catch {
    const match = trimmed.match(/```json\s*([\s\S]*?)\s*```/) || trimmed.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed && parsed.name === "execute_pbicli_command" && parsed.parameters?.command) {
          return parsed.parameters.command;
        }
      } catch {
        // continue
      }
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
        if (parsed && parsed.name === "execute_pbicli_command" && parsed.parameters?.command) {
          return parsed.parameters.command;
        }
      } catch {
        // continue
      }
    }
  }

  // 2. Regex fallback for unescaped JSON strings
  const commandMatch = trimmed.match(/"command"\s*:\s*"([\s\S]*?pbicli[\s\S]*?)"\s*(?:,|\}|$)/);
  if (commandMatch) {
    let cmd = commandMatch[1].trim();
    cmd = cmd.replace(/\\"/g, '"');
    cmd = cmd.replace(/\\'/g, "'");
    if (cmd.endsWith('--workspace ""')) {
      cmd = cmd.slice(0, -14).trim();
    }
    return cmd;
  }

  // 3. Text search fallback
  const rawPbiMatch = trimmed.match(/(pbicli\s+[a-zA-Z0-9_\-\s'"\[\]\.\{\}\:\/\*=\(\),\\\\]+)/);
  if (rawPbiMatch) {
    let cmd = rawPbiMatch[1].trim();
    cmd = sanitizeTrailing(cmd);
    cmd = cmd.replace(/\\"/g, '"');
    cmd = cmd.replace(/\\'/g, "'");
    return cmd;
  }

  return null;
}
