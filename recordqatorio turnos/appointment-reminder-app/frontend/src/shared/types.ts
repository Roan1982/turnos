export interface Recordatorio {
    email: boolean;
    whatsapp: boolean;
    fechaEnvioEmail?: string;
    fechaEnvioWhatsApp?: string;
}

export interface Appointment {
    _id: string;
    fecha: string; // Fecha real del turno
    fechaEnvio?: string; // Fecha programada para enviar el recordatorio
    fechaCarga?: string; // Fecha en que se cargó el turno
    hora: string;
    nroDoc: string;
    paciente: string;
    telefono: string;
    email: string;
    confirma?: string;
    motivo: string;
    profesional: string;
    especialidad: string;
    recordatorioEnviado: Recordatorio;
    estado: 'pendiente' | 'confirmado' | 'cancelado';
    createdAt: string;
    updatedAt: string;
}
