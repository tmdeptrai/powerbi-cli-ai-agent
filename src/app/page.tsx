"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatMarkdown } from "@/lib/markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  executedCommands?: string[];
}

interface AuthStatus {
  loggedIn: boolean;
  user?: string;
  tenantId?: string;
  linked: boolean;
  checking: boolean;
  message?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello. I am the Power BI CLI AI Assistant. I can run commands on your local environment to list workspaces, view reports, analyze datasets, trigger refreshes, and more. Ask me a question to get started.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    loggedIn: false,
    linked: false,
    checking: true,
  });
  const [loginMsg, setLoginMsg] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check auth status
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setAuthStatus({
        loggedIn: data.loggedIn,
        user: data.user,
        tenantId: data.tenantId,
        linked: data.linked,
        checking: false,
      });

      if (data.loggedIn && data.linked) {
        // If successfully logged in and linked, stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setLoginMsg("");
        }
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
  };

  // On mount: check auth status
  useEffect(() => {
    checkAuth();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setStatusText("Initiating request...");

    // Create a placeholder assistant message that we will stream into
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", executedCommands: [] },
    ]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const chatHistory = messages.concat(userMessage).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body returned from server.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantText = "";
      let commandsList: string[] = [];

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          
          // SSE events are separated by double newlines
          const events = chunk.split("\n\n");
          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;

            const eventMatch = rawEvent.match(/^event:\s*([a-zA-Z0-9_\-]+)/m);
            const dataMatch = rawEvent.match(/^data:\s*(.+)/m);

            if (eventMatch && dataMatch) {
              const event = eventMatch[1];
              const rawData = dataMatch[1];

              try {
                const data = JSON.parse(rawData);

                if (event === "status") {
                  setStatusText(data);
                } else if (event === "command") {
                  commandsList = [...commandsList, data];
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "assistant") {
                      last.executedCommands = commandsList;
                    }
                    return next;
                  });
                } else if (event === "token") {
                  assistantText += data;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "assistant") {
                      last.content = assistantText;
                    }
                    return next;
                  });
                } else if (event === "done") {
                  if (data.executedCommands) {
                    commandsList = data.executedCommands;
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last && last.role === "assistant") {
                        last.executedCommands = commandsList;
                      }
                      return next;
                    });
                  }
                } else if (event === "error") {
                  throw new Error(data);
                }
              } catch (e: any) {
                console.error("SSE parse error:", e.message, rawData);
              }
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.log("Chat request aborted by user.");
        return;
      }
      console.error("Chat error:", e);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.content = last.content 
            ? `${last.content}\n\n[Error: ${e.message}]`
            : `Error: ${e.message}`;
        }
        return next;
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setStatusText("");
    }
  };

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatusText("");
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        last.content = last.content 
          ? `${last.content}\n\n[Request Cancelled by User]`
          : "[Request Cancelled by User]";
      }
      return next;
    });
  };

  const handleLogin = async () => {
    setLoginMsg("Login tab opening in your browser. Please log in there.");
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      await res.json();

      // Start polling status every 2.5 seconds
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(checkAuth, 2500);
    } catch (e) {
      setLoginMsg("Error triggering login.");
      console.error(e);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content: "Conversation history cleared. How can I help you?",
      },
    ]);
  };

  const triggerTemplate = (promptText: string) => {
    handleSend(promptText);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar: Navigation, Status and Quick actions */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">System Status</div>
          {authStatus.checking ? (
            <div className="status-text">Checking status...</div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
                <span
                  className={`status-indicator ${
                    authStatus.linked
                      ? "connected"
                      : authStatus.loggedIn
                      ? "warning"
                      : "disconnected"
                  }`}
                />
                <span className="status-text">
                  {authStatus.linked
                    ? "ONLINE (LINKED)"
                    : authStatus.loggedIn
                    ? "AZURE ONLY (UNLINKED)"
                    : "OFFLINE"}
                </span>
              </div>

              {authStatus.loggedIn && (
                <div className="tenant-details">
                  <div>USER: {authStatus.user}</div>
                  <div style={{ marginTop: "0.25rem" }}>
                    TENANT: {authStatus.tenantId?.substring(0, 18)}...
                  </div>
                </div>
              )}

              {(!authStatus.linked || !authStatus.loggedIn) && (
                <div style={{ marginTop: "1rem" }}>
                  <button onClick={handleLogin} style={{ width: "100%" }}>
                    [ Authenticate ]
                  </button>
                  {loginMsg && (
                    <div
                      className="tenant-details"
                      style={{ color: "#f59e0b", marginTop: "0.5rem" }}
                    >
                      {loginMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-section" style={{ flex: 1 }}>
          <div className="sidebar-title">Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              onClick={() => triggerTemplate("List all workspaces")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ List Workspaces ]
            </button>
            <button
              onClick={() => triggerTemplate("List all reports in my workspace")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ List Reports ]
            </button>
            <button
              onClick={() => triggerTemplate("List all datasets in my workspace")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ List Datasets ]
            </button>
            <button
              onClick={() =>
                triggerTemplate(
                  "List the refresh history for the dataset of CoffeeSales"
                )
              }
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ Check Refresh Logs ]
            </button>
            <button
              onClick={() => triggerTemplate("Trigger a dataset refresh for CoffeeSales")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ Trigger Refresh ]
            </button>
            <button
              onClick={() => triggerTemplate("List user permissions for my workspace")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ Check Workspace Access ]
            </button>
            <button
              onClick={() => triggerTemplate("Run a DAX query EVALUATE(TOPN(10, 'CoffeSales')) on CoffeeSales dataset")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ Run DAX Query ]
            </button>
            <button
              onClick={() => triggerTemplate("Audit all workspaces across the tenant with details")}
              className="template-chip"
              disabled={isLoading || !authStatus.linked}
            >
              [ Tenant Audit (Admin) ]
            </button>
          </div>
        </div>

        <div className="sidebar-section" style={{ marginBottom: 0 }}>
          <button onClick={handleClear} style={{ width: "100%", borderColor: "#ef4444", color: "#ef4444" }}>
            [ Clear Chat ]
          </button>
        </div>
      </aside>

      {/* Main chat interface */}
      <main className="main-chat-area">
        <header className="chat-header">
          <div className="chat-header-title">Power BI CLI AI Agent</div>
        </header>

        {/* Chat message history */}
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <div className="message-label">
                {msg.role === "user" ? "USER" : "AGENT"}
              </div>
              <div
                className="message-body"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
              />

              {/* Show executed CLI commands under agent responses */}
              {msg.role === "assistant" &&
                msg.executedCommands &&
                msg.executedCommands.length > 0 && (
                  <div className="executed-commands-container">
                    <div className="executed-commands-title">Executed Commands</div>
                    {msg.executedCommands.map((cmd, idx) => (
                      <code key={idx} className="command-line">
                        &gt; {cmd}
                      </code>
                    ))}
                  </div>
                )}
            </div>
          ))}

          {/* Pending loading block */}
          {isLoading && (
            <div className="chat-message assistant">
              <div className="message-label">AGENT</div>
              <div className="loading-indicator">
                {statusText || "Thinking and running CLI commands"}
                <span>
                  <span className="dot-blink">.</span>
                  <span className="dot-blink">.</span>
                  <span className="dot-blink">.</span>
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Input Form */}
        <div className="chat-input-container">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="chat-input-form"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                authStatus.linked
                  ? "Ask about workspaces, reports, datasets, refreshes..."
                  : "Please authenticate with your account first to run CLI commands..."
              }
              disabled={isLoading || !authStatus.linked}
            />
            {isLoading ? (
              <button type="button" onClick={handleInterrupt} style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
                [ Cancel ]
              </button>
            ) : (
              <button type="submit" disabled={!inputValue.trim() || !authStatus.linked}>
                [ Send ]
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
