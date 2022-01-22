import HubspotAPI from "../../io/hubspot";
import { isPresent } from "../../util/helpers";
import { EntityAdapter } from "./interfaces";
import { typedEntries } from "./manager";

export async function downloadHubspotEntities<D, C>(downloader: HubspotAPI, entityAdapter: EntityAdapter<D, C>) {
  const downAssociations = (entityAdapter.associations
    .filter(([kind, dir]) => dir.includes('down'))
    .map(([kind, dir]) => kind));

  const apiProperties = [
    ...typedEntries(entityAdapter.data).map(([k, v]) => v.property).filter(isPresent),
    ...typedEntries(entityAdapter.computed).flatMap(([k, v]) => v.properties),
  ];

  return await downloader.downloadEntities(entityAdapter.kind, apiProperties, downAssociations);
}
