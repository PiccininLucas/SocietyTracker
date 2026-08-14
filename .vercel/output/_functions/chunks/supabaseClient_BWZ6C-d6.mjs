import { createClient } from "@supabase/supabase-js";
var supabase = createClient("https://prfhmcrhcyekegeefqcq.supabase.co/rest/v1/", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZmhtY3JoY3lla2VnZWVmcWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTE4MjIsImV4cCI6MjEwMjI4NzgyMn0.mu7IvBoEVaRJ08dnEkrgvOAx12up_pib6nF6UBwCEHw");
//#endregion
export { supabase as t };
