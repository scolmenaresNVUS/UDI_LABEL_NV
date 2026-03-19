import net from 'net';

export class NetworkTcpDriver {
  private host: string;
  private port: number;

  constructor(host: string, port: number = 9100) {
    this.host = host;
    this.port = port;
  }

  async sendJob(zpl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(10000);

      socket.connect(this.port, this.host, () => {
        socket.write(zpl, 'utf-8', () => {
          socket.end();
          resolve();
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Connection to ${this.host}:${this.port} timed out`));
      });

      socket.on('error', (err) => {
        reject(new Error(`Printer connection error: ${err.message}`));
      });
    });
  }

  async getStatus(): Promise<{ online: boolean; paperOut: boolean; headOpen: boolean }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);

      socket.connect(this.port, this.host, () => {
        // Send host status return command
        socket.write('~HS\r\n');
      });

      let data = '';
      socket.on('data', (chunk) => { data += chunk.toString(); });

      socket.on('end', () => {
        resolve({
          online: true,
          paperOut: data.includes('PAPER OUT'),
          headOpen: data.includes('HEAD OPEN'),
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ online: false, paperOut: false, headOpen: false });
      });

      socket.on('error', () => {
        resolve({ online: false, paperOut: false, headOpen: false });
      });

      setTimeout(() => {
        socket.destroy();
        resolve({ online: data.length > 0, paperOut: false, headOpen: false });
      }, 2000);
    });
  }

  async sendTestLabel(printerName: string): Promise<void> {
    const testZpl = [
      '^XA',
      '^FO50,50^A0N,40,40^FDTest Print^FS',
      `^FO50,100^A0N,25,25^FD${printerName}^FS`,
      `^FO50,140^A0N,25,25^FD${new Date().toISOString()}^FS`,
      '^FO50,180^GB400,1,2^FS',
      '^FO50,200^A0N,20,20^FDGS1 UDI Label System^FS',
      '^XZ',
    ].join('\n');
    return this.sendJob(testZpl);
  }
}
