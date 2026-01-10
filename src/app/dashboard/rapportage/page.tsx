"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateGroup = {
  id: "gedrag" | "oorzaak" | "aanpak" | "effect";
  label: string;
  items: string[];
};

type ChainOption = {
  id: string;
  text: string;
  next?: string[];
};

const templateGroups: TemplateGroup[] = [
  {
    id: "gedrag",
    label: "Gedrag",
    items: [
      "Ik zie dat je je stem verhoogt en wegloopt uit de ruimte.",
      "Je weigert de opdracht en gaat in discussie.",
      "Je bent stil, teruggetrokken en maakt weinig contact.",
      "Je loopt onrustig rond en verlaat meerdere keren de ruimte.",
      "Je zoekt de grens op en test de afspraken.",
    ],
  },
  {
    id: "oorzaak",
    label: "Oorzaak",
    items: [
      "De aanleiding lijkt een verandering in planning of verwachting.",
      "De drukte of harde geluiden in de omgeving lijken je te prikkelen.",
      "Onzekerheid over de taak lijkt spanning te geven.",
      "De afwijzing van een verzoek lijkt frustratie op te roepen.",
      "Vermoeidheid lijkt mee te spelen in je reactie.",
    ],
  },
  {
    id: "aanpak",
    label: "Aanpak",
    items: [
      "Ik heb je rustig aangesproken, grenzen benoemd en je een keuze geboden.",
      "Ik heb je een time-out aangeboden en prikkels verminderd.",
      "Ik heb structuur gegeven met korte, duidelijke stappen.",
      "Ik heb gecontroleerd of je de afspraak begreep en deze herhaald.",
      "We hebben samen afgesproken wat nodig was om verder te kunnen.",
    ],
  },
  {
    id: "effect",
    label: "Effect",
    items: [
      "Je kalmeerde en pakte de taak weer op.",
      "Je bleef geagiteerd, maar de situatie is gestabiliseerd.",
      "Je trok je terug maar bleef aanspreekbaar.",
      "Je accepteerde de afspraak en de sfeer verbeterde.",
      "Je had tijd nodig, daarna was weer contact mogelijk.",
    ],
  },
];

const interactionTemplates = [
  "Ik zie dat je reageert op {other}.",
  "Er ontstaat spanning in het contact met {other}.",
  "Je zoekt contact met {other} en stemt gedrag daarop af.",
  "Ik zie kort contact tussen jou en {other}.",
];

const gedragOptions: ChainOption[] = [
  {
    id: "gedrag-verhoogt-stem",
    text: "Ik zie dat je je stem verhoogt en wegloopt uit de ruimte.",
    next: ["oorzaak-planning", "oorzaak-prikkels", "oorzaak-frustratie"],
  },
  {
    id: "gedrag-weigert-opdracht",
    text: "Je weigert de opdracht en gaat in discussie.",
    next: ["oorzaak-onzeker", "oorzaak-frustratie", "oorzaak-verandering"],
  },
  {
    id: "gedrag-teruggetrokken",
    text: "Je bent stil, teruggetrokken en maakt weinig contact.",
    next: ["oorzaak-onzeker", "oorzaak-vermoeid", "oorzaak-prikkels"],
  },
  {
    id: "gedrag-onrustig",
    text: "Je loopt onrustig rond en verlaat meerdere keren de ruimte.",
    next: ["oorzaak-prikkels", "oorzaak-verandering", "oorzaak-onzeker"],
  },
  {
    id: "gedrag-grens",
    text: "Je zoekt de grens op en test de afspraken.",
    next: ["oorzaak-frustratie", "oorzaak-verandering", "oorzaak-onzeker"],
  },
];

const oorzaakOptions: ChainOption[] = [
  {
    id: "oorzaak-planning",
    text: "De aanleiding lijkt een verandering in planning of verwachting.",
    next: ["aanpak-structuur", "aanpak-grenzen", "aanpak-samen-afspraak"],
  },
  {
    id: "oorzaak-prikkels",
    text: "De drukte of harde geluiden in de omgeving lijken je te prikkelen.",
    next: ["aanpak-timeout", "aanpak-structuur", "aanpak-grenzen"],
  },
  {
    id: "oorzaak-onzeker",
    text: "Onzekerheid over de taak lijkt spanning te geven.",
    next: ["aanpak-structuur", "aanpak-herhalen", "aanpak-samen-afspraak"],
  },
  {
    id: "oorzaak-frustratie",
    text: "De afwijzing van een verzoek lijkt frustratie op te roepen.",
    next: ["aanpak-grenzen", "aanpak-keuze", "aanpak-timeout"],
  },
  {
    id: "oorzaak-vermoeid",
    text: "Vermoeidheid lijkt mee te spelen in je reactie.",
    next: ["aanpak-timeout", "aanpak-structuur", "aanpak-samen-afspraak"],
  },
  {
    id: "oorzaak-verandering",
    text: "Een verandering in de situatie lijkt je te ontregelen.",
    next: ["aanpak-structuur", "aanpak-grenzen", "aanpak-samen-afspraak"],
  },
];

const aanpakOptions: ChainOption[] = [
  {
    id: "aanpak-grenzen",
    text: "Ik heb je rustig aangesproken, grenzen benoemd en je een keuze geboden.",
    next: ["effect-kalmeert", "effect-stabiliseert", "effect-sfeer"],
  },
  {
    id: "aanpak-timeout",
    text: "Ik heb je een time-out aangeboden en prikkels verminderd.",
    next: ["effect-kalmeert", "effect-terugtrekken", "effect-stabiliseert"],
  },
  {
    id: "aanpak-structuur",
    text: "Ik heb structuur gegeven met korte, duidelijke stappen.",
    next: ["effect-kalmeert", "effect-sfeer", "effect-contact"],
  },
  {
    id: "aanpak-herhalen",
    text: "Ik heb gecontroleerd of je de afspraak begreep en deze herhaald.",
    next: ["effect-sfeer", "effect-kalmeert", "effect-contact"],
  },
  {
    id: "aanpak-samen-afspraak",
    text: "We hebben samen afgesproken wat nodig was om verder te kunnen.",
    next: ["effect-sfeer", "effect-contact", "effect-stabiliseert"],
  },
  {
    id: "aanpak-keuze",
    text: "Ik heb je een keuze gegeven zodat je regie kon behouden.",
    next: ["effect-kalmeert", "effect-sfeer", "effect-contact"],
  },
];

const effectOptions: ChainOption[] = [
  {
    id: "effect-kalmeert",
    text: "Je kalmeerde en pakte de taak weer op.",
  },
  {
    id: "effect-stabiliseert",
    text: "Je bleef geagiteerd, maar de situatie is gestabiliseerd.",
  },
  {
    id: "effect-terugtrekken",
    text: "Je trok je terug maar bleef aanspreekbaar.",
  },
  {
    id: "effect-sfeer",
    text: "Je accepteerde de afspraak en de sfeer verbeterde.",
  },
  {
    id: "effect-contact",
    text: "Je had tijd nodig, daarna was weer contact mogelijk.",
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
  const [otherClientCode, setOtherClientCode] = useState("");
  const [interactionText, setInteractionText] = useState("");
  const [includeInteraction, setIncludeInteraction] = useState(true);
  const [gedrag, setGedrag] = useState("");
  const [oorzaak, setOorzaak] = useState("");
  const [aanpak, setAanpak] = useState("");
  const [effect, setEffect] = useState("");
  const [selectedGedragId, setSelectedGedragId] = useState<string | null>(null);
  const [selectedOorzaakId, setSelectedOorzaakId] = useState<string | null>(null);
  const [selectedAanpakId, setSelectedAanpakId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const filteredOorzaken = useMemo(() => {
    if (!selectedGedragId) return oorzaakOptions;
    const gedrag = gedragOptions.find((item) => item.id === selectedGedragId);
    const allowed = new Set(gedrag?.next ?? []);
    return oorzaakOptions.filter((item) => allowed.has(item.id));
  }, [selectedGedragId]);

  const filteredAanpakken = useMemo(() => {
    if (!selectedOorzaakId) return aanpakOptions;
    const oorzaak = oorzaakOptions.find((item) => item.id === selectedOorzaakId);
    const allowed = new Set(oorzaak?.next ?? []);
    return aanpakOptions.filter((item) => allowed.has(item.id));
  }, [selectedOorzaakId]);

  const filteredEffecten = useMemo(() => {
    if (!selectedAanpakId) return effectOptions;
    const aanpak = aanpakOptions.find((item) => item.id === selectedAanpakId);
    const allowed = new Set(aanpak?.next ?? []);
    return effectOptions.filter((item) => allowed.has(item.id));
  }, [selectedAanpakId]);

  const resolvedOtherClient = useMemo(() => {
    return otherClientCode.trim() || "een andere client";
  }, [otherClientCode]);

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
    const prefix = trimmedClient ? `${trimmedClient}, ` : "";
    const withClient = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return "";
      if (!prefix) return trimmed;
      if (trimmed.toLowerCase().startsWith(trimmedClient.toLowerCase())) {
        return trimmed;
      }
      return `${prefix}${trimmed}`;
    };
    const withOther = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return "";
      const resolved = resolvedOtherClient;
      if (trimmed.includes("{other}")) {
        return trimmed.replaceAll("{other}", resolved);
      }
      if (trimmed.toLowerCase().includes(resolved.toLowerCase())) {
        return trimmed;
      }
      return `${trimmed} met ${resolved}`;
    };
    const gedragBlock = [withClient(gedrag)]
      .concat(
        includeInteraction && interactionText.trim()
          ? [withClient(withOther(interactionText))]
          : []
      )
      .filter(Boolean)
      .join("\n");
    const interactionBlock =
      includeInteraction && interactionText.trim()
        ? withClient(withOther(interactionText))
        : "";
    lines.push("Gedrag:");
    lines.push(gedragBlock);
    lines.push("");
    if (interactionBlock) {
      lines.push("Interactie:");
      lines.push(interactionBlock);
      lines.push("");
    }
    lines.push("Oorzaak:");
    lines.push(withClient(oorzaak));
    lines.push("");
    lines.push("Aanpak:");
    lines.push(withClient(aanpak));
    lines.push("");
    lines.push("Effect:");
    lines.push(withClient(effect));
    return lines.join("\n").trim();
  }, [
    aanpak,
    clientCode,
    effect,
    gedrag,
    oorzaak,
    otherClientCode,
    includeInteraction,
    interactionText,
  ]);

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
    setOtherClientCode("");
    setInteractionText("");
    setIncludeInteraction(true);
    setGedrag("");
    setOorzaak("");
    setAanpak("");
    setEffect("");
    setSelectedGedragId(null);
    setSelectedOorzaakId(null);
    setSelectedAanpakId(null);
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
                Gebruik sjablonen die gericht zijn aan de client en voeg nuance toe.
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

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Interactie</h3>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300"
                    checked={includeInteraction}
                    onChange={(event) => setIncludeInteraction(event.target.checked)}
                  />
                  Opnemen in rapportage
                </label>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                Leg kort vast als er interactie was met een andere client.
              </p>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Andere client (afkorting)
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                placeholder="Bijv. MS"
                value={otherClientCode}
                onChange={(event) => setOtherClientCode(event.target.value)}
              />
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Interactie
              </label>
              <textarea
                className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                placeholder="Beschrijf de interactie kort..."
                value={interactionText}
                onChange={(event) => setInteractionText(event.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {interactionTemplates.map((item) => {
                  const rendered = item.replaceAll("{other}", resolvedOtherClient);
                  return (
                    <button
                      key={item}
                      type="button"
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      onClick={() => {
                        setInteractionText((current) =>
                          appendTemplate(current, rendered)
                        );
                      }}
                    >
                      {rendered}
                    </button>
                  );
                })}
              </div>
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
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Ketting-suggesties
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(group.id === "gedrag"
                    ? gedragOptions
                    : group.id === "oorzaak"
                    ? filteredOorzaken
                    : group.id === "aanpak"
                    ? filteredAanpakken
                    : filteredEffecten
                  ).map((item) => {
                    const isSelected =
                      (group.id === "gedrag" && item.id === selectedGedragId) ||
                      (group.id === "oorzaak" &&
                        item.id === selectedOorzaakId) ||
                      (group.id === "aanpak" &&
                        item.id === selectedAanpakId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                        }`}
                        onClick={() => {
                          if (group.id === "gedrag") {
                            setSelectedGedragId(item.id);
                            setSelectedOorzaakId(null);
                            setSelectedAanpakId(null);
                            setGedrag((current) =>
                              appendTemplate(current, item.text)
                            );
                            return;
                          }
                          if (group.id === "oorzaak") {
                            setSelectedOorzaakId(item.id);
                            setSelectedAanpakId(null);
                            setOorzaak((current) =>
                              appendTemplate(current, item.text)
                            );
                            return;
                          }
                          if (group.id === "aanpak") {
                            setSelectedAanpakId(item.id);
                            setAanpak((current) =>
                              appendTemplate(current, item.text)
                            );
                            return;
                          }
                          setEffect((current) =>
                            appendTemplate(current, item.text)
                          );
                        }}
                      >
                        {item.text}
                      </button>
                    );
                  })}
                </div>
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
