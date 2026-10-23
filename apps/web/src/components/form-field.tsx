import type { AnyFieldApi } from "@tanstack/react-form";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type TextFieldProps = {
  field: AnyFieldApi;
  label: string;
  icon: LucideIcon;
  description?: string;
  multiline?: boolean;
} & Pick<React.ComponentProps<"input">, "type" | "placeholder" | "autoComplete" | "autoFocus">;

/** One TanStack Form field in the shadcn Field layout; errors show once the field is touched. */
export function TextField({ field, label, icon: Icon, description, multiline, ...inputProps }: TextFieldProps) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const controlProps = {
    id: field.name,
    name: field.name,
    value: field.state.value ?? "",
    onBlur: field.handleBlur,
    "aria-invalid": isInvalid,
  };

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </FieldLabel>
      {multiline ? (
        <Textarea
          {...controlProps}
          placeholder={inputProps.placeholder}
          autoFocus={inputProps.autoFocus}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      ) : (
        <Input {...controlProps} {...inputProps} onChange={(e) => field.handleChange(e.target.value)} />
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function SubmitButton({
  pending,
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; icon: LucideIcon }) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />}
      {children}
    </Button>
  );
}
