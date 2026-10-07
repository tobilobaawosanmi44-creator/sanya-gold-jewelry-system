/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its own data files at runtime, so it must not be bundled.
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
