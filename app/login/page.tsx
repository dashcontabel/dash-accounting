import { Suspense } from "react";
import Image from "next/image";

import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full items-stretch bg-linear-to-br from-[#071e3d] via-[#0f4c81] to-[#1a6eb5] dark:from-[#04111f] dark:via-[#0a3560] dark:to-[#0f4c81]">

      {/* Left panel — desktop only */}
      <section className="relative hidden flex-col justify-between p-12 text-white lg:flex lg:w-[52%] xl:p-16">

        {/* Logo area */}
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-white/20">
            <Image src="/logo-barros-e-sa-icon.png" alt="Barros & Sá" fill className="object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-white">Barros &amp; Sá</p>
            <p className="mt-0.5 text-[11px] text-blue-200/70">Assessoria Empresarial e Condominial</p>
          </div>
        </div>

        {/* Center text */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/80">
            Plataforma Corporativa
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Gestão contábil com foco em governança e escalabilidade
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-blue-100/70">
            Controle empresas, usuários e contexto operacional de forma segura em um painel unificado.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {["Dashboard intuitivo", "Gráficos e indicadores", "Tabelas operacionais", "Filtros inteligentes", "Multi-empresa"].map((f) => (
              <span key={f} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom watermark */}
        <p className="text-xs text-blue-200/40">
          &copy; {new Date().getFullYear()} Dash Contábil · Todos os direitos reservados
        </p>
      </section>

      {/* Right panel — form */}
      <section className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:bg-white/4 lg:backdrop-blur-sm">
        <Suspense fallback={<div className="text-sm text-blue-200">Carregando...</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
