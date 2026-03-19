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

// Zebra Browser Print runs locally on the user's machine.
// Try HTTPS first (v2+), fall back to HTTP (v1).
const ZBP_URLS = ['http://localhost:9100', 'https://localhost:9101'];

let resolvedBaseUrl: string | null = null;

async function getZbpBaseUrl(): Promise<string | null> {
  if (resolvedBaseUrl) return resolvedBaseUrl;

  for (const url of ZBP_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}/available`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        resolvedBaseUrl = url;
        return url;
      }
    } catch {
      // Try next URL
    }
  }
  return null;
}

/**
 * Check if Zebra Browser Print is running (direct browser-to-localhost call).
 */
export async function checkZebraBrowserPrint(): Promise<{ available: boolean; printer?: ZebraPrinter }> {
  try {
    const baseUrl = await getZbpBaseUrl();
    if (!baseUrl) return { available: false };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/available`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { available: false };

    const data = await res.json();
    if (data.printer && Array.isArray(data.printer) && data.printer.length > 0) {
      cachedDefaultDevice = data.printer[0];
      return { available: true, printer: data.printer[0] };
    }
    if (data.printer && !Array.isArray(data.printer)) {
      cachedDefaultDevice = data.printer;
      return { available: true, printer: data.printer };
    }
    return { available: true };
  } catch {
    return { available: false };
  }
}

/**
 * Discover all connected printers via Zebra Browser Print.
 */
export async function discoverPrinters(): Promise<ZebraPrinter[]> {
  try {
    const baseUrl = await getZbpBaseUrl();
    if (!baseUrl) return [];

    const res = await fetch(`${baseUrl}/available`);
    const data = await res.json();
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
 * Send ZPL data to Zebra printer via Browser Print (direct localhost call).
 */
export async function sendToZebraPrinter(zpl: string, device?: ZebraPrinter): Promise<void> {
  const printer = device || cachedDefaultDevice;
  if (!printer) {
    throw new Error('No Zebra printer found. Check that Zebra Browser Print is running and a printer is connected.');
  }

  const baseUrl = await getZbpBaseUrl();
  if (!baseUrl) {
    throw new Error('Zebra Browser Print is not reachable. Make sure it is running on this computer.');
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

  const res = await fetch(`${baseUrl}/write`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Print failed: ${errText}`);
  }
}

/**
 * Read printer status via Zebra Browser Print (direct localhost call).
 */
export async function readPrinterStatus(device?: ZebraPrinter): Promise<string> {
  const printer = device || cachedDefaultDevice;
  if (!printer) return 'No printer found';

  try {
    const baseUrl = await getZbpBaseUrl();
    if (!baseUrl) return 'Offline';

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

    const res = await fetch(`${baseUrl}/read`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) return 'Error';
    const text = await res.text();
    return text || 'Ready';
  } catch {
    return 'Offline';
  }
}
