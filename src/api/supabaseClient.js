import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mxmtzodghdzeadvmuwak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bXR6b2RnaGR6ZWFkdm11d2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODQ4OTksImV4cCI6MjA5MDI2MDg5OX0.RMnkm5a2QX1wTC-i3Jq8bMAuGnSYfNBxaPPPNwrBdMg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);