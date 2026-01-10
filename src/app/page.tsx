export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            ZorgBalans
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
            Persoonlijk Zorg Dashboard voor je dagelijkse werk.
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600">
            Alle persoonlijke tools voor de zorgverlener samen in een overzicht,
            van jaarplanning tot rapportages.
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
            Naar het dashboard
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Jaarplanner</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Plan diensten, verlof en bekijk je saldo over het jaar.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Rapportage</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Maak snel een rapportage met ketting-suggesties en kopieer de tekst.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Alles op een plek</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Een dashboard voor planning, rapportage en overzicht.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
