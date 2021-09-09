import { batchesOf } from "./helpers.js";

export class ArgParser {

  #opts: { [opt: string]: string };

  constructor(argv: string[]) {
    const args = argv.flatMap(s => s.split('='));
    this.#opts = Object.fromEntries(batchesOf(args, 2));
  }

  get(option: string): string | undefined {
    const value = this.#opts[option];
    delete this.#opts[option];
    return value;
  }

  getChoiceOrFail<T>(option: string, choices: { [opt: string]: () => T }) {
    const value = this.get(option);
    if (!value || !choices[value]) {
      console.log(`Error: ${option} must be ${Object.keys(choices)
        .map(c => `'${c}'`)
        .join(' or ')}`);
      process.exit(1);
    }
    return choices[value]();
  }

  failIfExtraOpts() {
    if (Object.keys(this.#opts).length > 0) {
      console.log(`Error: Unknown options passed:`, this.#opts);
      process.exit(1);
    }
  }

}
