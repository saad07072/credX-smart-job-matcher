"use client";

import { FormEvent, useState } from "react";

type WorkMode = "remote" | "hybrid" | "onsite";

type MatchResult = {
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    work_mode: WorkMode;
    skills: string[];
    minimum_gpa: number;
    sponsorship_available: boolean;
    description: string;
  };
  score: number;
  matched_skills: string[];
  reasons: string[];
  is_eligible: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const initialProfile = {
  name: "Saad Mujawar",
  skills: "Python, SQL, Machine Learning, FastAPI, React, JavaScript",
  gpa: "7.15",
  preferred_location: "Any",
  preferred_work_mode: "",
  needs_sponsorship: false,
};

const initialFilters = {
  role: "",
  location: "",
  work_mode: "",
  sponsorship_available: "",
};

export default function Home() {
  const [profile, setProfile] = useState(initialProfile);
  const [filters, setFilters] = useState(initialFilters);
  const [resume, setResume] = useState<File | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function findMatches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let resumeFilename: string | null = null;
      if (resume) {
        const resumeForm = new FormData();
        resumeForm.append("file", resume);
        const uploadResponse = await fetch(`${API_URL}/api/resumes`, { method: "POST", body: resumeForm });
        if (!uploadResponse.ok) throw new Error("Resume upload failed");
        const uploadedResume = await uploadResponse.json();
        resumeFilename = uploadedResume.filename;
      }
      const response = await fetch(`${API_URL}/api/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            skills: profile.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
            gpa: Number(profile.gpa),
            preferred_work_mode: profile.preferred_work_mode || null,
            resume_filename: resumeFilename,
          },
          filters: {
            role: filters.role || null,
            location: filters.location || null,
            work_mode: filters.work_mode || null,
            sponsorship_available: filters.sponsorship_available === "" ? null : filters.sponsorship_available === "yes",
          },
        }),
      });

      if (!response.ok) {
        throw new Error("The matching service could not process this profile.");
      }
      setMatches(await response.json());
    } catch {
      setError("Could not reach the API. Start the FastAPI server, then try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300"><span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300" />CredX Talent Network</p>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Smart Job Matcher</h1>
            <p className="mt-3 max-w-2xl text-slate-300">Transparent recommendations for students—not a black-box score.</p>
          </div>
          <div className="flex items-center gap-3"><div className="hidden text-right text-xs text-slate-400 sm:block">Student dashboard<br /><span className="font-semibold text-slate-200">Career discovery</span></div><div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200">Explainable matching</div></div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <form onSubmit={findMatches} className="rounded-3xl bg-white p-6 shadow-2xl shadow-cyan-950/30">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Your student profile</h2><p className="mt-1 text-sm text-slate-500">Complete the essentials and we’ll rank compatible roles.</p></div><div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-cyan-300">SM</div></div>

            <div className="mt-5 rounded-xl bg-cyan-50 p-3"><div className="flex justify-between text-xs font-bold text-cyan-900"><span>Profile readiness</span><span>{resume ? "100%" : "85%"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-cyan-100"><div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: resume ? "100%" : "85%" }} /></div><p className="mt-2 text-xs text-cyan-800">{resume ? "Resume attached—your profile is ready to match." : "Attach your resume to complete your profile."}</p></div>

            <div className="mt-6 space-y-4">
              <Field label="Name">
                <input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="input" />
              </Field>
              <Field label="Skills" hint="Separate skills with commas">
                <textarea required value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} className="input min-h-24 resize-y" />
              </Field>
              <Field label="Resume" hint="PDF, maximum 5 MB">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 transition hover:border-cyan-500 hover:bg-cyan-50">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-700">{resume ? resume.name : "Upload your resume"}</span><span className="block text-xs text-slate-400">{resume ? "Ready to attach" : "Used only to complete your profile"}</span></span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-cyan-700 shadow-sm">Browse</span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setResume(event.target.files?.[0] ?? null)} />
                </label>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="GPA (out of 10)">
                  <input required type="number" min="0" max="10" step="0.01" value={profile.gpa} onChange={(e) => setProfile({ ...profile, gpa: e.target.value })} className="input" />
                </Field>
                <Field label="Location">
                  <input value={profile.preferred_location} onChange={(e) => setProfile({ ...profile, preferred_location: e.target.value })} className="input" placeholder="Any" />
                </Field>
              </div>
              <Field label="Preferred work mode">
                <select value={profile.preferred_work_mode} onChange={(e) => setProfile({ ...profile, preferred_work_mode: e.target.value })} className="input">
                  <option value="">Any mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </Field>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium">
                <input type="checkbox" checked={profile.needs_sponsorship} onChange={(e) => setProfile({ ...profile, needs_sponsorship: e.target.checked })} className="h-4 w-4 accent-cyan-600" />
                I need visa sponsorship
              </label>
              <button disabled={isLoading} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white transition hover:bg-cyan-700 disabled:cursor-wait disabled:bg-slate-400">
                {isLoading ? "Finding your matches..." : "Find my matches"}
              </button>
            </div>
          </form>

          <section className="rounded-3xl bg-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Recommended roles</h2>
                <p className="mt-1 text-sm text-slate-500">Ranked by skills, eligibility, preferences, and sponsorship compatibility.</p>
              </div>
              {matches.length > 0 && <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold">{matches.length} roles</span>}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat value="6" label="Curated roles" />
              <Stat value="100%" label="Explainable" />
              <Stat value={resume ? "Ready" : "Pending"} label="Resume status" />
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
              <Filter label="Role">
                <input value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className="input" placeholder="e.g. Data" />
              </Filter>
              <Filter label="Location">
                <select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} className="input">
                  <option value="">All locations</option><option>Pune</option><option>Bengaluru</option><option>Mumbai</option><option>Hyderabad</option><option>Remote</option>
                </select>
              </Filter>
              <Filter label="Work mode">
                <select value={filters.work_mode} onChange={(e) => setFilters({ ...filters, work_mode: e.target.value })} className="input">
                  <option value="">All modes</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option>
                </select>
              </Filter>
              <Filter label="Sponsorship">
                <select value={filters.sponsorship_available} onChange={(e) => setFilters({ ...filters, sponsorship_available: e.target.value })} className="input">
                  <option value="">Any availability</option><option value="yes">Available</option><option value="no">Not available</option>
                </select>
              </Filter>
              <button type="button" onClick={() => setFilters(initialFilters)} className="text-left text-xs font-bold text-cyan-700 underline sm:col-span-2 xl:col-span-4">Clear filters</button>
            </div>

            {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
            {matches.length === 0 && !error && <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500">Submit your profile to see an explainable match breakdown.</div>}

            <div className="mt-5 space-y-4">
              {matches.map((match) => <MatchCard key={match.job.id} match={match} />)}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700"><span>{label}</span>{hint && <span className="ml-2 font-normal text-slate-400">{hint}</span>}<div className="mt-1.5">{children}</div></label>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-wide text-slate-500"><span>{label}</span><div className="mt-1.5">{children}</div></label>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-3"><p className="text-base font-black text-slate-900">{value}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</p></div>;
}

function MatchCard({ match }: { match: MatchResult }) {
  const scoreColor = match.score >= 75 ? "bg-emerald-500" : match.score >= 50 ? "bg-amber-500" : "bg-slate-400";
  return <article className="rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex gap-4">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${scoreColor} text-lg font-black text-white`}>{match.score}%</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className="font-bold text-slate-900">{match.job.title}</h3><p className="text-sm text-slate-500">{match.job.company} · {match.job.location} · {match.job.work_mode}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${match.is_eligible ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{match.is_eligible ? "Eligible" : "Check eligibility"}</span>
        </div>
        <p className="mt-3 text-sm text-slate-600">{match.job.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">{match.matched_skills.map((skill) => <span key={skill} className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">{skill}</span>)}</div>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">{match.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
      </div>
    </div>
  </article>;
}
