import React, { useState } from 'react';
import { WhatsAppQr } from './components/WhatsAppQr';
import { Container, Typography, Box, Alert, Tabs, Tab } from '@mui/material';
import { FileUpload } from './components/FileUpload';
import { AppointmentTable } from './components/AppointmentTable';
import axios from 'axios';

import { Appointment } from './shared/types';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function App() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);

    const handleFileUpload = async (file: File) => {
        try {
            console.log('Subiendo archivo:', file.name);
            console.log('Tipo de archivo:', file.type);
            console.log('Tamaño:', file.size);

            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post('http://localhost:3001/api/appointments/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log('Respuesta del servidor:', response.data);

            if (response.data.appointments && Array.isArray(response.data.appointments)) {
                setAppointments(response.data.appointments);
                setError(null);
                // Cambiar a la pestaña de turnos después de una carga exitosa
                setTabValue(1);
            } else {
                setError('La respuesta del servidor no tiene el formato esperado');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || 'Error al procesar el archivo. Por favor, verifica que sea un archivo Excel válido.';
            setError(errorMessage);
            console.error('Error:', err);
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
                Sistema de Recordatorio de Turnos
            </Typography>

            {/* Mostrar el QR de WhatsApp arriba de las pestañas */}
            <WhatsAppQr />

            <Box sx={{ width: '100%', mt: 4 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange}>
                        <Tab label="Importar Turnos" />
                        <Tab label="Ver Turnos" />
                    </Tabs>
                </Box>
                
                <TabPanel value={tabValue} index={0}>
                    <FileUpload onFileUpload={handleFileUpload} />
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <AppointmentTable appointments={appointments} />
                </TabPanel>
            </Box>
        </Container>
    );
}

export default App;
