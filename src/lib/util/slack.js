import slack from '@slack/web-api';
import config from './config.js';
import logger from './logger.js';


export default class Slack {

  constructor() {
    this.slackWebClient = new slack.WebClient(config.slack.apiToken);
  }

  /**
   * @param {string} text
   */
  async postErrorToSlack(text) {
    text = (config.slack.errorPrefix || '') + text;
    await this.postToSlack(text);
  }

  /**
   * @param {object} data
   * @param {string} data.title
   * @param {string} data.content
   */
  async postAttachmentToSlack({ title, content }) {
    logger.info('Slack', title, content);

    if (config.slack.errorChannelId) {
      await this.slackWebClient.files.upload({
        channels: config.slack.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  /**
   * @param {string} text
   */
  async postToSlack(text) {
    logger.info('Slack', text);

    if (config.slack.errorChannelId) {
      await this.slackWebClient.chat.postMessage({
        channel: config.slack.errorChannelId,
        text: text,
      });
    }
  }

}
