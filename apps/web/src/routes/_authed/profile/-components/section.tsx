import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A bordered block of the profile page: heading, optional hint, then content. */
export function Section({
  icon: Icon,
  title,
  description,
  badge,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  tone?: "destructive";
  children?: ReactNode;
}) {
  return (
    <section data-slot="profile-section" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6", tone === "destructive" && "border-destructive/40")}>
      <div className="flex flex-col gap-1">
        <h2 className={cn("flex items-center gap-2 font-medium", tone === "destructive" && "text-destructive")}>
          <Icon className={cn("size-4", tone === "destructive" ? "" : "text-muted-foreground")} />
          {title}
          {badge}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
