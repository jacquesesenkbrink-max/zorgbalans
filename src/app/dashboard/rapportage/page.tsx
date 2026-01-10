"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateGroup = {
  id: "gedrag" | "oorzaak" | "aanpak" | "effect";
  label: string;
  items: string[];
};

const templateGroups: TemplateGroup[] = [
  {
    id: "gedrag",
    label: "Gedrag",
    items: [
      "Client verhoogt stem en loopt weg uit de ruimte.",
      "Client weigert opdracht en gaat in discussie.",
      "Client is stil, teruggetrokken en maakt weinig contact.",
      "Client loopt onrustig rond en verlaat meerdere keren de ruimte.",
      "Client zoekt grens op en test afspraken.",
    ],
  },
  {
    id: "oorzaak",
    label: "Oorzaak",
    items: [
      "Aanleiding is een verandering in planning of verwachting.",
      "Trigger was drukte of harde geluiden in de omgeving.",
      "Onzekerheid over de taak leidde tot spanning.",
      "Afwijzing van een verzoek riep frustratie op.",
      "Vermoeidheid speelde mee in de reactie.",
    ],
  },
  {
    id: "aanpak",
    label: "Aanpak",
    items: [
      "Rustig aangesproken, grenzen benoemd en keuze geboden.",
      "Time-out aangeboden en prikkels verminderd.",
      "Structuur gegeven met korte, duidelijke stappen.",
      "Gecontroleerd of client de afspraak begreep en herhaald.",
      "Samen afgesproken wat nodig was om verder te kunnen.",
    ],
  },
  {
    id: "effect",
    label: "Effect",
    items: [
      "Client kalmeerde en pakte de taak weer op.",
      "Client bleef geagiteerd, situatie gestabiliseerd.",
      "Client trok zich terug maar bleef aanspreekbaar.",
      "Client accepteerde de afspraak en de sfeer verbeterde.",
      "Client had tijd nodig, daarna weer contact mogelijk.",
    ],
  },
];

const appendTemplate = (value: string, template: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? `${trimmed}\n${template}` : template;
};

export default function RapportagePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientCode, setClientCode] = useState("");
  const [gedrag, setGedrag] = useState("");
  const [oorzaak, setOorzaak] = useState("");
  const [aanpak, setAanpak] = useState("");
  const [effect, setEffect] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEmail(session?.user.email ?? null);
        setLoading(false);
      }
    );
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const reportText = useMemo(() => {
    const lines: string[] = [];
    const trimmedClient = clientCode.trim();
    if (trimmedClient) {
      lines.push(`Client: ${trimmedClient}`);
      lines.push("");
    }
    lines.push("Gedrag:");
    lines.push(gedrag.trim());
    lines.push("");
    lines.push("Oorzaak:");
    lines.push(oorzaak.trim());
    lines.push("");
    lines.push("Aanpak:");
    lines.push(aanpak.trim());
    lines.push("");
    lines.push("Effect:");
    lines.push(effect.trim());
    return lines.join("\n").trim();
  }, [aanpak, clientCode, effect, gedrag, oorzaak]);

  const handleCopy = async () => {
    if (!reportText) {
      setCopyStatus("Vul eerst de rapportage in.");
      return;
    }
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyStatus("Gekopieerd naar klembord.");
    } catch (error) {
      setCopyStatus("Kopieren mislukt. Probeer opnieuw.");
    }
  };

  const handleClear = () => {
    setClientCode("");
    setGedrag("");
    setOorzaak("");
    setAanpak("");
    setEffect("");
    setCopyStatus(null);
  };

  const templateMap = {
    gedrag: setGedrag,
    oorzaak: setOorzaak,
    aanpak: setAanpak,
    effect: setEffect,
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Dashboard
            </p>
            <h1 className="text-xl font-semibold">Rapportage</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Terug naar jaarplanner
            </a>
            <a
              href="/login"
              className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              Account
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          {loading ? (
            <p className="text-sm text-zinc-600">Sessiestatus laden...</p>
          ) : email ? (
            <p className="text-sm text-zinc-600">
              Ingelogd als <span className="font-semibold">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Je bent niet ingelogd.{" "}
              <a className="font-semibold text-zinc-900" href="/login">
                Log in
              </a>{" "}
              om rapportages te maken.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold">Rapportage invoer</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Gebruik sjablonen om snel te starten en voeg eigen nuance toe.
              </p>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Client (afkorting)
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                placeholder="Bijv. JD"
                value={clientCode}
                onChange={(event) => setClientCode(event.target.value)}
              />
            </div>

            {templateGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{group.label}</h3>
                  <button
                    type="button"
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                    onClick={() => {
                      templateMap[group.id]("");
                    }}
                  >
                    Wissen
                  </button>
                </div>
                <textarea
                  className="mt-3 min-h-[110px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                  placeholder={`${group.label} notities...`}
                  value={
                    group.id === "gedrag"
                      ? gedrag
                      : group.id === "oorzaak"
                      ? oorzaak
                      : group.id === "aanpak"
                      ? aanpak
                      : effect
                  }
                  onChange={(event) => {
                    templateMap[group.id](event.target.value);
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      onClick={() => {
                        templateMap[group.id]((current) =>
                          appendTemplate(current, item)
                        );
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Rapportage tekst</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Kopieer de tekst en plak deze in het clientdossier.
            </p>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
              <pre className="whitespace-pre-wrap font-sans">
                {reportText || "Vul de velden links om de rapportage te zien."}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                onClick={handleCopy}
              >
                Kopieer rapportage
              </button>
              <button
                type="button"
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                onClick={handleClear}
              >
                Alles wissen
              </button>
            </div>
            {copyStatus ? (
              <p className="mt-3 text-xs font-semibold text-zinc-600">
                {copyStatus}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
