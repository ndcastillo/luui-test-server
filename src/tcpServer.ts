// src/tcpServer.ts
import net from 'net';
import { parseGPSData } from './protocolParser'; // Lo crearemos después
import { registerDevice, unregisterDevice, getDeviceSocket, updateDeviceData } from './deviceManager'; // Lo crearemos después

const TCP_PORT = 5093; // Puerto que usan tus dispositivos (ajusta si es necesario)
const HOST = '0.0.0.0';

// Un buffer simple por conexión para manejar datos fragmentados
const connectionBuffers: Map<net.Socket, string> = new Map();

const server = net.createServer((socket) => {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] Nuevo dispositivo conectado: ${remoteAddress}`);
    connectionBuffers.set(socket, ''); // Inicializar buffer para esta conexión

    socket.on('data', (data) => {
        const rawDataHex = data.toString('hex'); // Convertir a hexadecimal para visualización/debugging
        console.log(`[TCP] Datos recibidos de ${remoteAddress} (HEX): ${rawDataHex}`);
        
        let currentBuffer = connectionBuffers.get(socket) || '';
        currentBuffer += data.toString('ascii'); // Asumimos ASCII por ahora para el parseo del protocolo

        // Bucle para procesar todos los mensajes completos en el buffer
        // El protocolo usa '[' y ']' para enmarcar mensajes
        let messageEndIndex;
        while ((messageEndIndex = currentBuffer.indexOf(']')) !== -1) {
            const messageStartIndex = currentBuffer.indexOf('[');
            if (messageStartIndex === -1 || messageStartIndex > messageEndIndex) {
                // No hay un inicio de mensaje válido antes del fin, o está corrupto.
                // Descartar datos hasta el fin del mensaje actual para evitar bucles infinitos.
                console.warn(`[TCP] Datos corruptos o mal enmarcados recibidos de ${remoteAddress}. Buffer: ${currentBuffer.substring(0, messageEndIndex + 1)}`);
                currentBuffer = currentBuffer.substring(messageEndIndex + 1);
                continue;
            }

            const fullMessage = currentBuffer.substring(messageStartIndex, messageEndIndex + 1);
            console.log(`[TCP] Mensaje completo extraído de ${remoteAddress}: ${fullMessage}`);
            
            try {
                const parsed = parseGPSData(fullMessage); // Implementar esta función
                if (parsed) {
                    console.log(`[TCP] Datos parseados: `, parsed);
                    
                    // Registrar el dispositivo si es el primer mensaje o necesario
                    // Usaremos el Device ID para registrar el socket
                    if (parsed.deviceId) {
                        registerDevice(parsed.deviceId, socket);
                    }

                    // Lógica de manejo de comandos
                    switch (parsed.commandType) {
                        case 'LK': // Link Keep (Heartbeat)
                            // El dispositivo espera una respuesta para el LK
                            // Ejemplo: [CS*DEVICE_ID*LEN*LK]
                            // La longitud de "LK" es 2. "0002" en ASCII.
                            // El formato exacto de la respuesta puede variar ligeramente según el fabricante.
                            // Asumimos que el fabricante "CS" es el que responde.
                            const lkResponse = `[CS*${parsed.deviceId}*0002*LK]`;
                            console.log(`[TCP] Enviando respuesta LK a ${parsed.deviceId}: ${lkResponse}`);
                            socket.write(lkResponse);
                            updateDeviceData(parsed.deviceId, { lastSeen: new Date(), battery: parsed.data?.battery });
                            break;
                        case 'UD': // Upload Data (Posición, etc.)
                            console.log(`[TCP] Datos de posición recibidos de ${parsed.deviceId}:`, parsed.data);
                            updateDeviceData(parsed.deviceId, { 
                                lastSeen: new Date(), 
                                location: parsed.data?.location,
                                battery: parsed.data?.battery,
                                // ... otros campos de UD
                            });
                            // Normalmente el servidor NO responde a los mensajes UD
                            break;
                        case 'AL': // Alarma
                            console.log(`[TCP] Alarma recibida de ${parsed.deviceId}:`, parsed.data);
                            updateDeviceData(parsed.deviceId, { 
                                lastSeen: new Date(), 
                                lastAlarm: { type: parsed.data?.alarmType, timestamp: new Date() },
                                // ... otros campos de AL
                            });
                            // El servidor DEBE responder para confirmar la alarma
                            // Ejemplo: [CS*DEVICE_ID*LEN*AL]
                            const alResponse = `[CS*${parsed.deviceId}*0002*AL]`;
                            console.log(`[TCP] Enviando respuesta AL a ${parsed.deviceId}: ${alResponse}`);
                            socket.write(alResponse);
                            break;
                        // ... otros tipos de comandos
                        default:
                            console.warn(`[TCP] Tipo de comando desconocido: ${parsed.commandType}`);
                    }
                }
            } catch (error) {
                console.error(`[TCP] Error parseando datos de ${remoteAddress}:`, error);
                // Podrías cerrar el socket si los datos son consistentemente corruptos
            }
            
            // Eliminar el mensaje procesado del buffer
            currentBuffer = currentBuffer.substring(messageEndIndex + 1);
        }
        connectionBuffers.set(socket, currentBuffer); // Actualizar el buffer
    });

    socket.on('end', () => {
        console.log(`[TCP] Dispositivo desconectado: ${remoteAddress}`);
        connectionBuffers.delete(socket);
        unregisterDevice(socket); // Necesitamos una forma de encontrar el ID del dispositivo por el socket
    });

    socket.on('error', (err) => {
        console.error(`[TCP] Error en socket ${remoteAddress}: ${err.message}`);
        connectionBuffers.delete(socket);
        unregisterDevice(socket);
    });
});

export function startTcpServer() {
    server.listen(TCP_PORT, HOST, () => {
        console.log(`[TCP] Servidor GPS escuchando en ${HOST}:${TCP_PORT}`);
    });
}

export function sendCommandToDevice(deviceId: string, commandString: string): boolean {
    const socket = getDeviceSocket(deviceId);
    if (socket && !socket.destroyed) {
        console.log(`[TCP] Enviando comando a ${deviceId}: ${commandString}`);
        socket.write(commandString);
        return true;
    }
    console.warn(`[TCP] No se pudo enviar comando. Dispositivo ${deviceId} no conectado o socket destruido.`);
    return false;
}