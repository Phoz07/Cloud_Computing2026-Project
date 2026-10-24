import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Banknote, ClipboardList, Hash, Info, Lock, ShoppingCart, Ticket, TicketPlus, Trash2, Type, Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { TextField, SubmitButton } from "@/components/form-field";
import { LeaveGuard } from "@/components/leave-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { enrollmentsKey, type Availability } from "@/lib/enrollments";
import { eventDetailKey, problemCode, type EventDetail } from "@/lib/events";
import { formatPrice } from "@/lib/format";
import { hasRole, useSession } from "@/lib/session";
import { kindInfo, MIN_PAID_PRICE, ticketTypeProblemFields, type TicketKind, type TicketType } from "@/lib/ticket-types";
import { focusFirstInvalid } from "../../../-components/event-form";
import { SaveBar } from "../../../-components/save-bar";
import { DeleteTicketTypeDialog } from "./delete-ticket-type-dialog";
import { QuestionBuilder } from "./question-builder";
import {
  diffPayload, toFormValues, toPayload, useTicketTypeForm, type TicketTypeFormValues,
} from "./ticket-type-form";

const ROOT = "[data-slot=ticket-type-editor]";

type TicketTypeEditorProps = {
  event: EventDetail;
  /** omitted when creating one */
  ticketType?: TicketType;
  availability?: Availability;
};

/** Creates a ticket type, or edits one (saving through the floating save bar, like the event editor). */
export function TicketTypeEditor({ event, ticketType, availability }: TicketTypeEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  // a suspended event is frozen for its organizer until an admin lifts it
  const locked = event.status === "suspended" && !hasRole(session?.user, ["admin"]);
  const [baseline, setBaseline] = useState(() => toFormValues(ticketType));
  const allowLeave = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const held = availability ? availability.confirmed + availability.reserved + availability.pending : 0;
  // the service refuses to change the kind once anyone holds tickets of it
  const kindLocked = !!ticketType && held > 0;
  const listParams = { eventId: event.id };

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ticket-types"] }),
      queryClient.invalidateQueries({ queryKey: enrollmentsKey }),
    ]);

  const form = useTicketTypeForm({
    defaultValues: baseline,
    onSubmitInvalid: () => {
      toast.add({ type: "error", title: "กรุณาแก้ไขช่องที่ยังไม่ถูกต้อง" });
      focusFirstInvalid(ROOT);
    },
    onSubmit: async ({ value }) => {
      const tickets = eventClient.api.events({ id: event.id })["ticket-types"];
      if (!ticketType) {
        const { data, error } = await tickets.post(toPayload(value));
        if (error) return showProblem(error);
        toast.add({ type: "success", title: `สร้าง “${data.name}” แล้ว` });
        allowLeave.current = true;
        await refresh();
        await navigate({ to: "/dashboard/events/$eventId/tickets", params: listParams });
        return;
      }
      const patch = diffPayload(value, baseline);
      if (Object.keys(patch).length === 0) return;
      const { data, error } = await tickets({ ticketTypeId: ticketType.id }).patch(patch);
      if (error) return showProblem(error);
      const next = toFormValues(data);
      setBaseline(next);
      form.reset(next);
      toast.add({ type: "success", title: "บันทึกแล้ว" });
      void refresh();
    },
  });

  function showProblem(error: unknown) {
    const code = problemCode(error);
    const message = problemMessage(error);
    const field = code ? (ticketTypeProblemFields[code] as keyof TicketTypeFormValues | undefined) : undefined;
    if (field) {
      form.setFieldMeta(field, (meta) => ({ ...meta, isTouched: true, errorMap: { ...meta.errorMap, onServer: { message } } }));
      focusFirstInvalid(ROOT);
    }
    // e.g. an admin suspended the event meanwhile: reload so the page shows why
    if (code === "EVENT_SUSPENDED") void queryClient.invalidateQueries({ queryKey: eventDetailKey(event.id) });
    if (code === "KIND_LOCKED" || code === "QUOTA_BELOW_TAKEN") void queryClient.invalidateQueries({ queryKey: enrollmentsKey });
    toast.add({ type: "error", title: message });
  }

  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const changes = Object.keys(diffPayload(values, baseline)).length;

  return (
    <div data-slot="ticket-type-editor" className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          to="/dashboard/events/$eventId/tickets"
          params={listParams}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}
        >
          <ArrowLeft data-icon="inline-start" />
          ประเภทตั๋วทั้งหมด
        </Link>
        <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold">
          {ticketType ? <Ticket className="size-5 shrink-0 text-primary" /> : <TicketPlus className="size-5 shrink-0 text-primary" />}
          <span className="truncate">{ticketType ? ticketType.name : "เพิ่มประเภทตั๋ว"}</span>
        </h2>
      </header>

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="size-5" />
                  รายละเอียดตั๋ว
                </CardTitle>
                <CardDescription>แสดงบนหน้าอีเวนต์ให้ผู้สนใจเลือก</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <form.Field name="name">
                    {(field) => (
                      <TextField field={field} label="ชื่อตั๋ว" icon={Type} placeholder="เช่น บัตรทั่วไป, Early Bird" maxLength={100} disabled={locked} />
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <TextField
                        field={field}
                        label="รายละเอียด (ไม่บังคับ)"
                        icon={ClipboardList}
                        multiline
                        placeholder="เช่น สิทธิ์ที่ได้รับ หรือเงื่อนไขของตั๋ว"
                        disabled={locked}
                      />
                    )}
                  </form.Field>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <form.Field name="price">
                      {(field) => (
                        <TextField
                          field={field}
                          label="ราคาต่อใบ"
                          icon={Banknote}
                          type="number"
                          inputMode="numeric"
                          suffix="บาท"
                          description={`ใส่ 0 สำหรับตั๋วฟรี · ตั๋วที่ขายราคาอย่างน้อย ฿${MIN_PAID_PRICE}`}
                          disabled={locked}
                        />
                      )}
                    </form.Field>
                    <form.Field name="maxPerUser">
                      {(field) => (
                        <TextField
                          field={field}
                          label="ซื้อได้สูงสุดต่อบัญชี"
                          icon={ShoppingCart}
                          type="number"
                          inputMode="numeric"
                          suffix="ใบ"
                          description="รวมทุกครั้งที่ลงทะเบียน 1–10 ใบ"
                          disabled={locked}
                        />
                      )}
                    </form.Field>
                    {values.kind === "first_come" && (
                      <form.Field name="quota">
                        {(field) => (
                          <TextField
                            field={field}
                            label="จำนวนตั๋วทั้งหมด"
                            icon={Hash}
                            type="number"
                            inputMode="numeric"
                            suffix="ใบ"
                            description={
                              availability?.remaining != null && ticketType
                                ? `จองไปแล้ว ${held.toLocaleString()} ใบ ลดได้ไม่ต่ำกว่านี้`
                                : "ปิดรับเมื่อตั๋วหมด"
                            }
                            disabled={locked}
                          />
                        )}
                      </form.Field>
                    )}
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-5" />
                  แบบฟอร์มลงทะเบียน
                </CardTitle>
                <CardDescription>
                  ผู้ซื้อกรอกให้ผู้เข้าร่วมทีละคน ตั๋ว 1 ใบต่อผู้เข้าร่วม 1 คน ลากที่ไอคอนด้านซ้ายเพื่อเรียงลำดับคำถาม
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuestionBuilder form={form} disabled={locked} />
              </CardContent>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  รูปแบบการรับตั๋ว
                </CardTitle>
                <CardDescription>ใครได้ตั๋ว และได้เมื่อไร</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <form.Field name="kind">
                    {(field) => (
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as TicketKind)}
                        disabled={locked || kindLocked}
                        aria-label="รูปแบบการรับตั๋ว"
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      >
                        {(Object.keys(kindInfo) as TicketKind[]).map((kind) => {
                          const { icon: Icon, label, description } = kindInfo[kind];
                          return (
                            <FieldLabel key={kind} htmlFor={`kind-${kind}`}>
                              <Field orientation="horizontal">
                                <FieldContent>
                                  <FieldTitle>
                                    <Icon className="size-4 text-muted-foreground" />
                                    {label}
                                  </FieldTitle>
                                  <FieldDescription>{description}</FieldDescription>
                                </FieldContent>
                                <RadioGroupItem value={kind} id={`kind-${kind}`} />
                              </Field>
                            </FieldLabel>
                          );
                        })}
                      </RadioGroup>
                    )}
                  </form.Field>
                  {kindLocked && (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="mt-0.5 size-4 shrink-0" />
                      มีผู้ลงทะเบียนแล้ว จึงเปลี่ยนรูปแบบไม่ได้
                    </p>
                  )}
                  {values.kind === "invite" && event.status !== "invite" && (
                    <Alert>
                      <Info />
                      <AlertTitle>เพิ่มรายชื่อในแท็บผู้ได้รับเชิญ</AlertTitle>
                      <AlertDescription>
                        ตั๋วนี้ลงทะเบียนได้เฉพาะอีเมลในรายชื่อผู้ได้รับเชิญของอีเวนต์ คนอื่นจะเห็นตั๋วแต่กดลงทะเบียนไม่ได้
                      </AlertDescription>
                    </Alert>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>

            {ticketType && availability && (
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="size-5" />
                    ยอดลงทะเบียน
                  </CardTitle>
                  <CardDescription>
                    {formatPrice(ticketType.price)}
                    {ticketType.price > 0 && " ต่อใบ"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="ยืนยันแล้ว" value={availability.confirmed} />
                    {ticketType.price > 0 && <Stat label="รอชำระเงิน" value={availability.reserved} />}
                    {ticketType.kind === "approval" && <Stat label="รออนุมัติ" value={availability.pending} />}
                    {availability.remaining !== null && <Stat label="เหลือ" value={availability.remaining} />}
                  </dl>
                </CardContent>
              </Card>
            )}

            {ticketType && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="size-5" />
                    ลบประเภทตั๋ว
                  </CardTitle>
                  <CardDescription>ลบได้เฉพาะประเภทที่ยังไม่มีผู้ลงทะเบียน</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type="button" variant="destructive" disabled={locked || held > 0} onClick={() => setDeleteOpen(true)}>
                    <Trash2 data-icon="inline-start" />
                    ลบประเภทตั๋วนี้
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>

        {ticketType ? (
          <SaveBar
            changes={changes}
            saving={isSubmitting}
            disabled={locked}
            onSave={() => void form.handleSubmit()}
            onDiscard={() => form.reset(baseline)}
            allowLeaveRef={allowLeave}
          />
        ) : (
          <>
            <Card size="sm">
              <CardFooter className="flex flex-wrap justify-end gap-2">
                <Link to="/dashboard/events/$eventId/tickets" params={listParams} className={buttonVariants({ variant: "ghost" })}>
                  <ArrowLeft data-icon="inline-start" />
                  ยกเลิก
                </Link>
                <SubmitButton pending={isSubmitting} icon={TicketPlus} disabled={locked}>
                  สร้างประเภทตั๋ว
                </SubmitButton>
              </CardFooter>
            </Card>
            <LeaveGuard when={changes > 0} allowLeaveRef={allowLeave} />
          </>
        )}
      </form>

      {ticketType && (
        <DeleteTicketTypeDialog
          eventId={event.id}
          ticketType={ticketType}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            allowLeave.current = true;
            return navigate({ to: "/dashboard/events/$eventId/tickets", params: listParams });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
