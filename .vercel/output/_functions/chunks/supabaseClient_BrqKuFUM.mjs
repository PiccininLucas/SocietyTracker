import { createClient } from "@supabase/supabase-js";
//#region src/core/infrastructure/database/supabaseClient.ts
function getEnv(key) {
	const g = globalThis;
	return (typeof process !== "undefined" && process.env?.[key] || Object.assign({
		"ASSETS_PREFIX": void 0,
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZmhtY3JoY3lla2VnZWVmcWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTE4MjIsImV4cCI6MjEwMjI4NzgyMn0.mu7IvBoEVaRJ08dnEkrgvOAx12up_pib6nF6UBwCEHw",
		"PUBLIC_SUPABASE_URL": "https://prfhmcrhcyekegeefqcq.supabase.co/rest/v1/",
		"SITE": void 0,
		"SSR": true
	}, {
		SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZmhtY3JoY3lla2VnZWVmcWNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjcxMTgyMiwiZXhwIjoyMTAyMjg3ODIyfQ.Q50EbdwksFa1_IlxBBeFxRf9npwDQfI_J31O-5jcTVo",
		PUBLIC: "C:\\Users\\Public"
	})?.[key] || typeof g.process !== "undefined" && g.process?.env?.[key] || "").trim();
}
var supabaseUrl = getEnv("PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL") || "https://society-tracker-placeholder.supabase.co";
var supabaseAnonKey = getEnv("PUBLIC_SUPABASE_ANON_KEY") || getEnv("SUPABASE_ANON_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";
!supabaseUrl.includes("society-tracker-placeholder") && supabaseAnonKey.includes("placeholder");
var supabase = createClient(supabaseUrl, supabaseAnonKey);
//#endregion
export { supabase as t };
