"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateCategory = "gedrag" | "oorzaak" | "aanpak" | "effect" | "interactie";

type TemplateType = "standard" | "interaction";

type TemplateRow = {
  id: string;
  category: TemplateCategory;
  template_type: TemplateType;
  text: string;
  sort_order: number;
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  gedrag: "Gedrag",
  oorzaak: "Oorzaak",
  aanpak: "Aanpak",
  effect: "Effect",
  interactie: "Interactie",
};

export default function RapportageAdminPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [formId, setFormId] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory>("gedrag");
  const [templateType, setTemplateType] = useState<TemplateType>("standard");
  const [text, setText] = useState("");
  const [sortOrder, setSortOrder] = useState("10");

  const groupedTemplates = useMemo(() => {
    const sorted = [...templates].sort((a, b) => a.sort_order - b.sort_order);
    return sorted.reduce<Record<TemplateCategory, TemplateRow[]>>(
      (acc, item) => {
        acc[item.category].push(item);
        return acc;
      },
      { gedrag: [], oorzaak: [], aanpak: [], effect: [], interactie: [] }
    );
  }, [templates]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("report_templates")
      .select("id, category, template_type, text, sort_order")
      .order("sort_order");
    if (loadError) {
      setError(loadError.message);
    } else {
      setTemplates((data ?? []) as TemplateRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setEmail(data.session?.user.email ?? null);
      loadTemplates();
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEmail(session?.user.email ?? null);
        loadTemplates();
      }
    );
    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const resetForm = () => {
    setFormId(null);
    setCategory("gedrag");
    setTemplateType("standard");
    setText("");
    setSortOrder("10");
  };

  const handleEdit = (template: TemplateRow) => {
    setFormId(template.id);
    setCategory(template.category);
    setTemplateType(template.template_type);
    setText(template.text);
    setSortOrder(String(template.sort_order));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("Tekst is verplicht.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      category,
      template_type: templateType,
      text: text.trim(),
      sort_order: Number(sortOrder) || 0,
    };
    if (formId) {
      const { error: updateError } = await supabase
        .from("report_templates")
        .update(payload)
        .eq("id", formId);
      if (updateError) {
        setError(updateError.message);
      } else {
        await loadTemplates();
        resetForm();
      }
    } else {
      const { error: insertError } = await supabase
        .from("report_templates")
        .insert(payload);
      if (insertError) {
        setError(insertError.message);
      } else {
        await loadTemplates();
        resetForm();
      }
    }
    setBusy(false);
  };

  const handleDelete = async (templateId: string) => {
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("report_templates")
      .delete()
      .eq("id", templateId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await loadTemplates();
      if (formId === templateId) {
        resetForm();
      }
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Rapportage
            </p>
            <h1 className="text-xl font-semibold">Sjablonen beheren</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/rapportage"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Terug naar rapportage
            </a>
            <a
              href="/dashboard"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Dashboard
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          {email ? (
            <p className="text-sm text-zinc-600">
              Ingelogd als <span className="font-semibold">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Log in om sjablonen te beheren.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)]">
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-zinc-600">Sjablonen laden...</p>
              </div>
            ) : (
              (Object.keys(groupedTemplates) as TemplateCategory[]).map(
                (categoryKey) => (
                  <div
                    key={categoryKey}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <h2 className="text-base font-semibold">
                      {CATEGORY_LABELS[categoryKey]}
                    </h2>
                    {groupedTemplates[categoryKey].length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        Nog geen sjablonen.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {groupedTemplates[categoryKey].map((template) => (
                          <div
                            key={template.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          >
                            <div className="min-w-[220px] flex-1 text-zinc-700">
                              {template.text}
                              <span className="ml-2 text-xs text-zinc-400">
                                #{template.sort_order} · {template.template_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                                onClick={() => handleEdit(template)}
                              >
                                Bewerken
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                                onClick={() => handleDelete(template.id)}
                                disabled={busy}
                              >
                                Verwijderen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">
              {formId ? "Sjabloon bewerken" : "Nieuw sjabloon"}
            </h2>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Categorie
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as TemplateCategory)
                }
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Type
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                value={templateType}
                onChange={(event) =>
                  setTemplateType(event.target.value as TemplateType)
                }
              >
                <option value="standard">Standaard</option>
                <option value="interaction">Interactie</option>
              </select>

              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Tekst
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                placeholder="Sjabloontekst..."
                value={text}
                onChange={(event) => setText(event.target.value)}
              />

              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Sorteer volgorde
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={busy}
                >
                  {formId ? "Opslaan" : "Toevoegen"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  onClick={resetForm}
                  disabled={busy}
                >
                  Wissen
                </button>
              </div>
            </form>
            {error ? (
              <p className="mt-3 text-xs font-semibold text-rose-600">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
