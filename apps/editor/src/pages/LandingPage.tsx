import { Link } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────── */

const features = [
  {
    icon: '✦',
    title: 'Visual-First Editing',
    description:
      'Design stunning interfaces with Puck editor while engineers wire logic through React Flow — all on one collaborative canvas.',
    highlight: 'No more design-to-dev handoff friction'
  },
  {
    icon: '◈',
    title: 'Instant Multi-Platform Export',
    description:
      'Generate production-ready React, Express, and Flutter apps from a single source of truth. Same IR, multiple outputs.',
    highlight: 'Ship to web & mobile simultaneously'
  },
  {
    icon: '◇',
    title: 'AI Copilot with Guardrails',
    description:
      'Let LLMs generate components and logic nodes with schema-validated prompts. Every suggestion is type-safe and auditable.',
    highlight: 'Safe AI that respects your architecture'
  },
  {
    icon: '▣',
    title: 'Enterprise-Grade Security',
    description:
      'Self-host on your infrastructure. Your code, your data, your rules. Full audit trails and role-based access control.',
    highlight: 'Complete data sovereignty'
  },
  {
    icon: '◉',
    title: 'Built-In Testing & CI/CD',
    description:
      'Every generated bundle is testable out of the box. Integrate seamlessly with your existing pipelines and workflows.',
    highlight: 'Ship with confidence'
  },
  {
    icon: '⟲',
    title: 'Version Control Native',
    description:
      'IR-based architecture means every change is diffable, mergeable, and reversible. Git-friendly by design.',
    highlight: 'Real version control for visual builders'
  }
];

const workflowSteps = [
  {
    step: '01',
    title: 'Design Visually',
    description: 'Drag and drop components to build your UI. No code required to start.',
    color: 'from-bw-crimson to-bw-clay'
  },
  {
    step: '02',
    title: 'Wire Logic',
    description: 'Connect nodes to define data flow, API calls, and business rules.',
    color: 'from-bw-clay to-bw-amber'
  },
  {
    step: '03',
    title: 'Generate & Deploy',
    description: 'Export production code for your target platform. Ready for CI/CD.',
    color: 'from-bw-amber to-bw-sand'
  }
];

const useCases = [
  {
    industry: 'Startups',
    title: 'Ship MVPs 10x Faster',
    description: 'Go from idea to working prototype in hours, not weeks. Iterate rapidly with visual feedback.',
    metric: '10x',
    metricLabel: 'faster prototyping'
  },
  {
    industry: 'Agencies',
    title: 'Scale Client Delivery',
    description: 'Empower designers to build while developers focus on complex integrations.',
    metric: '60%',
    metricLabel: 'less dev time'
  },
  {
    industry: 'Enterprise',
    title: 'Standardize App Development',
    description: 'Enforce patterns and generate consistent, auditable code across all teams.',
    metric: '100%',
    metricLabel: 'code consistency'
  }
];

const stats = [
  { value: '50+', label: 'Component Types' },
  { value: '3', label: 'Export Targets' },
  { value: '100%', label: 'Type-Safe Output' },
  { value: '∞', label: 'Possibilities' }
];

/* ─────────────────────────────────────────────────────────────
   COMPONENTS
───────────────────────────────────────────────────────────── */

const GlowOrb = ({ className }: { className?: string }) => (
  <div
    className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
    aria-hidden
  />
);

const FeatureCard = ({
  icon,
  title,
  description,
  highlight
}: {
  icon: string;
  title: string;
  description: string;
  highlight: string;
}) => (
  <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-6 transition-all duration-300 hover:border-bw-sand/30 hover:shadow-lg hover:shadow-bw-crimson/10">
    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-bw-crimson/10 blur-2xl transition-all duration-500 group-hover:bg-bw-sand/20" />
    <div className="relative">
      <span className="mb-4 inline-block text-3xl">{icon}</span>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-bw-platinum/70">{description}</p>
      <span className="inline-block rounded-full bg-bw-sand/10 px-3 py-1 text-xs font-semibold text-bw-sand">
        {highlight}
      </span>
    </div>
  </article>
);

const WorkflowStep = ({
  step,
  title,
  description,
  color,
  isLast
}: {
  step: string;
  title: string;
  description: string;
  color: string;
  isLast: boolean;
}) => (
  <div className="relative flex flex-col items-center text-center">
    <div
      className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-2xl font-black text-white shadow-lg`}
    >
      {step}
    </div>
    {!isLast && (
      <div className="absolute left-1/2 top-16 hidden h-px w-full -translate-x-0 bg-gradient-to-r from-transparent via-bw-sand/30 to-transparent md:block" />
    )}
    <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
    <p className="text-sm text-bw-platinum/70">{description}</p>
  </div>
);

const UseCaseCard = ({
  industry,
  title,
  description,
  metric,
  metricLabel
}: {
  industry: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
}) => (
  <article className="group flex flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-bw-ink via-bw-ink to-bw-crimson/5 p-8 transition-all duration-300 hover:border-bw-clay/30">
    <span className="mb-2 text-xs font-bold uppercase tracking-widest text-bw-clay">
      {industry}
    </span>
    <h3 className="mb-3 text-xl font-bold text-white">{title}</h3>
    <p className="mb-6 flex-1 text-sm leading-relaxed text-bw-platinum/70">{description}</p>
    <div className="border-t border-white/10 pt-6">
      <span className="block text-4xl font-black text-bw-sand">{metric}</span>
      <span className="text-xs uppercase tracking-wider text-bw-platinum/50">{metricLabel}</span>
    </div>
  </article>
);

const StatItem = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl font-black text-bw-sand md:text-4xl">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-wider text-bw-platinum/60">{label}</div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */

export const LandingPage = () => (
  <div className="overflow-hidden">
    {/* ───────────────── HERO ───────────────── */}
    <section className="relative min-h-[90vh] bg-gradient-to-b from-bw-ink via-bw-ink to-transparent">
      <GlowOrb className="left-1/4 top-20 h-96 w-96 bg-bw-crimson/30" />
      <GlowOrb className="right-1/4 top-40 h-80 w-80 bg-bw-clay/20" />
      <GlowOrb className="bottom-20 left-1/2 h-72 w-72 -translate-x-1/2 bg-bw-sand/10" />

      <div className="bw-container relative flex min-h-[90vh] flex-col items-center justify-center py-20 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-bw-sand/20 bg-bw-sand/5 px-4 py-2 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bw-sand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bw-sand" />
          </span>
          <span className="text-sm font-medium text-bw-sand">Now in Public Beta</span>
        </div>

        {/* Headline */}
        <h1 className="mb-6 max-w-4xl text-4xl font-black leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
          Build Apps{' '}
          <span className="bg-gradient-to-r from-bw-crimson via-bw-clay to-bw-sand bg-clip-text text-transparent">
            Visually.
          </span>
          <br />
          Ship Code{' '}
          <span className="bg-gradient-to-r from-bw-sand via-bw-amber to-bw-crimson bg-clip-text text-transparent">
            Confidently.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mb-10 max-w-2xl text-lg text-bw-platinum/70 md:text-xl">
          The self-hosted visual builder that turns designs into production-ready React, Express, and Flutter code — with AI assistance and full type safety.
        </p>

        {/* CTAs */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-bw-crimson to-bw-clay px-10 py-4 text-base font-bold uppercase tracking-wide text-white shadow-glow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-bw-crimson/30"
          >
            <span className="relative z-10">Start Building Free</span>
            <div className="absolute inset-0 bg-gradient-to-r from-bw-clay to-bw-crimson opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-white/20 bg-white/5 px-10 py-4 text-base font-semibold text-white/90 backdrop-blur transition-all duration-300 hover:border-bw-sand/40 hover:bg-white/10"
          >
            Sign In →
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="grid w-full max-w-2xl grid-cols-2 gap-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur md:grid-cols-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>

    {/* ───────────────── SOCIAL PROOF ───────────────── */}
    <section className="border-y border-white/5 bg-bw-ink/50 py-12">
      <div className="bw-container">
        <p className="mb-8 text-center text-sm uppercase tracking-widest text-bw-platinum/40">
          Trusted by forward-thinking teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-50 grayscale md:gap-16">
          {['Startups', 'Agencies', 'Enterprises', 'Indie Hackers', 'Students'].map((name) => (
            <span key={name} className="text-lg font-bold text-bw-platinum/60">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* ───────────────── FEATURES ───────────────── */}
    <section className="relative py-24">
      <GlowOrb className="-left-40 top-1/2 h-96 w-96 bg-bw-crimson/10" />

      <div className="bw-container relative">
        <div className="mb-16 max-w-2xl">
          <span className="mb-4 inline-block text-sm font-bold uppercase tracking-widest text-bw-amber">
            Why BuildWeaver
          </span>
          <h2 className="mb-4 text-3xl font-black text-white md:text-5xl">
            Everything you need to ship production apps
          </h2>
          <p className="text-lg text-bw-platinum/60">
            Visual editing meets deterministic code generation. Your stack stays type-safe, testable, and CI/CD ready.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>

    {/* ───────────────── HOW IT WORKS ───────────────── */}
    <section className="relative border-y border-white/5 bg-gradient-to-b from-transparent via-bw-crimson/5 to-transparent py-24">
      <div className="bw-container">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-block text-sm font-bold uppercase tracking-widest text-bw-clay">
            How It Works
          </span>
          <h2 className="mb-4 text-3xl font-black text-white md:text-5xl">
            From idea to deployment in three steps
          </h2>
          <p className="mx-auto max-w-xl text-lg text-bw-platinum/60">
            No complex setup. No steep learning curve. Just build, connect, and ship.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {workflowSteps.map((item, index) => (
            <WorkflowStep
              key={item.step}
              {...item}
              isLast={index === workflowSteps.length - 1}
            />
          ))}
        </div>
      </div>
    </section>

    {/* ───────────────── USE CASES ───────────────── */}
    <section className="relative py-24">
      <GlowOrb className="-right-40 top-1/3 h-80 w-80 bg-bw-sand/10" />

      <div className="bw-container relative">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-block text-sm font-bold uppercase tracking-widest text-bw-sand">
            Use Cases
          </span>
          <h2 className="mb-4 text-3xl font-black text-white md:text-5xl">
            Built for teams that ship
          </h2>
          <p className="mx-auto max-w-xl text-lg text-bw-platinum/60">
            Whether you're a solo founder or an enterprise team, BuildWeaver scales with your needs.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {useCases.map((useCase) => (
            <UseCaseCard key={useCase.industry} {...useCase} />
          ))}
        </div>
      </div>
    </section>

    {/* ───────────────── TECH STACK ───────────────── */}
    <section className="border-y border-white/5 bg-bw-ink/50 py-16">
      <div className="bw-container text-center">
        <p className="mb-6 text-sm uppercase tracking-widest text-bw-platinum/40">
          Powered by modern tech
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-bw-platinum/50">
          {['React', 'TypeScript', 'Node.js', 'Flutter', 'Puck Editor', 'React Flow', 'Drizzle ORM', 'OpenRouter'].map(
            (tech) => (
              <span
                key={tech}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-bw-sand/30 hover:text-bw-sand"
              >
                {tech}
              </span>
            )
          )}
        </div>
      </div>
    </section>

    {/* ───────────────── FINAL CTA ───────────────── */}
    <section className="relative py-32">
      <GlowOrb className="left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 bg-bw-crimson/20" />

      <div className="bw-container relative text-center">
        <h2 className="mb-6 text-4xl font-black text-white md:text-6xl">
          Ready to build{' '}
          <span className="bg-gradient-to-r from-bw-crimson to-bw-sand bg-clip-text text-transparent">
            something amazing?
          </span>
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-lg text-bw-platinum/60">
          Join developers who are shipping faster with BuildWeaver. Free to start, powerful enough to scale.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-bw-sand to-bw-amber px-12 py-4 text-base font-bold uppercase tracking-wide text-bw-ink shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-bw-sand/20"
          >
            <span className="relative z-10">Get Started — It's Free</span>
          </Link>
          <Link
            to="/workspace"
            className="rounded-full border border-white/20 px-8 py-4 text-base font-semibold text-white/90 transition-all hover:border-bw-sand/40 hover:bg-white/5"
          >
            Explore Demo
          </Link>
        </div>
      </div>
    </section>

    {/* ───────────────── FOOTER ───────────────── */}
    <footer className="border-t border-white/5 bg-bw-ink py-12">
      <div className="bw-container">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-bw-crimson to-bw-clay text-lg font-black text-white">
              BW
            </div>
            <span className="text-lg font-bold text-white">BuildWeaver</span>
          </div>
          <div className="flex gap-6 text-sm text-bw-platinum/50">
            <a href="#" className="transition hover:text-bw-sand">
              Documentation
            </a>
            <a href="#" className="transition hover:text-bw-sand">
              GitHub
            </a>
            <a href="#" className="transition hover:text-bw-sand">
              Discord
            </a>
            <a href="#" className="transition hover:text-bw-sand">
              Twitter
            </a>
          </div>
          <p className="text-xs text-bw-platinum/30">
            © {new Date().getFullYear()} BuildWeaver. Self-hosted & open.
          </p>
        </div>
      </div>
    </footer>
  </div>
);
