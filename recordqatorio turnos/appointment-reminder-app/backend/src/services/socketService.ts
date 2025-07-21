import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

class SocketService {
    private static instance: SocketService;
    private io: SocketIOServer | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public initialize(server: HTTPServer): void {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                allowedHeaders: ["Content-Type"],
                credentials: true
            }
        });

        this.io.on('connection', (socket) => {
            console.log('Cliente WebSocket conectado:', socket.id);

            socket.on('disconnect', () => {
                console.log('Cliente WebSocket desconectado:', socket.id);
            });

            // Unirse a sala de actualizaciones de turnos
            socket.join('appointments');
        });

        console.log('Socket.IO inicializado correctamente');
    }

    // Emitir actualización cuando se envía un recordatorio
    public emitAppointmentUpdate(appointmentId: string, updateData: any): void {
        if (this.io) {
            this.io.to('appointments').emit('appointmentUpdated', {
                appointmentId,
                updateData,
                timestamp: new Date()
            });
            console.log(`[WEBSOCKET] Enviada actualización para turno ${appointmentId}`);
        }
    }

    // Emitir actualización de contadores
    public emitCountsUpdate(counts: { total: number; pending: number; notified: number }): void {
        if (this.io) {
            this.io.to('appointments').emit('countsUpdated', {
                counts,
                timestamp: new Date()
            });
            console.log('[WEBSOCKET] Enviada actualización de contadores');
        }
    }

    // Emitir notificación de recordatorio enviado
    public emitReminderSent(appointmentId: string, tipo: 'email' | 'whatsapp', paciente: string): void {
        if (this.io) {
            this.io.to('appointments').emit('reminderSent', {
                appointmentId,
                tipo,
                paciente,
                timestamp: new Date()
            });
            console.log(`[WEBSOCKET] Recordatorio ${tipo} enviado a ${paciente}`);
        }
    }

    // Emitir actualización masiva (para envío de todos los pendientes)
    public emitBulkUpdate(processed: number, errors: number): void {
        if (this.io) {
            this.io.to('appointments').emit('bulkUpdateComplete', {
                processed,
                errors,
                timestamp: new Date()
            });
            console.log(`[WEBSOCKET] Procesamiento masivo completado: ${processed} procesados, ${errors} errores`);
        }
    }

    public getIO(): SocketIOServer | null {
        return this.io;
    }
}

export default SocketService;
