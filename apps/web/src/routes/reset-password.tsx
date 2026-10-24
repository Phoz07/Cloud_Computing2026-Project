import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, KeyRound, LockKeyhole, RotateCcwKey, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { SubmitButton, TextField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { redirectIfSignedIn } from "@/lib/session";

export const Route = createFileRoute("/reset-password")({
  // Better Auth redirects here with ?token=... (or ?error=INVALID_TOKEN) from the emailed link
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: ResetPasswordPage,
});

const resetSchema = z
  .object({
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: { onSubmit: resetSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const result = await auth.resetPassword({ newPassword: value.password, token });
      if (result.error) return setFormError(authErrorMessage(result.error));
      toast.add({ type: "success", title: "ตั้งรหัสผ่านใหม่เรียบร้อย", description: "เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย" });
      await navigate({ to: "/login" });
    },
  });

  return (
    <AuthLayout icon={RotateCcwKey} title="ตั้งรหัสผ่านใหม่" description="ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ">
      {!token || error ? (
        <>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{authErrorMessage(error ?? "INVALID_TOKEN")}</AlertDescription>
          </Alert>
          <Link to="/forgot-password" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <KeyRound data-icon="inline-start" />
            ขอลิงก์ใหม่
          </Link>
        </>
      ) : (
        <>
          {formError && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="password">
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
                  <SubmitButton pending={isSubmitting} icon={RotateCcwKey} size="lg">
                    ตั้งรหัสผ่านใหม่
                  </SubmitButton>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
