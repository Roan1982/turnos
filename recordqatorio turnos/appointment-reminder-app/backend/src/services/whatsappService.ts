
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { Appointment } from '../models/appointment';

class WhatsAppServiceSingleton {
    public getIsReady(): boolean {
        return this.isReady;
    }
    private static instance: WhatsAppServiceSingleton;
    private client: Client;
    private isReady: boolean = false;
    public lastQr: string | null = null;

    private constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        this.client.on('qr', (qr) => {
            this.lastQr = qr;
            console.log('Por favor, escanea este código QR con WhatsApp:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            this.isReady = true;
            console.log('Cliente WhatsApp está listo!');
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp autenticado');
        });

        this.client.initialize().catch(err => {
            console.error('Error al inicializar WhatsApp:', err);
        });
    }

    public static getInstance(): WhatsAppServiceSingleton {
        if (!WhatsAppServiceSingleton.instance) {
            WhatsAppServiceSingleton.instance = new WhatsAppServiceSingleton();
        }
        return WhatsAppServiceSingleton.instance;
    }

    public async sendReminder(appointment: Appointment): Promise<void> {
        if (!this.isReady) {
            throw new Error('El cliente de WhatsApp no está listo. Por favor, escanea el código QR primero.');
        }
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
        
        const message = `🏥 *CMF Centro Médico Dr. Fia*

*Recordatorio de Turno*

Estimado/a ${appointment.paciente},

Le recordamos que tiene un turno programado para ${mensajeFecha}:

📅 *Fecha:* ${fechaFormateada}
🕒 *Hora:* ${appointment.hora}
👨‍⚕️ *Profesional:* ${appointment.profesional}
🏥 *Especialidad:* ${appointment.especialidad}
📝 *Motivo:* ${appointment.motivo}

📍 *Nuestra ubicación:*
Boulevard Buenos Aires 1300, Luis Guillón, Provincia de Buenos Aires

🌐 *Web:* https://doctorfia.com/

💬 *¿Necesita cancelar o tiene consultas?*
Escríbanos a nuestra línea de WhatsApp: *11 4162-8577*

¡Gracias por confiar en CMF Centro Médico Dr. Fia!`;
        try {
            let phoneNumber = appointment.telefono.replace(/\D/g, '');
            if (!phoneNumber.startsWith('549')) {
                phoneNumber = '549' + phoneNumber;
            }
            const chatId = `${phoneNumber}@c.us`;
            await this.client.sendMessage(chatId, message);
            console.log(`Mensaje enviado a ${appointment.paciente} (${chatId})`);
        } catch (error) {
            console.error(`Error al enviar mensaje de WhatsApp a ${appointment.paciente}:`, error);
            throw error;
        }
    }
}


const whatsappServiceInstance = WhatsAppServiceSingleton.getInstance();
export { whatsappServiceInstance as WhatsAppService };
