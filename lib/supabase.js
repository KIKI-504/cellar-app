import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

// Public client - for buyer view (respects Row Level Security)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Admin client - for your view only, used server-side
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
