export class AttachableError extends Error {
  public constructor(msg: string, public attachment: string) {
    super(msg);
    this.attachment = attachment;
  }
}

export class KnownError extends Error {
  public constructor(msg: string) {
    super(msg);
  }
}
