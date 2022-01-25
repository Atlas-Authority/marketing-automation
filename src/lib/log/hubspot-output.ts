import util from 'util';
import { DataFile, LogWriteStream } from '../data/file';
import { Hubspot } from '../hubspot';
import { Entity } from '../hubspot/entity';
import { EntityKind } from '../hubspot/interfaces';

export class HubspotOutputLogger {

  private ids: Record<EntityKind, number> = { deal: 0, contact: 0, company: 0 };
  private creating = new Set<Entity<any>>();

  constructor(private logFile: DataFile<any>) { }

  public logResults(hubspot: Hubspot) {
    const stream = this.logFile.writeStream();
    hubspot.dealManager.getArray().forEach((entity) => this.logEntity(stream, entity));
    hubspot.contactManager.getArray().forEach((entity) => this.logEntity(stream, entity));
    hubspot.companyManager.getArray().forEach((entity) => this.logEntity(stream, entity));
    stream.close();
  }

  private logEntity(stream: LogWriteStream, entity: Entity<any>) {
    const fromKind = entity.kind;

    const properties = { ...entity.getPropertyChanges() };
    if (Object.keys(properties).length > 0) {
      const action = this.creating.has(entity) ? 'create' : 'update';
      const id = `${fromKind}:${this.idFor(entity)}`;
      stream.writeLine(stringify([action, id, properties]));
    }

    const upAssociations = entity.getAssociationChanges().filter(assoc => {
      const otherKind = assoc.other.kind;
      const found = entity.adapter.associations[otherKind];
      return found?.includes('up');
    });

    if (upAssociations.length > 0) {
      const id = `${fromKind}:${this.idFor(entity)}`;
      const associations = upAssociations.map(assoc => [
        assoc.op,
        `${assoc.other.kind}:${this.idFor(assoc.other)}`,
      ]);
      stream.writeLine(stringify(['associate', id, associations]));
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
