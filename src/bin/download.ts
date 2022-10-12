import 'source-map-support/register';
import { hubspotSettingsFromENV } from '../lib/config/env';
import { downloadAllData } from '../lib/engine/download';
import { hubspotConfigFromENV } from '../lib/hubspot/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();
downloadAllData(console, hubspotConfigFromENV(), hubspotSettingsFromENV());
