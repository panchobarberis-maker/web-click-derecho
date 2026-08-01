import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      // The widget is loaded cross-origin from each law firm's own website.
      { source: "/w.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
      { source: "/api/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default config;
