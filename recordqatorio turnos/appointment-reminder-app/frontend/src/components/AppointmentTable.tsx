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
    Tab,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Pagination,
    Card,
    CardContent,
    Collapse
} from '@mui/material';
import {
    Email as EmailIcon,
    WhatsApp as WhatsAppIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Schedule as ScheduleIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
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
    refreshTrigger?: number;
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ 
    appointments: initialAppointments, 
    refreshTrigger 
}: { 
    appointments?: Appointment[];
    refreshTrigger?: number;
}) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0); // 0: Todos, 1: Pendientes, 2: Notificados
    const [refreshing, setRefreshing] = useState(false);
    
    // Estados para búsqueda, filtros y paginación
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProfessional, setFilterProfessional] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterNotificationStatus, setFilterNotificationStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [showFilters, setShowFilters] = useState(false);
    
    // Opciones para filtros
    const [professionals, setProfessionals] = useState<string[]>([]);
    const [specialties, setSpecialties] = useState<string[]>([]);
    
    // Contadores para las pestañas
    const [tabCounts, setTabCounts] = useState({
        total: 0,
        pending: 0,
        notified: 0
    });

    // Effect para refrescar cuando cambie refreshTrigger
    useEffect(() => {
        if (refreshTrigger !== undefined) {
            console.log('🔄 Refrescando tabla por WebSocket trigger:', refreshTrigger);
            fetchAppointments();
            fetchTabCounts();
        }
    }, [refreshTrigger]);

    const fetchAppointments = async () => {
        try {
            setRefreshing(true);
            
            // Construir parámetros de consulta
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString()
            });
            
            if (searchTerm) params.append('search', searchTerm);
            if (filterProfessional) params.append('profesional', filterProfessional);
            if (filterSpecialty) params.append('especialidad', filterSpecialty);
            if (filterDateFrom) params.append('fechaDesde', filterDateFrom);
            if (filterDateTo) params.append('fechaHasta', filterDateTo);
            
            // Aplicar filtro de tab (tiene prioridad sobre filterNotificationStatus)
            switch (tabValue) {
                case 1: // Pendientes
                    params.append('notificationStatus', 'pending');
                    break;
                case 2: // Notificados
                    params.append('notificationStatus', 'sent');
                    break;
                default: // Todos
                    if (filterNotificationStatus) {
                        params.append('notificationStatus', filterNotificationStatus);
                    }
                    break;
            }
            
            const response = await axios.get(`http://localhost:3001/api/appointments?${params}`);
            
            // Asegurar que appointments sea siempre un array
            const appointmentsData = Array.isArray(response.data.appointments) ? response.data.appointments : [];
            setAppointments(appointmentsData);
            
            setTotalPages(response.data.pagination?.totalPages || 1);
            setTotalItems(response.data.pagination?.total || 0);
            
            // Actualizar opciones de filtros
            if (response.data.filterOptions) {
                setProfessionals(response.data.filterOptions.profesionales || []);
                setSpecialties(response.data.filterOptions.especialidades || []);
            }
            
            setError(null);
            console.log('Datos actualizados:', appointmentsData.length, 'turnos de', response.data.pagination?.total || 0, 'total');
        } catch (err) {
            setError('Error al cargar los turnos');
            console.error('Error:', err);
            // En caso de error, asegurar que appointments sea un array vacío
            setAppointments([]);
        } finally {
            setRefreshing(false);
        }
    };

    // Función para forzar actualización completa (sin filtros de tab)
    const forceRefreshAll = async () => {
        try {
            setRefreshing(true);
            
            // Primero obtener los contadores actualizados
            const countsResponse = await axios.get('http://localhost:3001/api/appointments/counts');
            setTabCounts(countsResponse.data);
            console.log('Contadores actualizados:', countsResponse.data);
            
            // Luego actualizar con la consulta actual
            await fetchAppointments();
            
        } catch (err) {
            console.error('Error al forzar actualización completa:', err);
            // Si falla, al menos intentar la actualización normal
            await fetchAppointments();
        }
    };

    // Función para obtener solo los contadores
    const fetchTabCounts = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/appointments/counts');
            setTabCounts(response.data);
            console.log('Solo contadores actualizados:', response.data);
        } catch (err) {
            console.error('Error al obtener contadores:', err);
        }
    };

    useEffect(() => {
        fetchAppointments();
        fetchTabCounts(); // Obtener contadores iniciales
    }, [currentPage, itemsPerPage, searchTerm, filterProfessional, filterSpecialty, filterDateFrom, filterDateTo, filterNotificationStatus, tabValue]);

    useEffect(() => {
        if (initialAppointments && Array.isArray(initialAppointments)) {
            setAppointments(initialAppointments);
        }
    }, [initialAppointments]);

    // Force re-render cuando cambian los appointments para actualizar contadores
    useEffect(() => {
        console.log('Appointments actualizados:', appointments.length);
    }, [appointments]);

    const handleResendNotification = async (appointmentId: string, tipo: 'email' | 'whatsapp') => {
        try {
            setLoading(true);
            setError(null);
            
            await axios.post(`http://localhost:3001/api/appointments/${appointmentId}/reenviar`, { tipo });
            
            // Esperar un momento para que se procese el envío
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Polling agresivo para asegurar actualización
            let attempts = 0;
            const maxAttempts = 5;
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await forceRefreshAll();
                await fetchTabCounts(); // Actualizar contadores también
                attempts++;
                console.log(`Intento de actualización ${attempts}/${maxAttempts} después de envío individual`);
            }
            
            console.log(`Recordatorio ${tipo} enviado y datos actualizados`);
            
        } catch (err) {
            setError(`Error al reenviar ${tipo}`);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Nueva función para enviar todos los pendientes con auto-refresh mejorado
    const handleSendAllPendientes = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Enviar recordatorios
            const response = await axios.post('http://localhost:3001/api/appointments/enviar-todos-pendientes');
            console.log('Respuesta del envío:', response.data);
            
            // Polling más agresivo para asegurar actualización
            let attempts = 0;
            const maxAttempts = 8;
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                await forceRefreshAll();
                await fetchTabCounts(); // Actualizar contadores también
                attempts++;
                console.log(`Intento de actualización ${attempts}/${maxAttempts} después de envío masivo`);
            }
            
            // Forzar un último refresh después de un delay adicional
            await new Promise(resolve => setTimeout(resolve, 2000));
            await forceRefreshAll();
            await fetchTabCounts();
            
            // Mostrar mensaje de éxito
            console.log('Recordatorios enviados y datos actualizados exitosamente');
            
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

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setCurrentPage(1); // Reset to first page when changing tabs
        // Limpiar el filtro de notificación cuando se cambia de pestaña para evitar conflictos
        setFilterNotificationStatus('');
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const handleFilterChange = (filterType: string, value: string) => {
        switch (filterType) {
            case 'professional':
                setFilterProfessional(value);
                break;
            case 'specialty':
                setFilterSpecialty(value);
                break;
            case 'dateFrom':
                setFilterDateFrom(value);
                break;
            case 'dateTo':
                setFilterDateTo(value);
                break;
            case 'notificationStatus':
                setFilterNotificationStatus(value);
                break;
        }
        setCurrentPage(1); // Reset to first page when filtering
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterProfessional('');
        setFilterSpecialty('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterNotificationStatus('');
        setCurrentPage(1);
    };

    if (loading && appointments.length === 0) {
        return <Typography>Cargando turnos...</Typography>;
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                    Turnos y Estado de Notificaciones
                    {refreshing && <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                        (Actualizando...)
                    </Typography>}
                </Typography>
                <Box>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={() => forceRefreshAll()}
                        disabled={loading || refreshing}
                        sx={{ mr: 1 }}
                    >
                        {refreshing ? 'Actualizando...' : 'Actualizar'}
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleSendAllPendientes}
                        disabled={loading || refreshing}
                        startIcon={<ScheduleIcon />}
                    >
                        {loading ? 'Enviando...' : 'Enviar todos los pendientes'}
                    </Button>
                </Box>
            </Box>

            {/* Buscador y botón de filtros */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                label="Buscar turnos..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                InputProps={{
                                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                                }}
                                placeholder="Buscar por paciente, profesional, especialidad..."
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Items por página</InputLabel>
                                <Select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    label="Items por página"
                                >
                                    <MenuItem value={10}>10</MenuItem>
                                    <MenuItem value={25}>25</MenuItem>
                                    <MenuItem value={50}>50</MenuItem>
                                    <MenuItem value={100}>100</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                onClick={() => setShowFilters(!showFilters)}
                                endIcon={<FilterIcon />}
                            >
                                Filtros avanzados
                            </Button>
                        </Grid>
                    </Grid>
                    
                    {/* Filtros avanzados */}
                    <Collapse in={showFilters}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Profesional</InputLabel>
                                        <Select
                                            value={filterProfessional}
                                            onChange={(e) => handleFilterChange('professional', e.target.value)}
                                            label="Profesional"
                                        >
                                            <MenuItem value="">Todos</MenuItem>
                                            {professionals.map((professional) => (
                                                <MenuItem key={professional} value={professional}>
                                                    {professional}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Especialidad</InputLabel>
                                        <Select
                                            value={filterSpecialty}
                                            onChange={(e) => handleFilterChange('specialty', e.target.value)}
                                            label="Especialidad"
                                        >
                                            <MenuItem value="">Todas</MenuItem>
                                            {specialties.map((specialty) => (
                                                <MenuItem key={specialty} value={specialty}>
                                                    {specialty}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Notificaciones</InputLabel>
                                        <Select
                                            value={filterNotificationStatus}
                                            onChange={(e) => handleFilterChange('notificationStatus', e.target.value)}
                                            label="Notificaciones"
                                        >
                                            <MenuItem value="">Todos</MenuItem>
                                            <MenuItem value="pending">Pendientes</MenuItem>
                                            <MenuItem value="sent">Notificados</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="Fecha desde"
                                        value={filterDateFrom}
                                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="Fecha hasta"
                                        value={filterDateTo}
                                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button
                                        variant="outlined"
                                        onClick={clearFilters}
                                        sx={{ mr: 1 }}
                                    >
                                        Limpiar filtros
                                    </Button>
                                    <Typography variant="body2" component="span" color="textSecondary">
                                        Mostrando {appointments.length} de {totalItems} turnos
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                </CardContent>
            </Card>

            {/* Pestañas para filtrar */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="Filtros de turnos">
                    <Tab label={`Todos (${tabCounts.total})`} />
                    <Tab label={`Pendientes (${tabCounts.pending})`} />
                    <Tab label={`Notificados (${tabCounts.notified})`} />
                </Tabs>
            </Box>
            
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Fecha del Turno</TableCell>
                            <TableCell>Fecha de Carga</TableCell>
                            <TableCell>Envío Email (72h)</TableCell>
                            <TableCell>Envío WhatsApp (48h)</TableCell>
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
                        {Array.isArray(appointments) && appointments.map((appointment: Appointment) => {
                            // Mostrar las fechas programadas de envío separadas
                            let fechaEnvioEmail = appointment.fechaEnvioEmail ? formatDateTime(appointment.fechaEnvioEmail) : '-';
                            let fechaEnvioWhatsApp = appointment.fechaEnvioWhatsApp ? formatDateTime(appointment.fechaEnvioWhatsApp) : '-';
                            return (
                                <TableRow key={appointment._id}>
                                    <TableCell>{formatDate(appointment.fecha)}</TableCell>
                                    <TableCell>{appointment.fechaCarga ? formatDateTime(appointment.fechaCarga) : '-'}</TableCell>
                                    <TableCell>{fechaEnvioEmail}</TableCell>
                                    <TableCell>{fechaEnvioWhatsApp}</TableCell>
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
                        {(!Array.isArray(appointments) || appointments.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={11} align="center">
                                    <Typography variant="body2" color="textSecondary">
                                        No hay turnos para mostrar
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Paginación */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={(event: any, page: number) => setCurrentPage(page)}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                />
            </Box>
        </Box>
    );
};
