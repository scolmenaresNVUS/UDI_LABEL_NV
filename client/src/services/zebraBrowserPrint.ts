import api from './api';

export interface ZebraPrinter {
  name: string;
  uid: string;
  connection: string;
  deviceType: string;
  version?: number;
  provider?: string;
  manufacturer?: string;
}

let cachedDefaultDevice: ZebraPrinter | null = null;

/**
 * Check if Zebra Browser Print is running (proxied through our backend to avoid CORS).
 */
export async function checkZebraBrowserPrint(): Promise<{ available: boolean; printer?: ZebraPrinter }> {
  try {
    const res = await api.get('/zebra/available');
    const data = res.data;
    if (data.available) {
      // Parse the printer array from ZBP response
      if (data.printer && Array.isArray(data.printer) && data.printer.length > 0) {
        cachedDefaultDevice = data.printer[0];
        return { available: true, printer: data.printer[0] };
      }
      if (data.printer && !Array.isArray(data.printer)) {
        cachedDefaultDevice = data.printer;
        return { available: true, printer: data.printer };
      }
      return { available: true };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

/**
 * Discover all connected printers via Zebra Browser Print.
 */
export async function discoverPrinters(): Promise<ZebraPrinter[]> {
  try {
    const res = await api.get('/zebra/available');
    const data = res.data;
    if (data.printer && Array.isArray(data.printer)) {
      return data.printer;
    }
    if (data.printer && data.printer.name) {
      return [data.printer];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Send ZPL data to Zebra printer via Browser Print (proxied through backend).
 */
export async function sendToZebraPrinter(zpl: string, device?: ZebraPrinter): Promise<void> {
  const printer = device || cachedDefaultDevice;
  if (!printer) {
    throw new Error('No Zebra printer found. Check that Zebra Browser Print is running and a printer is connected.');
  }

  const payload = {
    device: {
      name: printer.name,
      uid: printer.uid,
      connection: printer.connection,
      deviceType: printer.deviceType,
      version: printer.version || 0,
      provider: printer.provider || 0,
      manufacturer: printer.manufacturer || '',
    },
    data: zpl,
  };

  const res = await api.post('/zebra/write', payload);
  if (res.data.error) {
    throw new Error(res.data.error);
  }
}

/**
 * Read printer status via Zebra Browser Print (proxied through backend).
 */
export async function readPrinterStatus(device?: ZebraPrinter): Promise<string> {
  const printer = device || cachedDefaultDevice;
  if (!printer) return 'No printer found';

  try {
    const payload = {
      device: {
        name: printer.name,
        uid: printer.uid,
        connection: printer.connection,
        deviceType: printer.deviceType,
        version: printer.version || 0,
        provider: printer.provider || 0,
        manufacturer: printer.manufacturer || '',
      },
    };

    const res = await api.post('/zebra/read', payload);
    return res.data.status || 'Unknown';
  } catch {
    return 'Offline';
  }
}
