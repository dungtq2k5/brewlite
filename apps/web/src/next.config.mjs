/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@brewlite/api-client', '@brewlite/contracts'],
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '29199',
            },
            {
                protocol: 'http',
                hostname: '127.0.0.1',
                port: '29199',
            },
        ],
    },
};

export default nextConfig;