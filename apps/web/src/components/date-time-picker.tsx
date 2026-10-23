import type { AnyFieldApi } from "@tanstack/react-form";
import { th } from "date-fns/locale/th";
import { CalendarDays, Clock, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLongDate } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");
const caption = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

// every 15 minutes; an off-grid saved time is added to the list so it still shows
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);
const DEFAULT_TIME = "19:00";

type DateTimePickerProps = {
  id: string;
  /** "YYYY-MM-DDTHH:mm" in local time, or "" when nothing is picked yet */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  /** days before this one can't be picked */
  fromDate?: Date;
};

/** A date (calendar popover, Buddhist-era caption like the rest of the Thai UI) and a time (15-minute list). */
export function DateTimePicker({ id, value, onChange, onBlur, invalid, disabled, fromDate }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [datePart = "", timePart = ""] = value.split("T");
  const selected = datePart ? new Date(`${datePart}T00:00`) : undefined;
  const times = useMemo(
    () => (timePart && !QUARTER_HOURS.includes(timePart) ? [...QUARTER_HOURS, timePart].sort() : QUARTER_HOURS),
    [timePart],
  );

  const pickDate = (date: Date | undefined) => {
    if (!date) return;
    onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${timePart || DEFAULT_TIME}`);
    setOpen(false);
  };

  return (
    <div data-slot="date-time-picker" className="flex gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={invalid}
              className="min-w-0 flex-1 justify-start font-normal data-[empty=true]:text-muted-foreground"
              data-empty={!selected}
            />
          }
        >
          <CalendarDays data-icon="inline-start" />
          <span className="truncate">{selected ? formatLongDate(selected) : "เลือกวันที่"}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={th}
            selected={selected}
            defaultMonth={selected ?? fromDate}
            onSelect={pickDate}
            disabled={fromDate ? { before: fromDate } : undefined}
            formatters={{ formatCaption: (month) => caption.format(month) }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Select
        items={times.map((t) => ({ value: t, label: `${t} น.` }))}
        value={timePart || null}
        disabled={disabled}
        onValueChange={(time) => {
          // picking a time before a date assumes today
          if (time) onChange(`${datePart || toDay(new Date())}T${time}`);
        }}
      >
        <SelectTrigger className="w-32" aria-label="เวลา" aria-invalid={invalid} onBlur={onBlur}>
          <Clock />
          <SelectValue placeholder="เวลา" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            {times.map((t) => (
              <SelectItem key={t} value={t}>
                {t} น.
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

const toDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** DateTimePicker in the shadcn Field layout for a TanStack Form field holding "YYYY-MM-DDTHH:mm". */
export function DateTimeField({
  field,
  label,
  icon: Icon,
  description,
  disabled,
  fromDate,
}: {
  field: AnyFieldApi;
  label: string;
  icon: LucideIcon;
  description?: React.ReactNode;
  disabled?: boolean;
  fromDate?: Date;
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </FieldLabel>
      <DateTimePicker
        id={field.name}
        value={field.state.value ?? ""}
        onChange={field.handleChange}
        onBlur={field.handleBlur}
        invalid={isInvalid}
        disabled={disabled}
        fromDate={fromDate}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}
