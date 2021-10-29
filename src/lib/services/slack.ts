import slack from '@slack/web-api';
import config from '../config/index.js';
import log from '../log/logger.js';

export default class Slack {

  client?: slack.WebClient;

  constructor() {
    if (config.slack.apiToken) {
      this.client = new slack.WebClient(config.slack.apiToken);
    }
  }


  async postErrorToSlack(text: string) {
    await this.postToSlack(text);
  }

  async postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    log.info('Slack', title, content);

    if (config.slack.errorChannelId) {
      await this.client?.files.upload({
        channels: config.slack.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  async postToSlack(text: string) {
    log.info('Slack', text);

    if (config.slack.errorChannelId) {
      await this.client?.chat.postMessage({
        channel: config.slack.errorChannelId,
        text: text,
      });
    }
  }

}
