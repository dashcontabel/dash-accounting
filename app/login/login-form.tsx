"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CompanyLogo from "@/app/components/company-logo";

type LoginResponse = {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "CLIENT";
    status: "ACTIVE" | "INACTIVE";
  };
  error?: string;
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(data.error ?? "Falha no login.");
        return;
      }

      const nextPath = searchParams.get("next");
      router.push(nextPath || "/");
      router.refresh();
    } catch {
      setError("Falha no login.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card-surface w-full p-7 sm:p-8">
      <div className="mb-5 flex justify-center">
        <CompanyLogo className="w-full max-w-[260px] rounded-xl bg-white/90 p-2" />
      </div>
      <h1 className="text-3xl font-semibold text-zinc-900">Entrar</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use seu email e senha para acessar o painel.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-zinc-700">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 outline-none ring-0 transition placeholder:text-zinc-400 focus:border-[#0f4c81]"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          Senha
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 outline-none ring-0 transition placeholder:text-zinc-400 focus:border-[#0f4c81]"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-[#0f4c81] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0d416d] disabled:cursor-not-allowed disabled:bg-zinc-500"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
