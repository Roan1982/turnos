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
// WhatsAppService ya es la instancia singleton exportada correctamente
const whatsappService = WhatsAppService;
console.log('[INIT] WhatsAppService inicializado:', typeof whatsappService, whatsappService && whatsappService.getIsReady && whatsappService.getIsReady());

// Conectar a MongoDB
connectToDatabase().catch(console.error);

app.use(cors());
app.use(express.json());

// Endpoint para obtener el QR de WhatsApp
app.get('/api/whatsapp/qr', async (req, res) => {
    try {
        if (!whatsappService.lastQr) {
            console.error('[QR] No hay QR disponible. ¿WhatsApp listo?', whatsappService.getIsReady && whatsappService.getIsReady());
            return res.status(404).json({ error: 'No hay QR disponible. El cliente puede estar autenticado o no listo.' });
        }
        // Convertir el QR a imagen base64 para mostrar en el frontend
        const qrImage = await qrcode.toDataURL(whatsappService.lastQr);
        res.json({ qr: qrImage });
    } catch (error) {
        console.error('[QR] Error generando la imagen del QR:', error);
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
        // Buscar turnos cuya fechaEnvio esté dentro del rango de ejecución (margen de 10 minutos)
        const start = new Date(now.getTime() - 5 * 60 * 1000);
        const end = new Date(now.getTime() + 5 * 60 * 1000);

        const appointments = await AppointmentModel.find({
            recordatorioEnviado: { $exists: true },
            $or: [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ],
            estado: { $ne: 'cancelado' },
            fechaEnvio: { $gte: start, $lte: end }
        });

        for (const appointment of appointments) {
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
                    // Log para depuración
                    console.log('[CRON] Intentando enviar WhatsApp:', {
                        telefono: appointment.telefono,
                        paciente: appointment.paciente,
                        fechaTurno: appointment.fecha,
                        fechaEnvio: appointment.fechaEnvio,
                        whatsappReady: whatsappService.getIsReady()
                    });
                    await whatsappService.sendReminder(appointment);
                    appointment.recordatorioEnviado.whatsapp = true;
                    appointment.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                } catch (e) {
                    console.error('Error enviando recordatorio por WhatsApp:', e);
                }
            }
            await appointment.save();
        }
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Endpoint temporal para debug: muestra los turnos que deberían recibir recordatorio ahora
app.get('/api/appointments/debug-reminders', async (req, res) => {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 5 * 60 * 1000);
        const end = new Date(now.getTime() + 5 * 60 * 1000);
        console.log('[DEBUG-REMINDERS] Buscando turnos entre', start, 'y', end);
        const query = {
            fechaEnvio: { $gte: start, $lte: end },
            $or: [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ],
            estado: { $ne: 'cancelado' }
        };
        console.log('[DEBUG-REMINDERS] Query:', JSON.stringify(query));
        const appointments = await AppointmentModel.find(query);
        console.log('[DEBUG-REMINDERS] Resultados encontrados:', appointments.length);
        if (appointments.length === 0) {
            return res.json({ message: 'No hay turnos para enviar recordatorio en este rango de tiempo.' });
        }
        res.json(appointments.map(a => ({
            paciente: a.paciente,
            fecha: a.fecha,
            fechaEnvio: a.fechaEnvio,
            email: a.email,
            telefono: a.telefono,
            estado: a.estado,
            recordatorioEnviado: a.recordatorioEnviado
        })));
    } catch (error) {
        console.error('[DEBUG-REMINDERS] Error en la consulta:', error);
        let msg = 'Error desconocido';
        if (error && typeof error === 'object' && 'message' in error) {
            msg = (error as any).message;
        } else if (typeof error === 'string') {
            msg = error;
        }
        res.status(500).json({ error: msg });
    }
});
