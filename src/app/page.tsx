import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <main className="w-full max-w-xl space-y-12">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Ciarán Ryan
          </h1>
          <p className="text-lg text-muted">
            AI Engineer &middot; Data Scientist &middot; AI for public good
          </p>
          <nav className="flex gap-6 text-sm font-medium">
            <a
              href="https://github.com/ciaryan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline decoration-muted decoration-1 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
            >
              GitHub <span aria-hidden="true">&#8599;</span>
            </a>
            <a
              href="https://linkedin.com/in/ciaran27ryan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline decoration-muted decoration-1 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
            >
              LinkedIn <span aria-hidden="true">&#8599;</span>
            </a>
          </nav>
        </header>

        <section className="space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            I&apos;m an AI Engineer at the{' '}
            <strong className="text-foreground">
              Government Digital Service
            </strong>
            , where I work on Gov UK Chat — integrating LLMs, building RAG
            evaluation pipelines, and designing agentic architectures for public
            services.
          </p>
          <p>
            Previously at{' '}
            <strong className="text-foreground">Publicis Sapient</strong>, I led
            data science across audience segmentation, graph ML recommendation
            engines, and multi-agent prototyping for executive decision-making.
          </p>
          <p>
            I hold a First Class Honours MA in Statistics from University
            College Dublin and I am a Google Certified ML Engineer & AWS
            Certified AI Practitioner. I&apos;m interested in how agentic
            workflows and LLMs can be applied responsibly at scale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Play
          </h2>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-lg font-medium">
            <Link
              href="/play/connections"
              className="text-foreground transition-colors hover:text-muted"
            >
              Connections
            </Link>
            <Link
              href="/play/news-quiz"
              className="text-foreground transition-colors hover:text-muted"
            >
              News Quiz
            </Link>
            <Link
              href="/play/trivia"
              className="text-foreground transition-colors hover:text-muted"
            >
              Trivia
            </Link>
            <Link
              href="/idle"
              className="text-foreground transition-colors hover:text-muted"
            >
              Idle
            </Link>
          </nav>
        </section>
      </main>
    </div>
  );
}
