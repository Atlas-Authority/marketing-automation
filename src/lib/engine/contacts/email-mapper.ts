import { mpacConfigFromENV } from "../../config/env";

export const mapEmail = (email: any) => {
  if (email) {
    let substitute = mpacConfigFromENV().emailMappings?.[email];
    if (substitute) {
      return substitute
    }
  }
  return email
}
