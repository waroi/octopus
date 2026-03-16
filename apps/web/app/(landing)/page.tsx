import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { HeroOctopus } from "@/components/hero-octopus";
import { auth } from "@/lib/auth";
import {
  IconBrandGithub,
  IconMessageChatbot,
  IconBrain,
  IconReportAnalytics,
  IconArrowRight,
  IconCode,
  IconGitPullRequest,
  IconShieldCheck,
  IconPlugConnected,
  IconRocket,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Octopus" width={32} height={32} />
            <span className="text-lg font-bold tracking-tight">Octopus</span>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/login">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pb-12 pt-20 sm:pb-16 sm:pt-28 lg:pb-24 lg:pt-36">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[300px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl dark:bg-primary/5" />
          <div className="absolute -top-[200px] left-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/6 blur-3xl dark:bg-primary/4" />
        </div>

        {/* 3D Octopus */}
        <HeroOctopus />

        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-8 inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              AI-powered code review automation
            </div>

            <h1 className="animate-fade-in text-5xl font-extrabold tracking-tight [animation-delay:100ms] sm:text-6xl lg:text-7xl">
              Your AI code reviewer
              <br />
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent dark:via-emerald-300 dark:to-teal-300">
                that never sleeps
              </span>
            </h1>

            <p className="animate-fade-in mx-auto mt-6 max-w-xl text-lg text-muted-foreground [animation-delay:200ms] sm:text-xl">
              Octopus reviews every pull request with deep context awareness.
              Catch bugs, enforce standards, and ship with confidence.
            </p>

            <div className="animate-fade-in mt-10 flex flex-col items-center gap-4 [animation-delay:300ms] sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 gap-2 px-8 text-base shadow-lg shadow-primary/25"
                asChild
              >
                <Link href="/login">
                  Start Free
                  <IconArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 gap-2 px-8 text-base" asChild>
                <a
                  href="https://github.com/Art-of-Technology/octopus"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconBrandGithub className="size-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          {/* Hero Visual — Code Review Mockup */}
          <div className="animate-fade-in mx-auto mt-16 max-w-4xl [animation-delay:400ms] sm:mt-20">
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-2xl" />

              <div className="relative overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/5 dark:shadow-black/30">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-400/70" />
                    <div className="size-3 rounded-full bg-yellow-400/70" />
                    <div className="size-3 rounded-full bg-green-400/70" />
                  </div>
                  <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                    <IconGitPullRequest className="size-3" />
                    feat: add user authentication middleware
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <IconGitPullRequest className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">feat: add user authentication middleware</span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">#142</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        opened 2 minutes ago by <span className="font-medium text-foreground">@developer</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <IconCheck className="size-3" />
                      Approved
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-md border bg-background font-mono text-xs">
                    <div className="border-b bg-muted/30 px-3 py-1.5 text-muted-foreground">src/middleware/auth.ts</div>
                    <div className="divide-y divide-border/50">
                      <DiffLine num="12" content="export async function authMiddleware(req: Request) {" />
                      <DiffLine num="13" content="  const token = req.headers.get('authorization');" type="context" />
                      <DiffLine num="" content="  if (!token) return Response.json({ error: 'missing' });" type="removed" />
                      <DiffLine num="14" content="  if (!token) {" type="added" />
                      <DiffLine num="15" content="    return Response.json({ error: 'Unauthorized' }, { status: 401 });" type="added" />
                      <DiffLine num="16" content="  }" type="added" />
                      <DiffLine num="17" content="  const session = await validateToken(token);" type="context" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Image src="/logo.svg" alt="Octopus" width={24} height={24} />
                      <span className="text-sm font-semibold">Octopus</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">AI Review</span>
                    </div>
                    <div className="mt-2.5 space-y-2 text-sm text-muted-foreground">
                      <div className="flex gap-2">
                        <IconCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        <span>
                          <span className="font-medium text-foreground">Proper HTTP status code.</span>{" "}
                          Good improvement — returning 401 instead of a generic response follows REST conventions.
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        <span>
                          <span className="font-medium text-foreground">Consider rate limiting.</span>{" "}
                          This endpoint could be targeted by brute-force attacks. Add rate limiting middleware.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/30 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 lg:grid-cols-4">
          <StatItem value="10x" label="Faster reviews" />
          <StatItem value="85%" label="Bugs caught before merge" />
          <StatItem value="< 2 min" label="Average review time" />
          <StatItem value="24/7" label="Always reviewing" />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Three steps to better reviews</h2>
            <p className="mt-4 text-muted-foreground">
              Connect your repos, and Octopus starts reviewing automatically. No configuration needed.
            </p>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            <StepCard step="01" icon={<IconPlugConnected className="size-5" />} title="Connect GitHub" description="Install the Octopus GitHub App and select the repositories you want to monitor." />
            <StepCard step="02" icon={<IconBrain className="size-5" />} title="AI Learns Your Code" description="Octopus indexes your codebase, understands your patterns, coding standards, and architecture." />
            <StepCard step="03" icon={<IconRocket className="size-5" />} title="Reviews on Autopilot" description="Every new PR gets an instant, context-aware review. Your team ships faster with confidence." />
          </div>
        </div>
      </section>

      {/* Features — Bento Grid */}
      <section className="relative border-t px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Features</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need for
              <br />
              better code reviews
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* AI Code Reviews — large card */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:col-span-2">
              <div className="flex flex-col lg:flex-row">
                <div className="flex-1 p-6 lg:p-8">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <IconBrain className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">AI Code Reviews</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Deep, context-aware reviews on every PR. Catches bugs, security issues, and anti-patterns before they reach production.
                  </p>
                </div>
                {/* Mini review mockup */}
                <div className="border-t px-6 pb-6 pt-4 lg:w-[320px] lg:border-l lg:border-t-0">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2 rounded-md bg-emerald-500/5 p-2.5">
                      <IconCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <div className="text-xs">
                        <span className="font-medium text-foreground">Type safe.</span>
                        <span className="text-muted-foreground"> Proper TypeScript generics used.</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-amber-500/5 p-2.5">
                      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <div className="text-xs">
                        <span className="font-medium text-foreground">Missing null check</span>
                        <span className="text-muted-foreground"> on line 42.</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-emerald-500/5 p-2.5">
                      <IconCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <div className="text-xs">
                        <span className="font-medium text-foreground">Good error handling.</span>
                        <span className="text-muted-foreground"> Try-catch covers edge cases.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat with Code */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <IconMessageChatbot className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">Chat with Your Code</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Ask anything about your codebase in natural language. Get instant, accurate answers.
                </p>
              </div>
              {/* Chat mockup */}
              <div className="border-t px-4 py-4">
                <div className="space-y-2.5">
                  <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-primary/10 px-3 py-2 text-xs text-foreground">
                    How does the auth middleware work?
                  </div>
                  <div className="mr-auto flex w-fit max-w-[85%] items-start gap-2">
                    <Image src="/logo.svg" alt="" width={18} height={18} className="mt-0.5 shrink-0" />
                    <div className="rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                      It validates JWT tokens from the Authorization header, checks expiry, and attaches the user to the request context...
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GitHub Native */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <IconGitPullRequest className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">GitHub Native</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Reviews appear as GitHub comments. No context switching — your team stays in the tools they use.
                </p>
              </div>
              {/* GitHub PR mockup */}
              <div className="border-t px-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md border bg-background p-2.5">
                    <IconGitPullRequest className="size-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">feat: add caching</span>
                    <span className="ml-auto rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">merged</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-background p-2.5">
                    <IconGitPullRequest className="size-3.5 text-primary" />
                    <span className="text-xs font-medium">fix: race condition</span>
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">open</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-background p-2.5">
                    <IconGitPullRequest className="size-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">refactor: utils</span>
                    <span className="ml-auto rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">merged</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Analytics — large card */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:col-span-2">
              <div className="flex flex-col lg:flex-row">
                <div className="flex-1 p-6 lg:p-8">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <IconReportAnalytics className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Team Analytics</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Time to merge, review quality, developer velocity — all the metrics you need to optimize your workflow.
                  </p>
                </div>
                {/* Chart mockup */}
                <div className="border-t px-6 pb-6 pt-4 lg:w-[320px] lg:border-l lg:border-t-0">
                  <div className="text-xs text-muted-foreground">Time to merge (hours)</div>
                  <div className="mt-3 flex items-end gap-2">
                    {[65, 48, 72, 35, 55, 28, 20].map((h, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-primary/20 transition-colors group-hover:bg-primary/40"
                          style={{ height: `${h}px` }}
                        />
                        <span className="text-[10px] text-muted-foreground/60">
                          {["M", "T", "W", "T", "F", "S", "S"][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg: 4.2h</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">-32% this week</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Repo */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <IconCode className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">Multi-Repo Support</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  One dashboard for all your repositories. Consistent quality across your org.
                </p>
              </div>
              {/* Repo list mockup */}
              <div className="border-t px-4 py-4">
                <div className="space-y-2">
                  {[
                    { name: "frontend", lang: "TypeScript", active: true },
                    { name: "api-server", lang: "Go", active: true },
                    { name: "mobile-app", lang: "Swift", active: false },
                  ].map((repo) => (
                    <div key={repo.name} className="flex items-center gap-2 rounded-md border bg-background p-2.5">
                      <IconBrandGithub className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium">{repo.name}</span>
                      <span className="text-[10px] text-muted-foreground">{repo.lang}</span>
                      <div className={`ml-auto size-2 rounded-full ${repo.active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Knowledge Base — large card */}
            <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:col-span-2">
              <div className="flex flex-col lg:flex-row">
                <div className="flex-1 p-6 lg:p-8">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <IconShieldCheck className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Knowledge Base</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Octopus learns your patterns and coding standards. Every review gets smarter as your codebase evolves.
                  </p>
                </div>
                {/* Knowledge mockup */}
                <div className="border-t px-6 pb-6 pt-4 lg:w-[320px] lg:border-l lg:border-t-0">
                  <div className="flex flex-wrap gap-1.5">
                    {["Auth patterns", "Error handling", "API conventions", "Naming rules", "Test coverage", "Type safety"].map((tag) => (
                      <span key={tag} className="rounded-full border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[78%] rounded-full bg-primary/60" />
                    </div>
                    <span>78% indexed</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[92%] rounded-full bg-primary/60" />
                    </div>
                    <span>92% learned</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section className="border-t px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Open Source</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Fully open source,
              <br />
              built in the open
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Octopus is 100% open source under the MIT license. Inspect the code,
              self-host on your own infrastructure, or contribute to make it better.
              No vendor lock-in, no hidden costs.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconCode className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">MIT Licensed</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Use it however you want — personal, commercial, or enterprise. No restrictions.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconBrandGithub className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">Community Driven</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                PRs welcome. Report bugs, request features, or build your own integrations.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconShieldCheck className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">Self-Host Ready</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Deploy on your own servers. Your code never leaves your infrastructure.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button variant="outline" size="lg" className="h-12 gap-2 px-8 text-base" asChild>
              <a href="https://github.com/Art-of-Technology/octopus" target="_blank" rel="noopener noreferrer">
                <IconBrandGithub className="size-4" />
                Star us on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to transform your
            <br />
            code review workflow?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Open source, free forever. Set up in under 2 minutes.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 gap-2 px-8 text-base shadow-lg shadow-primary/25" asChild>
              <Link href="/login">
                Get Started — It&apos;s Free
                <IconArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">No credit card required. Self-host or use our cloud.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Octopus" width={24} height={24} />
            <span className="font-medium text-foreground">Octopus</span>
          </div>
          <span>Open source code review automation.</span>
          <a
            href="https://github.com/Art-of-Technology/octopus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <IconBrandGithub className="size-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function DiffLine({ num, content, type = "context" }: { num: string; content: string; type?: "context" | "added" | "removed" }) {
  const bg = type === "added" ? "bg-emerald-500/8 dark:bg-emerald-500/10" : type === "removed" ? "bg-red-500/8 dark:bg-red-500/10" : "";
  const textColor = type === "added" ? "text-emerald-700 dark:text-emerald-300" : type === "removed" ? "text-red-700 dark:text-red-300" : "text-muted-foreground";
  const prefix = type === "added" ? "+" : type === "removed" ? "-" : " ";

  return (
    <div className={`flex ${bg}`}>
      <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-muted-foreground/50">{num}</span>
      <span className={`w-5 shrink-0 select-none py-0.5 text-center ${textColor}`}>{prefix}</span>
      <span className={`flex-1 py-0.5 pr-3 ${textColor}`}>{content}</span>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function StepCard({ step, icon, title, description }: { step: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative rounded-xl border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
      <div className="flex items-center gap-4">
        <span className="text-4xl font-black text-muted-foreground/20">{step}</span>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {icon}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
