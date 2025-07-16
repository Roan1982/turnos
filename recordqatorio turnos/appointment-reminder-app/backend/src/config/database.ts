import mongoose from 'mongoose';

export async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo:27017/appointments';
        await mongoose.connect(mongoUri);
        console.log('Conexión exitosa a MongoDB');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
        process.exit(1);
    }
}

mongoose.connection.on('disconnected', () => {
    console.log('Desconectado de MongoDB');
});

process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('Conexión a MongoDB cerrada');
        process.exit(0);
    } catch (error) {
        console.error('Error al cerrar la conexión:', error);
        process.exit(1);
    }
});
