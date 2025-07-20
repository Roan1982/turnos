import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Chip,
    Typography,
    Box,
    IconButton,
    Tooltip,
    Tabs,
    Tab
} from '@mui/material';
import {
    Email as EmailIcon,
    WhatsApp as WhatsAppIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Schedule as ScheduleIcon
} from '@mui/icons-material';
import axios from 'axios';

import { Appointment } from '../shared/types';

const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('es-AR');
};

const formatDateTime = (date: string | Date) => {
    // Mostrar en formato 24 horas
    return new Date(date).toLocaleString('es-AR', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

interface AppointmentTableProps {
    appointments?: Appointment[];
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ appointments: initialAppointments }: { appointments?: Appointment[] }) => {
    const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0); // 0: Todos, 1: Pendientes, 2: Notificados

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:3001/api/appointments');
            setAppointments(response.data);
            setError(null);
        } catch (err) {
            setError('Error al cargar los turnos');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    useEffect(() => {
        if (initialAppointments) {
            setAppointments(initialAppointments);
        }
    }, [initialAppointments]);

    const handleResendNotification = async (appointmentId: string, tipo: 'email' | 'whatsapp') => {
        try {
            setLoading(true);
            await axios.post(`http://localhost:3001/api/appointments/${appointmentId}/reenviar`, { tipo });
            await fetchAppointments(); // Recargar los datos
            setError(null);
        } catch (err) {
            setError(`Error al reenviar ${tipo}`);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Nueva función para enviar todos los pendientes con auto-refresh
    const handleSendAllPendientes = async () => {
        try {
            setLoading(true);
            await axios.post('http://localhost:3001/api/appointments/enviar-todos-pendientes');
            // Refrescar automáticamente la página después del envío
            await fetchAppointments();
            setError(null);
        } catch (err) {
            setError('Error al enviar todos los pendientes');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'confirmado':
                return 'success';
            case 'cancelado':
                return 'error';
            default:
                return 'warning';
        }
    };

    const renderNotificationStatus = (sent: boolean, date?: string | Date) => {
        if (sent && date) {
            return (
                <Tooltip title={`Enviado: ${formatDateTime(date)}`}>
                    <CheckCircleIcon color="success" />
                </Tooltip>
            );
        }
        return <ErrorIcon color="error" />;
    };

    // Función para filtrar turnos según la pestaña seleccionada
    const getFilteredAppointments = () => {
        switch (tabValue) {
            case 1: // Pendientes
                return appointments.filter(appointment => 
                    !appointment.recordatorioEnviado.email && !appointment.recordatorioEnviado.whatsapp
                );
            case 2: // Notificados
                return appointments.filter(appointment => 
                    appointment.recordatorioEnviado.email || appointment.recordatorioEnviado.whatsapp
                );
            default: // Todos
                return appointments;
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    if (loading) {
        return <Typography>Cargando turnos...</Typography>;
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    const filteredAppointments = getFilteredAppointments();

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Turnos y Estado de Notificaciones</Typography>
                <Box>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchAppointments()}
                        disabled={loading}
                        sx={{ mr: 1 }}
                    >
                        Actualizar
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleSendAllPendientes}
                        disabled={loading}
                        startIcon={<ScheduleIcon />}
                    >
                        Enviar todos los pendientes
                    </Button>
                </Box>
            </Box>

            {/* Pestañas para filtrar */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="Filtros de turnos">
                    <Tab label={`Todos (${appointments.length})`} />
                    <Tab label={`Pendientes (${appointments.filter(a => !a.recordatorioEnviado.email && !a.recordatorioEnviado.whatsapp).length})`} />
                    <Tab label={`Notificados (${appointments.filter(a => a.recordatorioEnviado.email || a.recordatorioEnviado.whatsapp).length})`} />
                </Tabs>
            </Box>
            
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Fecha del Turno</TableCell>
                            <TableCell>Fecha de Carga</TableCell>
                            <TableCell>Fecha de Envío</TableCell>
                            <TableCell>Hora</TableCell>
                            <TableCell>Paciente</TableCell>
                            <TableCell>Profesional</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>WhatsApp</TableCell>
                            <TableCell>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredAppointments.map((appointment: Appointment) => {
                            // Mostrar la fecha programada de envío (fechaEnvio)
                            let fechaEnvioProgramada = appointment.fechaEnvio ? formatDateTime(appointment.fechaEnvio) : '-';
                            return (
                                <TableRow key={appointment._id}>
                                    <TableCell>{formatDate(appointment.fecha)}</TableCell>
                                    <TableCell>{appointment.fechaCarga ? formatDateTime(appointment.fechaCarga) : '-'}</TableCell>
                                    <TableCell>{fechaEnvioProgramada}</TableCell>
                                    <TableCell>{appointment.hora}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{appointment.paciente}</Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {appointment.motivo}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{appointment.profesional}</Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {appointment.especialidad}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={appointment.estado}
                                            color={getStatusColor(appointment.estado)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {renderNotificationStatus(
                                            appointment.recordatorioEnviado.email,
                                            appointment.recordatorioEnviado.fechaEnvioEmail
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderNotificationStatus(
                                            appointment.recordatorioEnviado.whatsapp,
                                            appointment.recordatorioEnviado.fechaEnvioWhatsApp
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            onClick={() => handleResendNotification(appointment._id, 'email')}
                                            disabled={loading}
                                            size="small"
                                            color="primary"
                                        >
                                            <EmailIcon />
                                        </IconButton>
                                        <IconButton
                                            onClick={() => handleResendNotification(appointment._id, 'whatsapp')}
                                            disabled={loading}
                                            size="small"
                                            color="primary"
                                        >
                                            <WhatsAppIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
