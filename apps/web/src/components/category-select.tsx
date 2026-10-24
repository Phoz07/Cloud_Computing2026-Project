import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesQueryOptions } from "@/lib/events";
import { hasRole, useSession } from "@/lib/session";

type CategorySelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  errors?: React.ComponentProps<typeof FieldError>["errors"];
  disabled?: boolean;
};

export function CategorySelect({ value, onValueChange, onBlur, invalid, errors, disabled }: CategorySelectProps) {
  const { data: categories, isPending } = useQuery(categoriesQueryOptions);
  const { data: session } = useSession();
  const items = (categories ?? []).map((category) => ({ value: category.id, label: category.name }));
  const none = !isPending && items.length === 0;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="categoryId">
        <Tag className="size-4 text-muted-foreground" />
        หมวดหมู่
      </FieldLabel>
      <Select
        items={items}
        value={value || null}
        onValueChange={(next) => next && onValueChange(next)}
        disabled={disabled || none}
      >
        <SelectTrigger id="categoryId" className="w-full" aria-invalid={invalid} onBlur={onBlur}>
          <SelectValue placeholder={isPending ? "กำลังโหลด..." : "เลือกหมวดหมู่"} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {none && (
        <FieldDescription>
          ยังไม่มีหมวดหมู่ในระบบ{" "}
          {hasRole(session?.user, ["admin"]) ? (
            <Link to="/dashboard/categories">เพิ่มหมวดหมู่</Link>
          ) : (
            "กรุณาติดต่อผู้ดูแลระบบให้เพิ่มหมวดหมู่ก่อน"
          )}
        </FieldDescription>
      )}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}
