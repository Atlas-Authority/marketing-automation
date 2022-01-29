import util from 'util';
import { DataFile, LogWriteStream } from '../data/file';
import { Entity } from '../hubspot/entity';
import { Hubspot } from '../hubspot/hubspot';
import { withAutoClose } from '../util/helpers';

export class HubspotOutputLogger {

  private creating = new Set<Entity<any>>();

  constructor(private logFile: DataFile<any>) { }

  public logResults(hubspot: Hubspot) {
    withAutoClose(this.logFile.writeStream(), stream => {
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
      const id = `${fromKind}:${entity.id!}`;
      stream.writeLine(stringify([action, id, properties]));
    }

    const upAssociations = entity.getAssociationChanges().filter(assoc => {
      const otherKind = assoc.other.kind;
      const found = entity.adapter.associations[otherKind];
      return found?.includes('up');
    });

    if (upAssociations.length > 0) {
      const id = `${fromKind}:${entity.id!}`;
      const associations = upAssociations.map(assoc => [
        assoc.op,
        `${assoc.other.kind}:${assoc.other.id!}`,
      ]);
      stream.writeLine(stringify(['associate', id, associations]));
    }
  }

}

function stringify(o: any) {
  return util.inspect(o, {
    depth: null,
    breakLength: 80,
  });
}
