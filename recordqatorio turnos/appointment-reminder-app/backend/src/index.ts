import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { appointmentRouter } from './controllers/appointmentController';
import { EmailService } from './services/emailService';
import { WhatsAppService } from './services/whatsappService';
import { connectToDatabase } from './config/database';
import qrcode from 'qrcode';

dotenv.config();

const app = express();
const emailService = new EmailService();
const whatsappService = WhatsAppService;

// Conectar a MongoDB
connectToDatabase().catch(console.error);

app.use(cors());
app.use(express.json());

// Endpoint para obtener el QR de WhatsApp
app.get('/api/whatsapp/qr', async (req, res) => {
    if (!whatsappService.lastQr) {
        return res.status(404).json({ error: 'No hay QR disponible. El cliente puede estar autenticado o no listo.' });
    }
    try {
        // Convertir el QR a imagen base64 para mostrar en el frontend
        const qrImage = await qrcode.toDataURL(whatsappService.lastQr);
        res.json({ qr: qrImage });
    } catch (error) {
        res.status(500).json({ error: 'Error generando la imagen del QR.' });
    }
});

// Rutas
app.use('/api/appointments', appointmentRouter);

// Programar el envío de recordatorios exactamente 24 horas antes del turno
// Se ejecuta cada 10 minutos para no perder ningún turno
import { AppointmentModel } from './models/appointment';

cron.schedule('*/10 * * * *', async () => {
    try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Buscar turnos cuya fecha y hora sean exactamente 24h después del momento actual (con margen de 10 minutos)
        // Suponiendo que appointment.hora es string tipo 'HH:mm'
        const start = new Date(in24h);
        start.setMinutes(start.getMinutes() - 5);
        const end = new Date(in24h);
        end.setMinutes(end.getMinutes() + 5);

        // Buscar turnos entre start y end, y que no tengan recordatorio enviado
        const appointments = await AppointmentModel.find({
            recordatorioEnviado: { $exists: true },
            $or: [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ],
            estado: { $ne: 'cancelado' },
            fecha: {
                $gte: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
                $lte: new Date(end.getFullYear(), end.getMonth(), end.getDate())
            }
        });

        for (const appointment of appointments) {
            // Parsear hora
            const [h, m] = appointment.hora.split(':').map(Number);
            const apptDate = new Date(appointment.fecha);
            apptDate.setHours(h, m, 0, 0);
            if (apptDate >= start && apptDate <= end) {
                // Enviar email si no fue enviado
                if (!appointment.recordatorioEnviado.email) {
                    try {
                        await emailService.sendReminder(appointment);
                        appointment.recordatorioEnviado.email = true;
                        appointment.recordatorioEnviado.fechaEnvioEmail = new Date();
                    } catch (e) {
                        console.error('Error enviando recordatorio por email:', e);
                    }
                }
                // Enviar WhatsApp si no fue enviado
                if (!appointment.recordatorioEnviado.whatsapp) {
                    try {
                        await whatsappService.sendReminder(appointment);
                        appointment.recordatorioEnviado.whatsapp = true;
                        appointment.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                    } catch (e) {
                        console.error('Error enviando recordatorio por WhatsApp:', e);
                    }
                }
                await appointment.save();
            }
        }
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
