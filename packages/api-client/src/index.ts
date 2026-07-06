import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type { Database } from "./database.types";

export type WonderLoopSupabaseClient = SupabaseClient<Database>;
export type WonderLoopClientOptions = Parameters<typeof createClient<Database>>[2];

export function createWonderLoopClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  options?: WonderLoopClientOptions
): WonderLoopSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, options);
}
