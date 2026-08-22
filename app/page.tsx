import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-mist">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-mint">S</span>
            StackWatch
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-ink/65 transition hover:text-ink">
            Open dashboard <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <section className="relative flex flex-1 items-center py-20">
          <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-mint/70 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="mb-6 inline-flex rounded-full border border-teal/20 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal">
              Documentation intelligence
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-[-0.05em] text-ink sm:text-7xl">
              Don&apos;t monitor documentation.
              <span className="block text-teal">Monitor what it means for your code.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-ink/65">
              StackWatch is the foundation for tracking documentation changes, assessing project impact, and turning noise into useful engineering context.
            </p>
            <Link href="/dashboard" className="mt-10 inline-flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal">
              View MVP dashboard <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-ink/10 pt-5 text-xs text-ink/45">
          <span>StackWatch MVP foundation</span>
          <span>Built for signal, not noise.</span>
        </footer>
      </div>
    </main>
  );
}
