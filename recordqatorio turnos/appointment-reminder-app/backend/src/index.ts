import express, { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { appointmentRouter } from './controllers/appointmentController';
import { EmailService } from './services/emailService';
import { WhatsAppService } from './services/whatsappService';
import SocketService from './services/socketService';
import { connectToDatabase } from './config/database';
import { AppointmentModel } from './models/appointment';
import qrcode from 'qrcode';

dotenv.config();

const app = express();
const server = createServer(app);
const socketService = SocketService.getInstance();
socketService.initialize(server);

const emailService = new EmailService();
// Obtener la instancia singleton de WhatsApp
const whatsappService = WhatsAppService.getInstance();
console.log('[INIT] WhatsAppService inicializado:', typeof whatsappService, whatsappService && whatsappService.getIsReady && whatsappService.getIsReady());

// Conectar a MongoDB
connectToDatabase().then(async () => {
    console.log('[DB] Conectado a MongoDB');
    
    // Crear índice único para evitar duplicados
    try {
        await AppointmentModel.collection.createIndex(
            { fecha: 1, hora: 1, nroDoc: 1, paciente: 1 },
            { 
                unique: true,
                name: 'appointment_unique_index',
                background: true
            }
        );
        console.log('[DB] Índice único creado/verificado correctamente');
    } catch (error) {
        console.log('[DB] El índice único ya existe o hubo un error:', (error as Error).message);
    }
}).catch(console.error);

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

// Programar el envío de recordatorios con diferentes horarios:
// Email: 72 horas antes del turno
// WhatsApp: 48 horas antes del turno
// Se ejecuta cada 10 minutos para no perder ningún turno

cron.schedule('*/10 * * * *', async () => {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 5 * 60 * 1000);
        const end = new Date(now.getTime() + 5 * 60 * 1000);
        console.log('[CRON] Ejecutando. Buscando turnos con fechas de envío entre', start, 'y', end);

        // Buscar turnos que necesiten envío de email o WhatsApp
        const appointments = await AppointmentModel.find({
            recordatorioEnviado: { $exists: true },
            $or: [
                // Email pendiente y fecha de envío en rango
                { 
                    'recordatorioEnviado.email': { $ne: true },
                    fechaEnvioEmail: { $gte: start, $lte: end }
                },
                // WhatsApp pendiente y fecha de envío en rango
                { 
                    'recordatorioEnviado.whatsapp': { $ne: true },
                    fechaEnvioWhatsApp: { $gte: start, $lte: end }
                }
            ],
            estado: { $ne: 'cancelado' }
        });
        console.log(`[CRON] Turnos encontrados para procesar: ${appointments.length}`);

        for (const appointment of appointments) {
            // Calcular fechas de envío si no existen (para turnos antiguos)
            let needsSave = false;
            if (!appointment.fechaEnvioEmail && appointment.fecha) {
                appointment.fechaEnvioEmail = new Date(new Date(appointment.fecha).getTime() - 72 * 60 * 60 * 1000);
                needsSave = true;
                console.log(`[CRON] Calculada fechaEnvioEmail para ${appointment.paciente}:`, appointment.fechaEnvioEmail);
            }
            if (!appointment.fechaEnvioWhatsApp && appointment.fecha) {
                appointment.fechaEnvioWhatsApp = new Date(new Date(appointment.fecha).getTime() - 48 * 60 * 60 * 1000);
                needsSave = true;
                console.log(`[CRON] Calculada fechaEnvioWhatsApp para ${appointment.paciente}:`, appointment.fechaEnvioWhatsApp);
            }
            if (needsSave) {
                await appointment.save();
            }

            let enviado = false;
            // Convertir documento Mongoose a objeto plano para los servicios
            const plainAppointment = appointment.toObject ? appointment.toObject() : appointment;
            // Enviar email si no fue enviado y está en el rango de tiempo
            if (!appointment.recordatorioEnviado.email && appointment.fechaEnvioEmail &&
                appointment.fechaEnvioEmail >= start && appointment.fechaEnvioEmail <= end &&
                appointment.email && appointment.email.trim() !== '') {
                try {
                    console.log('[CRON][EMAIL] Enviando recordatorio a:', appointment.email, 'para', appointment.paciente, 'turno:', appointment.fecha, 'hora:', appointment.hora);
                    await emailService.sendReminder(plainAppointment);
                    appointment.recordatorioEnviado.email = true;
                    appointment.recordatorioEnviado.fechaEnvioEmail = new Date();
                    enviado = true;
                    console.log('[CRON][EMAIL] Recordatorio enviado con éxito a', appointment.email);
                } catch (e) {
                    console.error('[CRON][EMAIL] Error enviando recordatorio por email:', e);
                }
            }
            
            // Enviar WhatsApp si no fue enviado y está en el rango de tiempo
            if (!appointment.recordatorioEnviado.whatsapp && appointment.fechaEnvioWhatsApp &&
                appointment.fechaEnvioWhatsApp >= start && appointment.fechaEnvioWhatsApp <= end &&
                appointment.telefono && appointment.telefono.trim() !== '') {
                try {
                    console.log('[CRON][WHATSAPP] Intentando enviar WhatsApp:', {
                        telefono: appointment.telefono,
                        paciente: appointment.paciente,
                        fechaTurno: appointment.fecha,
                        fechaEnvioWhatsApp: appointment.fechaEnvioWhatsApp,
                        whatsappReady: whatsappService.getIsReady()
                    });
                    await whatsappService.sendReminder(plainAppointment);
                    appointment.recordatorioEnviado.whatsapp = true;
                    appointment.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                    enviado = true;
                    console.log('[CRON][WHATSAPP] Recordatorio enviado con éxito a', appointment.telefono);
                } catch (e) {
                    console.error('[CRON][WHATSAPP] Error enviando recordatorio por WhatsApp:', e);
                }
            }
            // Si se envió al menos uno, actualizar estado a 'notificado'
            if (enviado && appointment.estado !== 'cancelado') {
                appointment.estado = 'notificado';
            }
            await appointment.save();
        }
        console.log('[CRON] Fin de ciclo de envío automático.');
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
});

// @ts-ignore
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Socket.IO habilitado para actualizaciones en tiempo real');
});


// Endpoint temporal para debug: muestra los turnos que deberían recibir recordatorio ahora
app.get('/api/appointments/debug-reminders', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - 5 * 60 * 1000);
        const end = new Date(now.getTime() + 5 * 60 * 1000);
        console.log('[DEBUG-REMINDERS] Buscando turnos entre', start, 'y', end);
        
        const query = {
            $or: [
                // Email pendiente y fecha de envío en rango
                { 
                    'recordatorioEnviado.email': { $ne: true },
                    fechaEnvioEmail: { $gte: start, $lte: end }
                },
                // WhatsApp pendiente y fecha de envío en rango
                { 
                    'recordatorioEnviado.whatsapp': { $ne: true },
                    fechaEnvioWhatsApp: { $gte: start, $lte: end }
                }
            ],
            estado: { $ne: 'cancelado' }
        };
        
        console.log('[DEBUG-REMINDERS] Query:', JSON.stringify(query, null, 2));
        const appointments = await AppointmentModel.find(query);
        console.log('[DEBUG-REMINDERS] Resultados encontrados:', appointments.length);
        
        if (appointments.length === 0) {
            return res.json({ 
                message: 'No hay turnos para enviar recordatorio en este rango de tiempo.',
                timeRange: { start, end, now }
            });
        }
        
        res.json(appointments.map((a: any) => ({
            paciente: a.paciente,
            fecha: a.fecha,
            fechaEnvio: a.fechaEnvio, // mantener por compatibilidad
            fechaEnvioEmail: a.fechaEnvioEmail,
            fechaEnvioWhatsApp: a.fechaEnvioWhatsApp,
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
