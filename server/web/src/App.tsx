import * as React from 'react'
import heroImg from '@/assets/hero-tudso.jpg'
import featureAuto from '@/assets/feature-autoapply.jpg'
import featureCover from '@/assets/feature-coverletter.jpg'
import featureStats from '@/assets/feature-stats.jpg'
import featureNewest from '@/assets/feature-newest.jpg'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Sparkles, Building2, RefreshCw, FileText, Headphones, ShieldCheck, Leaf, Zap, Rocket, Upload, Wand2, Send } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster, toast } from 'sonner'

const displayFont = { fontFamily: 'Fraunces, Georgia, serif' }

type OpenSignup = () => void

function ClientToaster() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  if (!ready) return null
  return <Toaster />
}

function NavActions({ onSignup }: { onSignup: OpenSignup }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Button variant="ghost" size="sm" className="sm:h-10 sm:px-4" onClick={onSignup}>
        Login
      </Button>
      <Button size="sm" className="sm:h-10 sm:px-4" onClick={onSignup}>
        Start applying
      </Button>
    </div>
  )
}

function HeroActions({ onSignup }: { onSignup: OpenSignup }) {
  return (
    <div className="mt-6 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:mt-8">
      <Button size="lg" onClick={onSignup}>
        Start applying
      </Button>
      <Button size="lg" variant="outline" asChild>
        <a href="#how-it-works">Learn more</a>
      </Button>
    </div>
  )
}

function PricingSection({ onSignup }: { onSignup: OpenSignup }) {
  const [quarterly, setQuarterly] = React.useState(true)
  const passiveJobs = quarterly ? 150 : 50
  const plusJobs = quarterly ? 600 : 200

  return (
    <div className="mt-10">
      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <span className={`text-sm font-medium ${!quarterly ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
        <button
          type="button"
          onClick={() => setQuarterly(!quarterly)}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-foreground transition-colors"
          aria-label="Toggle quarterly billing"
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-background transition-transform ${quarterly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${quarterly ? 'text-foreground' : 'text-muted-foreground'}`}>Quarterly</span>
        <span className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-semibold text-foreground">SAVE 33%</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        <div className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex-1">
            <h3 className="text-2xl font-black" style={displayFont}>Passive</h3>
            <p className="text-sm text-muted-foreground">See what's out there</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black" style={displayFont}>{quarterly ? '$33' : '$49'}<span className="text-lg font-medium text-muted-foreground">/mo</span></span>
              {quarterly && <span className="text-lg text-muted-foreground line-through">$49/mo</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {quarterly ? (
                <><span className="line-through">$147</span> → $99/3 months</>
              ) : (
                '$147 billed every 3 months'
              )}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 shrink-0 text-foreground" /> Get applied up to <span className="font-semibold text-foreground underline decoration-foreground/30">{passiveJobs} jobs</span></li>
              <li className="flex items-start gap-2"><Building2 className="h-4 w-4 shrink-0 text-foreground" /> <span className="font-semibold text-foreground underline decoration-foreground/30">500K+</span> jobs from standard job sites</li>
              <li className="flex items-start gap-2"><RefreshCw className="h-4 w-4 shrink-0 text-foreground" /> Autopilot applies daily</li>
            </ul>
          </div>
          <Button className="mt-8 w-full" size="lg" variant="outline" onClick={onSignup}>Get Started</Button>
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-mint" /> 30-day money-back guarantee. Cancel any time.
          </p>
        </div>

        <div className="relative flex flex-col rounded-3xl border-2 border-foreground bg-brand-mint/20 p-6 sm:p-8">
          <div className="absolute -top-3 right-4 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-primary-foreground">MOST POPULAR</div>
          <div className="flex-1">
            <h3 className="text-2xl font-black" style={displayFont}>Tudso+</h3>
            <p className="text-sm text-muted-foreground">Best to land interviews fast</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black" style={displayFont}>{quarterly ? '$67' : '$99'}<span className="text-lg font-medium text-muted-foreground">/mo</span></span>
              {quarterly && <span className="text-lg text-muted-foreground line-through">$99/mo</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {quarterly ? (
                <><span className="line-through">$297</span> → FREE for 4 days then $199/3 months</>
              ) : (
                'FREE for 4 days then $99 monthly'
              )}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 shrink-0 text-foreground" /> Get applied up to <span className="font-semibold text-foreground underline decoration-foreground/30">{plusJobs} jobs</span></li>
              <li className="flex items-start gap-2"><Building2 className="h-4 w-4 shrink-0 text-foreground" /> <span className="font-semibold text-foreground underline decoration-foreground/30">2M+</span> jobs incl. Workday, iCims, etc</li>
              <li className="flex items-start gap-2"><RefreshCw className="h-4 w-4 shrink-0 text-foreground" /> Autopilot applies daily</li>
              <li className="flex items-start gap-2"><Rocket className="h-4 w-4 shrink-0 text-foreground" /> Apply to the newest jobs on market</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 shrink-0 text-foreground" /> Custom Resumes & Cover Letters</li>
              <li className="flex items-start gap-2"><Headphones className="h-4 w-4 shrink-0 text-foreground" /> Priority Support</li>
            </ul>
          </div>
          <Button className="mt-8 w-full" size="lg" onClick={onSignup}>
            <Zap className="h-4 w-4 fill-current" /> Start 4-day FREE Trial
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-mint" /> 30-day money-back guarantee. Cancel any time.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [signupOpen, setSignupOpen] = React.useState(false)
  const [signup, setSignup] = React.useState({ name: '', email: '' })

  const openSignup: OpenSignup = () => setSignupOpen(true)

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    const name = signup.name.trim()
    const email = signup.email.trim()
    if (!name || !email) {
      toast.error('Please enter your name and email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    toast.success("You're on the list! We'll email you when Tudso is ready.")
    setSignup({ name: '', email: '' })
    setSignupOpen(false)
  }

  const companyLogos = [
    { name: 'TikTok', slug: 'tiktok' },
    { name: 'Spotify', slug: 'spotify' },
    { name: 'Stripe', slug: 'stripe' },
    { name: 'Netflix', slug: 'netflix' },
    { name: 'Google', slug: 'google' },
    { name: 'Meta', slug: 'meta' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <ClientToaster />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <div className="text-xl font-black tracking-tight sm:text-2xl" style={displayFont}>Tudso</div>
        <NavActions onSignup={openSignup} />
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="relative overflow-hidden rounded-3xl bg-brand-mint p-6 sm:p-8 md:p-14">
          <h1 className="text-center text-3xl font-black leading-tight sm:text-4xl md:text-6xl" style={displayFont}>
            Let AI apply to<br />jobs for you
          </h1>
          <HeroActions onSignup={openSignup} />
          <div className="mt-6 flex justify-center sm:mt-8">
            <img src={heroImg} alt="Tudso mascot applying to jobs" width={1280} height={800} className="w-full max-w-2xl rounded-2xl" />
          </div>
        </div>

        <div className="my-10 flex items-center justify-center gap-4 text-center text-muted-foreground sm:my-12 sm:gap-10">
          <div>
            <div className="text-xl font-black text-foreground sm:text-2xl" style={displayFont}>5000+</div>
            <div className="text-xs uppercase tracking-wider">users</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <div className="text-xl font-black text-foreground sm:text-2xl" style={displayFont}>250k+</div>
            <div className="text-xs uppercase tracking-wider">jobs applied</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <div className="text-xl font-black text-foreground sm:text-2xl" style={displayFont}>3x</div>
            <div className="text-xs uppercase tracking-wider">more interviews</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Auto-apply to hundreds of jobs</h2>
            <p className="mt-4 max-w-md text-muted-foreground">Upload your resume once. Tudso finds roles that fit and submits tailored applications while you sleep.</p>
          </div>
          <div className="rounded-3xl bg-brand-lavender p-5 sm:p-6 md:p-10">
            <img src={featureAuto} alt="Resume with AI tags" width={928} height={720} loading="lazy" className="mx-auto w-full max-w-md" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 rounded-3xl bg-brand-yellow p-5 sm:p-6 md:order-1 md:p-10">
            <img src={featureCover} alt="AI-personalized cover letter" width={928} height={720} loading="lazy" className="mx-auto w-full max-w-md" />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Personalized resume and cover letters</h2>
            <p className="mt-4 max-w-md text-muted-foreground">Every application gets a resume and cover letter written from scratch which is matched to the role, company, and your unique story.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Track every application</h2>
            <p className="mt-4 max-w-md text-muted-foreground">See what's been sent. Spot patterns and double down on what's working.</p>
          </div>
          <div className="rounded-3xl bg-brand-pink p-5 sm:p-6 md:p-10">
            <img src={featureStats} alt="Application tracking dashboard" width={928} height={720} loading="lazy" className="mx-auto w-full max-w-md" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 rounded-3xl bg-brand-cream p-5 sm:p-6 md:order-1 md:p-10">
            <img src={featureNewest} alt="Rocket launching over fresh job listings" width={928} height={720} loading="lazy" className="mx-auto w-full max-w-md" />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Apply to the newest jobs on market</h2>
            <p className="mt-4 max-w-md text-muted-foreground">Tudso auto-applies to the newest jobs on market before anybody else.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">Three steps to put your job search on autopilot</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: Upload, title: '1. Upload your resume', desc: 'Tell us about your goals and preferences. Takes less than 2 minutes.', bg: 'bg-brand-lavender' },
            { icon: Wand2, title: '2. AI tailors each application', desc: 'Tudso writes a custom resume and cover letter for every role, matched to the company.', bg: 'bg-brand-yellow' },
            { icon: Send, title: '3. Autopilot sends them daily', desc: 'Sit back. Tudso applies to the newest jobs on market and tracks every reply.', bg: 'bg-brand-mint' },
          ].map((step) => (
            <div key={step.title} className={`rounded-3xl ${step.bg} p-6 sm:p-8`}>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-background/70">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-black" style={displayFont}>{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>Let's start applying today.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Tudso applies you to the freshest jobs every day, on autopilot.</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Leaf className="h-4 w-4 text-brand-mint" />
            <span>Apply to jobs at companies like</span>
            <Leaf className="h-4 w-4 text-brand-mint" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80">
            {companyLogos.map((c) => (
              <img
                key={c.slug}
                src={`https://cdn.simpleicons.org/${c.slug}/111111`}
                alt={`${c.name} logo`}
                loading="lazy"
                className="h-6 w-auto sm:h-7"
              />
            ))}
          </div>
        </div>

        <PricingSection onSignup={openSignup} />

        <div className="mt-10 flex items-center justify-center text-sm text-muted-foreground">
          <span>Trusted by 5000+ jobseekers</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>What our users are saying</h2>
          <p className="mt-2 text-sm text-muted-foreground">Loved by job seekers around the world</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { name: 'Marcus', flag: '🇺🇸', meta: 'Landed SWE role in 3 weeks', bg: 'bg-brand-cream', quote: 'I applied to 400 jobs in a month without lifting a finger. Got 12 interviews and an offer at a startup I love.' },
            { name: 'Priya', flag: '🇬🇧', meta: 'Career switch to PM', bg: 'bg-brand-sky', quote: 'Writing cover letters was killing me. Tudso does it better than I ever could — and in seconds.' },
            { name: 'Jonas', flag: '🇩🇪', meta: 'Hired in 6 weeks', bg: 'bg-brand-pink', quote: "It's like having a personal recruiter working 24/7. The tracking dashboard alone is worth it." },
          ].map((t) => (
            <div key={t.name} className={`rounded-3xl ${t.bg} p-5 sm:p-6`}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background/60 text-lg">👤</div>
                <div className="min-w-0">
                  <div className="font-semibold">{t.name} <span className="ml-1">{t.flag}</span></div>
                  <div className="text-xs text-muted-foreground">{t.meta}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed">"{t.quote}"</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-black sm:text-3xl md:text-4xl" style={displayFont}>FAQ</h2>
          <p className="mt-2 text-sm text-muted-foreground">Common questions about Tudso</p>
        </div>
        <div className="mt-10 mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="how-it-works">
              <AccordionTrigger>How does Tudso apply to jobs for me?</AccordionTrigger>
              <AccordionContent>
                You upload your resume and answer a few questions about your goals. Tudso scans hundreds of job boards, matches you to relevant roles, and submits tailored applications on your behalf.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="customization">
              <AccordionTrigger>Are cover letters and resumes personalized?</AccordionTrigger>
              <AccordionContent>
                Yes. Every application is customized to the specific role and company using AI, so your experience matches what recruiters are looking for.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="safety">
              <AccordionTrigger>Is my data safe?</AccordionTrigger>
              <AccordionContent>
                Your information is encrypted and stored securely. We never share your personal data with third parties without your consent.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="billing">
              <AccordionTrigger>Can I cancel my subscription?</AccordionTrigger>
              <AccordionContent>
                Absolutely. You can cancel anytime from your account settings. We also offer a 30-day money-back guarantee.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="trial">
              <AccordionTrigger>How does the 4-day free trial work?</AccordionTrigger>
              <AccordionContent>
                The Tudso+ plan is free for the first 4 days. After that, your subscription begins automatically unless you cancel before the trial ends.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-5 sm:pb-10">
        <div className="rounded-3xl bg-secondary p-8 text-center sm:p-10">
          <div className="text-2xl font-black" style={displayFont}>Tudso</div>
          <nav className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <a href="#faq">FAQ</a>
            <a href="#">Terms of Use</a>
            <a href="#">Privacy Policy</a>
          </nav>
          <div className="mt-6 text-xs text-muted-foreground">© Tudso 2026</div>
        </div>
      </footer>

      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={displayFont} className="text-2xl">Join the waitlist</DialogTitle>
            <DialogDescription>
              Tudso is launching soon. Drop your details and we'll email you the moment you can start applying.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSignup} className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="Your name"
                maxLength={100}
                required
                value={signup.name}
                onChange={(e) => setSignup((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                maxLength={255}
                required
                value={signup.email}
                onChange={(e) => setSignup((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" size="lg">Join the waitlist</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
