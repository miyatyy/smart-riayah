import { createClient } from '@supabase/supabase-js';

// Ambil konfigurasi URL dan Anon Key dari environment variable (.env / .env.local / Node fallback)
const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof process !== 'undefined' ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) : '') ||
  '';

const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  (typeof process !== 'undefined' ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) : '') ||
  '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      realtime: { params: { eventsPerSecond: 10 } }
    });
