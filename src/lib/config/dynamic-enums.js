import { required } from "./helpers.js";

/** @enum {string} */
export const DealStage = {
  EVAL: required('HUBSPOT_DEALSTAGE_EVAL'),
  CLOSED_WON: required('HUBSPOT_DEALSTAGE_CLOSED_WON'),
  CLOSED_LOST: required('HUBSPOT_DEALSTAGE_CLOSED_LOST'),
};
