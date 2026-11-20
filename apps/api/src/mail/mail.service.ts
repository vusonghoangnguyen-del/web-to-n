import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

type VerificationEmail = {
  email: string;
  name: string;
  token: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    this.transporter = config.getOrThrow<string>('MAIL_MODE') === 'smtp'
      ? nodemailer.createTransport({
          host: config.getOrThrow<string>('MAIL_HOST'),
          port: config.getOrThrow<number>('MAIL_PORT'),
          secure: config.getOrThrow<boolean>('MAIL_SECURE'),
          auth: config.get<string>('MAIL_USER')
            ? {
                user: config.getOrThrow<string>('MAIL_USER'),
                pass: config.getOrThrow<string>('MAIL_PASSWORD'),
              }
            : undefined,
        })
      : null;
  }

  async sendVerificationEmail(input: VerificationEmail): Promise<void> {
    const verificationUrl = `${this.config.getOrThrow<string>('APP_WEB_URL')}/xac-minh-email?token=${encodeURIComponent(input.token)}`;
    const subject = 'Xác minh tài khoản Tờ Toán';
    const text = `Chào ${input.name},\n\nMở liên kết sau để xác minh tài khoản Tờ Toán:\n${verificationUrl}\n\nLiên kết sẽ hết hạn. Nếu bạn không đăng ký, hãy bỏ qua email này.`;
    const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><body><h1>Xác minh tài khoản Tờ Toán</h1><p>Chào ${escapeHtml(input.name)},</p><p>Nhấn vào liên kết dưới đây để hoàn tất đăng ký:</p><p><a href="${escapeHtml(verificationUrl)}">Xác minh email</a></p><p>Nếu bạn không đăng ký, hãy bỏ qua email này.</p></body></html>`;

    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.config.getOrThrow<string>('MAIL_FROM'),
        to: input.email,
        subject,
        text,
        html,
      });
      return;
    }

    const previewDirectory = path.resolve(__dirname, '../../../../storage/mail-preview');
    await mkdir(previewDirectory, { recursive: true });
    const previewPath = path.join(previewDirectory, `${randomUUID()}.html`);
    await writeFile(previewPath, html, 'utf8');
    this.logger.log(`Đã lưu email xác minh local tại ${previewPath}`);
  }

  async sendPasswordResetEmail(input: VerificationEmail): Promise<void> {
    const url = `${this.config.getOrThrow<string>('APP_WEB_URL')}/dat-lai-mat-khau?token=${encodeURIComponent(input.token)}`;
    const subject = 'Đặt lại mật khẩu Tờ Toán';
    const text = `Chào ${input.name},\n\nMở liên kết để đặt lại mật khẩu:\n${url}\n\nLiên kết có hiệu lực 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;
    const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><body><h1>Đặt lại mật khẩu Tờ Toán</h1><p>Chào ${escapeHtml(input.name)},</p><p><a href="${escapeHtml(url)}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p></body></html>`;
    if (this.transporter) {
      await this.transporter.sendMail({ from: this.config.getOrThrow<string>('MAIL_FROM'), to: input.email, subject, text, html });
      return;
    }
    const previewDirectory = path.resolve(__dirname, '../../../../storage/mail-preview');
    await mkdir(previewDirectory, { recursive: true });
    const previewPath = path.join(previewDirectory, `${randomUUID()}.html`);
    await writeFile(previewPath, html, 'utf8');
    this.logger.log(`Đã lưu email đặt lại mật khẩu local tại ${previewPath}`);
  }
}
