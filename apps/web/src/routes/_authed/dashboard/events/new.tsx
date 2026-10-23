import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, CalendarPlus, MapPin, Type } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import { CategorySelect } from "@/components/category-select";
import { DateTimeField } from "@/components/date-time-picker";
import { SubmitButton, TextField } from "@/components/form-field";
import { LeaveGuard } from "@/components/leave-guard";
import { PageHeader } from "@/components/page-header";
import { SlugField } from "@/components/slug-field";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { eventDetailKey, eventsKey, fromLocalInput, problemCode, problemFields, shiftEnd, SLUG_REGEX } from "@/lib/events";
import { formatDuration } from "@/lib/format";
import { focusFirstInvalid } from "./-components/event-form";

export const Route = createFileRoute("/_authed/dashboard/events/new")({ component: NewEventPage });

const ROOT = "[data-slot=new-event]";

const schema = z
  .object({
    title: z.string().trim().min(1, "กรุณากรอกชื่ออีเวนต์").max(150, "ชื่อยาวได้ไม่เกิน 150 ตัวอักษร"),
    categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
    startsAt: z.string().min(1, "กรุณาเลือกวันเวลาเริ่ม"),
    endsAt: z.string().min(1, "กรุณาเลือกวันเวลาสิ้นสุด"),
    venue: z.string().trim().min(1, "กรุณากรอกสถานที่").max(200, "ยาวได้ไม่เกิน 200 ตัวอักษร"),
    slug: z
      .string()
      .refine((v) => v === "" || (v.length >= 3 && v.length <= 80 && SLUG_REGEX.test(v)), "ลิงก์ต้องยาว 3–80 ตัวอักษร ใช้ a-z, 0-9 และ -"),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    path: ["endsAt"],
    message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น",
  });

const defaultValues = { title: "", categoryId: "", startsAt: "", endsAt: "", venue: "", slug: "" };

function NewEventPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previousStart = useRef("");
  const created = useRef(false);

  const form = useForm({
    defaultValues,
    validators: { onSubmit: schema },
    listeners: {
      onChange: ({ fieldApi }) => {
        const { errorMap } = fieldApi.state.meta;
        if (errorMap.onServer) fieldApi.setErrorMap({ ...errorMap, onServer: undefined });
      },
    },
    onSubmitInvalid: () => focusFirstInvalid(ROOT),
    onSubmit: async ({ value }) => {
      const { data, error } = await eventClient.api.events.post({
        title: value.title.trim(),
        categoryId: value.categoryId,
        venue: value.venue.trim(),
        slug: value.slug || undefined,
        startsAt: fromLocalInput(value.startsAt),
        endsAt: fromLocalInput(value.endsAt),
      });
      if (error) {
        const code = problemCode(error);
        const field = code ? (problemFields[code] as keyof typeof defaultValues | undefined) : undefined;
        if (field) {
          form.setFieldMeta(field, (meta) => ({
            ...meta,
            isTouched: true,
            errorMap: { ...meta.errorMap, onServer: { message: problemMessage(error) } },
          }));
          focusFirstInvalid(ROOT);
        }
        return void toast.add({ type: "error", title: problemMessage(error) });
      }
      created.current = true;
      queryClient.setQueryData(eventDetailKey(data.id), data);
      void queryClient.invalidateQueries({ queryKey: [...eventsKey, "mine"] });
      toast.add({ type: "success", title: "สร้างฉบับร่างแล้ว", description: "เพิ่มภาพปก รายละเอียด แล้วเผยแพร่ได้เลย" });
      await navigate({ to: "/dashboard/events/$eventId", params: { eventId: data.id } });
    },
  });

  const dirty = useStore(form.store, (state) => state.isDirty);

  // dates before today can't be picked
  const [today] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  return (
    <div data-slot="new-event" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link to="/dashboard/events" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowLeft data-icon="inline-start" />
        อีเวนต์ทั้งหมด
      </Link>
      <PageHeader
        icon={CalendarPlus}
        title="สร้างอีเวนต์ใหม่"
        description="เริ่มจากข้อมูลหลัก อีเวนต์จะถูกบันทึกเป็นฉบับร่าง แล้วคุณเพิ่มภาพปก รายละเอียด และเผยแพร่ได้ในขั้นถัดไป"
      />
      <Card>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>อีเวนต์ของคุณ</FieldLegend>
                <FieldGroup>
                  <form.Field name="title">
                    {(field) => (
                      <TextField
                        field={field}
                        label="ชื่ออีเวนต์"
                        icon={Type}
                        placeholder="เช่น Bangkok Music Festival 2026"
                        maxLength={150}
                        autoFocus
                      />
                    )}
                  </form.Field>
                  <form.Field name="categoryId">
                    {(field) => (
                      <CategorySelect
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        onBlur={field.handleBlur}
                        invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        errors={field.state.meta.errors}
                      />
                    )}
                  </form.Field>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>วันและเวลา</FieldLegend>
                <FieldGroup className="grid gap-6 sm:grid-cols-2">
                  <form.Field
                    name="startsAt"
                    listeners={{
                      onChange: ({ value }) => {
                        const end = form.getFieldValue("endsAt");
                        const shifted = shiftEnd(previousStart.current, value, end);
                        previousStart.current = value;
                        if (shifted !== end) form.setFieldValue("endsAt", shifted);
                      },
                    }}
                  >
                    {(field) => <DateTimeField field={field} label="เริ่ม" icon={CalendarClock} fromDate={today} />}
                  </form.Field>
                  <form.Subscribe selector={(state) => state.values.startsAt}>
                    {(startsAt) => (
                      <form.Field name="endsAt">
                        {(field) => {
                          const length = new Date(field.state.value).getTime() - new Date(startsAt).getTime();
                          return (
                            <DateTimeField
                              field={field}
                              label="สิ้นสุด"
                              icon={CalendarClock}
                              fromDate={today}
                              description={length > 0 ? `ระยะเวลา ${formatDuration(length)}` : undefined}
                            />
                          );
                        }}
                      </form.Field>
                    )}
                  </form.Subscribe>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>สถานที่และลิงก์</FieldLegend>
                <FieldGroup>
                  <form.Field name="venue">
                    {(field) => (
                      <TextField
                        field={field}
                        label="ชื่อสถานที่"
                        icon={MapPin}
                        placeholder="เช่น ศูนย์การประชุมแห่งชาติสิริกิติ์"
                        maxLength={200}
                      />
                    )}
                  </form.Field>
                  <form.Field name="slug">{(field) => <SlugField field={field} optional />}</form.Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex flex-wrap justify-end gap-2">
            <Link to="/dashboard/events" className={buttonVariants({ variant: "ghost" })}>
              ยกเลิก
            </Link>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton pending={isSubmitting} icon={CalendarPlus}>
                  สร้างฉบับร่างและไปต่อ
                </SubmitButton>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
      <LeaveGuard
        when={dirty}
        allowLeaveRef={created}
        title="ยกเลิกการสร้างอีเวนต์?"
        description="ข้อมูลที่กรอกไว้จะหายไป"
      />
    </div>
  );
}
