import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LogOut, Monitor, MonitorSmartphone, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Section } from "./-components/section";
import { sessionsQueryOptions } from "./-components/queries";

export const Route = createFileRoute("/_authed/profile/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const { data: session } = useSession();
  return <SessionsSection currentToken={session?.session.token} />;
}

function describeDevice(userAgent?: string | null) {
  if (!userAgent) return { label: "อุปกรณ์ที่ไม่รู้จัก", mobile: false };
  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : "เบราว์เซอร์";
  const os =
    /iPhone|iPad/.test(userAgent) ? "iOS"
    : /Android/.test(userAgent) ? "Android"
    : /Mac OS X/.test(userAgent) ? "macOS"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux"
    : "ระบบที่ไม่รู้จัก";
  return { label: `${browser} บน ${os}`, mobile: /Mobile|Android|iPhone/.test(userAgent) };
}

function SessionsSection({ currentToken }: { currentToken?: string }) {
  const queryClient = useQueryClient();
  const { data: sessions, isPending } = useQuery(sessionsQueryOptions);

  const revoke = useMutation({
    mutationFn: async (token?: string) => {
      const { error } = token ? await auth.revokeSession({ token }) : await auth.revokeOtherSessions();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.add({ type: "success", title: "ออกจากระบบอุปกรณ์เรียบร้อย" });
      return queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey });
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  const others = sessions?.filter((item) => item.token !== currentToken) ?? [];
  const ordered = [...(sessions ?? [])].sort((a, b) => Number(b.token === currentToken) - Number(a.token === currentToken));

  return (
    <Section
      icon={MonitorSmartphone}
      title="อุปกรณ์ที่เข้าสู่ระบบ"
      description="หากพบอุปกรณ์ที่ไม่รู้จัก ให้ออกจากระบบอุปกรณ์นั้นและเปลี่ยนรหัสผ่าน"
    >
      {isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <ul className="flex flex-col divide-y">
          {ordered.map((item) => {
            const device = describeDevice(item.userAgent);
            const DeviceIcon = device.mobile ? Smartphone : Monitor;
            const current = item.token === currentToken;
            return (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <DeviceIcon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      {device.label}
                      {current && <Badge>อุปกรณ์นี้</Badge>}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.ipAddress ? `${item.ipAddress} · ` : ""}เข้าสู่ระบบเมื่อ {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                </div>
                {!current && (
                  <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(item.token)}>
                    <LogOut data-icon="inline-start" />
                    ออกจากระบบ
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <Button variant="outline" className="self-start" disabled={revoke.isPending} onClick={() => revoke.mutate(undefined)}>
          {revoke.isPending ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}
          ออกจากระบบอุปกรณ์อื่นทั้งหมด
        </Button>
      )}
    </Section>
  );
}
