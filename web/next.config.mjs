   /** @type {import('next').NextConfig} */
   const nextConfig = {
     async rewrites() {
       // Dev only: in production, Caddy routes /api/* to FastAPI on :8000.
       return [
         { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
       ];
     },
   };

   export default nextConfig;