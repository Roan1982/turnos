import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography
} from '@mui/material';

interface Appointment {
    fecha: string;
    hora: string;
    nroDoc: string;
    paciente: string;
    telefono: string;
    email: string;
    confirma?: string;
    motivo: string;
    profesional: string;
    especialidad: string;
}

interface AppointmentListProps {
    appointments: Appointment[];
}

export const AppointmentList: React.FC<AppointmentListProps> = ({ appointments }) => {
    if (appointments.length === 0) {
        return (
            <Typography variant="body1" sx={{ mt: 2 }}>
                No hay turnos cargados
            </Typography>
        );
    }

    return (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Hora</TableCell>
                        <TableCell>Paciente</TableCell>
                        <TableCell>DNI</TableCell>
                        <TableCell>Teléfono</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Motivo</TableCell>
                        <TableCell>Profesional</TableCell>
                        <TableCell>Especialidad</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {appointments.map((appointment, index) => (
                        <TableRow key={index}>
                            <TableCell>{appointment.fecha}</TableCell>
                            <TableCell>{appointment.hora}</TableCell>
                            <TableCell>{appointment.paciente}</TableCell>
                            <TableCell>{appointment.nroDoc}</TableCell>
                            <TableCell>{appointment.telefono}</TableCell>
                            <TableCell>{appointment.email}</TableCell>
                            <TableCell>{appointment.motivo}</TableCell>
                            <TableCell>{appointment.profesional}</TableCell>
                            <TableCell>{appointment.especialidad}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};
