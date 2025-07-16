import nodemailer from 'nodemailer';
import { Appointment } from '../models/appointment';

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Usar STARTTLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendReminder(appointment: Appointment): Promise<void> {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: appointment.email,
            subject: 'Recordatorio de Turno',
            html: `
                <h3>Recordatorio de Turno</h3>
                <p>Estimado/a ${appointment.paciente},</p>
                <p>Le recordamos que tiene un turno programado para mañana:</p>
                <ul>
                    <li><strong>Fecha:</strong> ${appointment.fecha.toLocaleDateString()}</li>
                    <li><strong>Hora:</strong> ${appointment.hora}</li>
                    <li><strong>Profesional:</strong> ${appointment.profesional}</li>
                    <li><strong>Especialidad:</strong> ${appointment.especialidad}</li>
                    <li><strong>Motivo:</strong> ${appointment.motivo}</li>
                </ul>
                <p>Por favor, confirme su asistencia respondiendo este correo.</p>
                <p>¡Gracias!</p>
            `
        };

        await this.transporter.sendMail(mailOptions);
    }
}
