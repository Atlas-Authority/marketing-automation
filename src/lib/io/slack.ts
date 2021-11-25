import slack from '@slack/web-api';
import log from '../log/logger.js';
import env from '../parameters/env.js';

export default class Slack {

  private client?: slack.WebClient;

  public constructor() {
    if (env.slack.apiToken) {
      this.client = new slack.WebClient(env.slack.apiToken);
    }
  }

  public async postErrorToSlack(text: string) {
    await this.postToSlack(text);
  }

  public async postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    log.info('Slack', title, content);

    if (env.slack.errorChannelId) {
      await this.client?.files.upload({
        channels: env.slack.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  public async postToSlack(text: string) {
    log.info('Slack', text);

    if (env.slack.errorChannelId) {
      await this.client?.chat.postMessage({
        channel: env.slack.errorChannelId,
        text: text,
      });
    }
  }

}
