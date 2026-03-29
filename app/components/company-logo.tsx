import Image from "next/image";

type CompanyLogoProps = {
  className?: string;
  compact?: boolean;
  onDark?: boolean;
};

export default function CompanyLogo({ className, compact = false, onDark = false }: CompanyLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {/* Circular seal — crops just the round icon from the left of the PNG */}
      <div className={`relative shrink-0 overflow-hidden rounded-full ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
        <Image
          src="/logo-barros-e-sa-icon.png"
          alt="Barros & Sá"
          fill
          priority
          sizes={compact ? "40px" : "56px"}
          className="object-contain"
        />
      </div>

      {/* Name + subtitle in text */}
      <div className="min-w-0">
        <p className={`truncate font-bold leading-tight ${compact ? "text-sm" : "text-base"} ${onDark ? "text-white" : "text-zinc-900 dark:text-white"}`}>
          Barros &amp; Sá
        </p>
        {!compact && (
          <p className={`mt-0.5 text-[11px] leading-tight ${onDark ? "text-blue-200" : "text-zinc-500 dark:text-zinc-400"}`}>
            Assessoria Empresarial e Condominial
          </p>
        )}
      </div>
    </div>
  );
}
