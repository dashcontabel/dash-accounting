import Image from "next/image";

type CompanyLogoProps = {
  className?: string;
  compact?: boolean;
};

export default function CompanyLogo({ className, compact = false }: CompanyLogoProps) {
  return (
    <div className={className}>
      <Image
        src="/logo-barros-sa.png"
        alt="Barros & Sa - Assessoria Empresarial e Condominial"
        width={compact ? 180 : 340}
        height={compact ? 48 : 90}
        priority
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
