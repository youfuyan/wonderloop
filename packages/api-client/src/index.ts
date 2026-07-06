import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type { Database } from "./database.types";

export type WonderLoopSupabaseClient = SupabaseClient<Database>;

export function createWonderLoopClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): WonderLoopSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
