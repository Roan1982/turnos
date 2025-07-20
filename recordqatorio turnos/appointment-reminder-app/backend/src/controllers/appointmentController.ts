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

// Interfaces para el procesamiento de resultados
interface TurnoExitoso {
    fila: number;
    id: any;
    paciente: string;
    fecha: Date;
    hora: string;
}

interface TurnoDuplicado {
    fila: number;
    paciente: string;
    fecha: Date;
    hora: string;
    error: string;
}

interface TurnoError {
    fila: number;
    error: string;
    datos: AppointmentInput;
}

interface ResultadosProcesamiento {
    exitosos: TurnoExitoso[];
    duplicados: TurnoDuplicado[];
    errores: TurnoError[];
    totalProcesados: number;
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

        const resultados: ResultadosProcesamiento = {
            exitosos: [],
            duplicados: [],
            errores: [],
            totalProcesados: appointmentInputs.length
        };

        // Procesar cada turno individualmente para manejar duplicados y errores
        for (let i = 0; i < appointmentInputs.length; i++) {
            const input = appointmentInputs[i];
            const numeroFila = i + 2; // +2 porque Excel empieza en 1 y la primera fila son headers
            
            try {
                // Validar fecha
                if (!(input.fecha instanceof Date) || isNaN(input.fecha.getTime())) {
                    resultados.errores.push({
                        fila: numeroFila,
                        error: 'Fecha inválida',
                        datos: input
                    });
                    continue;
                }

                // Calcular fechaEnvio si no existe y usar hora del turno
                if (!input.fechaEnvio && input.fecha && input.hora) {
                    // Parsear fecha y hora manualmente para evitar desfases de zona horaria
                    let y, m, d;
                    if (typeof input.fecha === 'string') {
                        const partes = (input.fecha as string).split(/[\/\-]/);
                        if (partes.length === 3) {
                            // DD/MM/YYYY o YYYY-MM-DD
                            if (parseInt(partes[0], 10) > 31) {
                                // YYYY-MM-DD
                                y = parseInt(partes[0], 10);
                                m = parseInt(partes[1], 10) - 1;
                                d = parseInt(partes[2], 10);
                            } else {
                                // DD/MM/YYYY
                                d = parseInt(partes[0], 10);
                                m = parseInt(partes[1], 10) - 1;
                                y = parseInt(partes[2], 10);
                            }
                        } else {
                            // fallback
                            const dateObj = new Date(input.fecha as string);
                            y = dateObj.getFullYear();
                            m = dateObj.getMonth();
                            d = dateObj.getDate();
                        }
                    } else {
                        const dateObj = new Date(input.fecha as Date);
                        y = dateObj.getFullYear();
                        m = dateObj.getMonth();
                        d = dateObj.getDate();
                    }
                    const [h, min, s] = typeof input.hora === 'string' ? input.hora.split(':').map(Number) : [0, 0, 0];
                    // Construir fecha del turno usando UTC para evitar problemas de zona horaria
                    const fechaTurno = new Date(Date.UTC(y, m, d, h || 0, min || 0, s || 0, 0));
                    // Restar exactamente 24 horas y agregar 3 horas para compensar el desfase
                    const fechaEnvio = new Date(fechaTurno.getTime() - 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
                    input.fechaEnvio = fechaEnvio;
                }

                // Intentar crear el turno
                const appointment = await AppointmentModel.create(input);
                resultados.exitosos.push({
                    fila: numeroFila,
                    id: appointment._id,
                    paciente: appointment.paciente,
                    fecha: appointment.fecha,
                    hora: appointment.hora
                });

            } catch (error: any) {
                if (error?.code === 11000) {
                    // Error de duplicado
                    resultados.duplicados.push({
                        fila: numeroFila,
                        paciente: input.paciente,
                        fecha: input.fecha,
                        hora: input.hora,
                        error: 'Turno duplicado (ya existe en la base de datos)'
                    });
                } else {
                    // Otros errores
                    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                    resultados.errores.push({
                        fila: numeroFila,
                        error: errorMsg,
                        datos: input
                    });
                }
                console.error(`Error en fila ${numeroFila}:`, error);
            }
        }

        // Respuesta detallada
        const mensaje = [
            `Procesamiento completado.`,
            `Exitosos: ${resultados.exitosos.length}`,
            `Duplicados: ${resultados.duplicados.length}`,
            `Errores: ${resultados.errores.length}`
        ].join(' | ');

        res.json({
            message: mensaje,
            resultados: resultados
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

// Get appointment counts for tabs
router.get('/counts', async (req: Request, res: Response) => {
    try {
        const total = await AppointmentModel.countDocuments();
        const pending = await AppointmentModel.countDocuments({
            $and: [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ]
        });
        const notified = await AppointmentModel.countDocuments({
            $or: [
                { 'recordatorioEnviado.email': true },
                { 'recordatorioEnviado.whatsapp': true }
            ]
        });

        res.json({
            total,
            pending,
            notified
        });
    } catch (error) {
        console.error('Error fetching appointment counts:', error);
        res.status(500).json({ error: 'Error al obtener contadores de turnos' });
    }
});

// Get all appointments with search, filters and pagination
router.get('/', async (req: Request, res: Response) => {
    try {
        // Parámetros de query
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string || '';
        const estado = req.query.estado as string || '';
        const profesional = req.query.profesional as string || '';
        const especialidad = req.query.especialidad as string || '';
        const fechaDesde = req.query.fechaDesde as string || '';
        const fechaHasta = req.query.fechaHasta as string || '';
        const notificationStatus = req.query.notificationStatus as string || ''; // 'pending', 'notified', 'all'

        const skip = (page - 1) * limit;

        // Construir filtros
        const filters: any = {};

        // Filtro de búsqueda (busca en paciente, nroDoc, profesional)
        if (search) {
            filters.$or = [
                { paciente: { $regex: search, $options: 'i' } },
                { nroDoc: { $regex: search, $options: 'i' } },
                { profesional: { $regex: search, $options: 'i' } },
                { motivo: { $regex: search, $options: 'i' } }
            ];
        }

        // Filtros específicos
        if (estado) {
            filters.estado = estado;
        }

        if (profesional) {
            filters.profesional = { $regex: profesional, $options: 'i' };
        }

        if (especialidad) {
            filters.especialidad = { $regex: especialidad, $options: 'i' };
        }

        // Filtro de fechas
        if (fechaDesde || fechaHasta) {
            filters.fecha = {};
            if (fechaDesde) {
                filters.fecha.$gte = new Date(fechaDesde);
            }
            if (fechaHasta) {
                // Incluir todo el día hasta las 23:59:59
                const fechaHastaFin = new Date(fechaHasta);
                fechaHastaFin.setHours(23, 59, 59, 999);
                filters.fecha.$lte = fechaHastaFin;
            }
        }

        // Filtro de estado de notificación
        if (notificationStatus === 'pending') {
            filters.$and = [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ];
        } else if (notificationStatus === 'notified') {
            filters.$or = [
                { 'recordatorioEnviado.email': true },
                { 'recordatorioEnviado.whatsapp': true }
            ];
        }

        // Ejecutar consultas
        const [appointments, total] = await Promise.all([
            AppointmentModel.find(filters)
                .sort({ fecha: 1, hora: 1 })
                .skip(skip)
                .limit(limit),
            AppointmentModel.countDocuments(filters)
        ]);

        // Obtener datos para filtros (profesionales y especialidades únicos)
        const [profesionales, especialidades] = await Promise.all([
            AppointmentModel.distinct('profesional'),
            AppointmentModel.distinct('especialidad')
        ]);

        // Calcular información de paginación
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.json({
            appointments,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage,
                hasPrevPage
            },
            filterOptions: {
                profesionales: profesionales.filter(p => p && p.trim() !== '').sort(),
                especialidades: especialidades.filter(e => e && e.trim() !== '').sort()
            }
        });
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
                if (!appointment.email || appointment.email.trim() === '') {
                    return res.status(400).json({ error: 'Este turno no tiene email configurado' });
                }
                const emailService = new EmailService();
                await emailService.sendReminder(appointment);
                appointment.recordatorioEnviado.email = true;
                appointment.recordatorioEnviado.fechaEnvioEmail = new Date();
            } else if (tipo === 'whatsapp') {
                if (!appointment.telefono || appointment.telefono.trim() === '') {
                    return res.status(400).json({ error: 'Este turno no tiene teléfono configurado' });
                }
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

// Ruta temporal para enviar recordatorios a todos los turnos pendientes (sin filtrar por fecha ni hora)
router.post('/enviar-todos-pendientes', async (req: Request, res: Response) => {
    try {
        // Buscar turnos que no tengan recordatorio enviado por email ni whatsapp
        const pendientes = await AppointmentModel.find({
            $or: [
                { 'recordatorioEnviado.email': { $ne: true } },
                { 'recordatorioEnviado.whatsapp': { $ne: true } }
            ]
        });
        let enviados = 0;
        let errores = 0;
        
        for (const turno of pendientes) {
            try {
                // Enviar email si no fue enviado y tiene email válido
                if (!turno.recordatorioEnviado.email && turno.email && turno.email.trim() !== '') {
                    try {
                        const emailService = new EmailService();
                        await emailService.sendReminder(turno);
                        turno.recordatorioEnviado.email = true;
                        turno.recordatorioEnviado.fechaEnvioEmail = new Date();
                    } catch (emailError) {
                        console.error('Error enviando email:', emailError);
                        errores++;
                    }
                }
                
                // Enviar whatsapp si no fue enviado y tiene teléfono válido
                if (!turno.recordatorioEnviado.whatsapp && turno.telefono && turno.telefono.trim() !== '') {
                    try {
                        await WhatsAppService.sendReminder(turno);
                        turno.recordatorioEnviado.whatsapp = true;
                        turno.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                    } catch (whatsappError) {
                        console.error('Error enviando WhatsApp:', whatsappError);
                        errores++;
                    }
                }
                
                await turno.save();
                enviados++;
            } catch (err) {
                console.error('Error enviando recordatorio:', err);
                errores++;
            }
        }
        
        res.json({ 
            message: `Recordatorios enviados a ${enviados} turnos pendientes`, 
            total: pendientes.length,
            errores: errores
        });
    } catch (error) {
        console.error('Error enviando recordatorios masivos:', error);
        res.status(500).json({ error: 'Error al enviar recordatorios masivos' });
    }
});

export { router as appointmentRouter };
