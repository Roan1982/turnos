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
        // Calcular diferencia entre ahora y el turno
        const ahora = new Date();
        const fechaTurno = new Date(appointment.fecha);
        const diffHoras = Math.abs((fechaTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60));
        
        // Formatear fecha en dd/mm/aaaa
        const fechaFormateada = fechaTurno.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        let mensajeFecha = '';
        if (diffHoras >= 22 && diffHoras <= 26) {
            mensajeFecha = 'mañana';
        } else {
            mensajeFecha = `el día ${fechaFormateada} a las ${appointment.hora}`;
        }
        
        const mailOptions = {
            from: 'avisos@doctorfia.com',
            to: appointment.email,
            subject: 'Recordatorio de Turno - CMF Centro Médico Dr. Fia',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #007bff;">
                        <h2 style="color: #007bff; margin: 0;">CMF Centro Médico Dr. Fia</h2>
                    </div>
                    
                    <div style="padding: 20px; background-color: white;">
                        <h3 style="color: #333; margin-bottom: 20px;">Recordatorio de Turno</h3>
                        
                        <p>Estimado/a <strong>${appointment.paciente}</strong>,</p>
                        <p>Le recordamos que tiene un turno programado para <strong>${mensajeFecha}</strong>:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>📅 Fecha:</strong> ${fechaFormateada}</li>
                                <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>🕒 Hora:</strong> ${appointment.hora}</li>
                                <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>👨‍⚕️ Profesional:</strong> ${appointment.profesional}</li>
                                <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>🏥 Especialidad:</strong> ${appointment.especialidad}</li>
                                <li style="padding: 8px 0;"><strong>📝 Motivo:</strong> ${appointment.motivo}</li>
                            </ul>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #1976d2;"><strong>📍 Nuestra ubicación:</strong></p>
                            <p style="margin: 5px 0;">Boulevard Buenos Aires 1300, Luis Guillón, Provincia de Buenos Aires</p>
                            <p style="margin: 5px 0;"><strong>🌐 Web:</strong> <a href="https://doctorfia.com/" style="color: #007bff;">https://doctorfia.com/</a></p>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <p style="margin: 0; color: #856404;"><strong>💬 ¿Necesita cancelar o tiene consultas?</strong></p>
                            <p style="margin: 5px 0;">Escríbanos a nuestra línea de WhatsApp: <strong>11 4162-8577</strong></p>
                        </div>
                        
                        <p style="text-align: center; margin-top: 30px; color: #6c757d;">¡Gracias por confiar en CMF Centro Médico Dr. Fia!</p>
                    </div>
                </div>
            `
        };
        await this.transporter.sendMail(mailOptions);
    }
}
