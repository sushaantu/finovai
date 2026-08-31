import { FinovaiLogo } from '@/components/LandingPage'
import { cn } from '@/lib/utils'

export function DashboardBrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 font-['Inter_Tight',sans-serif] text-[17px] font-extrabold leading-none tracking-[-0.02em] text-foreground",
        className
      )}
      aria-hidden="true"
    >
      <span className="flex w-10 shrink-0 items-center [&_svg]:h-auto [&_svg]:w-10">
        <FinovaiLogo />
      </span>
      <span className="hidden truncate md:inline">
        finov<span className="text-[#2B7AE8]">ai</span>
      </span>
    </span>
  )
}
