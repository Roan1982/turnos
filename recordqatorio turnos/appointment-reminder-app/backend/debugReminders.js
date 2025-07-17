// Script para debug: muestra los turnos que deberían recibir recordatorio ahora
// Ejecutar dentro del contenedor backend con: node debugReminders.js

const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://mongo:27017/turnos'; // Ajusta si tu URI es diferente

const AppointmentSchema = new mongoose.Schema({
  fecha: Date,
  fechaEnvio: Date,
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

  const appointments = await Appointment.find({
    fechaEnvio: { $gte: start, $lte: end },
    $or: [
      { 'recordatorioEnviado.email': { $ne: true } },
      { 'recordatorioEnviado.whatsapp': { $ne: true } }
    ],
    estado: { $ne: 'cancelado' }
  });

  if (appointments.length === 0) {
    console.log('No hay turnos para enviar recordatorio en este rango de tiempo.');
  } else {
    console.log('Turnos que deberían recibir recordatorio ahora:');
    appointments.forEach(a => {
      console.log({
        paciente: a.paciente,
        fecha: a.fecha,
        fechaEnvio: a.fechaEnvio,
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
