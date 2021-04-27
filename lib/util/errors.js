export class AttachableError extends Error {
  /**
   * @param {string} msg
   * @param {string} attachment
   */
  constructor(msg, attachment) {
    super(msg);
    this.attachment = attachment;
  }
}

export class SimpleError extends Error {
  /**
   * @param {string} msg
   */
  constructor(msg) {
    super(msg);
    this.simple = true;
  }
}
