import LiveHubspotService from '../services/hubspot.js';
import { Uploader } from './interfaces.js';


export default class LiveUploader implements Uploader {

  hubspot = new LiveHubspotService();

}
