import React, { useEffect, useState } from 'react';
import { Box, Typography, Modal, CircularProgress, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import axios from 'axios';

interface WhatsAppQrModalProps {
    open: boolean;
    onClose: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({ open, onClose }) => {
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Refresca el QR cada 5 segundos mientras el modal está abierto
    useEffect(() => {
        let interval: NodeJS.Timeout;
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
        if (open) {
            fetchQr();
            interval = setInterval(fetchQr, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [open]);

    return (
        <Modal open={open} onClose={onClose} aria-labelledby="modal-qr-title" >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 370,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: 24,
                p: 4,
                outline: 'none',
                textAlign: 'center',
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Box>
                <WhatsAppIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                <Typography id="modal-qr-title" variant="h6" gutterBottom>
                    Vincular WhatsApp
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Escaneá este QR desde WhatsApp en tu teléfono ("Dispositivos vinculados").
                </Typography>
                {loading && <CircularProgress sx={{ mt: 2 }} />}
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                {qr && (
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <img src={qr} alt="QR de WhatsApp" style={{ width: 256, height: 256 }} />
                    </Box>
                )}
            </Box>
        </Modal>
    );
};
