import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { cliArgs } from '../lib/config/params';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine/engine";
import { ConsoleLogger } from '../lib/log/console';
import { AttachableError } from '../lib/util/errors';

const dataSetId = cliArgs[0];

const console = new ConsoleLogger();

console.printInfo('Run once', `Running on [${dataSetId ?? 'latest'}] data set`);

try {
  const dataSet = (dataSetId
    ? dataManager.dataSetFrom(+dataSetId)
    : dataManager.latestDataSet());

  const logDir = dataSet.makeLogDir!(`once-${Date.now()}`);

  const engine = new Engine(engineConfigFromENV(), console, logDir);

  engine.run(dataSet);

  dataSet.hubspot.populateFakeIds();
  logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
}
catch (e: any) {
  if (e instanceof AttachableError) {
    console.printInfo('Running Once', e.message);
    console.printInfo('Running Once', e.attachment);
  }
  else {
    throw e;
  }
}
