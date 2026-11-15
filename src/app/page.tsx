import { HeroMock } from "@/components/landing/hero-mock";
import { QuickCheck } from "@/components/landing/quick-check";
import { SiteFooter, SiteNav } from "@/components/landing/site-nav";
import { Icon } from "@/components/ui/icon";
import { HOOD, LADDER, STEPS, TRUST } from "@/components/landing/content";
import { ButtonLink } from "@/components/ui/primitives";
import { prisma } from "@/lib/server/db";

export default async function LandingPage() {
  // A demo circle exists only where someone ran the seed. It uses the normal PIN sign-in.
  const demo = await prisma.careProfile.findFirst({
    where: { isDemo: true },
    select: { careCode: true, preferredName: true },
  });
  return (
    <>
      <SiteNav />
      <main id="main">
        {/* ---------------------------------------------------------- Hero */}
        <section className="paper-ruled relative -mt-20 overflow-hidden pt-28 pb-20">
          <div
            className="pointer-events-none absolute inset-y-0 left-[8%] hidden w-px bg-margin/50 lg:block"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 shadow-[var(--shadow-soft)]">
                <span className="size-1.5 rounded-full bg-sage" aria-hidden="true" />A shared care circle for the people
                who raised us
              </p>
              <h1 className="mt-6 text-[clamp(3rem,7vw,5.6rem)] leading-[0.98]">
                Every dose matters.
                <br />
                <em className="text-sky-600">
                  Nobody should <span className="highlight">carry it alone.</span>
                </em>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-2">
                Saathi keeps an elder&apos;s medicines, doctor visits and daily routine in one place their caretaker and
                family can share — reminds them gently, notices when something slips, and escalates only as far as it
                needs to. And nothing about their care changes without their say.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/start" size="lg" icon="heart">
                  Create a care circle — free
                </ButtonLink>
                <ButtonLink href="#ladder" size="lg" variant="secondary">
                  See how it escalates
                </ButtonLink>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
                <li className="flex items-center gap-2">
                  <Icon name="mail" className="size-4 text-sky-600" /> Email reminders, no app to install
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="lock" className="size-4 text-sky-600" /> PIN access for each person
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="text" className="size-4 text-sky-600" /> Large text &amp; read-aloud
                </li>
              </ul>
            </div>
            <div className="pt-10 lg:pt-0">
              <HeroMock />
            </div>
          </div>

          {demo && (
            <div className="mx-auto mt-16 max-w-6xl px-6">
              <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-hand text-2xl text-sky-600">Try it in 10 seconds →</p>
                  <p className="text-sm text-ink-2">
                    A seeded circle with six weeks of history. Sign in with the demo PINs printed by{" "}
                    <code>npm run setup</code> — the same secure sign-in as every circle.
                  </p>
                </div>
                <ButtonLink href={`/access/${demo.careCode}`} variant="secondary" icon="arrowRight">
                  Open {demo.preferredName}&apos;s demo circle
                </ButtonLink>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- Problem */}
        <section
          aria-labelledby="problem"
          className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2"
        >
          <div>
            <p className="eyebrow">The problem</p>
            <h2 id="problem" className="mt-2 text-[clamp(2.4rem,4.5vw,3.6rem)] leading-[1.03]">
              Seven medicines. Three doctors. Four people helping. Nobody sees the whole picture.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              The caretaker knows about this morning. The son abroad knows about last month&apos;s test. The elder knows
              what the doctor said — mostly. Reminders live on sticky notes and in WhatsApp groups. When a dose is
              missed, nobody finds out until something goes wrong.
            </p>
            <p className="mt-6 font-serif text-2xl text-sky-600 italic">Saathi notices.</p>
          </div>
          <figure className="card p-6">
            <div className="grid grid-cols-10 gap-2.5" aria-hidden="true">
              {Array.from({ length: 50 }, (_, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded-full ${i === 33 ? "animate-pulse-ring bg-rose" : i % 7 === 3 ? "bg-marigold-200" : "bg-sky-100"}`}
                />
              ))}
            </div>
            <figcaption className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-center">
              <div>
                <p className="font-serif text-4xl">~50%</p>
                <p className="text-xs text-ink-2">average adherence to long-term therapy (WHO)</p>
              </div>
              <div>
                <p className="font-serif text-4xl">5+</p>
                <p className="text-xs text-ink-2">daily medicines — where polypharmacy risk begins</p>
              </div>
              <div>
                <p className="font-serif text-4xl">
                  30<span className="text-xl">min</span>
                </p>
                <p className="text-xs text-ink-2">how long Saathi waits before it nudges</p>
              </div>
            </figcaption>
            <p className="mt-4 text-center text-xs text-ink-3">
              One dot is one dose in a month. The red one went unnoticed — until now.
            </p>
          </figure>
        </section>

        {/* --------------------------------------------------------- Steps */}
        <section id="how" aria-labelledby="how-title" className="dot-grid border-y border-line bg-paper-2 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 id="how-title" className="mt-2 text-[clamp(2.4rem,4.5vw,3.6rem)] leading-[1.03]">
                  A routine that looks after itself.
                </h2>
              </div>
              <p className="max-w-sm text-ink-2">
                Eight things a devoted family member does without thinking — now done every day, for every dose.
              </p>
            </div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="card group relative overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700">
                      <Icon name={s.icon} />
                    </span>
                    <span
                      className="font-serif text-5xl text-paper-3 transition-colors group-hover:text-sky-200 before:content-[attr(data-n)]"
                      data-n={String(i + 1).padStart(2, "0")}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-6 text-xs font-semibold tracking-widest text-ink-3 uppercase">Step {i + 1}</p>
                  <h3 className="mt-1 text-2xl">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-16">
              <QuickCheck />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Ladder */}
        <section
          id="ladder"
          aria-labelledby="ladder-title"
          className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1.2fr]"
        >
          <div>
            <p className="eyebrow">When a dose slips</p>
            <h2 id="ladder-title" className="mt-2 text-[clamp(2.4rem,4.5vw,3.6rem)] leading-[1.03]">
              It never panics. It escalates gently.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Every circle sets its own timings. The elder always hears first. The family hears only when it genuinely
              matters — once, clearly, with what to do next.
            </p>
          </div>
          <div>
            <ol className="relative flex flex-col gap-4 before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-px before:bg-line-2">
              {LADDER.map((l, i) => (
                <li key={l.when} className="relative flex gap-4">
                  <span
                    className={`z-10 grid size-10 shrink-0 place-items-center rounded-full text-white ${l.tone}`}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="card flex-1 p-4">
                    <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
                      {l.when} · to {l.who}
                    </p>
                    <p className="mt-1">{l.what}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="card mt-6 ml-14 rotate-[-1deg] border-dashed p-4 text-sm">
              <p className="text-ink-3">To: Rahul (son) · Subject: Missed: Kamala&apos;s 9:00 PM medicines</p>
              <p className="mt-2">
                Atorvastatin 10 mg wasn&apos;t confirmed within 2 hours, so it&apos;s been marked missed. Please check
                in with Kamala — and don&apos;t let her double the next dose.
              </p>
              <p className="font-hand mt-2 text-xl text-sky-600">— sent once. Never twice.</p>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- Elder at centre */}
        <section id="families" aria-labelledby="families-title" className="paper-ruled border-y border-line py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div className="card order-2 p-6 lg:order-1">
              <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Waiting for Kamala&apos;s OK</p>
              <p className="mt-2 font-serif text-2xl">Priya suggested: move Atorvastatin to 8:00 PM, with dinner</p>
              <p className="mt-1 text-sm text-ink-2">“She keeps falling asleep before 9.” · 5 hours ago</p>
              <div className="mt-5 flex gap-2" aria-hidden="true">
                <span
                  className={`${"inline-flex min-h-11 items-center gap-2 rounded-xl bg-sage-700 px-4 font-semibold text-white"}`}
                >
                  <Icon name="check" className="size-4" /> Approve
                </span>
                <span className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 font-semibold">
                  Not now
                </span>
              </div>
              <div className="mt-6 rounded-xl border border-amber-100 bg-amber-100/60 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-amber-700">
                  <Icon name="shield" className="size-4" /> Senior safety check
                </p>
                <p className="mt-1 text-ink">
                  Levothyroxine and Shelcal are only 2 hours apart — calcium blocks thyroid medicine. Keep them at least
                  4 hours apart.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="eyebrow">The elder stays in charge</p>
              <h2 id="families-title" className="mt-2 text-[clamp(2.4rem,4.5vw,3.6rem)] leading-[1.03]">
                Their care. Their decision.
              </h2>
              <p className="mt-5 text-lg text-ink-2">
                With consent mode on, anything a caretaker or relative changes about a medicine arrives as a suggestion.
                Kamala approves it with one tap — or doesn&apos;t. Family can still log doses, book appointments and add
                questions for the doctor.
              </p>
              <ul className="mt-6 space-y-3 text-ink-2">
                <li className="flex gap-3">
                  <Icon name="check" className="mt-1 size-5 text-sage-700" /> Roles for elder, caretaker and family —
                  each with their own PIN
                </li>
                <li className="flex gap-3">
                  <Icon name="check" className="mt-1 size-5 text-sage-700" /> “Questions for the doctor” the elder
                  writes themselves
                </li>
                <li className="flex gap-3">
                  <Icon name="check" className="mt-1 size-5 text-sage-700" /> A printable health card for clinics and
                  emergencies
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Trust */}
        <section id="trust" aria-labelledby="trust-title" className="mx-auto max-w-6xl px-6 py-24">
          <p className="eyebrow">Built to be trusted</p>
          <h2 id="trust-title" className="mt-2 max-w-3xl text-[clamp(2.4rem,4.5vw,3.6rem)] leading-[1.03]">
            Not a reminder app. A care system.
          </h2>
          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.label} className="card p-5">
                <dt className="sr-only">{t.label}</dt>
                <dd className="font-serif text-5xl text-sky-600">{t.value}</dd>
                <dd className="mt-2 text-sm text-ink-2">{t.label}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {HOOD.map((h) => (
              <li key={h.title} className="card p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-paper-2 text-sky-700">
                  <Icon name={h.icon} />
                </span>
                <h3 className="mt-4 font-sans text-lg font-semibold tracking-normal">{h.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{h.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-3">
            <Icon name="info" className="size-4" /> Next.js · TypeScript · Prisma · Nodemailer · Luxon — tested with
            Vitest, Playwright &amp; axe.
          </p>
        </section>

        {/* ------------------------------------------------------------ CTA */}
        <section className="paper-ruled border-t border-line py-24 text-center">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-[clamp(2.6rem,5vw,4.2rem)] leading-[1.02]">
              Give the people who cared for you <em className="text-sky-600">a circle that cares back.</em>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/start" size="lg" icon="heart">
                Create a care circle
              </ButtonLink>
              <ButtonLink href="/access" size="lg" variant="secondary">
                I already have a care code
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
