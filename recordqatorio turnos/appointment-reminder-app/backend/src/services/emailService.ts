import nodemailer from 'nodemailer';
import { Appointment } from '../models/appointment';

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // Configuración para avisos@doctorfia.com en Ferozo (puerto 587 STARTTLS)
        this.transporter = nodemailer.createTransport({
            host: 'l0030791.ferozo.com',
            port: 587,
            secure: false, // Usar STARTTLS
            auth: {
                user: 'avisos@doctorfia.com',
                pass: 'Angel2025**'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendReminder(appointment: Appointment): Promise<void> {
        const mailOptions = {
            from: 'avisos@doctorfia.com',
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
