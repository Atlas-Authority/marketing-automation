import DataDir from "../cache/datadir";
import { isProduction } from "../parameters/env-config";

export default function cache<T>(file: string, data: T): T {
  if (!isProduction) {
    DataDir.in.file(file).writeJson(data);
  }
  return data;
}
