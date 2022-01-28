import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { cliArgs } from '../lib/config/params';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';
import { Marketplace } from '../lib/marketplace';

const dataSetId = cliArgs[0];

const console = new ConsoleLogger();

console.printInfo('Run once', `Running on [${dataSetId ?? 'latest'}] data set`);

const logDirName = `once-${Date.now()}`;
const { dataSet, logDir } = (dataSetId
  ? dataManager.dataSetFrom(+dataSetId, logDirName)
  : dataManager.latestDataSet(logDirName));

const hubspot = Hubspot.fromENV();

const engine = new Engine(hubspot, Marketplace.fromENV(), engineConfigFromENV(), console, logDir);

const data = dataSet.load();

engine.run(data);

hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(hubspot);
