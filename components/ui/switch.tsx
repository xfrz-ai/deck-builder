import { cn } from "@/lib/utils";

// Visual track + thumb for buttons with role="switch".
export function SwitchIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5.5 w-10 shrink-0 rounded-full p-0.5 transition",
        checked
          ? "bg-[#121212]/70 shadow-[0_1px_0.6px_0_rgba(18,18,18,0.30)_inset]"
          : "bg-stroke-01 shadow-[0_0_1px_0.5px_rgba(18,18,18,0.10)_inset]",
      )}
    >
      <span
        className={cn(
          "size-4.5 rounded-full bg-surface-02 shadow-[0_1px_0.5px_0_rgba(255,255,255,0.82)_inset,0_0_2.6px_0_rgba(0,0,0,0.25),0_1px_4px_0_rgba(0,0,0,0.14)] transition-transform",
          checked && "translate-x-[18px]",
        )}
      />
    </span>
  );
}
