import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Paper, Typography, Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileUpload(acceptedFiles[0]);
        }
    }, [onFileUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false
    });

    return (
        <Paper
            {...getRootProps()}
            sx={{
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? '#f0f0f0' : 'white',
                border: '2px dashed #cccccc'
            }}
        >
            <input {...getInputProps()} />
            <Box sx={{ mb: 2 }}>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" gutterBottom>
                {isDragActive
                    ? 'Suelta el archivo aquí'
                    : 'Arrastra y suelta un archivo Excel aquí'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
                o haz clic para seleccionar un archivo
            </Typography>
        </Paper>
    );
};
