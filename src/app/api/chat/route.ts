import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getCachedCommand, setCachedCommand, invalidateCache } from "@/lib/cache";
import { extractPbiCommand } from "@/lib/extractor";
import { validateCommand } from "@/lib/validator";
import { UrlMinifier } from "@/lib/urlMinifier";
import { formatJsonToMarkdownTable } from "@/lib/tableFormatter";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  const urlMinifier = new UrlMinifier();
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const modelName = process.env.OPENAI_MODEL_NAME || "meta/llama3-70b-instruct";

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY environment variable is not set in .env.local." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });

  const { messages } = await req.json();

  // Log User query
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  console.log(`\n--- [Streaming Chat API Request] ---`);
  console.log(`User query: "${lastUserMessage?.content || '(No text)'}"`);

  // Load manual
  let manualContent = "";
  try {
    const manualPath = path.join(process.cwd(), "POWERBICLI_MANUAL.md");
    manualContent = await fs.readFile(manualPath, "utf-8");
  } catch (e: any) {
    console.warn("Could not load POWERBICLI_MANUAL.md:", e.message);
  }

  const systemPrompt = `You are a helpful, professional, and efficient AI Assistant designed for Data Analysts. 
Your goal is to assist them in managing their Power BI environment, datasets, reports, gateways, and workspaces.
You interact with the Power BI Service by running local commands through the Power BI CLI (pbicli).

Here is the reference manual for pbicli:
${manualContent}

Guidelines:
1. Always formulate the exact pbicli commands needed to answer the user's request.
2. Use the 'execute_pbicli_command' tool to execute pbicli commands.
3. Only run pbicli commands. Never try to run other commands (like ls, cd, rm, cat).
4. IMPORTANT ABOUT WORKSPACES: 
   - 'pbicli workspace list' ONLY returns collaborative/shared workspaces. It returns an empty list '[]' if the user has no shared workspaces.
   - To target "My workspace" (the user's personal sandbox), you MUST omit the '--workspace' option entirely.
   - NEVER pass '--workspace "My workspace"' as a parameter, because pbicli will throw 'No workspace found with name My workspace'.
5. When a command returns tabular data or lists of reports/datasets, format them clearly in Markdown tables for the user.
6. Keep your answers clear, concise, and focused on helping the analyst.
7. Inform the user of any commands you ran behind the scenes.

IMPORTANT FOR TOOL CALLING: 
If you choose to run a command, use the defined tool 'execute_pbicli_command'. 
If you are unable to trigger tools natively, output a JSON object containing the tool call like this:
{"name": "execute_pbicli_command", "parameters": {"command": "pbicli workspace list"}}`;

  const apiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "execute_pbicli_command",
        description: "Executes a local Power BI CLI (pbicli) command and returns its output (JSON/TSV/YAML).",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The exact pbicli command to execute (e.g. 'pbicli workspace list' or 'pbicli report list --query \"[*]\"').",
            },
          },
          required: ["command"],
        },
      },
    },
  ];

  const executedCommands: string[] = [];

  // Helper to validate and execute command safely (with caching & invalidation support)
  const runPbiCommand = async (rawCommand: string): Promise<string> => {
    let command = rawCommand.trim();

    // Workaround for pbicli dataset query command bug:
    // If the command is 'pbicli dataset query' and does not contain '--script' or '--script-file',
    // append '--script "{}"' to bypass the buggy evaluation of scriptFile option that throws ENOENT.
    if (command.startsWith("pbicli dataset query") && 
        !command.includes("--script") && 
        !command.includes("--script-file")) {
      command += ' --script "{}"';
    }

    const validation = validateCommand(command);
    if (!validation.isValid) {
      return validation.error || "Error: Invalid command.";
    }

    executedCommands.push(command);
    invalidateCache(command); // Clear caches if it's a mutation command

    // 1. Check read-only cache first
    const cachedOutput = getCachedCommand(command);
    if (cachedOutput !== null) {
      console.log(`[Cache Hit] returning cached results for: "${command}"`);
      console.log(`[Tool Result] Output (first 100 chars): "${cachedOutput.substring(0, 100).replace(/\n/g, " ")}..."`);
      return cachedOutput;
    }

    console.log(`[Tool Call] Executing CLI command: "${command}"`);
    try {
      const result = await execAsync(command);
      const stdout = result.stdout;
      const stderr = result.stderr;
      
      const combined = stdout + (stderr ? `\n\nStderr:\n${stderr}` : "");
      console.log(`[Tool Result] Output (first 100 chars): "${combined.substring(0, 100).replace(/\n/g, " ")}..."`);
      setCachedCommand(command, combined); // Save in cache
      return combined;
    } catch (e: any) {
      const stdout = e.stdout || "";
      const stderr = e.stderr || e.message;
      const combined = stdout + (stderr ? `\n\nStderr:\n${stderr}` : "");
      console.log(`[Tool Result (Error)] Output (first 100 chars): "${combined.substring(0, 100).replace(/\n/g, " ")}..."`);
      return combined;
    }
  };

  // Construct a Streaming Response using Server-Sent Events (SSE)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to enqueue SSE data
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // --- PRE-LLM DIRECT DISPATCH ---
        const userText = lastUserMessage?.content?.trim() || "";
        const lowerText = userText.toLowerCase();

        let directCommand: string | null = null;

        if (lowerText === "list all workspaces" || lowerText === "list workspaces") {
          directCommand = "pbicli workspace list";
        } else if (lowerText === "list all reports in my workspace" || lowerText === "list reports") {
          directCommand = 'pbicli report list --query "[*]"';
        } else if (lowerText === "list all datasets in my workspace" || lowerText === "list datasets") {
          directCommand = "pbicli dataset list";
        } else if (lowerText === "list user permissions for my workspace" || lowerText === "check workspace access") {
          directCommand = "pbicli workspace user list";
        } else if (lowerText === "audit all workspaces across the tenant with details") {
          directCommand = "pbicli admin workspace list --expand users,reports,datasets";
        } else {
          // Match DAX query
          // "Run a DAX query EVALUATE(TOPN(10, 'Sales')) on CoffeeSales dataset"
          const daxMatch = userText.match(/run a dax query\s+([\s\S]+?)\s+on\s+(?:dataset\s+)?["']?([a-zA-Z0-9_\-\s\.\(\)'’‘]+?)["']?(?:\s+dataset)?$/i);
          if (daxMatch) {
            let daxQuery = daxMatch[1].trim();
            const datasetName = daxMatch[2].trim();
            // Sanitize query to avoid newlines and double quotes which break command execution and JSON parsing
            daxQuery = daxQuery.replace(/\s+/g, " ").replace(/"/g, "'");
            directCommand = `pbicli dataset query --dataset "${datasetName}" --dax "${daxQuery}"`;
          } else {
            // Match refresh history
            const refreshHistoryMatch = userText.match(/list the refresh history for the dataset of\s+["']?([a-zA-Z0-9_\-\s\.]+?)["']?/i) ||
                                         userText.match(/check refresh logs for\s+["']?([a-zA-Z0-9_\-\s\.]+?)["']?/i);
            if (refreshHistoryMatch) {
              const datasetName = refreshHistoryMatch[1].trim();
              directCommand = `pbicli dataset refresh history --dataset "${datasetName}"`;
            } else {
              // Match trigger refresh
              const triggerRefreshMatch = userText.match(/trigger a dataset refresh for\s+["']?([a-zA-Z0-9_\-\s\.]+?)["']?/i) ||
                                           userText.match(/refresh dataset\s+["']?([a-zA-Z0-9_\-\s\.]+?)["']?/i);
              if (triggerRefreshMatch) {
                const datasetName = triggerRefreshMatch[1].trim();
                directCommand = `pbicli dataset refresh start --dataset "${datasetName}"`;
              }
            }
          }
        }

        if (directCommand) {
          console.log(`[Direct Dispatch] Matched prompt "${userText}" -> executing: "${directCommand}"`);
          sendEvent("status", `Executing command: ${directCommand}`);
          sendEvent("command", directCommand);

          const commandResult = await runPbiCommand(directCommand);
          sendEvent("status", "Formatting results...");
          const formattedTable = formatJsonToMarkdownTable(commandResult);
          
          sendEvent("token", `I executed the command \`${directCommand}\` directly. Here are the results:\n\n${formattedTable}`);
          sendEvent("done", { executedCommands });
          return;
        }

        let loopCount = 0;
        const maxLoops = 5;
        let currentAssistantMessage: any = null;

        while (loopCount < maxLoops) {
          sendEvent("status", `Thinking... (Pass ${loopCount + 1}/${maxLoops})`);
          
          const response = await openai.chat.completions.create({
            model: modelName,
            messages: apiMessages,
            tools,
            tool_choice: "auto",
          });

          currentAssistantMessage = response.choices[0].message;

          // 5A. Handle Native OpenAI Tool Calling (Runs Concurrently via Promise.all)
          if (currentAssistantMessage.tool_calls && currentAssistantMessage.tool_calls.length > 0) {
            sendEvent("status", `Executing ${currentAssistantMessage.tool_calls.length} commands concurrently...`);
            apiMessages.push(currentAssistantMessage);

            // Stream command names immediately to UI
            currentAssistantMessage.tool_calls.forEach((tc: any) => {
              if (tc.type === "function") {
                const args = JSON.parse(tc.function.arguments);
                sendEvent("command", args.command);
              }
            });

            // Execute all tools in parallel
            let directBypassResult: string | null = null;
            let bypassedCommand = "";
            const toolPromises = currentAssistantMessage.tool_calls.map(async (toolCall: any) => {
              if (toolCall.type === "function" && toolCall.function.name === "execute_pbicli_command") {
                const args = JSON.parse(toolCall.function.arguments);
                const commandResult = await runPbiCommand(args.command);
                const minifiedResult = urlMinifier.minify(commandResult);

                // Track for potential bypass if there is exactly 1 tool call
                if (currentAssistantMessage.tool_calls.length === 1) {
                  directBypassResult = commandResult;
                  bypassedCommand = args.command;
                }

                return {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: minifiedResult || "(No output returned)",
                };
              }
              return null;
            });

            const toolResults = (await Promise.all(toolPromises)).filter(Boolean);
            apiMessages.push(...toolResults);

            // Check if we should bypass the LLM for simple query
            if (directBypassResult !== null) {
              const isSimpleQuery = /^\s*(list|show|check|available|get|history)\b/i.test(lastUserMessage?.content || "") ||
                ["list all workspaces", "list all reports in my workspace", "list all datasets in my workspace", "list the refresh history for the dataset of coffeesales"].some(
                  term => lastUserMessage?.content?.toLowerCase().includes(term)
                );
              const isReadOnlyCommand = bypassedCommand.includes("list") || bypassedCommand.includes("show") || bypassedCommand.includes("available") || bypassedCommand.includes("query");

              if (isSimpleQuery && isReadOnlyCommand) {
                sendEvent("status", "Formatting results...");
                const formattedTable = formatJsonToMarkdownTable(directBypassResult);
                sendEvent("token", `I executed the command \`${bypassedCommand}\` directly. Here are the results:\n\n${formattedTable}`);
                sendEvent("done", { executedCommands });
                return;
              }
            }
            
            loopCount++;
            continue;
          }

          // 5B. Handle Text-Based Fallback Tool Calling
          const extractedCommand = extractPbiCommand(currentAssistantMessage.content || "");
          if (extractedCommand) {
            sendEvent("status", `Executing command: ${extractedCommand}`);
            sendEvent("command", extractedCommand);

            const commandResult = await runPbiCommand(extractedCommand);
            const minifiedResult = urlMinifier.minify(commandResult);

            // Check if we should bypass the LLM for simple query
            const isSimpleQuery = /^\s*(list|show|check|available|get|history)\b/i.test(lastUserMessage?.content || "") ||
              ["list all workspaces", "list all reports in my workspace", "list all datasets in my workspace", "list the refresh history for the dataset of coffeesales"].some(
                term => lastUserMessage?.content?.toLowerCase().includes(term)
              );
            const isReadOnlyCommand = extractedCommand.includes("list") || extractedCommand.includes("show") || extractedCommand.includes("available") || extractedCommand.includes("query");

            if (isSimpleQuery && isReadOnlyCommand) {
              sendEvent("status", "Formatting results...");
              const formattedTable = formatJsonToMarkdownTable(commandResult);
              sendEvent("token", `I executed the command \`${extractedCommand}\` directly. Here are the results:\n\n${formattedTable}`);
              sendEvent("done", { executedCommands });
              return;
            }

            apiMessages.push({ role: "assistant", content: currentAssistantMessage.content });
            apiMessages.push({
              role: "user",
              content: `Tool Execution Result for command "${extractedCommand}":\n${minifiedResult}\n\nPlease parse this output and proceed. If this was successful, output your final answer. If it failed or you need more info, you may execute another command. Do not output raw JSON tool code now.`,
            });
            
            loopCount++;
            continue;
          }

          // No tools requested, loop ends!
          break;
        }

        // Stream the final completions text chunk-by-chunk for premium responsiveness
        sendEvent("status", "Writing final analysis...");
        
        const textStream = await openai.chat.completions.create({
          model: modelName,
          messages: apiMessages,
          stream: true,
        });

        for await (const chunk of textStream) {
          const token = chunk.choices[0]?.delta?.content || "";
          if (token) {
            const restoredToken = urlMinifier.restoreStreamChunk(token);
            if (restoredToken) {
              sendEvent("token", restoredToken);
            }
          }
        }

        const remaining = urlMinifier.flush();
        if (remaining) {
          sendEvent("token", remaining);
        }

        // Signal completion with the list of all executed commands
        sendEvent("done", { executedCommands });
        console.log(`[Stream Finished] Response streaming complete.`);
      } catch (err: any) {
        console.error("Stream execution error:", err);
        sendEvent("error", err.message || "Internal server error during streaming.");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
