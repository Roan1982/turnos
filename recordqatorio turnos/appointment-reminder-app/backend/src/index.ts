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

// Programar el envío de recordatorios
// Se ejecuta cada hora para verificar los turnos del día siguiente
cron.schedule('0 * * * *', async () => {
    try {
        // Aquí deberías obtener las citas de la base de datos
        // Por ahora, esto es solo un ejemplo
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Obtener citas para mañana y enviar recordatorios
        // appointmentsForTomorrow = await getAppointmentsForDate(tomorrow);
        // for (const appointment of appointmentsForTomorrow) {
        //     await emailService.sendReminder(appointment);
        //     await whatsappService.sendReminder(appointment);
        // }
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
