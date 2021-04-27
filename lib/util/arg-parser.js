import { batchesOf } from "./helpers.js";

export class ArgParser {

  /** @type {{ [opt: string]: string }} */
  #opts;

  /**
   * @param {string[]} argv
   */
  constructor(argv) {
    const args = argv.flatMap(s => s.split('='));
    this.#opts = Object.fromEntries(batchesOf(args, 2));
  }

  /**
   * @param {string} option
   * @return {string | undefined}
   */
  get(option) {
    const value = this.#opts[option];
    delete this.#opts[option];
    return value;
  }

  /**
   * @template T
   * @param {string} option
   * @param {{ [opt: string]: () => T }} choices
   */
  getChoiceOrFail(option, choices) {
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
