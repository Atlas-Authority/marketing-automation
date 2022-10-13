import 'source-map-support/register';
import { downloadAllData } from '../lib/engine/download';
import { hubspotConfigFromENV } from '../lib/hubspot/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();
void downloadAllData(console, hubspotConfigFromENV());
