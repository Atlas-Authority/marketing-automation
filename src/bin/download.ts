import 'source-map-support/register';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();
const hubspot = Hubspot.live(console);
downloadAllData(console, hubspot);
