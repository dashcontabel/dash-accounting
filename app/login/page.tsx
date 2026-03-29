import { Suspense } from "react";

import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6">
      <div className="grid w-full items-stretch gap-6 lg:grid-cols-2">
        <section className="hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-[#0f4c81] via-[#1d5f9a] to-[#2b6fa7] p-8 text-white shadow-2xl lg:flex lg:flex-col lg:justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-100">
            Plataforma Corporativa
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Gestao contabil com foco em governanca e escalabilidade
          </h1>
          <p className="mt-4 max-w-md text-sm text-blue-100">
            Controle empresas, usuarios e contexto operacional de forma segura em um painel unificado.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/30 bg-white/10 p-3">
              <p className="text-blue-100">Visual</p>
              <p className="mt-1 font-semibold">Dashboard intuitivo</p>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/10 p-3">
              <p className="text-blue-100">Analise</p>
              <p className="mt-1 font-semibold">Graficos e indicadores</p>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/10 p-3">
              <p className="text-blue-100">Gestao</p>
              <p className="mt-1 font-semibold">Tabelas operacionais</p>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/10 p-3">
              <p className="text-blue-100">Produtividade</p>
              <p className="mt-1 font-semibold">Filtros inteligentes</p>
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center">
          <Suspense fallback={<div className="text-sm text-zinc-600">Carregando...</div>}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
