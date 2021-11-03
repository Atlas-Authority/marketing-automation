import { IO } from "../io/io.js";
import { cliParams } from './arg-parser.js';

export function getIoFromCli() {
  return new IO({
    in: input(cliParams.getChoiceOrFail('--downloader', ['live', 'cached'])),
    out: output(cliParams.getChoiceOrFail('--uploader', ['live', 'console'])),
  });
}

function input(opt: 'live' | 'cached'): 'local' | 'remote' {
  switch (opt) {
    case 'cached': return 'local';
    case 'live': return 'remote';
  }
}

function output(opt: 'live' | 'console'): 'local' | 'remote' {
  switch (opt) {
    case 'console': return 'local';
    case 'live': return 'remote';
  }
}
