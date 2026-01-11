"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateCategory = "gedrag" | "oorzaak" | "aanpak" | "effect" | "interactie";

type TemplateRow = {
  id: string;
  category: TemplateCategory;
  text: string;
  template_type: "standard" | "interaction";
  sort_order: number;
};

type ChainRow = {
  id: string;
  category: "gedrag" | "oorzaak" | "aanpak" | "effect";
  text: string;
  next_ids: string[] | null;
  sort_order: number;
};

type TemplateGroup = {
  id: "gedrag" | "oorzaak" | "aanpak" | "effect";
  label: string;
  items: string[];
};

const CATEGORY_ORDER: Array<"gedrag" | "oorzaak" | "aanpak" | "effect"> = [
  "gedrag",
  "oorzaak",
  "aanpak",
  "effect",
];

const CATEGORY_LABELS: Record<
  "gedrag" | "oorzaak" | "aanpak" | "effect",
  string
> = {
  gedrag: "Gedrag",
  oorzaak: "Oorzaak",
  aanpak: "Aanpak",
  effect: "Effect",
};

const appendTemplate = (value: string, template: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? `${trimmed} ${template}` : template;
};

export default function RapportagePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientCode, setClientCode] = useState("");
  const [otherClientCode, setOtherClientCode] = useState("");
  const [interactionText, setInteractionText] = useState("");
  const [interactionContext, setInteractionContext] = useState<
    "gedrag" | "oorzaak" | null
  >(null);
  const [gedrag, setGedrag] = useState("");
  const [oorzaak, setOorzaak] = useState("");
  const [aanpak, setAanpak] = useState("");
  const [effect, setEffect] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [chainOptions, setChainOptions] = useState<ChainRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedGedragId, setSelectedGedragId] = useState<string | null>(null);
  const [selectedOorzaakId, setSelectedOorzaakId] = useState<string | null>(null);
  const [selectedAanpakId, setSelectedAanpakId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const previousOtherRef = useRef("een andere client");
  const previousClientRef = useRef("");

  const chainByCategory = useMemo(() => {
    const grouped = {
      gedrag: [] as ChainRow[],
      oorzaak: [] as ChainRow[],
      aanpak: [] as ChainRow[],
      effect: [] as ChainRow[],
    };
    const sorted = [...chainOptions].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    for (const option of sorted) {
      grouped[option.category].push(option);
    }
    return grouped;
  }, [chainOptions]);

  const filteredOorzaken = useMemo(() => {
    if (!selectedGedragId) return chainByCategory.oorzaak;
    const gedrag = chainByCategory.gedrag.find(
      (item) => item.id === selectedGedragId
    );
    const allowed = new Set(gedrag?.next_ids ?? []);
    return chainByCategory.oorzaak.filter((item) => allowed.has(item.id));
  }, [chainByCategory, selectedGedragId]);

  const filteredAanpakken = useMemo(() => {
    if (!selectedOorzaakId) return chainByCategory.aanpak;
    const oorzaak = chainByCategory.oorzaak.find(
      (item) => item.id === selectedOorzaakId
    );
    const allowed = new Set(oorzaak?.next_ids ?? []);
    return chainByCategory.aanpak.filter((item) => allowed.has(item.id));
  }, [chainByCategory, selectedOorzaakId]);

  const filteredEffecten = useMemo(() => {
    if (!selectedAanpakId) return chainByCategory.effect;
    const aanpak = chainByCategory.aanpak.find(
      (item) => item.id === selectedAanpakId
    );
    const allowed = new Set(aanpak?.next_ids ?? []);
    return chainByCategory.effect.filter((item) => allowed.has(item.id));
  }, [chainByCategory, selectedAanpakId]);

  const templateGroups = useMemo<TemplateGroup[]>(() => {
    return CATEGORY_ORDER.map((category) => {
      const items = templates
        .filter(
          (template) =>
            template.category === category &&
            template.template_type === "standard"
        )
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((template) => template.text);
      return {
        id: category,
        label: CATEGORY_LABELS[category],
        items,
      };
    });
  }, [templates]);

  const interactionTemplates = useMemo(() => {
    return templates
      .filter((template) => template.category === "interactie")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((template) => template.text);
  }, [templates]);

  const resolvedOtherClient = useMemo(() => {
    return otherClientCode.trim() || "een andere client";
  }, [otherClientCode]);

  useEffect(() => {
    const previous = previousOtherRef.current;
    if (previous === resolvedOtherClient) return;
    if (interactionText.includes(previous)) {
      const escaped = previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      setInteractionText((current) => current.replace(regex, resolvedOtherClient));
    }
    previousOtherRef.current = resolvedOtherClient;
  }, [interactionText, resolvedOtherClient]);

  useEffect(() => {
    const nextClient = clientCode.trim();
    const previous = previousClientRef.current;
    if (previous === nextClient) return;
    if (!nextClient && !previous) return;
    const updateText = (current: string) => {
      if (!previous) return current;
      if (!current.includes(previous)) return current;
      const escaped = previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      return current.replace(regex, nextClient);
    };
    setGedrag(updateText);
    setOorzaak(updateText);
    setAanpak(updateText);
    setEffect(updateText);
    setInteractionText(updateText);
    previousClientRef.current = nextClient;
  }, [clientCode]);

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

  useEffect(() => {
    let isMounted = true;
    if (!email) {
      setTemplates([]);
      setChainOptions([]);
      setTemplatesLoading(false);
      return () => {
        isMounted = false;
      };
    }
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const [templatesResult, chainsResult] = await Promise.all([
        supabase
          .from("report_templates")
          .select("id, category, text, template_type, sort_order")
          .order("sort_order"),
        supabase
          .from("report_chain_options")
          .select("id, category, text, next_ids, sort_order")
          .order("sort_order"),
      ]);
      if (!isMounted) return;
      if (templatesResult.error) {
        setTemplatesError(templatesResult.error.message);
      } else {
        setTemplates((templatesResult.data ?? []) as TemplateRow[]);
      }
      if (chainsResult.error) {
        setTemplatesError((current) =>
          current
            ? `${current} | ${chainsResult.error?.message ?? ""}`
            : chainsResult.error?.message ?? null
        );
      } else {
        setChainOptions((chainsResult.data ?? []) as ChainRow[]);
      }
      setTemplatesLoading(false);
    };
    loadTemplates();
    return () => {
      isMounted = false;
    };
  }, [email]);

  const reportText = useMemo(() => {
    const lines: string[] = [];
    const withClient = (text: string) => {
      return text.trim();
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
    const interactionLine = interactionText.trim()
      ? withClient(withOther(interactionText))
      : "";
    const gedragBlock = [withClient(gedrag)]
      .concat(
        interactionContext === "gedrag" && interactionLine
          ? [interactionLine]
          : []
      )
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ");
    const oorzaakBlock = [withClient(oorzaak)]
      .concat(
        interactionContext === "oorzaak" && interactionLine
          ? [interactionLine]
          : []
      )
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ");
    lines.push("Gedrag:");
    lines.push(gedragBlock);
    lines.push("");
    lines.push("Oorzaak:");
    lines.push(oorzaakBlock);
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
    interactionContext,
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
    setInteractionContext(null);
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
              Terug naar dashboard
            </a>
            <a
              href="/dashboard/rapportage/admin"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Sjablonen beheren
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
              {templatesLoading ? (
                <p className="mt-3 text-xs font-semibold text-zinc-500">
                  Sjablonen laden...
                </p>
              ) : templatesError ? (
                <p className="mt-3 text-xs font-semibold text-rose-600">
                  Sjablonen laden mislukt: {templatesError}
                </p>
              ) : null}
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
                {(group.id === "gedrag" || group.id === "oorzaak") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
                    <button
                      type="button"
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      onClick={() => {
                        const contextId =
                          group.id === "gedrag" || group.id === "oorzaak"
                            ? group.id
                            : null;
                        if (!contextId) return;
                        const nextContext =
                          interactionContext === contextId ? null : contextId;
                        setInteractionContext(nextContext);
                      }}
                    >
                      {interactionContext === group.id
                        ? "Interactie verbergen"
                        : "Interactie toevoegen"}
                    </button>
                    <span className="text-xs text-zinc-500">
                      Optioneel: interactie met andere clienten.
                    </span>
                  </div>
                )}
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
                {interactionContext === group.id && (
                  <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
                    <h4 className="text-sm font-semibold text-zinc-700">
                      {group.id === "gedrag"
                        ? "Gedrag bij interactie met anderen"
                        : "Oorzaak vanuit interactie met anderen"}
                    </h4>
                    <p className="mt-1 text-xs text-zinc-600">
                      Leg kort vast welke rol de interactie speelde.
                    </p>
                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Andere client (afkorting)
                    </label>
                    <input
                      className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                      placeholder="Bijv. MS"
                      value={otherClientCode}
                      onChange={(event) => setOtherClientCode(event.target.value)}
                    />
                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Interactie
                    </label>
                    <textarea
                      className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                      placeholder="Beschrijf de interactie kort..."
                      value={interactionText}
                      onChange={(event) => setInteractionText(event.target.value)}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {interactionTemplates.map((item) => {
                        const rendered = item.replaceAll(
                          "{other}",
                          resolvedOtherClient
                        );
                        return (
                          <button
                            key={item}
                            type="button"
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
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
                )}
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Ketting-suggesties
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(group.id === "gedrag"
                    ? chainByCategory.gedrag
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
                <div className="mt-3 text-xs text-zinc-500">
                  Tip: gebruik de ketting-suggesties hierboven voor snelle invoer.
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
