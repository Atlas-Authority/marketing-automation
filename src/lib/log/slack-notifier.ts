import Slack from "../io/slack";
import { runLoopConfigFromENV, slackConfigFromENV } from "../parameters/env-config";
import { AttachableError, KnownError } from "../util/errors";

export class SlackNotifier {

  static fromENV() {
    const slackConfig = slackConfigFromENV();
    if (!slackConfig.apiToken) return null;

    const slack = new Slack(slackConfig.apiToken, slackConfig.errorChannelId);
    return new SlackNotifier(slack);
  }

  constructor(private slack: Slack) { }

  notifyStarting() {
    this.slack.postToSlack(`Starting Marketing Engine`);
  }

  async notifyErrors(errors: any[]) {
    const loopConfig = runLoopConfigFromENV();

    await this.slack.postToSlack(`Failed ${loopConfig.retryTimes} times. Below are the specific errors, in order. Trying again in ${loopConfig.runInterval}.`);
    for (const error of errors) {
      if (error instanceof KnownError) {
        await this.slack.postErrorToSlack(error.message);
      }
      else if (error instanceof AttachableError) {
        await this.slack.postErrorToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
        await this.slack.postAttachmentToSlack({
          title: 'Error attachment for ^',
          content: error.attachment,
        });
      }
      else {
        await this.slack.postErrorToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
      }
    }
  }

}
