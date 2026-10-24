import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, KeyRound, Mail, MailCheck, Send } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { SubmitButton, TextField } from "@/components/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { redirectIfSignedIn } from "@/lib/session";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: ForgotPasswordPage,
});

const forgotSchema = z.object({ email: z.email("กรุณากรอกอีเมลให้ถูกต้อง") });

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: forgotSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await auth.requestPasswordReset({
        email: value.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return setFormError(authErrorMessage(error));
      // same answer whether or not the email exists, so accounts can't be probed
      setSentTo(value.email);
    },
  });

  return (
    <AuthLayout
      icon={KeyRound}
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้"
      footer={
        <Link to="/login" className="flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" />
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      {sentTo ? (
        <Alert>
          <MailCheck />
          <AlertTitle>ตรวจสอบอีเมลของคุณ</AlertTitle>
          <AlertDescription>
            หาก {sentTo} มีบัญชีอยู่ในระบบ คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่ภายในไม่กี่นาที
          </AlertDescription>
        </Alert>
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
              <form.Field name="email">
                {(field) => (
                  <TextField field={field} label="อีเมล" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" />
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <SubmitButton pending={isSubmitting} icon={Send} size="lg">
                    ส่งลิงก์ตั้งรหัสผ่านใหม่
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
