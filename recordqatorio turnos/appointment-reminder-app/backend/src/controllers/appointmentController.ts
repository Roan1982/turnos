import express, { Request, Response } from 'express';
import multer from 'multer';
import { ExcelService } from '../services/excelService';
import { AppointmentModel, Appointment, AppointmentInput } from '../models/appointment';
import { EmailService } from '../services/emailService';
import { WhatsAppService } from '../services/whatsappService';
import SocketService from '../services/socketService';

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
const socketService = SocketService.getInstance();

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

                // Calcular fechas de envío separadas si no existen
                if ((!input.fechaEnvioEmail || !input.fechaEnvioWhatsApp) && input.fecha && input.hora) {
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
                    
                    // Calcular fechaEnvioEmail: 72 horas antes del turno
                    if (!input.fechaEnvioEmail) {
                        const fechaEnvioEmail = new Date(fechaTurno.getTime() - 72 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
                        input.fechaEnvioEmail = fechaEnvioEmail;
                    }
                    
                    // Calcular fechaEnvioWhatsApp: 48 horas antes del turno
                    if (!input.fechaEnvioWhatsApp) {
                        const fechaEnvioWhatsApp = new Date(fechaTurno.getTime() - 48 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
                        input.fechaEnvioWhatsApp = fechaEnvioWhatsApp;
                    }
                    
                    // Mantener fechaEnvio por compatibilidad (usar la del email)
                    input.fechaEnvio = input.fechaEnvioEmail;
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
            console.log('Aplicando filtro PENDIENTES:', filters);
        } else if (notificationStatus === 'sent') {
            filters.$or = [
                { 'recordatorioEnviado.email': true },
                { 'recordatorioEnviado.whatsapp': true }
            ];
            console.log('Aplicando filtro NOTIFICADOS:', filters);
        }

        console.log('Filtros finales aplicados:', JSON.stringify(filters, null, 2));
        console.log('Parámetros de consulta recibidos:', { page, limit, search, profesional, especialidad, notificationStatus });

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

        console.log(`Resultados encontrados: ${appointments.length} de ${total} total`);
        console.log('Muestra de appointments:', appointments.slice(0, 2).map((a: any) => ({
            paciente: a.paciente,
            emailEnviado: a.recordatorioEnviado.email,
            whatsappEnviado: a.recordatorioEnviado.whatsapp
        })));

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
                profesionales: profesionales.filter((p: any) => p && p.trim() !== '').sort(),
                especialidades: especialidades.filter((e: any) => e && e.trim() !== '').sort()
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
                
                // Notificar vía WebSocket
                socketService.emitReminderSent(appointment._id.toString(), 'email', appointment.paciente);
            } else if (tipo === 'whatsapp') {
                if (!appointment.telefono || appointment.telefono.trim() === '') {
                    return res.status(400).json({ error: 'Este turno no tiene teléfono configurado' });
                }
                await WhatsAppService.sendReminder(appointment);
                appointment.recordatorioEnviado.whatsapp = true;
                appointment.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                
                // Notificar vía WebSocket
                socketService.emitReminderSent(appointment._id.toString(), 'whatsapp', appointment.paciente);
            }
            
            // Cambiar estado a 'notificado' si se envió el recordatorio y no está cancelado
            if (appointment.estado !== 'cancelado') {
                appointment.estado = 'notificado';
                console.log(`[REENVIO] Estado cambiado a 'notificado' para ${appointment.paciente} (${tipo})`);
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
        
        // Emitir actualización del turno vía WebSocket
        socketService.emitAppointmentUpdate(appointment._id.toString(), {
            estado: appointment.estado,
            recordatorioEnviado: appointment.recordatorioEnviado
        });
        
        // Actualizar contadores y emitir vía WebSocket
        const [total, pending, notified] = await Promise.all([
            AppointmentModel.countDocuments(),
            AppointmentModel.countDocuments({
                $and: [
                    { 'recordatorioEnviado.email': { $ne: true } },
                    { 'recordatorioEnviado.whatsapp': { $ne: true } }
                ]
            }),
            AppointmentModel.countDocuments({
                $or: [
                    { 'recordatorioEnviado.email': true },
                    { 'recordatorioEnviado.whatsapp': true }
                ]
            })
        ]);
        
        socketService.emitCountsUpdate({ total, pending, notified });
        
        res.json({ message: `Recordatorio por ${tipo} enviado correctamente`, appointment });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Error al enviar el recordatorio' });
    }
});

// Ruta temporal para enviar recordatorios a todos los turnos pendientes (respetando fechas de envío)
router.post('/enviar-todos-pendientes', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        
        // Buscar turnos que no tengan recordatorio enviado y estén en tiempo de envío
        const pendientes = await AppointmentModel.find({
            $or: [
                // Email pendiente y fecha pasada o muy cercana
                { 
                    'recordatorioEnviado.email': { $ne: true },
                    fechaEnvioEmail: { $lte: now }
                },
                // WhatsApp pendiente y fecha pasada o muy cercana
                { 
                    'recordatorioEnviado.whatsapp': { $ne: true },
                    fechaEnvioWhatsApp: { $lte: now }
                }
            ],
            estado: { $ne: 'cancelado' }
        });
        
        let enviados = 0;
        let errores = 0;
        
        for (const turno of pendientes) {
            try {
                let recordatorioEnviado = false;
                
                // Enviar email si no fue enviado, tiene email válido y está en tiempo
                if (!turno.recordatorioEnviado.email && turno.email && turno.email.trim() !== '' &&
                    turno.fechaEnvioEmail && turno.fechaEnvioEmail <= now) {
                    try {
                        const emailService = new EmailService();
                        await emailService.sendReminder(turno);
                        turno.recordatorioEnviado.email = true;
                        turno.recordatorioEnviado.fechaEnvioEmail = new Date();
                        recordatorioEnviado = true;
                        console.log(`[MANUAL] Email enviado a ${turno.email} para ${turno.paciente}`);
                        
                        // Notificar vía WebSocket
                        socketService.emitReminderSent(turno._id.toString(), 'email', turno.paciente);
                    } catch (emailError) {
                        console.error('Error enviando email:', emailError);
                        errores++;
                    }
                }
                
                // Enviar whatsapp si no fue enviado, tiene teléfono válido y está en tiempo
                if (!turno.recordatorioEnviado.whatsapp && turno.telefono && turno.telefono.trim() !== '' &&
                    turno.fechaEnvioWhatsApp && turno.fechaEnvioWhatsApp <= now) {
                    try {
                        await WhatsAppService.sendReminder(turno);
                        turno.recordatorioEnviado.whatsapp = true;
                        turno.recordatorioEnviado.fechaEnvioWhatsApp = new Date();
                        recordatorioEnviado = true;
                        console.log(`[MANUAL] WhatsApp enviado a ${turno.telefono} para ${turno.paciente}`);
                        
                        // Notificar vía WebSocket
                        socketService.emitReminderSent(turno._id.toString(), 'whatsapp', turno.paciente);
                    } catch (whatsappError) {
                        console.error('Error enviando WhatsApp:', whatsappError);
                        errores++;
                    }
                }
                
                // Si se envió al menos un recordatorio, cambiar estado a 'notificado'
                if (recordatorioEnviado && turno.estado !== 'cancelado') {
                    turno.estado = 'notificado';
                    console.log(`[MANUAL] Estado cambiado a 'notificado' para ${turno.paciente}`);
                }
                
                await turno.save();
                enviados++;
            } catch (err) {
                console.error('Error enviando recordatorio:', err);
                errores++;
            }
        }
        
        // Emitir actualización masiva vía WebSocket
        socketService.emitBulkUpdate(enviados, errores);
        
        // Actualizar contadores finales
        const [total, pending, notified] = await Promise.all([
            AppointmentModel.countDocuments(),
            AppointmentModel.countDocuments({
                $and: [
                    { 'recordatorioEnviado.email': { $ne: true } },
                    { 'recordatorioEnviado.whatsapp': { $ne: true } }
                ]
            }),
            AppointmentModel.countDocuments({
                $or: [
                    { 'recordatorioEnviado.email': true },
                    { 'recordatorioEnviado.whatsapp': true }
                ]
            })
        ]);
        
        socketService.emitCountsUpdate({ total, pending, notified });
        
        res.json({ 
            message: `Recordatorios procesados para ${enviados} turnos pendientes`, 
            total: pendientes.length,
            errores: errores,
            info: "Se respetaron las fechas de envío: Email (72h antes), WhatsApp (48h antes)"
        });
    } catch (error) {
        console.error('Error enviando recordatorios masivos:', error);
        res.status(500).json({ error: 'Error al enviar recordatorios masivos' });
    }
});

// Ruta para verificar la consistencia de fechas de envío
router.get('/verify-send-dates', async (req: Request, res: Response) => {
    try {
        const stats = {
            total: 0,
            conFechaEnvioEmail: 0,
            conFechaEnvioWhatsApp: 0,
            sinFechaEnvioEmail: 0,
            sinFechaEnvioWhatsApp: 0,
            conFechaEnvioDeprecated: 0,
            inconsistentes: [] as any[]
        };

        const turnos = await AppointmentModel.find({});
        stats.total = turnos.length;

        for (const turno of turnos) {
            if (turno.fechaEnvioEmail) stats.conFechaEnvioEmail++;
            else stats.sinFechaEnvioEmail++;

            if (turno.fechaEnvioWhatsApp) stats.conFechaEnvioWhatsApp++;
            else stats.sinFechaEnvioWhatsApp++;

            if (turno.fechaEnvio) stats.conFechaEnvioDeprecated++;

            // Verificar inconsistencias
            if (turno.fecha) {
                const fechaTurno = new Date(turno.fecha);
                const expectedEmailDate = new Date(fechaTurno.getTime() - 72 * 60 * 60 * 1000);
                const expectedWhatsAppDate = new Date(fechaTurno.getTime() - 48 * 60 * 60 * 1000);

                if (turno.fechaEnvioEmail && Math.abs(turno.fechaEnvioEmail.getTime() - expectedEmailDate.getTime()) > 60000) {
                    stats.inconsistentes.push({
                        id: turno._id,
                        paciente: turno.paciente,
                        tipo: 'email',
                        fechaEsperada: expectedEmailDate,
                        fechaActual: turno.fechaEnvioEmail
                    });
                }

                if (turno.fechaEnvioWhatsApp && Math.abs(turno.fechaEnvioWhatsApp.getTime() - expectedWhatsAppDate.getTime()) > 60000) {
                    stats.inconsistentes.push({
                        id: turno._id,
                        paciente: turno.paciente,
                        tipo: 'whatsapp',
                        fechaEsperada: expectedWhatsAppDate,
                        fechaActual: turno.fechaEnvioWhatsApp
                    });
                }
            }
        }

        res.json({
            message: 'Verificación de consistencia completada',
            stats,
            recomendaciones: {
                ...(stats.sinFechaEnvioEmail > 0 && { email: `${stats.sinFechaEnvioEmail} turnos sin fecha de envío de email` }),
                ...(stats.sinFechaEnvioWhatsApp > 0 && { whatsapp: `${stats.sinFechaEnvioWhatsApp} turnos sin fecha de envío de WhatsApp` }),
                ...(stats.inconsistentes.length > 0 && { inconsistencias: `${stats.inconsistentes.length} turnos con fechas inconsistentes` })
            }
        });
    } catch (error) {
        console.error('Error en verificación:', error);
        res.status(500).json({ error: 'Error al verificar fechas de envío' });
    }
});

// Ruta para migrar turnos existentes a las nuevas fechas de envío
router.post('/migrate-send-dates', async (req: Request, res: Response) => {
    try {
        // Buscar turnos que no tengan las nuevas fechas de envío
        const turnosSinFechas = await AppointmentModel.find({
            $or: [
                { fechaEnvioEmail: { $exists: false } },
                { fechaEnvioWhatsApp: { $exists: false } }
            ]
        });

        let migrados = 0;
        let errores = 0;

        for (const turno of turnosSinFechas) {
            try {
                let needsSave = false;

                if (!turno.fechaEnvioEmail && turno.fecha) {
                    // Calcular fechaEnvioEmail: 72 horas antes del turno
                    turno.fechaEnvioEmail = new Date(new Date(turno.fecha).getTime() - 72 * 60 * 60 * 1000);
                    needsSave = true;
                }

                if (!turno.fechaEnvioWhatsApp && turno.fecha) {
                    // Calcular fechaEnvioWhatsApp: 48 horas antes del turno
                    turno.fechaEnvioWhatsApp = new Date(new Date(turno.fecha).getTime() - 48 * 60 * 60 * 1000);
                    needsSave = true;
                }

                // Mantener fechaEnvio por compatibilidad (usar la del email)
                if (!turno.fechaEnvio && turno.fechaEnvioEmail) {
                    turno.fechaEnvio = turno.fechaEnvioEmail;
                    needsSave = true;
                }

                if (needsSave) {
                    await turno.save();
                    migrados++;
                    console.log(`[MIGRACIÓN] Migrado turno de ${turno.paciente}: Email ${turno.fechaEnvioEmail}, WhatsApp ${turno.fechaEnvioWhatsApp}`);
                }
            } catch (error) {
                console.error(`Error migrando turno ${turno._id}:`, error);
                errores++;
            }
        }

        res.json({
            message: `Migración completada`,
            totalEncontrados: turnosSinFechas.length,
            migrados,
            errores,
            info: "Se calcularon las fechas de envío para turnos existentes: Email (72h antes), WhatsApp (48h antes)"
        });
    } catch (error) {
        console.error('Error en migración:', error);
        res.status(500).json({ error: 'Error al migrar fechas de envío' });
    }
});

export { router as appointmentRouter };
