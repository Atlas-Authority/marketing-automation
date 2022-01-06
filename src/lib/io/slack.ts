import * as slack from '@slack/web-api';
import log from '../log/logger';

export default class Slack {

  private client?: slack.WebClient;

  public constructor(apiToken: string, private errorChannelId: string | undefined) {
    this.client = new slack.WebClient(apiToken);
  }

  public async postErrorToSlack(text: string) {
    await this.postToSlack(text);
  }

  public async postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    log.info('Slack', title, content);

    if (this.errorChannelId) {
      await this.client?.files.upload({
        channels: this.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  public async postToSlack(text: string) {
    log.info('Slack', text);

    if (this.errorChannelId) {
      await this.client?.chat.postMessage({
        channel: this.errorChannelId,
        text: text,
      });
    }
  }

}
