import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import * as userApi from "../api/user.api";
import SkillsEditor from "../components/profile/SkillsEditor";

const BIO_MAX = 300;

const inputClass =
  "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-400/50 disabled:opacity-60 disabled:cursor-not-allowed";

function SectionHeader({ children }) {
  return (
    <h2 className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-500 mb-4">
      {children}
    </h2>
  );
}

function normalizeGithubUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const urlMatch = raw.match(/github\.com\/([^/?#]+)/i);
  if (urlMatch) return urlMatch[1];
  return raw.replace(/^@/, "");
}

function profileCompleteness(form) {
  const checks = [
    Boolean(form.bio?.trim()),
    (form.skills?.length || 0) > 0,
    Boolean(form.experienceLevel),
    Boolean(form.availability),
    Boolean(form.githubProfile?.trim()),
  ];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length };
}

function userToForm(user) {
  if (!user) {
    return {
      name: "",
      email: "",
      phone: "",
      organization: "",
      organizationType: "college",
      skills: [],
      experienceLevel: "beginner",
      availability: "medium",
      bio: "",
      githubProfile: "",
      linkedinProfile: "",
    };
  }
  return {
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    organization: user.organization || "",
    organizationType: user.organizationType || "college",
    skills: Array.isArray(user.skills) ? [...user.skills] : [],
    experienceLevel: user.experienceLevel || "beginner",
    availability: user.availability || "medium",
    bio: user.bio || "",
    githubProfile: user.githubProfile || "",
    linkedinProfile: user.linkedinProfile || "",
  };
}

export default function Profile() {
  const { user: authUser, refreshUser } = useAuth();
  const userId = authUser?._id || authUser?.id;

  const [form, setForm] = useState(userToForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await userApi.getUser(userId);
        if (!cancelled) setForm(userToForm(profile));
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load profile"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const completeness = useMemo(() => profileCompleteness(form), [form]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!userId || saving) return;

    if (form.bio.length > BIO_MAX) {
      toast.error(`Bio must be ${BIO_MAX} characters or fewer`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        organization: form.organization.trim(),
        organizationType: form.organizationType,
        skills: form.skills,
        experienceLevel: form.experienceLevel,
        availability: form.availability,
        bio: form.bio.trim(),
        githubProfile: normalizeGithubUsername(form.githubProfile),
        linkedinProfile: form.linkedinProfile.trim(),
      };

      const updated = await userApi.updateUser(userId, payload);
      setForm(userToForm(updated));
      await refreshUser?.();
      toast.success("Profile saved");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "Failed to save profile";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-sm text-gray-500 tracking-[0.25em] uppercase">
          Loading profile…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-green-500/[0.08] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-500/[0.08] rounded-full blur-[160px] pointer-events-none" />

      <main className="relative max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/dashboard"
          className="text-xs text-gray-500 hover:text-gray-300 tracking-[0.2em] uppercase mb-6 inline-block"
        >
          ← Dashboard
        </Link>

        <p className="text-xs font-medium text-green-400 tracking-[0.2em] uppercase mb-2">
          Profile
        </p>
        <h1 className="text-3xl font-bold text-white mb-2">Your profile</h1>
        <p className="text-sm text-gray-500 mb-6">
          Skills and details here power AI Team Matcher and Skill Gap Detector.
        </p>

        {/* Completeness nudge */}
        <div className="mb-6 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-300">
              Profile completeness
            </span>
            <span className="text-xs text-gray-400">
              {completeness.done}/{completeness.total} complete
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-amber-400 transition-all"
              style={{
                width: `${(completeness.done / completeness.total) * 100}%`,
              }}
            />
          </div>
          {completeness.done < completeness.total && (
            <p className="text-[11px] text-gray-500">
              Fill out your profile to get better AI matches and accurate skill
              gap analysis.
            </p>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="relative">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/20 via-transparent to-pink-500/20 opacity-50 blur-sm pointer-events-none" />
            <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-8">
              {error && (
                <p className="text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded px-3 py-2">
                  {error}
                </p>
              )}

              {/* Section 1 — Basic Info */}
              <section>
                <SectionHeader>Basic Info</SectionHeader>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      Name
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set("name")}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      Email
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      disabled
                      readOnly
                      className={inputClass}
                    />
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      Email is view-only on your profile.
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      Phone <span className="text-gray-700">(optional)</span>
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="+91 98765 43210"
                      className={inputClass}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                        Organization
                      </span>
                      <input
                        type="text"
                        value={form.organization}
                        onChange={set("organization")}
                        placeholder="College or company name"
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                        Organization type
                      </span>
                      <select
                        value={form.organizationType}
                        onChange={set("organizationType")}
                        className={inputClass}
                      >
                        <option value="college">College</option>
                        <option value="company">Company</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              {/* Section 2 — Skills */}
              <section>
                <SectionHeader>Skills</SectionHeader>
                <SkillsEditor
                  skills={form.skills}
                  onChange={(skills) => setForm((f) => ({ ...f, skills }))}
                  disabled={saving}
                />
              </section>

              {/* Section 3 — Experience & Availability */}
              <section>
                <SectionHeader>Experience &amp; Availability</SectionHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      Experience level
                    </span>
                    <select
                      value={form.experienceLevel}
                      onChange={set("experienceLevel")}
                      className={inputClass}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      Availability
                    </span>
                    <select
                      value={form.availability}
                      onChange={set("availability")}
                      className={inputClass}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
              </section>

              {/* Section 4 — Bio */}
              <section>
                <SectionHeader>Bio</SectionHeader>
                <label className="block">
                  <textarea
                    value={form.bio}
                    onChange={set("bio")}
                    maxLength={BIO_MAX}
                    rows={4}
                    placeholder="Tell teammates about your interests and what you like to build…"
                    className={`${inputClass} resize-y min-h-[100px]`}
                  />
                  <p className="text-[10px] text-gray-600 mt-1.5 text-right">
                    {form.bio.length}/{BIO_MAX} characters
                  </p>
                </label>
              </section>

              {/* Section 5 — Links */}
              <section>
                <SectionHeader>Links</SectionHeader>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      GitHub username
                    </span>
                    <input
                      type="text"
                      value={form.githubProfile}
                      onChange={set("githubProfile")}
                      placeholder="Swati7087"
                      className={inputClass}
                    />
                    <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                      Enter your GitHub username exactly as it appears on
                      github.com — this helps match your commits in the
                      Contribution Analyzer.
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1.5 block">
                      LinkedIn <span className="text-gray-700">(optional)</span>
                    </span>
                    <input
                      type="url"
                      value={form.linkedinProfile}
                      onChange={set("linkedinProfile")}
                      placeholder="https://linkedin.com/in/…"
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>

              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="w-full sm:w-auto text-sm font-semibold text-white tracking-wider uppercase px-8 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:shadow-[0_0_30px_rgba(74,222,128,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Spinner({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} animate-spin`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
