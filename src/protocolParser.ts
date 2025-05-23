// src/protocolParser.ts

export interface ParsedGPSData {
    manufacturer: string;
    deviceId: string;
    contentLength: number; // Longitud decimal del contenido
    rawContent: string;
    commandType?: string; // LK, UD, AL, etc.
    data?: any; // Objeto con los datos específicos del comando
}

// Ejemplo de función para parsear (muy simplificada)
export function parseGPSData(message: string): ParsedGPSData | null {
    if (!message.startsWith('[') || !message.endsWith(']')) {
        throw new Error('Mensaje mal enmarcado. No empieza con [ o no termina con ].');
    }

    const strippedMessage = message.substring(1, message.length - 1); // Quitar '[' y ']'
    const parts = strippedMessage.split('*');

    if (parts.length < 4) {
        throw new Error(`Formato de mensaje incorrecto. Se esperaban al menos 4 partes separadas por '*': ${strippedMessage}`);
    }

    const manufacturer = parts[0];
    const deviceId = parts[1];
    const contentLengthHex = parts[2];
    const rawContent = parts.slice(3).join('*'); // El contenido puede tener '*' si no se maneja bien

    // Validar longitud (ASCII HEX a decimal)
    const contentLength = parseInt(contentLengthHex, 16);
    if (isNaN(contentLength)) {
        throw new Error(`Longitud de contenido inválida (no es HEX): ${contentLengthHex}`);
    }

    // La longitud real del contenido debe coincidir.
    // Cuidado: el protocolo dice "4 bit ASCII code", lo que es ambiguo.
    // Si FFFF = 65535, entonces son 4 caracteres ASCII que representan un número HEX de 16 bits.
    // El ejemplo "length 162 in ASCII code is 00A2" lo confirma.
    if (rawContent.length !== contentLength) {
         // OJO: Esto puede fallar si el `rawContent` tiene caracteres multibyte y `contentLength` se refiere a bytes.
         // El protocolo parece implicar que `contentLength` es la longitud de la cadena `rawContent` tal cual.
        console.warn(`Advertencia: La longitud del contenido (${rawContent.length}) no coincide con la especificada (${contentLength}) para el mensaje: ${message}`);
        // Podrías optar por no lanzar error aquí si el resto del parseo puede continuar, o ser estricto.
    }

    const parsedData: ParsedGPSData = {
        manufacturer,
        deviceId,
        contentLength,
        rawContent,
        data: {}
    };

    // Identificar tipo de comando y parsear datos específicos
    // Esto es lo que necesita más trabajo basado en el protocolo.
    const contentParts = rawContent.split(',');
    parsedData.commandType = contentParts[0];

    switch (parsedData.commandType) {
        case 'LK':
            // Ejemplo: LK,pasos,volteos_sueño,batería%
            // o simplemente LK
            if (contentParts.length > 1) {
                parsedData.data.steps = parseInt(contentParts[1]);
                parsedData.data.tumbling = parseInt(contentParts[2]);
                parsedData.data.battery = parseInt(contentParts[3]); // Podría tener un '%'
            } else {
                 // LK simple sin datos adicionales, o la batería viene en otro lado
            }
            break;
        case 'UD':
            // UD,fecha,hora,validez,lat,N/S,lon,E/W,velocidad,rumbo,altitud,satélites,gsm,batería,pasos,volteos,estado_dev,lbs_num,lbs_info...,wifi_num,wifi_info...,precisión
            // Esto es muy complejo y requiere un parseo detallado de cada campo según el Apéndice I
            parsedData.data.timestamp = contentParts[1] + contentParts[2]; // ddmmyy + hhmmss
            parsedData.data.gpsValidity = contentParts[3];
            parsedData.data.location = {
                lat: parseFloat(contentParts[4]),
                lon: parseFloat(contentParts[6])
            };
            parsedData.data.battery = parseInt(contentParts[13]);
            // ... muchos más campos ...
            break;
        case 'AL':
             // AL,fecha,hora,validez,lat,N/S,lon,E/W,...,estado_dev_con_alarma,...
            parsedData.data.timestamp = contentParts[1] + contentParts[2];
            parsedData.data.alarmType = "GENERIC_ALARM"; // Necesitarías decodificar el campo de estado del dispositivo
            // ... muchos más campos ...
            break;
        // Añadir más casos para otros comandos: CONFIG, APN, UPLOAD, CALL, SOS1, IP, etc.
    }

    return parsedData;
}