import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { passwordTemplate } from 'src/templates/password-reset-template';
import { emailConfirmTemplate } from 'src/templates/email-confirm-template';
import { BcryptService } from 'src/common/services/bcrypt.service';
import { ConfigService } from '@nestjs/config';
import { LOGO, SYSTEM_EMAIL, SYSTEM_NAME } from '../common/constants';

@Injectable()
export class EmailService {
  private readonly from: string;
  private readonly logoUrl: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly bcryptService: BcryptService,
    private readonly configService: ConfigService,
  ) {
    this.from = this.configService.get<string>(
      'EMAIL_FROM',
      `${SYSTEM_NAME} <${SYSTEM_EMAIL}>`,
    );
    this.logoUrl = this.configService.get<string>('LOGO_URL', LOGO);
  }

  private async getClient() {
    const transport = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 465),
      secure: this.configService.get<boolean>('SMTP_SECURE', true),
      auth: {
        user: this.configService.get<string>('SMTP_USER', SYSTEM_EMAIL),
        pass: this.configService.get<string>('SMTP_PASS', 'aayubhyzsaefipln'),
      },
    });

    transport.on('error', (error) => {
      throw new HttpException(`Erro SMTP: ${error}`, 500);
    });

    return transport;
  }

  async resetPassword({
    url,
    name,
    email,
  }: {
    url: string;
    name: string;
    email: string;
  }) {
    const client = await this.getClient();

    client
      .sendMail({
        from: this.from,
        to: email,
        subject: 'Redefinição de senha',
        html: passwordTemplate(url, name, SYSTEM_NAME),
        attachments: [
          {
            filename: 'logo.png',
            path: LOGO,
            cid: 'logo',
          },
        ],
      })
      .catch((error) => {
        console.error('Erro ao enviar email:', error);
      });
  }

  async confirmEmail({
    url,
    name,
    email,
  }: {
    url: string;
    name: string;
    email: string;
  }) {
    try {
      const client = await this.getClient();
      await client.sendMail({
        from: this.from,
        to: email,
        subject: 'Confirmação de email',
        html: emailConfirmTemplate(url, name, email, SYSTEM_NAME),
        attachments: [
          {
            filename: 'logo.png',
            path: LOGO,
            cid: 'logo',
          },
        ],
      });

      console.log('Email enviado com sucesso.');
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }
  }
}
