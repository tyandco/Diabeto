const { spawnSync } = require('node:child_process');

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
}

if (supabaseKey) {
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = supabaseKey;
}

const result = spawnSync('npx', ['expo', 'export', '-p', 'web'], {
  env: process.env,
  shell: true,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
