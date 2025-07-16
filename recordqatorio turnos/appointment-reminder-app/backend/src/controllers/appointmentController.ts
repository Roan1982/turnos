import express, { Request, Response } from 'express';
import multer from 'multer';
import { ExcelService } from '../services/excelService';
import { AppointmentModel, Appointment, AppointmentInput } from '../models/appointment';
import { EmailService } from '../services/emailService';
import { WhatsAppService } from '../services/whatsappService';

// Extended types
interface MulterFile extends Express.Multer.File {
    buffer: Buffer;
}

interface RequestWithFile extends Request {
    file?: MulterFile;
}

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

// Configurar multer para aceptar solo archivos Excel
const storage = multer.memoryStorage();
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos Excel (.xls o .xlsx)'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Límite de 5MB
    }
});

const router = express.Router();

router.post('/upload', upload.single('file'), async (req: MulterRequest, res: Response) => {
    try {
        console.log('Recibiendo archivo:', req.file?.originalname);
        console.log('Mime type:', req.file?.mimetype);
        console.log('Buffer size:', req.file?.buffer?.length);

        if (!req.file || !req.file.buffer) {
            console.log('Error: No se recibió archivo o buffer');
            return res.status(400).json({ 
                error: 'Por favor, sube un archivo Excel válido (.xls o .xlsx)'
            });
        }

        console.log('Procesando archivo Excel...');
        const appointmentInputs = ExcelService.parseExcelFile(req.file.buffer);
        console.log('Turnos encontrados:', appointmentInputs.length);
        
        if (!Array.isArray(appointmentInputs) || appointmentInputs.length === 0) {
            console.log('Error: No se encontraron turnos válidos');
            return res.status(400).json({
                error: 'El archivo no contiene datos de turnos válidos'
            });
        }
        
        console.log('Ejemplo del primer turno:', JSON.stringify(appointmentInputs[0], null, 2));

        // Validar que todas las fechas sean válidas
        for (const input of appointmentInputs) {
            if (!(input.fecha instanceof Date) || isNaN(input.fecha.getTime())) {
                return res.status(400).json({
                    error: 'El archivo contiene fechas inválidas'
                });
            }
        }

        const appointments = await AppointmentModel.create(appointmentInputs);

        res.json({
            message: 'Archivo procesado correctamente',
            appointments
        });

    } catch (error) {
        console.error('Error processing file:', error);
        
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Error al procesar el archivo. Por favor, verifica que el formato sea correcto.'
        });
    }
});

// Get all appointments
router.get('/', async (req: Request, res: Response) => {
    try {
        const appointments = await AppointmentModel.find().sort({ fecha: 1, hora: 1 });
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Error al obtener los turnos' });
    }
});

// Get a single appointment
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const appointment = await AppointmentModel.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        res.json(appointment);
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ error: 'Error al obtener el turno' });
    }
});

// Send a notification for an appointment
router.post('/:id/reenviar', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { tipo } = req.body;

        const appointment = await AppointmentModel.findById(id);
        if (!appointment) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        try {
            if (tipo === 'email') {
                const emailService = new EmailService();
                await emailService.sendReminder(appointment);
                appointment.recordatorioEnviado.email = true;
                appointment.recordatorioEnviado.fechaEnvioEmail = new Date();
            } else if (tipo === 'whatsapp') {
                await WhatsAppService.sendReminder(appointment);
                appointment.recordatorioEnviado.whatsapp = true;
                appointment.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
            }
        } catch (error) {
            console.error(`Error al enviar ${tipo}:`, error);
            let errorMsg = `Error al enviar el recordatorio por ${tipo}`;
            if (error instanceof Error && error.message) {
                errorMsg += `: ${error.message}`;
            } else if (typeof error === 'string') {
                errorMsg += `: ${error}`;
            }
            return res.status(500).json({ error: errorMsg });
        }

        await appointment.save();
        res.json({ message: `Recordatorio por ${tipo} enviado correctamente`, appointment });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Error al enviar el recordatorio' });
    }
});

export { router as appointmentRouter };
