import slack from '@slack/web-api';
import config from './config/index.js';
import logger from './logger.js';


export default class Slack {

  slackWebClient = new slack.WebClient(config.slack.apiToken);

  async postErrorToSlack(text: string) {
    text = (config.slack.errorPrefix || '') + text;
    await this.postToSlack(text);
  }

  async postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    logger.info('Slack', title, content);

    if (config.slack.errorChannelId) {
      await this.slackWebClient.files.upload({
        channels: config.slack.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  async postToSlack(text: string) {
    logger.info('Slack', text);

    if (config.slack.errorChannelId) {
      await this.slackWebClient.chat.postMessage({
        channel: config.slack.errorChannelId,
        text: text,
      });
    }
  }

}
