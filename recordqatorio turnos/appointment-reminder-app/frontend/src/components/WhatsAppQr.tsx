import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';

export const WhatsAppQr: React.FC = () => {
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQr = async () => {
            try {
                setLoading(true);
                const response = await axios.get('http://localhost:3001/api/whatsapp/qr');
                setQr(response.data.qr);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.error || 'No se pudo obtener el QR.');
                setQr(null);
            } finally {
                setLoading(false);
            }
        };
        fetchQr();
    }, []);

    return (
        <Paper sx={{ p: 3, mt: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
                Escanea el código QR con WhatsApp
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
                Este QR es necesario para vincular el sistema y poder enviar recordatorios automáticos por WhatsApp. Abre WhatsApp en tu teléfono, ve a "Dispositivos vinculados" y escanea el código.
            </Typography>
            {loading && <CircularProgress sx={{ mt: 2 }} />}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {qr && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                    <img src={qr} alt="QR de WhatsApp" style={{ width: 256, height: 256 }} />
                </Box>
            )}
        </Paper>
    );
};
