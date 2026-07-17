import { useMemo, useState } from "react";

// Common skills for coding students — powers autocomplete as you type.
const SKILL_SUGGESTIONS = [
  "React",
  "Next.js",
  "Vue.js",
  "Angular",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "Tailwind CSS",
  "Node.js",
  "Express",
  "FastAPI",
  "Django",
  "Flask",
  "Spring Boot",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "Redis",
  "Firebase",
  "GraphQL",
  "REST APIs",
  "Git",
  "GitHub",
  "Docker",
  "Kubernetes",
  "AWS",
  "CI/CD",
  "DevOps",
  "Linux",
  "Python",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Swift",
  "Kotlin",
  "React Native",
  "Flutter",
  "Figma",
  "UI/UX",
  "Jest",
  "Cypress",
  "Testing",
  "Agile",
  "Scrum",
  "Machine Learning",
  "OpenAI API",
  "TensorFlow",
  "Data Structures",
  "Algorithms",
  "System Design",
  "WebSockets",
  "Socket.io",
  "Prisma",
  "Mongoose",
  "Vite",
  "Webpack",
];

function normalizeSkill(value) {
  return String(value || "").trim().toLowerCase();
}

// Chip-based skills editor — add via input + Enter/button, with autocomplete.
export default function SkillsEditor({ skills = [], onChange, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);

  const addedSet = useMemo(
    () => new Set(skills.map((s) => normalizeSkill(s))),
    [skills]
  );

  const suggestions = useMemo(() => {
    const q = normalizeSkill(draft);
    if (!q) return [];

    return SKILL_SUGGESTIONS.filter((skill) => {
      if (addedSet.has(normalizeSkill(skill))) return false;
      const n = normalizeSkill(skill);
      return n.includes(q) || q.includes(n.replace(/\./g, ""));
    }).slice(0, 8);
  }, [draft, addedSet]);

  const showSuggestions = open && draft.trim().length > 0 && suggestions.length > 0;

  const addSkill = (raw) => {
    const skill = String(raw || "").trim();
    if (!skill) return;
    if (addedSet.has(normalizeSkill(skill))) {
      setDraft("");
      setOpen(false);
      return;
    }
    onChange?.([...skills, skill]);
    setDraft("");
    setHighlight(0);
    setOpen(false);
  };

  const removeSkill = (index) => {
    onChange?.(skills.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === "Enter") {
        e.preventDefault();
        addSkill(draft);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      addSkill(suggestions[highlight] || draft);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
        {skills.length === 0 ? (
          <span className="text-xs text-gray-600 italic">
            No skills added yet — e.g. React, Node.js, MongoDB
          </span>
        ) : (
          skills.map((skill, i) => (
            <span
              key={`${skill}-${i}`}
              className="inline-flex items-center gap-1.5 text-[11px] tracking-wide px-2.5 py-1 rounded-full border border-green-400/30 bg-green-400/10 text-green-300"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(i)}
                disabled={disabled}
                className="text-green-400/70 hover:text-pink-300 disabled:opacity-40 leading-none"
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so mousedown on a suggestion registers before close.
              window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a skill — suggestions appear as you type"
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 disabled:opacity-50"
          />

          {showSuggestions && (
            <ul
              role="listbox"
              className="absolute z-20 left-0 right-0 mt-1 py-1 rounded-lg border border-white/[0.12] bg-[#0a0a12]/95 backdrop-blur-md shadow-xl max-h-48 overflow-y-auto"
            >
              {suggestions.map((skill, i) => (
                <li key={skill} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSkill(skill)}
                    className={
                      "w-full text-left px-3 py-2 text-sm transition-colors " +
                      (i === highlight
                        ? "bg-green-400/10 text-green-300"
                        : "text-gray-300 hover:bg-white/[0.04] hover:text-white")
                    }
                  >
                    {skill}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => addSkill(draft)}
          disabled={disabled || !draft.trim()}
          className="text-xs font-semibold tracking-wider uppercase text-green-300 px-3 py-2 rounded-lg border border-green-400/30 hover:bg-green-400/5 disabled:opacity-40 shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
