const features = [
  {
    title: 'Visual-first editing',
    description:
      'Compose UI with Puck and orchestrate logic via React Flow, keeping designers and engineers perfectly in sync.'
  },
  {
    title: 'Deterministic codegen',
    description:
      'Ship real React, Express, and Flutter apps from the same IR with adapter-pure, testable bundles.'
  },
  {
    title: 'LLM copilots with guardrails',
    description:
      'Generate nodes or components with schema-validated prompts so every suggestion is production-safe.'
  }
];

export const App = () => (
  <div className="min-h-screen bg-bw-ink text-bw-platinum">
    <section className="relative overflow-hidden bg-gradient-to-br from-bw-crimson via-bw-clay to-bw-ink py-20 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <div className="mx-auto h-full w-3/4 rounded-full bg-bw-sand blur-3xl" />
      </div>
      <div className="bw-container relative flex flex-col items-center gap-8">
        <p className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold tracking-widest text-bw-sand">
          VISUAL · LOGIC · CODEGEN
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
          Build production-grade apps from a single collaborative canvas.
        </h1>
        <p className="max-w-2xl text-base text-bw-platinum/80 md:text-lg">
          BuildWeaver unifies UI, logic, data, and LLM assistance so teams can go from idea to runnable
          code in a single, auditable workflow.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button className="rounded-full bg-bw-sand px-8 py-3 text-sm font-semibold uppercase tracking-wide text-bw-ink shadow-glow-sm transition hover:-translate-y-1">
            Launch Editor
          </button>
          <button className="rounded-full border border-white/40 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white/90 transition hover:bg-white/10">
            View Week-by-Week Plan
          </button>
        </div>
      </div>
    </section>

    <section className="bw-container py-20">
      <div className="mb-12 flex flex-col gap-4 text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-bw-amber">WHY BUILDWEAVER</p>
        <h2 className="text-3xl font-bold text-white md:text-4xl">Everything teams need to ship confidently</h2>
        <p className="text-bw-platinum/70 md:text-lg">
          Visual editing meets deterministic outputs, so your stack stays type-safe, testable, and ready for CI/CD.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg shadow-black/20 backdrop-blur"
          >
            <div className="mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-bw-crimson to-bw-amber p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-[1rem] bg-bw-ink text-xl font-bold text-bw-sand">✦</div>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
            <p className="text-sm text-bw-platinum/80">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  </div>
);
