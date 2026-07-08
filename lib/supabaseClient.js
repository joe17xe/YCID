import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* DEMO = true tant que Supabase n'est pas configuré :
   l'app tourne alors sur les données de démonstration, en mémoire. */
export const DEMO = !url || !key || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const supabase = DEMO ? null : createClient(url, key);
