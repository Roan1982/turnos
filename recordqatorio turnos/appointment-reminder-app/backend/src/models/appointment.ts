import mongoose, { Document, Schema } from 'mongoose';

// Interface para la creación de turnos desde Excel
export interface AppointmentInput {
    fecha: Date; // Fecha y hora real del turno (del Excel)
    fechaCarga?: Date; // Fecha en que se cargó el turno
    hora: string;
    fechaEnvio?: Date; // Fecha y hora en que se debe enviar el recordatorio (24h antes)
    nroDoc: string;
    paciente: string;
    telefono: string;
    email: string;
    confirma?: string;
    motivo: string;
    profesional: string;
    especialidad: string;
    recordatorioEnviado: {
        email: boolean;
        whatsapp: boolean;
        fechaEnvioEmail?: Date;
        fechaEnvioWhatsApp?: Date;
    };
    estado: 'pendiente' | 'confirmado' | 'cancelado' | 'notificado';
}

// Interface completa incluyendo campos autogenerados por MongoDB
export interface Appointment extends AppointmentInput {
    createdAt: Date;
    updatedAt: Date;
}

export interface AppointmentDocument extends Appointment, Document {}

const AppointmentSchema = new Schema<AppointmentDocument>({
    fecha: { type: Date, required: true }, // Fecha y hora real del turno (del Excel)
    fechaCarga: { type: Date, default: Date.now }, // Fecha de carga
    hora: { type: String, required: true },
    fechaEnvio: { type: Date }, // Fecha y hora en que se debe enviar el recordatorio (24h antes)
    nroDoc: { type: String, required: true },
    paciente: { type: String, required: true },
    telefono: { type: String, required: true },
    email: { type: String, required: true },
    confirma: { type: String, required: false },
    motivo: { type: String, required: false },
    profesional: { type: String, required: true },
    especialidad: { type: String, required: true },
    recordatorioEnviado: {
        email: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
        fechaEnvioEmail: { type: Date },
        fechaEnvioWhatsApp: { type: Date }
    },
    estado: { 
        type: String, 
        enum: ['pendiente', 'confirmado', 'cancelado', 'notificado'],
        default: 'pendiente'
    }
}, {
    timestamps: true
});

export const AppointmentModel = mongoose.model<AppointmentDocument>('Appointment', AppointmentSchema);
