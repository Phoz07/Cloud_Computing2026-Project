import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** Centered card shell shared by the login, register and password pages. */
export function AuthLayout({
  icon: Icon,
  title,
  description,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="auth-layout" className="flex justify-center py-8 md:py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
        {footer && (
          <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">{footer}</CardFooter>
        )}
      </Card>
    </div>
  );
}
