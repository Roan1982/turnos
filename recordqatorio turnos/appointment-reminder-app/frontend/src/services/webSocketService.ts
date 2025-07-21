import { io, Socket } from 'socket.io-client';

class WebSocketService {
    private socket: Socket | null = null;
    private static instance: WebSocketService;

    private constructor() {}

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    public connect(): void {
        if (this.socket?.connected) {
            return;
        }

        const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 5000,
        });

        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor WebSocket');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Desconectado del servidor WebSocket');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Error de conexión WebSocket:', error);
        });
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    public onAppointmentUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on('appointmentUpdated', callback);
        }
    }

    public onCountsUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on('countsUpdated', callback);
        }
    }

    public onReminderSent(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on('reminderSent', callback);
        }
    }

    public onBulkUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on('bulkUpdateComplete', callback);
        }
    }

    public offAppointmentUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.off('appointmentUpdated', callback);
        }
    }

    public offCountsUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.off('countsUpdated', callback);
        }
    }

    public offReminderSent(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.off('reminderSent', callback);
        }
    }

    public offBulkUpdate(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.off('bulkUpdateComplete', callback);
        }
    }

    public isConnected(): boolean {
        return this.socket?.connected || false;
    }
}

export default WebSocketService;
