import * as slack from '@slack/web-api';
import { slackConfigFromENV } from "../config/env";
import { ConsoleLogger } from '../log/console';
import { AttachableError, KnownError } from "../util/errors";

interface RunLoopConfig {
  runInterval: string;
  retryInterval: string;
  retryTimes: number;
}

export class SlackNotifier {

  public static fromENV(console: ConsoleLogger) {
    const slackConfig = slackConfigFromENV();
    if (!slackConfig.apiToken) return undefined;

    const client = new slack.WebClient(slackConfig.apiToken);
    return new SlackNotifier(console, client, slackConfig.errorChannelId);
  }

  private constructor(
    private console: ConsoleLogger,
    private client: slack.WebClient,
    private errorChannelId: string | undefined,
  ) { }

  public async notifyStarting() {
    void this.#postToSlack(`Starting Marketing Engine`);
  }

  public async notifyErrors(loopConfig: RunLoopConfig, errors: any[]) {
    await this.#postToSlack(`Failed ${loopConfig.retryTimes} times. Below are the specific errors, in order. Trying again in ${loopConfig.runInterval}.`);
    for (const error of errors) {
      if (error instanceof KnownError) {
        await this.#postToSlack(error.message);
      }
      else if (error instanceof AttachableError) {
        await this.#postErrorToSlack(error);
        await this.#postAttachmentToSlack({
          title: 'Error attachment for ^',
          content: error.attachment,
        });
      }
      else {
        await this.#postErrorToSlack(error);
      }
    }
  }

  public async notifyDataShiftIssues(resultLabel: string, table: string) {
    await this.#postAttachmentToSlack({
      title: `Data Shift Issue for ${resultLabel}:`,
      content: table,
    });

  }

  async #postErrorToSlack(error: Error) {
    await this.#postToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
  }

  async #postAttachmentToSlack({ title, content }: { title: string, content: string }) {
    this.console.printInfo('Slack', title, content);

    if (this.errorChannelId) {
      await this.client.files.upload({
        channels: this.errorChannelId,
        title: title,
        content: content,
      });
    }
  }

  async #postToSlack(text: string) {
    this.console.printInfo('Slack', text);

    if (this.errorChannelId) {
      await this.client.chat.postMessage({
        channel: this.errorChannelId,
        text: text,
      });
    }
  }

}
