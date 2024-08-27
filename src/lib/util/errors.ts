import {Deal} from '../model/deal'

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

export class BlockingDeal extends Error {
  public constructor(msg: string, public deal: Deal) {
    super(msg);
    this.deal = deal;
  }
}
