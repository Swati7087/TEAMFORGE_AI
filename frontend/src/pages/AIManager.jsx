import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useProject } from "../hooks/useProjects";
import * as aiApi from "../api/ai.api";

function MessageBubble({ role, content, toolLabel, toolUsed }) {
  const isUser = role === "user";
  const isRag = toolUsed === "rag_retrieval";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 " +
          (isUser
            ? "bg-green-500/10 border border-green-400/20 text-gray-100"
            : "bg-[#0a0a12]/80 border border-pink-500/30 text-gray-200 shadow-[0_0_20px_rgba(236,72,153,0.08)]")
        }
      >
        {!isUser && (
          <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-pink-400 mb-2">
            AI Manager
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {isRag && !isUser && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <span className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              <span aria-hidden>📚</span>
              Answered from project context
            </span>
          </div>
        )}
        {toolLabel && !isUser && !isRag && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <span className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              <span aria-hidden>🔧</span>
              Used: {toolLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIManager() {
  const { id: projectId } = useParams();
  const { project, loading, error } = useProject(projectId);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hey — I'm your AI Engineering Manager. Ask me anything about this project, or pick a quick action below.",
      toolLabel: null,
      toolUsed: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showActions, setShowActions] = useState(false);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    aiApi
      .getManagerSuggestions(projectId)
      .then(setSuggestions)
      .catch(() => {
        setSuggestions([]);
      });
  }, [projectId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendMessage = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed || sending) return;

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg = { role: "user", content: trimmed, toolLabel: null, toolUsed: null };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setShowActions(false);

    try {
      const data = await aiApi.chatWithManager(projectId, {
        message: trimmed,
        conversationHistory: history,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          toolLabel: data.toolLabel || null,
          toolUsed: data.toolUsed || null,
        },
      ]);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "AI generation failed, please try again";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: msg,
          toolLabel: null,
          toolUsed: null,
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-sm text-gray-500 tracking-[0.25em] uppercase">
          Loading…
        </p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-pink-400 text-sm">{error || "Project not found"}</p>
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#050508] text-white relative flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-500/[0.08] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-green-500/[0.06] rounded-full blur-[140px] pointer-events-none" />

      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-xl bg-[#050508]/80 shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <Link
            to={`/projects/${projectId}`}
            className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase mb-2 inline-block"
          >
            ← {project.title}
          </Link>
          <h1 className="text-xl font-bold text-white">
            AI Engineering{" "}
            <span className="bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent">
              Manager
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Ask about bottlenecks, deadlines, team gaps, sprints — I pull real
            project data.
          </p>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 sm:px-6 min-h-0 overflow-hidden">
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto min-h-0 py-4 overscroll-contain"
        >
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.role}
              content={m.content}
              toolLabel={m.toolLabel}
              toolUsed={m.toolUsed}
            />
          ))}

          {sending && (
            <div className="flex justify-start mb-4">
              <div className="bg-[#0a0a12]/80 border border-pink-500/20 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                  Thinking…
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative shrink-0 py-4 border-t border-white/[0.06] bg-[#050508]/80">
          {showActions && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0a0a12]/95 backdrop-blur-md border border-white/[0.1] rounded-xl overflow-hidden shadow-xl z-10">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-gray-500 px-3 py-2 border-b border-white/[0.06]">
                Quick actions
              </p>
              <ul className="max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <li key={s.label}>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleQuickAction(s.prompt)}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-pink-500/10 hover:text-pink-200 transition-colors disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowActions((v) => !v)}
              disabled={sending}
              className="shrink-0 w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] text-gray-400 hover:text-pink-300 hover:border-pink-500/30 transition-colors disabled:opacity-50 flex items-center justify-center text-lg"
              title="Quick actions"
              aria-label="Quick actions"
            >
              ⚡
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask about bottlenecks, deadlines, team gaps…"
              rows={1}
              disabled={sending}
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl bg-[#0a0a12]/60 border border-white/[0.1] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-pink-500/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 h-11 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-pink-500 hover:shadow-[0_0_24px_rgba(236,72,153,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
