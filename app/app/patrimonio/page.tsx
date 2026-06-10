"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmToast } from "@/app/components/confirm-toast";
import AppShell from "@/app/components/app-shell";

// ── Types ─────────────────────────────────────────────────────────────────────

type RowType = "SECTION" | "ASSET" | "SUBTOTAL" | "TOTAL";

type Asset = {
  id: string;
  groupId: string;
  sectionId: string | null;
  referenceMonth: string;
  label: string;
  sublabel: string | null;
  rowType: RowType;
  economico: string | null;
  financeiro: string | null;
  sortOrder: number;
};

type Group = { id: string; name: string; isActive: boolean };

type AssetForm = {
  label: string;
  sublabel: string;
  rowType: RowType;
  sectionId: string;
  newSectionName: string;
  economico: string;
  financeiro: string;
  sortOrder: string;
  referenceMonth: string;
};

const emptyForm = (): AssetForm => ({
  label: "",
  sublabel: "",
  rowType: "ASSET",
  sectionId: "",
  newSectionName: "",
  economico: "",
  financeiro: "",
  sortOrder: "0",
  referenceMonth: new Date().toISOString().slice(0, 7),
});

const NEW_SECTION_VALUE = "__new_section__";

type CopyForm = {
  sourceMonth: string;
  targetMonth: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNumber(v: string | null | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtShort(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDecimal(v: string | null): number | null {
  if (!v) return null;
  return parseFloat(v);
}

function totalRow(a: Asset): number {
  return (parseDecimal(a.economico) ?? 0) + (parseDecimal(a.financeiro) ?? 0);
}

function hasAnyValue(a: Asset): boolean {
  return a.economico !== null || a.financeiro !== null;
}

function monthLabel(m: string): string {
  const [year, month] = m.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sectionAssetsTotal(rows: Asset[], sectionName: string): number | null {
  const wanted = normalizeText(sectionName);
  const startIndex = rows.findIndex(
    (row) =>
      (row.rowType === "SECTION" || row.rowType === "SUBTOTAL") &&
      normalizeText(row.label).includes(wanted),
  );
  if (startIndex < 0) return null;

  let total = 0;
  let hasValue = false;
  for (const row of rows.slice(startIndex + 1)) {
    if (row.rowType === "SECTION" || row.rowType === "SUBTOTAL" || row.rowType === "TOTAL") break;
    if (row.rowType !== "ASSET") continue;
    const economico = parseDecimal(row.economico) ?? 0;
    const financeiro = parseDecimal(row.financeiro) ?? 0;
    if (row.economico !== null || row.financeiro !== null) hasValue = true;
    total += economico + financeiro;
  }

  return hasValue ? total : null;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: number | null; sub: string;
  color: "blue" | "emerald" | "amber"; icon: React.ReactNode;
}) {
  const colors = {
    blue: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-300",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
    amber: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300",
  };
  const iconBg = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  };
  return (
    <div className={`flex flex-col rounded-2xl border-2 p-5 ${colors[color]}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg[color]}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${colors[color]}`}>
        {value !== null ? fmtShort(value) : <span className="text-zinc-400 text-lg">—</span>}
      </p>
      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}

// ── Asset Modal ───────────────────────────────────────────────────────────────

function AssetModal({ open, editing, form, sections, onClose, onFormChange, onSave }: {
  open: boolean; editing: Asset | null; form: AssetForm;
  sections: Asset[];
  onClose: () => void; onFormChange: (f: AssetForm) => void; onSave: (e: FormEvent) => Promise<void>;
}) {
  if (!open) return null;
  const isSection = form.rowType === "SECTION" || form.rowType === "SUBTOTAL";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">
            {editing ? "Editar ativo" : "Novo ativo patrimonial"}
          </h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSave} className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Mês de referência</label>
              <input type="month" required value={form.referenceMonth}
                onChange={(e) => onFormChange({ ...form, referenceMonth: e.target.value })}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Tipo de linha</label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {form.rowType === "SUBTOTAL" ? "Subtotal" : isSection ? "Secao" : "Ativo"}
              </div>
            </div>
          </div>
          {!isSection && (
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Secao do patrimonio <span className="text-red-500">*</span></label>
                <select required value={form.sectionId}
                  onChange={(e) => onFormChange({ ...form, sectionId: e.target.value, newSectionName: e.target.value === NEW_SECTION_VALUE ? form.newSectionName : "" })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  <option value="" disabled>Selecione uma secao</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                  <option value={NEW_SECTION_VALUE}>+ Criar nova secao</option>
                </select>
              </div>
              {form.sectionId === NEW_SECTION_VALUE && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Nome da nova secao <span className="text-red-500">*</span></label>
                  <input type="text" required placeholder="Ex: Cotas Patrimoniais" value={form.newSectionName}
                    onChange={(e) => onFormChange({ ...form, newSectionName: e.target.value })}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Descrição <span className="text-red-500">*</span></label>
            <input type="text" required placeholder="Ex: APLICAÇÕES BANCO DO BRASIL" value={form.label}
              onChange={(e) => onFormChange({ ...form, label: e.target.value })}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sublabel <span className="text-zinc-300 text-[10px]">opcional</span></label>
            <input type="text" placeholder="Ex: Cotas patrimoniais" value={form.sublabel}
              onChange={(e) => onFormChange({ ...form, sublabel: e.target.value })}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          {!isSection && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Econômico (R$)</label>
                <input type="number" step="0.01" placeholder="0.00" value={form.economico}
                  onChange={(e) => onFormChange({ ...form, economico: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Financeiro (R$)</label>
                <input type="number" step="0.01" placeholder="0.00" value={form.financeiro}
                  onChange={(e) => onFormChange({ ...form, financeiro: e.target.value })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Ordem de exibição</label>
            <input type="number" step="1" value={form.sortOrder}
              onChange={(e) => onFormChange({ ...form, sortOrder: e.target.value })}
              className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              {editing ? "Salvar alterações" : "Criar ativo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit/Delete icon buttons ──────────────────────────────────────────────────

function EditBtn({ onClick, light = false }: { onClick: () => void; light?: boolean }) {
  return (
    <button type="button" onClick={onClick} title="Editar"
      className={`rounded-lg p-1.5 transition-colors ${
        light
          ? "bg-white/10 text-white hover:bg-white/25"
          : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/60"
      }`}>
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.929l-3.536.707.707-3.536A4 4 0 019 13z" />
      </svg>
    </button>
  );
}

function DeleteBtn({ onClick, light = false }: { onClick: () => void; light?: boolean }) {
  return (
    <button type="button" onClick={onClick} title="Excluir"
      className={`rounded-lg p-1.5 transition-colors ${
        light
          ? "bg-white/10 text-white hover:bg-red-400/30"
          : "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
      }`}>
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm());
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyForm, setCopyForm] = useState<CopyForm>({
    sourceMonth: "",
    targetMonth: new Date().toISOString().slice(0, 7),
  });

  // Auth
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user?: { id: string; role: "ADMIN" | "CLIENT"; email: string } }) => {
        if (!data.user) { router.push("/login"); return; }
        setUserRole(data.user.role);
        setUserEmail(data.user.email);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Load groups once role is known
  useEffect(() => {
    if (!userRole) return;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data: { groups?: Group[] }) => {
        const g = data.groups ?? [];
        setGroups(g);
        if (g.length > 0) setSelectedGroupId(g[0].id);
        else setIsLoading(false);
      });
  }, [userRole]);

  // Load months when group changes
  useEffect(() => {
    if (!selectedGroupId) return;
    setSelectedMonth("");
    setAssets([]);
    fetch(`/api/patrimonio/months?groupId=${selectedGroupId}`)
      .then((r) => r.json())
      .then((data: { months?: string[] }) => {
        const m = data.months ?? [];
        setMonths(m);
        if (m.length > 0) setSelectedMonth(m[0]);
        else setIsLoading(false);
      });
  }, [selectedGroupId]);

  // Load assets when month changes
  const loadAssets = useCallback(async () => {
    if (!selectedGroupId || !selectedMonth) { setAssets([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const r = await fetch(`/api/patrimonio?groupId=${selectedGroupId}&month=${selectedMonth}`);
      const data = (await r.json()) as { assets?: Asset[] };
      setAssets(data.assets ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroupId, selectedMonth]);

  useEffect(() => { if (selectedMonth) loadAssets(); }, [selectedMonth, loadAssets]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const availableSections = assets.filter(
    (asset) => (asset.rowType === "SECTION" || asset.rowType === "SUBTOTAL") && !asset.id.startsWith("__"),
  );

  // CRUD
  function openCreate() {
    setEditingAsset(null);
    setForm({
      ...emptyForm(),
      referenceMonth: selectedMonth || new Date().toISOString().slice(0, 7),
      sectionId: availableSections[0]?.id ?? NEW_SECTION_VALUE,
    });
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setForm({
      label: asset.label,
      sublabel: asset.sublabel ?? "",
      rowType: asset.rowType,
      sectionId: asset.sectionId ?? availableSections[0]?.id ?? NEW_SECTION_VALUE,
      newSectionName: "",
      economico: asset.economico !== null ? String(parseDecimal(asset.economico) ?? "") : "",
      financeiro: asset.financeiro !== null ? String(parseDecimal(asset.financeiro) ?? "") : "",
      sortOrder: String(asset.sortOrder),
      referenceMonth: asset.referenceMonth,
    });
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (form.rowType === "ASSET" && (!form.sectionId || (form.sectionId === NEW_SECTION_VALUE && !form.newSectionName.trim()))) {
      toast.error("Informe a secao do patrimonio.");
      return;
    }
    const payload = {
      groupId: selectedGroupId,
      referenceMonth: form.referenceMonth,
      label: form.label.trim(),
      sublabel: form.sublabel.trim() || null,
      rowType: form.rowType,
      sectionId: form.rowType === "ASSET" && form.sectionId !== NEW_SECTION_VALUE ? form.sectionId : null,
      newSectionName: form.rowType === "ASSET" && form.sectionId === NEW_SECTION_VALUE ? form.newSectionName.trim() : null,
      economico: toNumber(form.economico),
      financeiro: toNumber(form.financeiro),
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    const url = editingAsset ? `/api/patrimonio/${editingAsset.id}` : "/api/patrimonio";
    const method = editingAsset ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      toast.error(d.error ?? "Falha ao salvar.");
      return;
    }
    toast.success(editingAsset ? "Ativo atualizado." : "Ativo criado.");
    setModalOpen(false);
    if (!editingAsset && form.referenceMonth !== selectedMonth) {
      setMonths((prev) => Array.from(new Set([form.referenceMonth, ...prev])).sort((a, b) => b.localeCompare(a)));
      setSelectedMonth(form.referenceMonth);
    } else {
      await loadAssets();
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmToast("Deseja remover este ativo?"))) return;
    const res = await fetch(`/api/patrimonio/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      toast.error(d.error ?? "Falha ao remover.");
      return;
    }
    toast.success("Ativo removido.");
    await loadAssets();
  }

  function openCopyModal() {
    setCopyForm({
      sourceMonth: selectedMonth || months[0] || new Date().toISOString().slice(0, 7),
      targetMonth: new Date().toISOString().slice(0, 7),
    });
    setCopyModalOpen(true);
  }

  async function handleCopy(e: FormEvent) {
    e.preventDefault();
    if (!selectedGroupId) return;
    const res = await fetch("/api/patrimonio/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: selectedGroupId,
        sourceMonth: copyForm.sourceMonth,
        targetMonth: copyForm.targetMonth,
      }),
    });
    const data = (await res.json()) as { error?: string; assetsCopied?: number; sectionsCopied?: number };
    if (!res.ok) {
      toast.error(data.error ?? "Falha ao copiar patrimonio.");
      return;
    }

    toast.success(`Patrimonio copiado: ${data.sectionsCopied ?? 0} secoes e ${data.assetsCopied ?? 0} ativos.`);
    setCopyModalOpen(false);
    setMonths((prev) => Array.from(new Set([copyForm.targetMonth, ...prev])).sort((a, b) => b.localeCompare(a)));
    setSelectedMonth(copyForm.targetMonth);
  }

  // KPIs
  const totalAsset = assets.find((a) => a.rowType === "TOTAL");
  const economicoTotal = totalAsset ? parseDecimal(totalAsset.economico) : null;
  const financeiroTotal = totalAsset ? parseDecimal(totalAsset.financeiro) : null;
  const grandTotal = economicoTotal !== null || financeiroTotal !== null
    ? (economicoTotal ?? 0) + (financeiroTotal ?? 0) : null;

  const producedSection = assets.find(
    (a) =>
      (a.rowType === "SECTION" || a.rowType === "SUBTOTAL") &&
      normalizeText(a.label).includes("patrimonio produzido"),
  );
  const producedSubtotalValue = producedSection
    ? ((parseDecimal(producedSection.economico) ?? 0) + (parseDecimal(producedSection.financeiro) ?? 0)) || null
    : null;
  const producedValue = producedSubtotalValue ?? sectionAssetsTotal(assets, "patrimonio produzido");

  const imovelAsset = assets.find((a) => a.rowType === "ASSET" && (a.sublabel ?? a.label).toLowerCase().includes("im"));
  const imovelValue = imovelAsset
    ? (parseDecimal(imovelAsset.economico) ?? parseDecimal(imovelAsset.financeiro))
    : null;

  const isAdmin = userRole === "ADMIN";
  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const colClass = isAdmin ? "grid-cols-[1fr_170px_170px_170px_72px]" : "grid-cols-[1fr_200px_200px_200px]";

  return (
    <AppShell role={userRole} email={userEmail} onLogout={handleLogout}>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-800 dark:text-zinc-100">
            Demonstrativo de Ativos Patrimoniais
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            {selectedMonth
              ? <>Posição em <span className="font-semibold text-zinc-600 dark:text-zinc-300">{monthLabel(selectedMonth)}</span></>
              : "Selecione um período"}
            {currentGroup && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                {currentGroup.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 1 && (
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {months.length > 0 && (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          )}
          {isAdmin && (
            <>
              {months.length > 0 && (
                <button type="button" onClick={openCopyModal}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8m-7 8h6a2 2 0 002-2V7l-4-4H9a2 2 0 00-2 2v2m-2 4v8a2 2 0 002 2h6" />
                  </svg>
                  Copiar competencia
                </button>
              )}
              <button type="button" onClick={openCreate}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Novo ativo
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total do Patrimônio" value={grandTotal} sub="Econômico + Financeiro" color="blue"
          icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h10m-7 4h4" /></svg>} />
        <KpiCard label="Patrimônio Produzido" value={producedValue} sub={producedSection?.label ?? "Cotas, A Receber, Móveis"} color="emerald"
          icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
        <KpiCard label="Imóveis" value={imovelValue} sub={imovelAsset?.sublabel ?? "Bens imóveis"} color="amber"
          icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && selectedGroupId && months.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center dark:border-zinc-700">
          <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
          </svg>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Nenhum dado cadastrado ainda.</p>
          {isAdmin && (
            <button type="button" onClick={openCreate}
              className="mt-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              Cadastrar primeiro ativo
            </button>
          )}
        </div>
      )}

      {!isLoading && assets.length > 0 && (
        <>
          {/* ── MOBILE ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:hidden">
            {assets.map((asset) => {
              const total = totalRow(asset);
              const hasVal = hasAnyValue(asset);
              if (asset.rowType === "SECTION") {
                return (
                  <div key={asset.id} className="mt-1 flex items-center justify-between px-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{asset.label}</p>
                    {isAdmin && !asset.id.startsWith("__") && <div className="flex gap-1"><EditBtn onClick={() => openEdit(asset)} /><DeleteBtn onClick={() => handleDelete(asset.id)} /></div>}
                  </div>
                );
              }
              if (asset.rowType === "TOTAL" || asset.rowType === "SUBTOTAL") {
                return (
                  <div key={asset.id} className="flex items-center justify-between rounded-2xl bg-blue-600 px-4 py-4 shadow-sm dark:bg-blue-700">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-white">{asset.label}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-extrabold tabular-nums text-white">{hasVal ? fmt(total) : "—"}</p>
                      {isAdmin && asset.rowType !== "TOTAL" && <div className="flex gap-1"><EditBtn onClick={() => openEdit(asset)} light /><DeleteBtn onClick={() => handleDelete(asset.id)} light /></div>}
                    </div>
                  </div>
                );
              }
              return (
                <div key={asset.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900/50">
                  <div className="mb-3 flex items-start justify-between">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {asset.label}
                      {asset.sublabel && <span className="ml-1.5 text-[10px] font-normal text-zinc-400">— {asset.sublabel}</span>}
                    </p>
                    {isAdmin && <div className="flex gap-1"><EditBtn onClick={() => openEdit(asset)} /><DeleteBtn onClick={() => handleDelete(asset.id)} /></div>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800">
                      <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Econômico</span>
                      <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{fmt(asset.economico)}</span>
                    </div>
                    <div className="flex flex-col rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
                      <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-500">Financeiro</span>
                      <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{fmt(asset.financeiro)}</span>
                    </div>
                    <div className="flex flex-col rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-900/20">
                      <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-blue-500">Total</span>
                      <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{hasVal ? fmt(total) : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="px-1 pb-2 text-[11px] text-zinc-400 dark:text-zinc-500">ⓘ Econômico = soma dos exercícios registrados.</p>
          </div>

          {/* ── DESKTOP ─────────────────────────────────────────────────────── */}
          <div className="hidden sm:block overflow-hidden rounded-2xl shadow-lg border border-[#0c3460]/20 dark:border-[#0f4c81]/20">
            <div className="flex items-center justify-between bg-linear-to-r from-[#0c3460] to-[#0f4c81] px-6 py-4 dark:from-[#090f1a] dark:to-[#0d1f38]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70">Demonstrativo Patrimonial</p>
                <p className="mt-0.5 text-sm font-bold text-white">{currentGroup?.name} — {selectedMonth ? monthLabel(selectedMonth) : ""}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                <span className="text-[10px] font-semibold text-blue-200">Econômico + Financeiro</span>
              </div>
            </div>

            {/* Column headers */}
            <div className={`grid ${colClass} border-b border-[#0c3460]/10 dark:border-[#0f4c81]/15`}>
              <div className="bg-[#0f4c81]/5 px-6 py-3 dark:bg-[#0f4c81]/10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0c3460] dark:text-blue-300">Ativo</p>
              </div>
              <div className="border-l border-[#0c3460]/10 bg-[#0f4c81]/8 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-[#0f4c81]/15">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f4c81] dark:text-blue-300">Econômico</p>
              </div>
              <div className="border-l border-[#0c3460]/10 bg-amber-50 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-amber-950/30">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">Financeiro</p>
              </div>
              <div className="border-l border-[#0c3460]/10 bg-[#0c3460]/5 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-[#0c3460]/30">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0c3460] dark:text-blue-200">Total</p>
              </div>
              {isAdmin && <div className="border-l border-[#0c3460]/10 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50" />}
            </div>

            <div className="divide-y divide-[#0c3460]/6 dark:divide-[#0f4c81]/10 bg-white dark:bg-zinc-900/70">
              {assets.map((asset) => {
                const total = totalRow(asset);
                const hasVal = hasAnyValue(asset);
                const pct = asset.economico !== null && grandTotal && grandTotal > 0
                  ? Math.round((parseDecimal(asset.economico)! / grandTotal) * 100) : 0;

                if (asset.rowType === "SECTION") {
                  return (
                    <div key={asset.id} className={`grid ${colClass}`}>
                      <div className="flex items-center border-l-4 border-[#0f4c81] bg-[#0f4c81]/5 px-5 py-2.5 dark:border-[#0f4c81]/70 dark:bg-[#0f4c81]/10">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0f4c81] dark:text-blue-300">{asset.label}</p>
                      </div>
                      <div className="border-l border-[#0c3460]/8 bg-[#0f4c81]/3" />
                      <div className="border-l border-[#0c3460]/8 bg-amber-50/40" />
                      <div className="border-l border-[#0c3460]/8 bg-[#0c3460]/3" />
                      {isAdmin && !asset.id.startsWith("__") && <div className="flex items-center justify-center gap-0.5 border-l border-zinc-100 dark:border-zinc-700"><EditBtn onClick={() => openEdit(asset)} /><DeleteBtn onClick={() => handleDelete(asset.id)} /></div>}
                    </div>
                  );
                }

                if (asset.rowType === "TOTAL" || asset.rowType === "SUBTOTAL") {
                  return (
                    <div key={asset.id} className={`grid ${colClass} bg-linear-to-r from-[#0c3460] via-[#0f4c81] to-[#0c3460] dark:from-[#090f1a] dark:via-[#0d1f38] dark:to-[#090f1a]`}>
                      <div className="flex items-center gap-3 px-6 py-4">
                        <span className="h-px w-5 bg-white/30" />
                        <p className="text-sm font-extrabold uppercase tracking-wide text-white">{asset.label}</p>
                      </div>
                      <p className="border-l border-white/15 py-4 text-center text-sm font-semibold tabular-nums text-blue-200">{fmt(asset.economico)}</p>
                      <p className="border-l border-white/15 py-4 text-center text-sm font-semibold tabular-nums text-blue-200">{fmt(asset.financeiro)}</p>
                      <p className="border-l border-white/15 py-4 text-center text-sm font-extrabold tabular-nums text-white">{hasVal ? fmt(total) : "—"}</p>
                      {isAdmin && asset.rowType !== "TOTAL" && <div className="flex items-center justify-center gap-0.5 border-l border-white/10"><EditBtn onClick={() => openEdit(asset)} light /><DeleteBtn onClick={() => handleDelete(asset.id)} light /></div>}
                    </div>
                  );
                }

                return (
                  <div key={asset.id} className={`group grid ${colClass} transition-colors hover:bg-[#0f4c81]/5 dark:hover:bg-[#0f4c81]/8`}>
                    <div className="flex flex-col justify-center px-6 py-4">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{asset.label}</p>
                      {asset.sublabel && <p className="mt-0.5 text-[10px] text-zinc-400">{asset.sublabel}</p>}
                      {pct > 0 && (
                        <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#0c3460]/8 dark:bg-[#0f4c81]/20">
                          <div className="h-1 rounded-full bg-[#0f4c81]/50" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-center border-l border-[#0c3460]/8 bg-[#0f4c81]/3 px-5 py-4 dark:border-[#0f4c81]/10">
                      <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">{fmt(asset.economico)}</p>
                      {pct > 0 && <p className="mt-0.5 text-[10px] font-semibold text-[#0f4c81] dark:text-blue-400">{pct}% do total</p>}
                    </div>
                    <div className="flex items-center justify-end border-l border-[#0c3460]/8 bg-amber-50/20 px-5 py-4">
                      <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">{fmt(asset.financeiro)}</p>
                    </div>
                    <div className="flex items-center justify-end border-l border-[#0c3460]/8 bg-[#0c3460]/3 px-5 py-4 dark:bg-[#0c3460]/8">
                      <p className="text-sm font-semibold tabular-nums text-[#0c3460] dark:text-blue-200">{hasVal ? fmt(total) : "—"}</p>
                    </div>
                    {isAdmin && <div className="flex items-center justify-center gap-0.5 border-l border-zinc-100 dark:border-zinc-700/50"><EditBtn onClick={() => openEdit(asset)} /><DeleteBtn onClick={() => handleDelete(asset.id)} /></div>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-[#0c3460]/10 bg-[#0c3460]/3 px-6 py-3 dark:border-[#0f4c81]/15 dark:bg-[#090f1a]/60">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">ⓘ Econômico = soma dos exercícios registrados · Financeiro = posição atual</p>
              <p className="text-[11px] font-semibold text-[#0f4c81] dark:text-blue-400">{selectedMonth ? monthLabel(selectedMonth) : ""}</p>
            </div>
          </div>
        </>
      )}

      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Copiar patrimonio</h2>
              <button type="button" onClick={() => setCopyModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCopy} className="flex flex-col gap-4 px-6 py-5">
              <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Copie secoes, ativos, valores e ordem de uma competencia para outra. A competencia de destino nao pode possuir patrimonio cadastrado.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Origem</label>
                  <input type="month" required value={copyForm.sourceMonth}
                    onChange={(e) => setCopyForm({ ...copyForm, sourceMonth: e.target.value })}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Destino</label>
                  <input type="month" required value={copyForm.targetMonth}
                    onChange={(e) => setCopyForm({ ...copyForm, targetMonth: e.target.value })}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCopyModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancelar
                </button>
                <button type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Copiar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AssetModal open={modalOpen} editing={editingAsset} form={form} sections={availableSections}
        onClose={() => setModalOpen(false)} onFormChange={setForm} onSave={handleSave} />
    </AppShell>
  );
}
