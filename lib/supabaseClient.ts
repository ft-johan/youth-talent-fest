// lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// Get your unique URL and anon key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create the client
export const supabase = createClient(supabaseUrl, supabaseKey);