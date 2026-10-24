import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarClock, ClipboardList, CreditCard, ListChecks, Mail, MapPin, Minus, Plus, RotateCcw, Send, Ticket,
  TicketCheck, TicketX, Timer, TimerOff, UserRound,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { SubmitButton, TextField } from "@/components/form-field";
import { LeaveGuard } from "@/components/leave-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { paymentClient, registrationClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { availabilityQueryOptions, enrollmentsKey, splitName, type Availability } from "@/lib/enrollments";
import { eventQueryOptions, problemCode, type EventDetail } from "@/lib/events";
import { formatDateRange, formatPrice } from "@/lib/format";
import { isEmail } from "@/lib/invitations";
import { useLiveSeats } from "@/lib/live-seats";
import {
  formatTimeLeft, resizeSeatHold, seatHoldKey, seatHoldQueryOptions, startSeatHold, useTimeLeft, type SeatHold,
} from "@/lib/seat-holds";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  kindInfo, LONG_TEXT_MAX, SHORT_TEXT_MAX, ticketTypesQueryOptions, type Question, type TicketType,
} from "@/lib/ticket-types";
import { focusFirstInvalid } from "../../../dashboard/events/-components/event-form";

export const Route = createFileRoute("/_authed/events/$slug/enroll/$ticketTypeId")({ component: EnrollPage });

const ROOT = "[data-slot=enroll-form]";

const unavailable: Record<Exclude<Availability["state"], "open">, string> = {
  sold_out: "ตั๋วประเภทนี้หมดแล้ว",
  limit_reached: "คุณมีตั๋วประเภทนี้ครบจำนวนที่ซื้อได้ต่อบัญชีแล้ว",
  invite_only: "ตั๋วประเภทนี้สำหรับผู้ได้รับเชิญเท่านั้น",
  invitation_used: "คำเชิญของคุณถูกใช้ลงทะเบียนแล้ว",
  closed: "อีเวนต์นี้ยังไม่เปิดหรือปิดรับลงทะเบียนแล้ว",
};

function EnrollPage() {
  const { slug, ticketTypeId } = Route.useParams();
  const { data: event, isPending: eventPending, isError } = useQuery(eventQueryOptions(slug));
  const { data: types, isPending: typesPending } = useQuery(ticketTypesQueryOptions(slug));
  const { data: availability, isPending: availabilityPending } = useQuery({
    ...availabilityQueryOptions(event?.id ?? ""),
    enabled: !!event,
  });
  // the quantity picker's maximum follows the seats left
  useLiveSeats(event?.id);
  const ticketType = types?.find((type) => type.id === ticketTypeId);
  const state = availability?.find((a) => a.ticketTypeId === ticketTypeId);
  // first_come is the kind with a quota, so its seats are held while the form is filled in;
  // the service answers a running hold (a reload, another device) as it is
  const holdsSeats = ticketType?.kind === "first_come";
  const hold = useQuery({ ...seatHoldQueryOptions(ticketTypeId), enabled: holdsSeats && state?.state === "open" });

  const back = (
    <Link to="/events/$slug" params={{ slug }} className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft data-icon="inline-start" />
      กลับไปหน้าอีเวนต์
    </Link>
  );

  const holdPending = holdsSeats && state?.state === "open" && hold.isPending;
  if (eventPending || typesPending || (event && availabilityPending) || holdPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4" aria-busy="true" aria-label="กำลังโหลด">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (isError || !event || !ticketType || !state) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TicketX />
          </EmptyMedia>
          <EmptyTitle>ไม่พบตั๋วนี้</EmptyTitle>
          <EmptyDescription>ลิงก์อาจไม่ถูกต้อง หรือตั๋วถูกลบไปแล้ว</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{back}</EmptyContent>
      </Empty>
    );
  }
  // the hold may be what took the last seats, as the live seats then say
  const blocked = state.state !== "open" && !(state.state === "sold_out" && hold.data);
  if (blocked || (holdsSeats && hold.isError)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {state.state === "limit_reached" ? <TicketCheck /> : <TicketX />}
          </EmptyMedia>
          <EmptyTitle>ลงทะเบียน {ticketType.name} ไม่ได้</EmptyTitle>
          <EmptyDescription>
            {state.state !== "open" ? unavailable[state.state] : problemMessage(hold.error)}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          {back}
          {state.mine > 0 && (
            <Link to="/tickets" className={buttonVariants()}>
              <Ticket data-icon="inline-start" />
              ตั๋วของฉัน
            </Link>
          )}
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <EnrollForm
      key={ticketType.id}
      event={event}
      ticketType={ticketType}
      availability={state}
      hold={holdsSeats ? (hold.data ?? null) : null}
    />
  );
}

type AttendeeValues = { firstName: string; lastName: string; email: string; answers: string[] };

const emptyAttendee = (questions: Question[]): AttendeeValues => ({
  firstName: "",
  lastName: "",
  email: "",
  answers: questions.map(() => ""),
});

/** Checks every attendee against the ticket type's own questions, like apps/registration does. */
function enrollSchema(questions: Question[]) {
  const attendee = z.object({
    firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ยาวได้ไม่เกิน 100 ตัวอักษร"),
    lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100, "ยาวได้ไม่เกิน 100 ตัวอักษร"),
    email: z.string().trim().refine(isEmail, "รูปแบบอีเมลไม่ถูกต้อง"),
    answers: z.array(z.string()).superRefine((answers, ctx) => {
      questions.forEach((question, index) => {
        const value = answers[index]?.trim() ?? "";
        if (!value) {
          if (question.required) {
            ctx.addIssue({ code: "custom", path: [index], message: question.type === "choice" ? "กรุณาเลือกคำตอบ" : "กรุณาตอบคำถามนี้" });
          }
          return;
        }
        const max = question.type === "short_text" ? SHORT_TEXT_MAX : LONG_TEXT_MAX;
        if (value.length > max) {
          ctx.addIssue({ code: "custom", path: [index], message: `ยาวได้ไม่เกิน ${max.toLocaleString()} ตัวอักษร` });
        }
      });
    }),
  });
  return z.object({ attendees: z.array(attendee).min(1) });
}

type EnrollValues = { attendees: AttendeeValues[] };

/** The enroll form; a hook of its own so the attendee cards can take it typed. */
function useEnrollForm(options: {
  defaultValues: EnrollValues;
  schema: ReturnType<typeof enrollSchema>;
  onSubmit: (props: { value: EnrollValues }) => Promise<void>;
  onSubmitInvalid: () => void;
}) {
  return useForm({
    defaultValues: options.defaultValues,
    validators: { onSubmit: options.schema },
    onSubmitInvalid: options.onSubmitInvalid,
    onSubmit: options.onSubmit,
  });
}

type EnrollFormApi = ReturnType<typeof useEnrollForm>;

function EnrollForm({
  event,
  ticketType,
  availability,
  hold,
}: {
  event: EventDetail;
  ticketType: TicketType;
  availability: Availability;
  // the seats held while the form is filled in (first_come), from seatHoldQueryOptions
  hold: SeatHold | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const questions = ticketType.questions;
  const schema = useMemo(() => enrollSchema(questions), [questions]);
  const done = useRef(false);
  const [redirecting, setRedirecting] = useState(false);
  const paid = ticketType.price > 0;
  const approval = ticketType.kind === "approval";
  const timeLeft = useTimeLeft(hold?.deadline);
  const expired = timeLeft === 0;
  // seats left don't count the ones this hold already has
  const held = hold && !expired ? hold.quantity : 0;
  // the account's limit and the seats left, whichever is lower
  const max = Math.max(1, Math.min(ticketType.maxPerUser - availability.mine, (availability.remaining ?? Infinity) + held));

  // as many attendees as the hold has seats (another device may have changed them)
  const [defaults] = useState((): EnrollValues => {
    const user = session?.user;
    const first = emptyAttendee(questions);
    const others = Array.from({ length: (hold?.quantity ?? 1) - 1 }, () => emptyAttendee(questions));
    return { attendees: [user ? { ...first, ...splitName(user), email: user.email } : first, ...others] };
  });

  const setHold = (next: SeatHold) => queryClient.setQueryData(seatHoldKey(ticketType.id), next);
  const resize = useMutation({ mutationFn: (quantity: number) => resizeSeatHold(ticketType.id, quantity) });
  const holdAgain = useMutation({
    mutationFn: (quantity: number) => startSeatHold(ticketType.id, quantity),
    onSuccess: (next) => {
      setHold(next);
      toast.add({ type: "success", title: "จองที่นั่งใหม่แล้ว", description: "กรอกข้อมูลต่อได้เลย" });
    },
    onError: (error) => {
      toast.add({ type: "error", title: problemMessage(error) });
      void queryClient.invalidateQueries({ queryKey: enrollmentsKey });
    },
  });

  /** Changes the ticket count, resizing a running hold first (the seats may have gone meanwhile). */
  const changeQuantity = async (quantity: number, apply: () => void) => {
    if (hold && !expired) {
      try {
        setHold(await resize.mutateAsync(quantity));
      } catch (error) {
        toast.add({ type: "error", title: problemMessage(error) });
        // ran out by the service's clock a moment before this one's
        if (problemCode(error) === "HOLD_EXPIRED") setHold({ ...hold, deadline: 0 });
        return;
      }
    }
    apply();
  };

  const toOrder = (enrollmentId: string) => navigate({ to: "/tickets/orders/$enrollmentId", params: { enrollmentId } });

  const form = useEnrollForm({
    defaultValues: defaults,
    schema,
    onSubmitInvalid: () => {
      toast.add({ type: "error", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      focusFirstInvalid(ROOT);
    },
    onSubmit: async ({ value }) => {
      if (expired) {
        return void toast.add({ type: "error", title: "หมดเวลาจองที่นั่งแล้ว", description: "กดจองที่นั่งใหม่เพื่อลงทะเบียนต่อ" });
      }
      const { data, error } = await registrationClient.api.regis.enrollments.post({
        ticketTypeId: ticketType.id,
        attendees: value.attendees.map((attendee) => ({
          firstName: attendee.firstName.trim(),
          lastName: attendee.lastName.trim(),
          email: attendee.email.trim(),
          answers: questions.flatMap((question, index) => {
            const answer = attendee.answers[index]?.trim();
            return answer ? [{ questionId: question.id, value: answer }] : [];
          }),
        })),
      });
      if (error) {
        toast.add({ type: "error", title: problemMessage(error) });
        // e.g. the last seats went meanwhile: show the current state
        return void queryClient.invalidateQueries({ queryKey: enrollmentsKey });
      }
      done.current = true;
      void queryClient.invalidateQueries({ queryKey: enrollmentsKey });

      if (data.status === "awaiting_payment") {
        const { data: checkout, error: checkoutError } = await paymentClient.api.payment.checkout.post({ enrollmentId: data.id });
        if (checkout) {
          setRedirecting(true);
          return window.location.assign(checkout.url);
        }
        toast.add({
          type: "error",
          title: problemMessage(checkoutError),
          description: "ที่นั่งของคุณยังถูกจองไว้ ชำระเงินได้จากหน้านี้",
        });
        return void toOrder(data.id);
      }
      toast.add(
        data.status === "pending"
          ? { type: "success", title: "ส่งคำขอแล้ว", description: "เราจะแจ้งผลทางอีเมลเมื่อผู้จัดงานพิจารณา" }
          : { type: "success", title: "ลงทะเบียนสำเร็จ", description: "ส่งตั๋วไปที่อีเมลของผู้เข้าร่วมแล้ว" },
      );
      await toOrder(data.id);
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const quantity = values.attendees.length;
  // shown while the limit or the seats allow more than one, or the form already has more
  const picksQuantity = max > 1 || quantity > 1;
  const dirty = JSON.stringify(values) !== JSON.stringify(defaults);
  const { icon: KindIcon, label: kindLabel } = kindInfo[ticketType.kind];

  return (
    <div data-slot="enroll-form" className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
      <header className="flex flex-col gap-3">
        <Link to="/events/$slug" params={{ slug: event.slug }} className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
          <ArrowLeft data-icon="inline-start" />
          {event.title}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="size-6 shrink-0 text-primary" />
          {approval ? "ขอเข้าร่วม" : "ลงทะเบียน"}: {ticketType.name}
        </h1>
      </header>

      <form
        noValidate
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="attendees" mode="array">
          {(field) => (
            <div className="flex min-w-0 flex-col gap-6">
              {(picksQuantity || hold) && (
                <Card size="sm">
                  <CardContent className="flex flex-col gap-4">
                    {picksQuantity && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2 font-medium">
                            <Ticket className="size-4 text-muted-foreground" />
                            จำนวนตั๋ว
                          </span>
                          <span className="text-sm text-muted-foreground">1 ใบต่อผู้เข้าร่วม 1 คน · เลือกได้สูงสุด {max} ใบ</span>
                        </div>
                        <div className="flex items-center gap-3" role="group" aria-label="จำนวนตั๋ว">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="ลดจำนวนตั๋ว"
                            disabled={quantity <= 1 || resize.isPending}
                            onClick={() => changeQuantity(quantity - 1, () => field.removeValue(quantity - 1))}
                          >
                            <Minus />
                          </Button>
                          <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                            {quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="เพิ่มจำนวนตั๋ว"
                            disabled={quantity >= max || resize.isPending}
                            onClick={() => changeQuantity(quantity + 1, () => field.pushValue(emptyAttendee(questions)))}
                          >
                            <Plus />
                          </Button>
                        </div>
                      </div>
                    )}
                    {picksQuantity && hold && <Separator />}
                    {hold && timeLeft !== undefined && (
                      <HoldStatus timeLeft={timeLeft} pending={holdAgain.isPending} onHoldAgain={() => holdAgain.mutate(quantity)} />
                    )}
                  </CardContent>
                </Card>
              )}
              {field.state.value.map((_, index) => (
                <AttendeeCard key={index} form={form} index={index} questions={questions} self={index === 0} />
              ))}
            </div>
          )}
        </form.Field>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-21">
          <Card>
            {event.thumbnailUrl && <img src={event.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4 shrink-0" />
                  {formatDateRange(event.startsAt, event.endsAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" />
                  {event.venue}
                </span>
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ticketType.name}</span>
                <span>{formatPrice(ticketType.price)}</span>
              </div>
              {ticketType.kind !== "first_come" && (
                <Badge variant="secondary" className="self-start">
                  <KindIcon data-icon="inline-start" />
                  {kindLabel}
                </Badge>
              )}
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>จำนวน</span>
                <span className="tabular-nums">× {quantity}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 text-base font-semibold">
                <span>ยอดรวม</span>
                <span className="tabular-nums">{formatPrice(ticketType.price * quantity)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3">
              {approval && (
                <Alert>
                  <KindIcon />
                  <AlertTitle>ต้องได้รับอนุมัติ</AlertTitle>
                  <AlertDescription>
                    {paid
                      ? "ผู้จัดงานจะพิจารณาคำขอ หากอนุมัติ คุณจะได้รับอีเมลให้ชำระเงินภายใน 72 ชั่วโมง"
                      : "ผู้จัดงานจะพิจารณาคำขอ และส่งตั๋วทางอีเมลเมื่ออนุมัติ"}
                  </AlertDescription>
                </Alert>
              )}
              {hold && timeLeft !== undefined && (
                <p
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-sm",
                    timeLeft <= 60_000 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {expired ? <TimerOff className="size-4" /> : <Timer className="size-4" />}
                  {expired ? (
                    "หมดเวลาจองที่นั่งแล้ว"
                  ) : (
                    <>
                      เหลือเวลากรอกข้อมูล <span className="font-semibold tabular-nums">{formatTimeLeft(timeLeft)}</span>
                    </>
                  )}
                </p>
              )}
              {expired ? (
                <HoldAgainButton pending={holdAgain.isPending} onClick={() => holdAgain.mutate(quantity)} className="w-full" />
              ) : (
                <SubmitButton
                  pending={isSubmitting || redirecting}
                  icon={approval ? Send : paid ? CreditCard : TicketCheck}
                  className="w-full"
                >
                  {approval ? "ส่งคำขอ" : paid ? "ไปชำระเงิน" : "ยืนยันการลงทะเบียน"}
                </SubmitButton>
              )}
              {paid && !approval && (
                <p className="text-center text-xs text-muted-foreground">ระบบจองที่นั่งไว้ 30 นาทีระหว่างชำระเงินผ่าน Stripe</p>
              )}
            </CardFooter>
          </Card>
        </aside>
      </form>

      <LeaveGuard when={dirty} allowLeaveRef={done} description="ข้อมูลผู้เข้าร่วมที่กรอกไว้จะหายไป" />
    </div>
  );
}

/**
 * The seat hold's time left, next to the ticket count it holds. Once it runs out the seats are
 * anyone's again; what was typed stays, and holding again carries on with it.
 */
function HoldStatus({ timeLeft, pending, onHoldAgain }: { timeLeft: number; pending: boolean; onHoldAgain: () => void }) {
  const expired = timeLeft === 0;
  const urgent = timeLeft <= 60_000;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className={cn("flex items-center gap-2 font-medium", urgent && "text-destructive")}>
          {expired ? <TimerOff className="size-4" /> : <Timer className={cn("size-4", !urgent && "text-muted-foreground")} />}
          {expired ? "หมดเวลาจองที่นั่ง" : "จองที่นั่งไว้ให้คุณแล้ว"}
        </span>
        <span className="text-sm text-muted-foreground">
          {expired
            ? "ที่นั่งถูกปล่อยให้คนอื่นแล้ว ข้อมูลที่กรอกไว้ยังอยู่"
            : "กรอกข้อมูลให้เสร็จก่อนหมดเวลา ไม่เช่นนั้นที่นั่งจะถูกปล่อยให้คนอื่น"}
        </span>
      </div>
      {expired ? (
        <HoldAgainButton pending={pending} onClick={onHoldAgain} size="sm" />
      ) : (
        // a timer, not a live region: announcing every second would drown out the form
        <span
          role="timer"
          aria-label="เวลาจองที่นั่งที่เหลือ"
          className={cn("text-2xl font-semibold tabular-nums", urgent && "text-destructive")}
        >
          {formatTimeLeft(timeLeft)}
        </span>
      )}
    </div>
  );
}

function HoldAgainButton({ pending, ...props }: { pending: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" {...props} disabled={pending || props.disabled}>
      {pending ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
      จองที่นั่งใหม่
    </Button>
  );
}

function AttendeeCard({
  form,
  index,
  questions,
  self,
}: {
  form: EnrollFormApi;
  index: number;
  questions: Question[];
  self: boolean;
}) {
  const name = `attendees[${index}]` as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5" />
          ผู้เข้าร่วมคนที่ {index + 1}
        </CardTitle>
        <CardDescription>
          {self ? "เติมจากบัญชีของคุณแล้ว แก้ไขได้หากซื้อให้คนอื่น" : "ตั๋วจะถูกส่งไปที่อีเมลของผู้เข้าร่วมคนนี้"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-2">
            <form.Field name={`${name}.firstName`}>
              {(field) => <TextField field={field} label="ชื่อ" icon={UserRound} autoComplete={self ? "given-name" : "off"} maxLength={100} />}
            </form.Field>
            <form.Field name={`${name}.lastName`}>
              {(field) => <TextField field={field} label="นามสกุล" icon={UserRound} autoComplete={self ? "family-name" : "off"} maxLength={100} />}
            </form.Field>
          </div>
          <form.Field name={`${name}.email`}>
            {(field) => (
              <TextField
                field={field}
                label="อีเมล"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete={self ? "email" : "off"}
                description="ส่งตั๋วไปที่อีเมลนี้ บัญชีที่ใช้อีเมลนี้จะเห็นตั๋วในหน้าตั๋วของฉันด้วย"
              />
            )}
          </form.Field>
          {questions.map((question, questionIndex) => (
            <form.Field key={question.id} name={`${name}.answers[${questionIndex}]`}>
              {(field) => {
                const label = question.required ? question.label : `${question.label} (ไม่บังคับ)`;
                if (question.type !== "choice") {
                  return (
                    <TextField
                      field={field}
                      label={label}
                      icon={ClipboardList}
                      multiline={question.type === "long_text"}
                      maxLength={question.type === "short_text" ? SHORT_TEXT_MAX : LONG_TEXT_MAX}
                    />
                  );
                }
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <FieldSet data-invalid={invalid}>
                    <FieldLegend variant="label" className="flex items-center gap-2">
                      <ListChecks className="size-4 text-muted-foreground" />
                      {label}
                    </FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.state.value}
                      onValueChange={(value) => {
                        field.handleChange(value as string);
                        field.handleBlur();
                      }}
                      aria-invalid={invalid}
                    >
                      {(question.options ?? []).map((option, optionIndex) => {
                        const id = `${field.name}-${optionIndex}`;
                        return (
                          <Field key={option} orientation="horizontal" data-invalid={invalid}>
                            <RadioGroupItem value={option} id={id} aria-invalid={invalid} />
                            <FieldLabel htmlFor={id} className="font-normal">
                              {option}
                            </FieldLabel>
                          </Field>
                        );
                      })}
                    </RadioGroup>
                    {invalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldSet>
                );
              }}
            </form.Field>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
