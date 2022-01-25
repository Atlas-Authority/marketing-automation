import 'source-map-support/register';
import util from 'util';
import { DataFile, LogWriteStream } from '../data/file';
import { Hubspot } from '../hubspot';
import { Entity } from '../hubspot/entity';
import { EntityKind } from '../hubspot/interfaces';

export function logHubspotResults(hubspot: Hubspot, logFile: DataFile<any>) {
  new HubspotResultLogger().logResults(hubspot, logFile);
}

class HubspotResultLogger {

  private ids: Record<EntityKind, number> = { deal: 0, contact: 0, company: 0 };
  private creating = new Set<Entity<any, any>>();

  public logResults(hubspot: Hubspot, logFile: DataFile<any>) {
    logFile.writeStream(stream => {
      hubspot.dealManager.getArray().forEach((entity) => this.logEntity(stream, entity));
      hubspot.contactManager.getArray().forEach((entity) => this.logEntity(stream, entity));
      hubspot.companyManager.getArray().forEach((entity) => this.logEntity(stream, entity));
    });
  }

  private logEntity(stream: LogWriteStream, entity: Entity<any, any>) {
    const fromKind = entity.adapter.kind;

    const properties = entity.getPropertyChanges();
    if (Object.keys(properties).length > 0) {
      const verb = this.creating.has(entity) ? 'Creating' : 'Updating';
      stream.writeLine(`${verb} [${fromKind}:${this.idFor(entity)}]:\n${stringify(properties)}\n`);
    }

    const associations = entity.getAssociationChanges().filter(assoc => {
      const otherKind = assoc.other.adapter.kind;
      const found = entity.adapter.associations.find(a => a[0] === otherKind);
      return found?.[1].includes('up');
    });
    if (associations.length > 0) {
      stream.writeLine(`Associating [${fromKind}:${this.idFor(entity)}]:\n${stringify(associations.map(assoc => [
        assoc.op,
        `${assoc.other.adapter.kind}:${this.idFor(assoc.other)}`,
      ]))}\n`);
    }
  }

  private idFor<T extends Entity<any, any>>(entity: T) {
    if (!entity.id) {
      const kind = entity.adapter.kind;
      this.creating.add(entity);
      entity.id = `fake-${++this.ids[kind]}`;
    }
    return entity.id;
  }

}

function stringify(o: any) {
  return util.inspect(o, {
    depth: null,
    breakLength: 80,
  });
}
