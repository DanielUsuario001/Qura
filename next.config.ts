import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose only safe public env vars — service role key stays server-side only
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
};

export default nextConfig;
