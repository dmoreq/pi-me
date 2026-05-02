import Defuddle from "defuddle";
import { getProfiles, fetch as wreqFetch } from "wreq-js";
import type { FetchDependencies } from "./types";

export const runtimeDependencies: FetchDependencies = {
  fetch: wreqFetch,
  defuddle: Defuddle,
  getProfiles,
};
