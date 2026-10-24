import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, KeyRound, Mail, ShieldCheck, UserPlus, UserRound } from "lucide-react";
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

export const Route = createFileRoute("/register")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => redirectIfSignedIn(context.queryClient, search.redirect),
  component: RegisterPage,
});

// Better Auth's default password policy is 8 to 128 characters
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร").max(100, "ชื่อยาวเกินไป"),
    email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

function RegisterPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = safeRedirect(search.redirect);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    validators: { onSubmit: registerSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await auth.signUp.email({
        name: value.name.trim(),
        email: value.email,
        password: value.password,
      });
      if (error) return setFormError(authErrorMessage(error));
      await refreshSession(queryClient);
      await navigate({ href: target });
    },
  });

  return (
    <AuthLayout
      icon={UserPlus}
      title="สมัครสมาชิก"
      description="สร้างบัญชี Eventide เพื่อจองตั๋วอีเวนต์ที่คุณสนใจ"
      footer={
        <>
          มีบัญชีอยู่แล้ว?
          <Link to="/login" search={{ redirect: search.redirect }} className="font-medium text-primary hover:underline">
            เข้าสู่ระบบ
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
          <form.Field name="name">
            {(field) => <TextField field={field} label="ชื่อที่แสดง" icon={UserRound} autoComplete="name" />}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <TextField field={field} label="อีเมล" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" />
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <TextField
                field={field}
                label="รหัสผ่าน"
                icon={KeyRound}
                type="password"
                autoComplete="new-password"
                description="อย่างน้อย 8 ตัวอักษร"
              />
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <TextField field={field} label="ยืนยันรหัสผ่าน" icon={ShieldCheck} type="password" autoComplete="new-password" />
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <SubmitButton pending={isSubmitting} icon={UserPlus} size="lg">
                สมัครสมาชิก
              </SubmitButton>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
