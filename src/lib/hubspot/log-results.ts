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
  private creating = new Set<Entity<any>>();

  public logResults(hubspot: Hubspot, logFile: DataFile<any>) {
    logFile.writeStream(stream => {
      hubspot.dealManager.getArray().forEach((entity) => this.logEntity(stream, entity));
      hubspot.contactManager.getArray().forEach((entity) => this.logEntity(stream, entity));
      hubspot.companyManager.getArray().forEach((entity) => this.logEntity(stream, entity));
    });
  }

  private logEntity(stream: LogWriteStream, entity: Entity<any>) {
    const fromKind = entity.kind;

    const properties = { ...entity.getPropertyChanges() };
    if (Object.keys(properties).length > 0) {
      const action = this.creating.has(entity) ? 'create' : 'update';
      const id = `${fromKind}:${this.idFor(entity)}`;
      stream.writeLine(stringify({ action, id, properties }));
    }

    const associations = entity.getAssociationChanges().filter(assoc => {
      const otherKind = assoc.other.kind;
      const found = entity.adapter.associations.find(a => a[0] === otherKind);
      return found?.[1].includes('up');
    });
    if (associations.length > 0) {
      const action = 'associations';
      const id = `${fromKind}:${this.idFor(entity)}`;
      const mappedAssociations = associations.map(assoc => [
        assoc.op,
        `${assoc.other.kind}:${this.idFor(assoc.other)}`,
      ]);
      stream.writeLine(stringify({ action, id, mappedAssociations }));
    }
  }

  private idFor<T extends Entity<any>>(entity: T) {
    if (!entity.id) {
      const kind = entity.kind;
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
