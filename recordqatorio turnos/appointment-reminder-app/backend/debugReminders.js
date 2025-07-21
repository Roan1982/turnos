// Script para debug: muestra los turnos que deberían recibir recordatorio ahora
// Ejecutar dentro del contenedor backend con: node debugReminders.js

const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://mongo:27017/turnos'; // Ajusta si tu URI es diferente

const AppointmentSchema = new mongoose.Schema({
  fecha: Date,
  fechaEnvio: Date, // DEPRECATED - mantener por compatibilidad
  fechaEnvioEmail: Date, // Fecha para enviar email (72 horas antes)
  fechaEnvioWhatsApp: Date, // Fecha para enviar WhatsApp (48 horas antes)
  paciente: String,
  telefono: String,
  email: String,
  estado: String,
  recordatorioEnviado: {
    email: Boolean,
    whatsapp: Boolean,
    fechaEnvioEmail: Date,
    fechaEnvioWhatsApp: Date
  }
}, { collection: 'appointments' });

const Appointment = mongoose.model('Appointment', AppointmentSchema);

async function main() {
  await mongoose.connect(uri);
  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const end = new Date(now.getTime() + 5 * 60 * 1000);

  // Actualizar query para usar las nuevas fechas separadas
  const appointments = await Appointment.find({
    $or: [
      // Email pendiente y fecha de envío en rango
      { 
        'recordatorioEnviado.email': { $ne: true },
        fechaEnvioEmail: { $gte: start, $lte: end }
      },
      // WhatsApp pendiente y fecha de envío en rango
      { 
        'recordatorioEnviado.whatsapp': { $ne: true },
        fechaEnvioWhatsApp: { $gte: start, $lte: end }
      }
    ],
    estado: { $ne: 'cancelado' }
  });

  if (appointments.length === 0) {
    console.log('No hay turnos para enviar recordatorio en este rango de tiempo.');
    console.log('Rango de tiempo:', { start, end, now });
  } else {
    console.log('Turnos que deberían recibir recordatorio ahora:');
    appointments.forEach(a => {
      console.log({
        paciente: a.paciente,
        fecha: a.fecha,
        fechaEnvio: a.fechaEnvio, // mantener por compatibilidad
        fechaEnvioEmail: a.fechaEnvioEmail,
        fechaEnvioWhatsApp: a.fechaEnvioWhatsApp,
        email: a.email,
        telefono: a.telefono,
        estado: a.estado,
        recordatorioEnviado: a.recordatorioEnviado
      });
    });
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
