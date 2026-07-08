"use client";
import { useEffect, useState } from "react";
import { supabase, DEMO } from "./supabaseClient";

/* Conversion camelCase (UI) <-> snake_case (Postgres) */
const FIELD_OVERRIDES = { start: "start_date", end: "end_date" };
const camelToSnake = (k) => FIELD_OVERRIDES[k] || k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const snakeToCamel = (k) => {
  const inv = Object.entries(FIELD_OVERRIDES).find(([, v]) => v === k);
  if (inv) return inv[0];
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
};
export const toDb = (row) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined).map(([k, v]) => [camelToSnake(k), v]));
export const fromDb = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v]));

const keyOf = (table, r) => (table === "project_members" ? `${r.projectId}|${r.userId}` : r.id);

/* Liste persistée : même signature que useState -> aucun changement
   dans les composants. Chaque mise à jour est diffée et upsertée. */
export function usePersistedList(table, demoSeed) {
  const [list, setList] = useState(DEMO ? demoSeed : []);
  useEffect(() => {
    if (DEMO) return;
    supabase.from(table).select("*").then(({ data, error }) => {
      if (error) console.error("load", table, error.message);
      else setList((data || []).map(fromDb));
    });
  }, [table]);
  const set = (updater) =>
    setList((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!DEMO) persistDiff(table, prev, next);
      return next;
    });
  return [list, set];
}

async function persistDiff(table, prev, next) {
  const prevMap = new Map(prev.map((r) => [keyOf(table, r), JSON.stringify(r)]));
  const changed = next.filter((r) => prevMap.get(keyOf(table, r)) !== JSON.stringify(r));
  if (!changed.length) return;
  const onConflict = table === "project_members" ? "project_id,user_id" : "id";
  const { error } = await supabase.from(table).upsert(changed.map(toDb), { onConflict });
  if (error) console.error("persist", table, error.message);
}

export function useProfiles(demoSeed) {
  const [users, setUsers] = useState(DEMO ? demoSeed : []);
  useEffect(() => {
    if (DEMO) return;
    supabase.from("profiles").select("*").then(({ data, error }) => {
      if (error) console.error("load profiles", error.message);
      else setUsers((data || []).map(fromDb));
    });
  }, []);
  return users;
}
