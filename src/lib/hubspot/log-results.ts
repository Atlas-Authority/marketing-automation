import 'source-map-support/register';
import util from 'util';
import { DataFile, LogWriteStream } from '../data/file';
import { Hubspot } from '../hubspot';
import { Entity } from '../hubspot/entity';
import { EntityKind } from '../hubspot/interfaces';

export function logHubspotResults(hubspot: Hubspot, logFile: DataFile<any>) {
  const ids: Record<EntityKind, number> = { deal: 0, contact: 0, company: 0 };

  const createIdIfNeeded = <T extends Entity<any, any>>(entity: T) => {
    if (!entity.id) {
      const kind = entity.adapter.kind;
      entity.id = `fake-${kind}-${++ids[kind]}`;
    }
  };

  hubspot.dealManager.getArray().forEach(createIdIfNeeded);
  hubspot.contactManager.getArray().forEach(createIdIfNeeded);
  hubspot.companyManager.getArray().forEach(createIdIfNeeded);

  logFile.writeStream(stream => {
    hubspot.dealManager.getArray().forEach((entity) => logEntity(stream, entity));
    hubspot.contactManager.getArray().forEach((entity) => logEntity(stream, entity));
    hubspot.companyManager.getArray().forEach((entity) => logEntity(stream, entity));
  });
}

function logEntity(stream: LogWriteStream, entity: Entity<any, any>) {
  const fromKind = entity.adapter.kind;

  const stringify = (o: any) => util.inspect(o, { depth: null, breakLength: 100 });

  const properties = entity.getPropertyChanges();
  if (Object.keys(properties).length > 0) {
    stream.writeLine(`Updating [${fromKind}:${entity.id!}]: ${stringify(properties)}\n`);
  }

  const associations = entity.getAssociationChanges().filter(assoc => {
    const otherKind = assoc.other.adapter.kind;
    const found = entity.adapter.associations.find(a => a[0] === otherKind);
    return found?.[1].includes('up');
  });
  if (associations.length > 0) {
    stream.writeLine(`Associating [${fromKind}:${entity.id!}]: ${stringify(associations.map(assoc => [
      assoc.op,
      `${assoc.other.adapter.kind}:${assoc.other.id!}`,
    ]))}\n`);
  }
}
