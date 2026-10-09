/** @type {import('next').NextConfig} */
const nextConfig = {
  // These read their own data files at runtime, so they must not be bundled.
  serverExternalPackages: ['pdfkit', 'exceljs'],
};

export default nextConfig;
