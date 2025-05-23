// src/index.ts
import { Elysia, t } from 'elysia';
import { startTcpServer, sendCommandToDevice } from './tcpServer';
import { getAllConnectedDevices, getDeviceInfo } from './deviceManager';

// Iniciar el servidor TCP para los dispositivos GPS
startTcpServer();

// Configurar y arrancar el servidor API HTTP con ElysiaJS
const ELYSIA_PORT = 3000;

const app = new Elysia()
    .get('/', () => '¡Hola! Servidor GPS y API funcionando.')
    .get('/api/devices', () => {
        const devices = getAllConnectedDevices().map(dev => ({ // Exponer solo datos seguros
            deviceId: dev.deviceId,
            ip: dev.ip,
            lastSeen: dev.lastSeen,
            location: dev.location,
            battery: dev.battery,
            lastAlarm: dev.lastAlarm,
        }));
        return devices;
    })
    .get('/api/devices/:id', ({ params: { id } }) => {
        const dev = getDeviceInfo(id);
        if (!dev) {
            return { error: 'Dispositivo no encontrado' };
        }
        return { // Exponer solo datos seguros
            deviceId: dev.deviceId,
            ip: dev.ip,
            lastSeen: dev.lastSeen,
            location: dev.location,
            battery: dev.battery,
            lastAlarm: dev.lastAlarm,
        };
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    .post('/api/devices/:id/command', ({ params: { id }, body }) => {
        const commandToSend = body.command; // Ej: "[CS*DEVICE_ID*0002*CR]"
        if (!commandToSend || typeof commandToSend !== 'string') {
            return { error: 'Comando no proporcionado o en formato incorrecto' };
        }
        // ¡MUCHO CUIDADO! Validar que el comando sea seguro y tenga el deviceID correcto.
        // Aquí deberías construir el comando de forma segura o validar el que te envían.
        // Por simplicidad, asumimos que el body.command ya es la cadena completa y correcta.
        // Por ejemplo, para un CR:
        // const safeCommand = `[CS*${id}*0002*CR]`;

        const success = sendCommandToDevice(id, commandToSend);
        if (success) {
            return { message: `Comando enviado a ${id}` };
        } else {
            return { error: `No se pudo enviar comando a ${id} (no conectado?)` };
        }
    }, {
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            command: t.String() // La cadena completa del comando a enviar
        })
    })
    .listen(ELYSIA_PORT);

console.log(
    `🦊 Servidor API Elysia escuchando en http://${app.server?.hostname}:${app.server?.port}`
);