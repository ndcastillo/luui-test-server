// src/deviceManager.ts
import net from 'net';

interface DeviceInfo {
    socket: net.Socket;
    lastSeen: Date;
    deviceId: string;
    ip: string;
    port: number;
    location?: { lat: number; lon: number };
    battery?: number;
    lastAlarm?: { type: string; timestamp: Date };
    // ... más datos que quieras guardar en memoria
}

const connectedDevices: Map<string, DeviceInfo> = new Map(); // Key: deviceId
const socketToDeviceId: Map<net.Socket, string> = new Map(); // Key: socket

export function registerDevice(deviceId: string, socket: net.Socket) {
    const remoteAddress = socket.remoteAddress;
    const remotePort = socket.remotePort;

    if (!remoteAddress || !remotePort) {
        console.warn(`[DM] Intento de registrar dispositivo sin remoteAddress/remotePort. Socket podría estar cerrándose.`);
        return;
    }
    
    const deviceInfo: DeviceInfo = {
        socket,
        deviceId,
        lastSeen: new Date(),
        ip: remoteAddress,
        port: remotePort,
    };
    connectedDevices.set(deviceId, deviceInfo);
    socketToDeviceId.set(socket, deviceId);
    console.log(`[DM] Dispositivo ${deviceId} registrado desde ${remoteAddress}:${remotePort}`);
}

export function unregisterDevice(item: net.Socket | string) {
    let deviceIdToRemove: string | undefined;

    if (typeof item === 'string') { // Se pasó un deviceId
        deviceIdToRemove = item;
    } else { // Se pasó un socket
        deviceIdToRemove = socketToDeviceId.get(item);
    }

    if (deviceIdToRemove) {
        const deviceInfo = connectedDevices.get(deviceIdToRemove);
        if (deviceInfo) {
            socketToDeviceId.delete(deviceInfo.socket);
            connectedDevices.delete(deviceIdToRemove);
            console.log(`[DM] Dispositivo ${deviceIdToRemove} desregistrado.`);
        }
    }
}

export function getDeviceSocket(deviceId: string): net.Socket | undefined {
    return connectedDevices.get(deviceId)?.socket;
}

export function getDeviceInfo(deviceId: string): DeviceInfo | undefined {
    return connectedDevices.get(deviceId);
}

export function getAllConnectedDevices(): DeviceInfo[] {
    return Array.from(connectedDevices.values());
}

export function updateDeviceData(deviceId: string, data: Partial<Omit<DeviceInfo, 'socket' | 'deviceId' | 'ip' | 'port'>>) {
    const deviceInfo = connectedDevices.get(deviceId);
    if (deviceInfo) {
        // Filtrar para no sobreescribir el socket, id, ip, port
        const { socket, deviceId: id, ip, port, ...updatableData } = deviceInfo;
        const newDeviceInfo = { ...updatableData, ...data }; // Aplicar actualizaciones
        connectedDevices.set(deviceId, { socket, deviceId: id, ip, port, ...newDeviceInfo } as DeviceInfo);
    }
}