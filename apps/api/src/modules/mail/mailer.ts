import nodemailer from "nodemailer";

import { config } from "../../config.js";
import type { MailContent } from "./messages.js";

export class MailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailSendError";
  }
}

export function isMailConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

export function appLoginUrl(): string {
  return `${config.appPublicUrl}/login`;
}

export function appResetPasswordUrl(token: string): string {
  return `${config.appPublicUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!isMailConfigured()) {
    throw new MailSendError("SMTP не настроен.");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  return transporter;
}

export async function sendMail(to: string, content: MailContent): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html
  });
}

/** Отправка без секретов в логе. false — письмо не ушло, бизнес-операция уже могла пройти. */
export async function sendMailSafe(to: string, content: MailContent): Promise<boolean> {
  try {
    await sendMail(to, content);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error("[mail] send failed:", reason);
    return false;
  }
}
