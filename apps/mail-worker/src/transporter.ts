import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

// Without Gmail credentials (local dev), messages are serialized and logged instead of sent.
export const isDryRun = !user || !pass;

export const transporter = isDryRun
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

export const from = process.env.MAIL_FROM || user || "eventide@localhost";
