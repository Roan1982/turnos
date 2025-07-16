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
    Tooltip
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
    return new Date(date).toLocaleString('es-AR');
};

interface AppointmentTableProps {
    appointments?: Appointment[];
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ appointments: initialAppointments }) => {
    const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    if (loading) {
        return <Typography>Cargando turnos...</Typography>;
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Turnos y Estado de Notificaciones</Typography>
                <Button
                    startIcon={<RefreshIcon />}
                    onClick={() => fetchAppointments()}
                    disabled={loading}
                >
                    Actualizar
                </Button>
            </Box>
            
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Fecha del Turno</TableCell>
                            <TableCell>Fecha de Carga</TableCell>
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
                        {appointments.map((appointment) => (
                            <TableRow key={appointment._id}>
                                <TableCell>{formatDate(appointment.fecha)}</TableCell>
                                <TableCell>{appointment.fechaCarga ? formatDateTime(appointment.fechaCarga) : '-'}</TableCell>
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
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
