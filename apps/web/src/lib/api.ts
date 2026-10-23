import { treaty } from "@elysia/eden";
import type { Authentication as AuthApp } from "@app/auth";
import type { Event as EventApp } from "@app/event";
import type { Payment as PaymentApp } from "@app/payment";
import type { Registration as RegistrationApp } from "@app/registration";

export const authClient = treaty<AuthApp>(window.location.origin);
export const eventClient = treaty<EventApp>(window.location.origin);
export const registrationClient = treaty<RegistrationApp>(window.location.origin);
export const paymentClient = treaty<PaymentApp>(window.location.origin);
