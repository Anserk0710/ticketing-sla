import { defineConfig } from 'vite';
import fs from 'node:fs'
import react from '@vitejs/plugin-react';

const certKeyPath = new URL('./certs/192.168.1.111-key.pem', import.meta.url);
const certPath = new URL('./certs/192.168.1.111.pem', import.meta.url);
const httpsEnabled =
    process.env.VITE_HTTPS !== 'false' &&
    fs.existsSync(certKeyPath) &&
    fs.existsSync(certPath);

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: '0.0.0.0',
        https: httpsEnabled
            ? {
                key: fs.readFileSync(certKeyPath),
                cert: fs.readFileSync(certPath),
              }
            : undefined,
    },
});
