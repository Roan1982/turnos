export interface Recordatorio {
    email: boolean;
    whatsapp: boolean;
    fechaEnvioEmail?: string;
    fechaEnvioWhatsApp?: string;
}

export interface Appointment {
    _id: string;
    fecha: string; // Fecha real del turno
    fechaEnvio?: string; // Fecha programada para enviar el recordatorio (DEPRECATED - compatibilidad)
    fechaEnvioEmail?: string; // Fecha para enviar email (72 horas antes)
    fechaEnvioWhatsApp?: string; // Fecha para enviar WhatsApp (48 horas antes)
    fechaCarga?: string; // Fecha en que se cargó el turno
    hora: string;
    nroDoc: string;
    paciente: string;
    telefono?: string; // Opcional
    email?: string; // Opcional
    confirma?: string;
    motivo: string;
    profesional: string;
    especialidad: string;
    recordatorioEnviado: Recordatorio;
    estado: 'pendiente' | 'confirmado' | 'cancelado' | 'notificado';
    createdAt: string;
    updatedAt: string;
}
