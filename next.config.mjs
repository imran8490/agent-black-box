/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets you open the dev server via 127.0.0.1 / LAN / WSL IP without the "Cross origin request" warning.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.local", "172.*.*.*", "192.168.*.*", "10.*.*.*"],
  // The Walrus SDK loads a .wasm file at runtime; bundling it breaks the server build.
  // Keep it (and its wasm package) as plain Node requires.
  serverExternalPackages: ["@mysten/walrus", "@mysten/walrus-wasm", "@mysten-incubation/memwal", "@grpc/grpc-js", "@protobuf-ts/grpc-transport"],
};

export default nextConfig;
