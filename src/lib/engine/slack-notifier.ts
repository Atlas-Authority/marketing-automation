import * as slack from '@slack/web-api';
import { ConsoleLogger } from '../log/console';
import { slackConfigFromENV } from "../parameters/env-config";
import { AttachableError, KnownError } from "../util/errors";

interface RunLoopConfig {
  runInterval: string;
  retryInterval: string;
  retryTimes: number;
}

export class SlackNotifier {

  static fromENV(log: ConsoleLogger) {
    const slackConfig = slackConfigFromENV();
    if (!slackConfig.apiToken) return null;

    const client = new slack.WebClient(slackConfig.apiToken);
    return new SlackNotifier(log, client, slackConfig.errorChannelId);
  }

  private constructor(
    private log: ConsoleLogger,
    private client: slack.WebClient,
    private errorChannelId: string | undefined,
  ) { }

  public async notifyStarting() {
    this.postToSlack(`Starting Marketing Engine`);
  }

  public async notifyErrors(loopConfig: RunLoopConfig, errors: any[]) {
    await this.postToSlack(`Failed ${loopConfig.retryTimes} times. Below are the specific errors, in order. Trying again in ${loopConfig.runInterval}.`);
    for (const error of errors) {
      if (error instanceof KnownError) {
        await this.postToSlack(error.message);
      }
      else if (error instanceof AttachableError) {
        await this.postErrorToSlack(error);
        await this.postAttachmentToSlack({
          title: 'Error attachment for ^',
          content: error.attachment,
        });
      }
      else {
        await this.postErrorToSlack(error);
      }
    }
  }

  private async postErrorToSlack(error: Error) {
    await this.postToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
  }

  private async postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    this.log.info('Slack', title, content);

    if (this.errorChannelId) {
      await this.client.files.upload({
        channels: this.errorChannelId,
        title: title,
        content: content,
      })
    }
  }

  private async postToSlack(text: string) {
    this.log.info('Slack', text);

    if (this.errorChannelId) {
      await this.client.chat.postMessage({
        channel: this.errorChannelId,
        text: text,
      });
    }
  }

}
