import 'source-map-support/register';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';

const console = new Console();
const hubspot = Hubspot.live(console);
downloadAllData(console, hubspot);
