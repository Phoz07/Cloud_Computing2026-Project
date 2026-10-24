import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, KeyRound, LogIn, Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { SubmitButton, TextField } from "@/components/form-field";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { redirectIfSignedIn, refreshSession, safeRedirect } from "@/lib/session";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
    // set by Better Auth when a Google sign-in fails
    error: z.string().optional(),
  }),
  beforeLoad: ({ context, search }) => redirectIfSignedIn(context.queryClient, search.redirect),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = safeRedirect(search.redirect);
  const [formError, setFormError] = useState<string | null>(
    search.error ? authErrorMessage(search.error) : null,
  );

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await auth.signIn.email(value);
      if (error) return setFormError(authErrorMessage(error));
      await refreshSession(queryClient);
      await navigate({ href: target });
    },
  });

  return (
    <AuthLayout
      icon={LogIn}
      title="เข้าสู่ระบบ"
      description="เข้าสู่ระบบเพื่อจองตั๋วและจัดการอีเวนต์ของคุณ"
      footer={
        <>
          ยังไม่มีบัญชี?
          <Link to="/register" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <GoogleSignIn redirectTo={target} />
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
          <form.Field name="password">
            {(field) => (
              <TextField field={field} label="รหัสผ่าน" icon={KeyRound} type="password" autoComplete="current-password" />
            )}
          </form.Field>
          <Link to="/forgot-password" className="-mt-4 self-end text-sm text-muted-foreground hover:text-primary hover:underline">
            ลืมรหัสผ่าน?
          </Link>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <SubmitButton pending={isSubmitting} icon={LogIn} size="lg">
                เข้าสู่ระบบ
              </SubmitButton>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
