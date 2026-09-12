import { useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  ChevronDown,
  Check,
  Plus,
  Camera,
  Mic,
  Menu,
  X,
} from "lucide-react";
import heroImg from "@/assets/hero-desktop.jpg";
import { api } from "@/lib/api";


const planFeatures = [
  "100% Stealth",
  "Snap & Solve",
  "Real-Time Answers",
];

const subscriptionPlans = [
  {
    name: "Free",
    price: "Free",
    cta: "Get started",
    features: ["3 Interview Sessions", ...planFeatures],
    highlight: false,
  },
  {
    name: "Weekly",
    price: "$78.00 / week",
    cta: "Subscribe",
    features: ["Unlimited Interview Sessions", ...planFeatures],
    highlight: false,
  },
  {
    name: "Monthly",
    price: "$149.90 / month",
    cta: "Subscribe",
    features: ["Unlimited Interview Sessions", ...planFeatures],
    highlight: true,
  },
  {
    name: "Yearly",
    price: "$599.90 / year",
    cta: "Subscribe",
    features: ["Unlimited Interview Sessions", ...planFeatures],
    highlight: false,
  },
];

const oneTimePlans = [
  {
    name: "Basic",
    price: "$59.00 / one time",
    cta: "Buy now",
    features: ["3 Interview Sessions", ...planFeatures],
    highlight: false,
  },
  {
    name: "Plus",
    price: "$118.00 / one time",
    cta: "Buy now",
    features: ["8 Interview Sessions", ...planFeatures],
    highlight: true,
  },
  {
    name: "Pro",
    price: "$177.00 / one time",
    cta: "Buy now",
    features: ["15 Interview Sessions", ...planFeatures],
    highlight: false,
  },
];


const faqs = [
  {
    q: "What is Tudso?",
    a: "Tudso is a real-time AI copilot for live online interviews. It listens to the conversation, detects the interviewer's questions, and suggests tailored answers on your screen within seconds. It can also use your resume, the job description, and your own notes as context for better responses.",
  },
  {
    q: "Is Tudso visible to the interviewer during screen sharing?",
    a: "No. Tudso runs in stealth mode. The copilot window is excluded from screen capture, so it stays invisible during screen sharing on Zoom, Meet, Teams and other platforms. Only you can see it.",
  },
  {
    q: "What types of meeting softwares does Tudso support?",
    a: "Zoom, Google Meet, Microsoft Teams, Webex, Amazon Chime, Slack huddles, and any browser-based or phone interview. The desktop app captures system audio, so it works even with platforms we haven't named.",
  },
  {
    q: "Does Tudso offer free trial or free plan?",
    a: "Yes. You can start free with a limited number of interview sessions. Paid plans unlock unlimited live sessions, premium models, and priority support.",
  },
  {
    q: "Does it work for coding or technical interviews?",
    a: "Yes. Tudso supports live coding rounds with explanations, complexity analysis, and step-by-step reasoning in Python, JavaScript, Java, C++, SQL and more. Snap and Solve captures any on-screen problem for an instant solution.",
  },
  {
    q: "Is Tudso suitable for all job roles?",
    a: "Yes. From engineering, data and product to marketing, finance, consulting, healthcare and customer support. Tudso adapts to your role and seniority using the materials you upload for context before the interview.",
  },
];

function NavLink({
  children,
  href,
  hasCaret,
}: {
  children: React.ReactNode;
  href: string;
  hasCaret?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-1 text-sm text-white/85 hover:text-white transition"
    >
      {children}
      {hasCaret && <ChevronDown className="w-3.5 h-3.5" />}
    </a>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const links = [
    { label: "Home", href: "#top" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Resources", href: "#faq" },
  ];

  useEffect(() => {
    let cancelled = false;
    void api.session().then(({ user }) => {
      if (!cancelled) setLoggedIn(Boolean(user));
    }).catch(() => {
      if (!cancelled) setLoggedIn(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[min(1100px,calc(100%-1.5rem))]">
      <nav className="flex items-center justify-between gap-3 rounded-full bg-secondary/95 backdrop-blur px-2.5 py-2 shadow-lg shadow-black/10 border border-white/5">
        <a href="#top" className="flex min-w-0 items-center gap-2 pl-2">
          <img src="/icon.png" alt="Tudso logo" width={28} height={28} className="h-7 w-7 shrink-0 rounded-md object-contain" />
          <span className="truncate text-white font-semibold tracking-tight">Tudso</span>
        </a>
        <div className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <NavLink key={l.label} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={loggedIn ? "/dashboard" : "/login?mode=register"}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white text-secondary px-3.5 py-2 text-sm font-medium hover:bg-muted transition"
          >
            <span className="hidden sm:inline">{loggedIn ? "Dashboard" : "Sign up"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden mt-2 rounded-2xl bg-secondary/95 backdrop-blur p-2 shadow-lg shadow-black/10 border border-white/5">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/15 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground/80">
      {icon}
      {children}
    </span>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="hero-gradient-bg relative pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 overflow-hidden"
    >
      <div className="max-w-5xl mx-auto text-center relative">
        <span className="inline-flex items-center rounded-full bg-secondary px-4 py-2 text-xs sm:text-sm font-semibold text-white mb-6 sm:mb-8">
           100% undetectable!
        </span>



        <h1 className="font-display text-[2.25rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-secondary">
          #1 AI assistant
          <br />
          for <em className="italic">interviews</em>
        </h1>

        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
           Completely undetectable real-time support during live online interviews.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
          <a
            href="/login?mode=register"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-primary-foreground font-medium shadow-lg shadow-primary/30 hover:bg-primary/90 transition"
          >
            Get Started For Free <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/download"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-secondary/15 px-6 py-3.5 text-secondary font-medium hover:bg-muted transition"
          >
            Download Desktop App <Download className="w-4 h-4" />
          </a>
        </div>


        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Available For</span>
          <Chip icon={<img src="https://cdn.simpleicons.org/apple" alt="" width={14} height={14} className="w-3.5 h-3.5" />}>macOS</Chip>
          <Chip
            icon={
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                <path d="M3 5.5 10.5 4.4V11H3V5.5Zm9-1.3L21 3v8h-9V4.2ZM3 12.5h7.5V19L3 17.9v-5.4ZM12 12.5h9V20l-9-1.2v-6.3Z" />
              </svg>
            }
          >
            Windows
          </Chip>
        </div>

        <div className="mt-10 sm:mt-16 relative">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-secondary/20 border border-white/40 mx-auto max-w-4xl transform-gpu">
            <img
              src={heroImg}
              alt="Tudso interview copilot overlaying a live video interview on a desktop"
              width={1920}
              height={1200}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}


function FeatureCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl bg-card border border-secondary/10 p-4 sm:p-5 overflow-hidden ${className}`}
    >
      <div className="h-40 sm:h-44 rounded-2xl bg-muted/60 mb-4 p-3 flex items-center justify-center">
        {children}
      </div>
      <h3 className="font-display text-xl sm:text-2xl text-secondary mb-1.5">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}




const si = "https://cdn.simpleicons.org";
const siLegacy = "https://cdn.jsdelivr.net/npm/simple-icons@8.15.0/icons";

const aiModels = [
  { name: "GPT-5.4", vendor: "OpenAI", logo: `${siLegacy}/openai.svg`, active: false },
  { name: "Gemini 3.1 Pro", vendor: "Google", logo: `${si}/googlegemini`, active: true },
  { name: "Claude 4.6", vendor: "Anthropic", logo: `${si}/anthropic`, active: false },
  { name: "Llama 4 Maverick", vendor: "Meta", logo: `${si}/meta`, active: false },
];

const meetingPlatforms = [
  { name: "Zoom", logo: `${si}/zoom` },
  { name: "Google Meet", logo: `${si}/googlemeet` },
  { name: "Microsoft Teams", logo: `${siLegacy}/microsoftteams.svg` },
  { name: "Webex", logo: `${si}/webex` },
  { name: "Slack", logo: `${siLegacy}/slack.svg` },
];

const languageChips = [
  "🇺🇸 English",
  "🇪🇸 Español",
  "🇫🇷 Français",
  "🇩🇪 Deutsch",
  "🇮🇹 Italiano",
  "🇷🇺 Русский",
  "🇯🇵 日本語",
  "🇰🇷 한국어",
  "🇮🇳 हिन्दी",
  "🇳🇱 Nederlands",
  "🇹🇷 Türkçe",
  "🇻🇳 Tiếng Việt",
];

function SpecializedGrid() {
  return (
    <section id="features" className="pt-20 sm:pt-28 pb-14 sm:pb-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
             FEATURES
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-secondary tracking-tight">
             Built to be&nbsp;<em className="italic">100% undetectable</em>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Stealth mode */}
          <FeatureCard
            title="Stealth mode"
            description="Screen share with confidence, it is only visible to you"
          >
            <div className="w-full grid grid-cols-2 rounded-xl overflow-hidden border border-secondary/10">
              <div className="bg-card p-2.5">
                <span className="inline-flex rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Visible to you
                </span>
                <div className="mt-3 space-y-1.5">
                  {[90, 70, 80, 55, 65].map((w, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full bg-secondary/10"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </div>
              <div
                className="p-2.5 flex items-start justify-center"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, color-mix(in oklab, var(--secondary) 12%, transparent) 0 6px, transparent 6px 12px)",
                }}
              >
                <span className="inline-flex rounded-full bg-card border border-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Invisible to others
                </span>
              </div>
            </div>
          </FeatureCard>

          {/* 100% Source-Available */}
          <FeatureCard
            title="Community-driven"
            description="Tudso is 100% source-available, and all of its code is publicly available on GitHub."
          >
            <div className="w-full rounded-xl border border-secondary/10 bg-card overflow-hidden text-left">
              <div className="flex items-center justify-between px-3 py-2 border-b border-secondary/10">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary">
                  <img src="https://cdn.simpleicons.org/github/1e1b16" alt="GitHub logo" width={14} height={14} className="w-3.5 h-3.5" />
                  tudso / tudso
                </span>
                <span className="rounded-full border border-secondary/15 bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  ★ Star 1.2k
                </span>
              </div>
              <div className="flex gap-3 px-3 py-1.5 border-b border-secondary/10 text-[10px] text-muted-foreground">
                <span className="font-semibold text-primary border-b-2 border-primary pb-0.5">Code</span>
                <span>Issues 12</span>
                <span>Pull requests 7</span>
              </div>
              <div className="px-3 py-2 space-y-1.5 text-[11px] text-secondary/80">
                {[
                  { icon: "📁", name: "src", meta: "a1b2c3d · 2h ago" },
                  { icon: "📁", name: "packages", meta: "d4e5f6a · 5h ago" },
                  { icon: "📄", name: "README.md", meta: "7f8g9h0 · 1d ago" },
                  { icon: "📄", name: "LICENSE", meta: "MIT · 1d ago" },
                ].map((f) => (
                  <div key={f.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">{f.icon}</span>
                      <span className="font-medium text-primary/90">{f.name}</span>
                    </span>
                    <span className="text-[9px] text-muted-foreground">{f.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          </FeatureCard>

          {/* Customize your AI */}
          <FeatureCard
            title="Customize your AI"
            description="Pick and personalize your AI with custom prompts and context"
          >
            <div className="w-full space-y-1.5">
              {aiModels.map((m) => (
                <div
                  key={m.name}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 border transition ${
                    m.active
                      ? "bg-primary/10 border-primary/30"
                      : "bg-card border-secondary/10"
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-background border border-secondary/10 flex items-center justify-center">
                    <img
                      src={m.logo}
                      alt={`${m.vendor} logo`}
                      loading="lazy"
                      width={15}
                      height={15}
                      className="w-[15px] h-[15px] object-contain"
                    />
                  </span>
                  <span className="leading-tight flex-1">
                    <span
                      className={`block text-xs font-semibold ${
                        m.active ? "text-secondary" : "text-secondary/70"
                      }`}
                    >
                      {m.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">{m.vendor}</span>
                  </span>
                  {m.active && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </FeatureCard>

          {/* Snap and solve */}
          <FeatureCard
            title="Snap and solve"
            description="Capture any question on your screen for instant solutions"
          >
            <div className="relative w-full rounded-xl bg-secondary p-3 text-left">
              <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr-sm" />
              <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl-sm" />
              <span className="inline-flex w-7 h-7 rounded-lg bg-primary items-center justify-center mb-2">
                <Camera className="w-3.5 h-3.5 text-white" />
              </span>
              <p className="text-[11px] leading-snug text-white/90">
                How can we communicate brand value clearly across touchpoints?
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Typography", "Hierarchy", "Minimal text", "Animation"].map((t) => (
                  <span key={t} className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/85">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </FeatureCard>

          {/* Blazing fast transcription */}
          <FeatureCard
            title="Blazing fast transcription"
            description="Use a state-of-the-art fast transcription model"
          >
            <div className="w-full space-y-3">
              <div className="flex items-end justify-center gap-[3px] h-14">
                {[30, 55, 75, 45, 90, 60, 100, 70, 40, 85, 50, 95, 65, 35, 80, 55, 45, 70, 30, 60].map(
                  (h, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-primary/70"
                      style={{ height: `${h}%` }}
                    />
                  ),
                )}
              </div>
              <div className="flex items-center justify-between rounded-full bg-card border border-secondary/10 px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Mic className="w-3 h-3 text-primary" /> Transcribing...
                </span>
                <span className="text-[10px] font-semibold text-secondary">00:12</span>
              </div>
            </div>
          </FeatureCard>

          {/* Live coding support */}
          <FeatureCard
            title="Live coding support"
            description="Reads code shared on your screen, then gives you a solution"
          >
            <div className="w-full rounded-xl bg-secondary overflow-hidden text-left">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                  <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
                  <span className="w-2 h-2 rounded-full bg-[#28c840]" />
                </div>
                <span className="flex items-center gap-1 text-[9px] font-semibold text-[#28c840]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" /> Live
                </span>
              </div>
              <pre className="px-3 py-2 text-[10px] leading-relaxed font-mono text-white/85">
{`def longest_unique(s):
  seen, start, best = set(), 0, 0
  for i, ch in enumerate(s):
    while ch in seen:
      seen.remove(s[start])
      start += 1
    seen.add(ch)
    best = max(best, i - start + 1)`}
              </pre>
            </div>
          </FeatureCard>

          {/* Works on all platforms */}
          <FeatureCard
            title="Works on all platforms"
            description="Works with all meeting platforms on browser or desktop app"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-card border border-secondary/10 p-3">
              {meetingPlatforms.map((p) => (
                <span
                  key={p.name}
                  className="w-11 h-11 rounded-xl bg-background border border-secondary/10 flex items-center justify-center"
                >
                  <img
                    src={p.logo}
                    alt={`${p.name} logo`}
                    loading="lazy"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </span>
              ))}
            </div>
          </FeatureCard>

          {/* Support 55+ languages */}
          <FeatureCard
            title="Support 55+ languages"
            description="Interviewing in another language? We've got you covered"
          >
            <div className="w-full">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {languageChips.slice(0, 8).map((l) => (
                  <span
                    key={l}
                    className="rounded-full border border-secondary/15 bg-card px-2.5 py-1 text-[10px] text-secondary"
                  >
                    {l}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                ... and 45+ more
              </p>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [tab, setTab] = useState<"subscriptions" | "onetime">("subscriptions");
  const plans = tab === "subscriptions" ? subscriptionPlans : oneTimePlans;
  return (
    <section id="pricing" className="py-14 sm:py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
            Pricing
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-secondary tracking-tight">
            Simple, <em className="italic">honest plans</em>
          </h2>
          <div className="mt-7 inline-flex items-center rounded-full border border-secondary/15 bg-card p-1">
            {[
              { label: "Subscriptions", value: "subscriptions" as const },
              { label: "One-Time", value: "onetime" as const },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => setTab(t.value)}
                aria-pressed={tab === t.value}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t.value
                    ? "bg-secondary text-white"
                    : "text-muted-foreground hover:text-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`grid gap-4 sm:gap-5 items-start ${
            tab === "subscriptions"
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl border p-6 bg-card ${
                p.highlight
                  ? "border-primary/40 shadow-lg shadow-primary/10"
                  : "border-secondary/10"
              }`}
            >
              <h3 className="font-display text-2xl text-secondary">{p.name}</h3>
              <p className="font-display text-2xl sm:text-3xl text-secondary mt-3">{p.price}</p>
              <a
                href="#top"
                className={`mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition ${
                  p.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-white hover:bg-secondary/80"
                }`}
              >
                {p.cta}
              </a>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-secondary/90">
                    <Check className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



function CTA() {
  return (
    <section className="hero-gradient-bg py-16 sm:py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-secondary tracking-tight">
          Land your <em className="italic">dream job.</em>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Join thousands using Tudso to interview with confidence.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/login?mode=register"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-primary-foreground font-medium shadow-lg shadow-primary/30 hover:bg-primary/90 transition"
          >
            Get Started For Free <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/download"
            className="inline-flex items-center gap-2 rounded-full bg-secondary text-white px-6 py-3.5 font-medium hover:bg-secondary/80 transition"
          >
            Download Desktop App <Download className="w-4 h-4" />
          </a>

        </div>
      </div>
    </section>
  );
}

function Footer() {
  const columns = [
    {
      h: "Product",
      items: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "Download", href: "#pricing" },
        { label: "FAQs", href: "#faq" },
      ],
    },
    {
      h: "Company",
      items: [
        { label: "Privacy", href: "#top" },
        { label: "Terms", href: "#top" },
      ],
    },
  ];

  return (
    <footer className="bg-secondary text-white/60 px-4 pt-16 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr] md:gap-16">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/icon.png" alt="Tudso logo" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-xl object-contain" />
              <span className="text-white text-lg font-semibold tracking-tight">
                Tudso
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              Real-time AI copilot for job interviews. Private, undetectable and
              available on macOS, Windows and the browser.
            </p>
            <a
              href="#pricing"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {columns.map((col) => (
            <div key={col.h}>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-[0.14em] mb-4">
                {col.h}
              </h4>
              <ul className="space-y-3 text-sm">
                {col.items.map((i) => (
                  <li key={i.label}>
                    <a href={i.href} className="transition hover:text-white">
                      {i.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Tudso</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );

}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-14 sm:py-20 px-4 bg-background">

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-secondary tracking-tight">
            Frequently asked <em className="italic">questions</em>
          </h2>
          <p className="mt-4 text-muted-foreground">Everything you need to know about Tudso</p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-secondary/10 bg-card overflow-hidden"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 md:px-6 md:py-5"
                >
                  <span className="text-secondary font-medium">{item.q}</span>
                  <Plus
                    className={`w-5 h-5 shrink-0 text-primary transition-transform duration-200 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 md:px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <main className="marketing-page min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <SpecializedGrid />
      <Pricing />
      <FAQ />

      <CTA />
      <Footer />
    </main>
  );
}

