export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            ZorgBalans
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
            Jaarplanner voor je uren, van concept tot definitief.
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600">
            Hou je basisrooster bij, plan diensten en zie je plus/min‑saldo
            cumulatief oplopen richting het jaareinde.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            href="/login"
          >
            Inloggen of registreren
          </a>
          <a
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
            href="/dashboard"
          >
            Naar dashboard
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">6‑maanden overzicht</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Altijd zes maanden in beeld met concept en definitieve uren.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Feestdagen + sluitingen</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Nederlandse feestdagen en eigen sluitingsdagen in de kalender.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Cumulatief saldo</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Direct zien hoeveel plus/min‑uren je naar het jaar‑einde meeneemt.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
