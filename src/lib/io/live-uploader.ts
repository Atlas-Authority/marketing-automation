import LiveHubspotService from '../services/live/hubspot.js';
import { Uploader } from './interfaces.js';


export default class LiveUploader implements Uploader {

  hubspot = new LiveHubspotService();

}
