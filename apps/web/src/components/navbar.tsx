import { Link } from "@tanstack/react-router";
import { LogIn, Telescope, UserPlus } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/session";
import { cn } from "cn";

export default function Navbar() {
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-17 w-full items-center justify-center border-b bg-background p-4">
      <div className="container flex w-full items-center justify-between gap-4">
        <Link to="/" className="text-2xl font-bold">
          <span className="text-primary">Event</span>ide
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: "ghost" }), "font-bold")}>
            <Telescope data-icon="inline-start" />
            สำรวจ
          </Link>
          {isPending ? (
            <Skeleton className="size-10 rounded-full" />
          ) : session ? (
            <UserMenu user={session.user} />
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: "outline" })}>
                <LogIn data-icon="inline-start" />
                เข้าสู่ระบบ
              </Link>
              <Link to="/register" className={buttonVariants({ variant: "default" })}>
                <UserPlus data-icon="inline-start" />
                สมัครสมาชิก
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
