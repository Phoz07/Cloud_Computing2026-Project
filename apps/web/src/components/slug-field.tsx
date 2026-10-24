import type { AnyFieldApi } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX, Link as LinkIcon } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeSlugInput, SLUG_REGEX, slugAvailableQueryOptions } from "@/lib/events";

type SlugFieldProps = {
  field: AnyFieldApi;
  /** the event being edited: its own slug counts as available */
  excludeId?: string;
  /** the saved slug, which needs no check */
  current?: string;
  optional?: boolean;
  disabled?: boolean;
};

/** `/events/<slug>` input that checks with the server, as you type, whether the link is free. */
export function SlugField({ field, excludeId, current, optional, disabled }: SlugFieldProps) {
  const value: string = field.state.value ?? "";
  const debounced = useDebouncedValue(value, 400);
  const wellFormed = value.length >= 3 && value.length <= 80 && SLUG_REGEX.test(value);
  const checkable = wellFormed && debounced === value && value !== current;
  const { data: available, isFetching } = useQuery({ ...slugAvailableQueryOptions(debounced, excludeId), enabled: checkable });
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  let status: React.ReactNode = null;
  let hint: React.ReactNode = optional && !value ? "เว้นว่างไว้ ระบบจะสร้างลิงก์ให้อัตโนมัติ" : "ใช้ a-z, 0-9 และ - เช่น music-fest-2026";
  if (value && !wellFormed) {
    hint = "ยาว 3–80 ตัวอักษร ใช้ a-z, 0-9 และ - (ไม่ขึ้นต้นหรือลงท้ายด้วย -)";
  } else if (value && value === current) {
    hint = "ลิงก์ปัจจุบันของอีเวนต์นี้";
  } else if (wellFormed && (isFetching || debounced !== value)) {
    status = <Spinner />;
    hint = "กำลังตรวจสอบ...";
  } else if (checkable && available === true) {
    status = <CircleCheck className="text-primary" />;
    hint = "ใช้ลิงก์นี้ได้";
  } else if (checkable && available === false) {
    status = <CircleX className="text-destructive" />;
    hint = "ลิงก์นี้ถูกใช้แล้วหรือสงวนไว้ กรุณาเลือกลิงก์อื่น";
  }
  const taken = checkable && available === false;

  return (
    <Field data-invalid={isInvalid || taken}>
      <FieldLabel htmlFor={field.name}>
        <LinkIcon className="size-4 text-muted-foreground" />
        ลิงก์ของอีเวนต์{optional && " (ไม่บังคับ)"}
      </FieldLabel>
      <InputGroup data-disabled={disabled}>
        <InputGroupAddon>
          <InputGroupText>/events/</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={field.name}
          name={field.name}
          value={value}
          placeholder="my-event"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={isInvalid || taken}
          onBlur={() => {
            // a trailing hyphen is fine while typing, not once you leave the field
            field.handleChange(value.replace(/^-+|-+$/g, ""));
            field.handleBlur();
          }}
          onChange={(e) => field.handleChange(normalizeSlugInput(e.target.value))}
        />
        {status && <InputGroupAddon align="inline-end">{status}</InputGroupAddon>}
      </InputGroup>
      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
