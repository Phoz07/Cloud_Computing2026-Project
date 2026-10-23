import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, KeyRound, Link2, LockKeyhole, MailCheck, Save, ShieldCheck, Unlink } from "lucide-react";
import { z } from "zod";
import { SubmitButton, TextField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { providersQueryOptions } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { Section } from "./-components/section";
import { accountsQueryOptions, sessionsQueryOptions } from "./-components/queries";

export const Route = createFileRoute("/_authed/profile/sign-in")({
  // linkSocial comes back here with ?error=... when Google can't be linked
  validateSearch: z.object({ error: z.string().optional() }),
  component: SignInPage,
});

function SignInPage() {
  const { error } = Route.useSearch();
  const guarded = Route.useRouteContext().session;
  const { data: session } = useSession();
  const email = (session?.user ?? guarded.user).email;
  const { data: accounts } = useQuery(accountsQueryOptions);
  const hasPassword = accounts?.some((account) => account.providerId === "credential");

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{authErrorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <ConnectedAccountsSection email={email} />
      {accounts && hasPassword && <ChangePasswordSection />}
    </div>
  );
}

function ConnectedAccountsSection({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const { data: accounts, isPending } = useQuery(accountsQueryOptions);
  const { data: providers } = useQuery(providersQueryOptions);
  const google = accounts?.find((account) => account.providerId === "google");

  const link = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      const { error } = await auth.linkSocial({
        provider: "google",
        callbackURL: `${origin}/profile/sign-in`,
        errorCallbackURL: `${origin}/profile/sign-in`,
      });
      if (error) throw error;
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  // A Google-only account has no credential row; the reset-password flow creates one.
  const createPassword = useMutation({
    mutationFn: async () => {
      const { error } = await auth.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      toast.add({ type: "success", title: "ส่งลิงก์ตั้งรหัสผ่านแล้ว", description: `ตรวจสอบอีเมล ${email}` }),
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  const hasCredential = accounts?.some((account) => account.providerId === "credential");

  const unlink = useMutation({
    mutationFn: async (accountId: string) => {
      // the Better Auth account row id, not Google's user id
      const { error } = await auth.unlinkAccount({ accountId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.add({ type: "success", title: "ยกเลิกการเชื่อมต่อ Google แล้ว" });
      return queryClient.invalidateQueries({ queryKey: accountsQueryOptions.queryKey });
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  const rows = [
    {
      key: "credential",
      icon: KeyRound,
      label: "อีเมลและรหัสผ่าน",
      connected: hasCredential,
      action: hasCredential ? null : (
        <Button variant="outline" size="sm" disabled={createPassword.isPending} onClick={() => createPassword.mutate()}>
          {createPassword.isPending ? <Spinner data-icon="inline-start" /> : <MailCheck data-icon="inline-start" />}
          สร้างรหัสผ่าน
        </Button>
      ),
    },
    {
      key: "google",
      icon: Link2,
      label: "Google",
      connected: Boolean(google),
      action: google ? (
        // Better Auth refuses to unlink the last sign-in method; hide the button instead of erroring
        (accounts?.length ?? 0) > 1 && (
          <Button variant="outline" size="sm" disabled={unlink.isPending} onClick={() => unlink.mutate(google.id)}>
            {unlink.isPending ? <Spinner data-icon="inline-start" /> : <Unlink data-icon="inline-start" />}
            ยกเลิกการเชื่อมต่อ
          </Button>
        )
      ) : providers?.google ? (
        <Button
          variant="outline"
          size="sm"
          disabled={link.isPending || link.isSuccess}
          onClick={() => link.mutate()}
        >
          {link.isPending || link.isSuccess ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          เชื่อมต่อ Google
        </Button>
      ) : null,
    },
  ];

  return (
    <Section icon={Link2} title="ช่องทางเข้าสู่ระบบ" description="เชื่อมต่อ Google เพื่อเข้าสู่ระบบได้ในคลิกเดียว">
      {isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.map(({ key, icon: Icon, label, connected, action }) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                {label}
                <Badge variant={connected ? "secondary" : "outline"}>{connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}</Badge>
              </span>
              {action}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

function ChangePasswordSection() {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      const { error } = await auth.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (error) return void toast.add({ type: "error", title: authErrorMessage(error) });
      toast.add({ type: "success", title: "เปลี่ยนรหัสผ่านเรียบร้อย", description: "อุปกรณ์อื่นถูกออกจากระบบแล้ว" });
      form.reset();
      await queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey });
    },
  });

  return (
    <Section icon={LockKeyhole} title="เปลี่ยนรหัสผ่าน" description="เมื่อเปลี่ยนรหัสผ่าน อุปกรณ์อื่นทั้งหมดจะถูกออกจากระบบ">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="currentPassword">
            {(field) => (
              <TextField field={field} label="รหัสผ่านปัจจุบัน" icon={KeyRound} type="password" autoComplete="current-password" />
            )}
          </form.Field>
          <form.Field name="newPassword">
            {(field) => (
              <TextField
                field={field}
                label="รหัสผ่านใหม่"
                icon={LockKeyhole}
                type="password"
                autoComplete="new-password"
                description="อย่างน้อย 8 ตัวอักษร"
              />
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <TextField field={field} label="ยืนยันรหัสผ่านใหม่" icon={ShieldCheck} type="password" autoComplete="new-password" />
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <SubmitButton pending={isSubmitting} icon={Save} className="self-start">
                เปลี่ยนรหัสผ่าน
              </SubmitButton>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </Section>
  );
}
