// server.bun.js

const HOST = '0.0.0.0'; // Escuchar en todas las interfaces disponibles
const PORT = 5093;      // Puerto que usa tu dispositivo (ajústalo)

console.log(`[Bun TCP] Intentando escuchar en ${HOST}:${PORT}...`);

const server = Bun.listen({
    hostname: HOST,
    port: PORT,
    socket: {
        // open se llama cuando un nuevo cliente se conecta
        open(socket) {
            const { remoteAddress, remotePort } = socket;
            console.log(`[Bun TCP] Conectado por ${remoteAddress}:${remotePort}`);
            // Puedes guardar el socket o información asociada si necesitas manejar múltiples clientes
            // socket.data = { id: generateUniqueId(), lastSeen: Date.now() };
        },
        // data se llama cuando el servidor recibe datos del cliente
        data(socket, buffer) {
            const { remoteAddress, remotePort } = socket;
            // El buffer es un Uint8Array o Buffer de Node.js
            // Para obtener la representación hexadecimal:
            const dataHex = Buffer.from(buffer).toString('hex');
            console.log(`[Bun TCP] Recibido de ${remoteAddress}:${remotePort} (HEX): ${dataHex}`);
            
            // Aquí podrías añadir la lógica para responder al LK
            // const receivedString = Buffer.from(buffer).toString('ascii'); // o 'utf-8' según el protocolo

            // Ejemplo (MUY simplificado) de detección y respuesta a un LK
            // Necesitarás una lógica de parseo más robusta como la que discutimos antes.
            // Esto asume que el mensaje LK es exactamente '[CS*DEVICEID*0002*LK]'
            // y que `parseSimpleLK` extrae el DEVICEID.
            /*
            function parseSimpleLK(asciiData) {
                // Ejemplo: "[CS*1234567890*0002*LK]"
                if (asciiData.includes('*LK]')) {
                    const parts = asciiData.substring(1, asciiData.length - 1).split('*');
                    if (parts.length >= 2 && parts[parts.length-1] === 'LK') {
                        return parts[1]; // Devuelve el Device ID
                    }
                }
                return null;
            }

            const deviceId = parseSimpleLK(receivedString);
            if (deviceId) {
                // Construir la respuesta LK. El protocolo define fabricante, ID, longitud y contenido.
                // Aquí 'CS' es el fabricante, deviceId es el ID, '0002' es la longitud de 'LK'.
                const lkResponse = `[CS*${deviceId}*0002*LK]`;
                socket.write(lkResponse); // Enviar respuesta
                console.log(`[Bun TCP] Enviada respuesta LK a ${deviceId} (ASCII): ${lkResponse}`);
            }
            */
        },
        // close se llama cuando la conexión se cierra
        close(socket, error) {
            const { remoteAddress, remotePort } = socket;
            if (error) {
                console.error(`[Bun TCP] Conexión con ${remoteAddress}:${remotePort} cerrada debido a error:`, error);
            } else {
                console.log(`[Bun TCP] Conexión con ${remoteAddress}:${remotePort} cerrada limpiamente.`);
            }
        },
        // error se llama si ocurre un error en el socket (que no necesariamente cierra la conexión)
        error(socket, error) {
            const { remoteAddress, remotePort } = socket;
            console.error(`[Bun TCP] Error en socket para ${remoteAddress}:${remotePort}:`, error);
        },
        // drain se llama cuando el buffer de escritura del socket está vacío y puede aceptar más datos.
        // Útil para control de flujo si envías muchos datos.
        /*
        drain(socket) {
            console.log('[Bun TCP] Buffer de escritura vacío, listo para más datos.');
        }
        */
    },
});

console.log(`[Bun TCP] Servidor escuchando en ${server.hostname}:${server.port}`);

// Para mantener el proceso de Bun corriendo (si no tienes otro código que lo mantenga vivo)
// setInterval(() => {}, 1 << 30); // No es estrictamente necesario si el servidor está activo.