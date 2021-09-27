import runEngine from "../lib/engine/engine.js";
import { getCliOptions } from "../lib/util/cli/index.js";

const { downloader, uploader } = getCliOptions();

await runEngine({
  downloader,
  uploader,
});
