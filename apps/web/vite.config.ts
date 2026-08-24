import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs'
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const certKeyPath = path.resolve(
        process.cwd(),
        env.VITE_HTTPS_KEY || 'certs/dev-key.pem',
    );

    const certPath = path.resolve(
        process.cwd(),
        env.VITE_HTTPS_CERT || 'certs/dev-cert.pem',
    );

    const httpsEnabled =
        env.VITE_HTTPS === 'true' &&
        fs.existsSync(certKeyPath) &&
        fs.existsSync(certPath);

    return {
        plugins: [react(), tailwindcss()],

        server: {
            port: 5173,
            host: '0.0.0.0',
            strictPort: true,

            https: httpsEnabled
                ? {
                    key: fs.readFileSync(certKeyPath),
                    cert: fs.readFileSync(certPath),
                }
                : undefined,

            proxy: {
                '/api': {
                    target:
                        env.VITE_API_PROXY_TARGET ||
                        'http://localhost:3000',
                    changeOrigin: true,
                },
            },
        },
    };
});