import * as XLSX from 'xlsx';
import { AppointmentInput } from '../models/appointment';

export class ExcelService {
    static parseExcelFile(buffer: Buffer): AppointmentInput[] {
        try {
            console.log('Iniciando procesamiento de archivo Excel...');
            // Normalizar encabezados para comparación flexible
            const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
            
            // Leer el archivo Excel
            let workbook;
            try {
                workbook = XLSX.read(buffer, { type: 'buffer' });
                console.log('Archivo Excel leído correctamente');
            } catch (error) {
                console.error('Error al leer el archivo Excel:', error);
                throw new Error('El archivo no es un archivo Excel válido');
            }
            
            if (!workbook.SheetNames.length) {
                console.error('Error: El archivo Excel está vacío');
                throw new Error('El archivo Excel está vacío');
            }

            console.log('Hojas encontradas:', workbook.SheetNames);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convertir a JSON con opciones específicas
        const data = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: '',
            dateNF: 'dd/mm/yyyy',
            header: 1, // Usar la primera fila como encabezados
            blankrows: false
        });

        // Si la primera fila es un array, convertir a objetos usando los encabezados
        let rows: any[] = [];
        if (Array.isArray(data) && Array.isArray(data[0])) {
            const headers = data[0].map((h: any) => h?.toString().trim());
            for (let i = 1; i < data.length; i++) {
                const obj: any = {};
                for (let j = 0; j < headers.length; j++) {
                    obj[headers[j]] = data[i][j];
                }
                rows.push(obj);
            }
            // Validar columnas requeridas usando los headers reales
            const requiredColumns = ['Fecha', 'Hora', 'Nro Doc', 'Paciente', 'Telefono', 'Email', 'Confirma', 'Motivo', 'Profesional', 'Especialidad'];
            const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
            const normalizedHeaders = headers.map(normalize);
            const normalizedRequired = requiredColumns.map(normalize);
            const missingColumns = normalizedRequired.filter(col => !normalizedHeaders.includes(col));
            if (missingColumns.length > 0) {
                const missingOriginal = requiredColumns.filter((col, i) => missingColumns.includes(normalizedRequired[i]));
                console.error('Columnas faltantes:', missingOriginal);
                throw new Error(`Faltan las siguientes columnas: ${missingOriginal.join(', ')}`);
            }
        } else {
            rows = data;
            // Validar columnas requeridas usando las llaves del primer objeto
            if (rows.length > 0) {
                const requiredColumns = ['Fecha', 'Hora', 'Nro Doc', 'Paciente', 'Telefono', 'Email', 'Confirma', 'Motivo', 'Profesional', 'Especialidad'];
                const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
                const headers = Object.keys(rows[0]);
                const normalizedHeaders = headers.map(normalize);
                const normalizedRequired = requiredColumns.map(normalize);
                const missingColumns = normalizedRequired.filter(col => !normalizedHeaders.includes(col));
                if (missingColumns.length > 0) {
                    const missingOriginal = requiredColumns.filter((col, i) => missingColumns.includes(normalizedRequired[i]));
                    console.error('Columnas faltantes:', missingOriginal);
                    throw new Error(`Faltan las siguientes columnas: ${missingOriginal.join(', ')}`);
                }
            }
        }

            if (!data.length) {
                console.error('No hay datos en la primera hoja del Excel');
                throw new Error('No hay datos en la primera hoja del Excel');
            }

            // Procesar cada fila con acceso flexible a los campos
        const appointments = rows.map((row: any, index: number) => {
                try {
                    console.log(`Procesando fila ${index + 1}:`, row);

                    // Acceso flexible a los campos
                    const getField = (row: any, name: string) => {
                        const keys = Object.keys(row);
                        const normalizedName = normalize(name);
                        const foundKey = keys.find(k => normalize(k) === normalizedName);
                        return foundKey ? row[foundKey] : '';
                    };

                    // Validar datos obligatorios
                    if (!getField(row, 'Fecha')?.toString().trim()) {
                        throw new Error('Falta la fecha');
                    }
                    if (!getField(row, 'Hora')?.toString().trim()) {
                        throw new Error('Falta la hora');
                    }
                    if (!getField(row, 'Paciente')?.toString().trim()) {
                        throw new Error('Falta el nombre del paciente');
                    }
                    // Validar que al menos uno de los campos 'email' o 'telefono' esté presente
                    const emailValue = getField(row, 'Email')?.toString().trim();
                    const telefonoValue = getField(row, 'Telefono')?.toString().trim();
                    if (!emailValue && !telefonoValue) {
                        throw new Error('Debe completar al menos Email o Telefono');
                    }

                    // Crear el objeto de turno
                    // Combinar fecha y hora en un solo Date
                    const fechaBase = this.excelDateToJSDate(getField(row, 'Fecha'));
                    const horaStr = getField(row, 'Hora')?.toString().trim() || '00:00';
                    const [h, m] = horaStr.split(':').map(Number);
                    // Crear fechaTurno exacta
                    const fechaTurno = new Date(Date.UTC(
                        fechaBase.getUTCFullYear(),
                        fechaBase.getUTCMonth(),
                        fechaBase.getUTCDate(),
                        h || 0,
                        m || 0,
                        0,
                        0
                    ));
                    
                    // Crear appointment con campos opcionales manejados correctamente
                    const appointment: any = {
                        fecha: fechaTurno, // fecha y hora exacta del Excel
                        fechaCarga: new Date(),
                        hora: horaStr,
                        nroDoc: getField(row, 'Nro Doc')?.toString().trim() || '',
                        paciente: getField(row, 'Paciente')?.toString().trim() || '',
                        confirma: getField(row, 'Confirma')?.toString().trim() || '',
                        motivo: getField(row, 'Motivo')?.toString().trim() || '',
                        profesional: getField(row, 'Profesional')?.toString().trim() || '',
                        especialidad: getField(row, 'Especialidad')?.toString().trim() || '',
                        recordatorioEnviado: {
                            email: false,
                            whatsapp: false
                        },
                        estado: "pendiente" as "pendiente"
                    };
                    
                    // Solo agregar email si tiene valor válido
                    if (emailValue && emailValue.length > 0) {
                        appointment.email = emailValue;
                    }
                    
                    // Solo agregar teléfono si tiene valor válido
                    if (telefonoValue && telefonoValue.length > 0) {
                        appointment.telefono = telefonoValue;
                    }

                    console.log(`Fila ${index + 1} procesada correctamente:`, appointment);
                    return appointment;
                } catch (error) {
                    console.error(`Error procesando fila ${index + 1}:`, error);
                    if (error instanceof Error) {
                        throw new Error(`Error en la fila ${index + 1}: ${error.message}`);
                    } else {
                        throw new Error(`Error desconocido en la fila ${index + 1}`);
                    }
                }
            });

            console.log(`Procesamiento completado. Total de turnos: ${appointments.length}`);
            return appointments;

        } catch (error) {
            console.error('Error en parseExcelFile:', error);
            if (error instanceof Error) {
                throw new Error(`Error al procesar el archivo Excel: ${error.message}`);
            }
            throw new Error('Error desconocido al procesar el archivo Excel');
        }
    }

    private static excelDateToJSDate(excelDate: string | number): Date {
        try {
            // Si ya es un objeto Date, devolverlo tal cual (TypeScript compatible)
            if (typeof excelDate === 'object' && excelDate !== null && Object.prototype.toString.call(excelDate) === '[object Date]' && !isNaN((excelDate as Date).getTime())) {
                return excelDate as Date;
            }
            if (typeof excelDate === 'string') {
                const cleanDate = (excelDate as string).trim().replace(/-/g, '/');
                // Soporta d/m/yyyy, m/d/yyyy, d/m/yy, m/d/yy
                const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
                const match = cleanDate.match(regex);
                if (match) {
                    let a = parseInt(match[1], 10);
                    let b = parseInt(match[2], 10);
                    let yearRaw = parseInt(match[3], 10);
                    let fullYear = yearRaw;
                    if (yearRaw < 100) {
                        fullYear = yearRaw < 50 ? 2000 + yearRaw : 1900 + yearRaw;
                    }
                    if (fullYear < 1950 || fullYear > 2100) {
                        throw new Error(`Año fuera de rango razonable: ${fullYear}`);
                    }
                    // Si el primer número es mayor a 12, seguro es día/mes/año
                    // Si el segundo número es mayor a 12, seguro es mes/día/año (raro en español)
                    // Si ambos <= 12, priorizamos día/mes/año (por uso en Argentina)
                    let day, month;
                    if (a > 12) {
                        day = a; month = b;
                    } else if (b > 12) {
                        day = b; month = a;
                    } else {
                        day = a; month = b;
                    }
                    // Usar Date.UTC para evitar desfase horario
                    const date = new Date(Date.UTC(fullYear, month - 1, day));
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }

            if (typeof excelDate === 'number') {
                // Excel almacena fechas como días desde 1900-01-01
                // Usar Date.UTC para evitar desfase horario
                const excelEpoch = Date.UTC(1899, 11, 30);
                const ms = excelEpoch + Number(excelDate) * 86400000;
                const date = new Date(ms);
                return date;
            }

            const date = new Date(excelDate as any);
            if (!isNaN(date.getTime())) {
                return date;
            }

            throw new Error(`Formato de fecha inválido: ${excelDate}`);
        } catch (error) {
            throw new Error(`Formato de fecha inválido: ${excelDate}`);
        }
    }
}
