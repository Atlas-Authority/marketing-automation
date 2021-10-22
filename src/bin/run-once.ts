import { getCliOptions } from "../lib/cli/index.js";
import runEngine from "../lib/engine/engine.js";

const { downloader, uploader } = getCliOptions();

await runEngine({
  downloader,
  uploader,
});
