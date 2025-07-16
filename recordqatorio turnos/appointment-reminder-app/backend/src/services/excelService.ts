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
                    const appointment = {
                        fecha: this.excelDateToJSDate(getField(row, 'Fecha')),
                        hora: getField(row, 'Hora')?.toString().trim() || '',
                        nroDoc: getField(row, 'Nro Doc')?.toString().trim() || '',
                        paciente: getField(row, 'Paciente')?.toString().trim() || '',
                        telefono: getField(row, 'Telefono')?.toString().trim() || '',
                        email: getField(row, 'Email')?.toString().trim() || '',
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
            // Si es string, intentamos primero el formato dd/mm/yyyy
            if (typeof excelDate === 'string') {
                const cleanDate = excelDate.trim();
                // Formato dd/mm/yyyy
                if (cleanDate.includes('/')) {
                    const parts = cleanDate.split('/');
                    if (parts.length === 3) {
                        const [day, month, yearRaw] = parts.map(Number);
                        if (!isNaN(day) && !isNaN(month) && !isNaN(yearRaw)) {
                            let fullYear = yearRaw;
                            if (yearRaw < 100) {
                                // Si es menor a 50, 20XX. Si es 50 o más, 19XX
                                fullYear = yearRaw < 50 ? 2000 + yearRaw : 1900 + yearRaw;
                            }
                            if (fullYear < 1950 || fullYear > 2100) {
                                throw new Error(`Año fuera de rango razonable: ${fullYear}`);
                            }
                            const date = new Date(fullYear, month - 1, day);
                            if (!isNaN(date.getTime())) {
                                return date;
                            }
                        }
                    }
                }
            }

            // Si es número, es un timestamp de Excel
            if (typeof excelDate === 'number') {
                const unixTimestamp = (excelDate - 25569) * 86400 * 1000;
                const date = new Date(unixTimestamp);
                return date;
            }

            // Último intento: parsear como fecha normal
            const date = new Date(excelDate);
            if (!isNaN(date.getTime())) {
                return date;
            }

            throw new Error(`Formato de fecha inválido: ${excelDate}`);
        } catch (error) {
            throw new Error(`Formato de fecha inválido: ${excelDate}`);
        }
    }
}
