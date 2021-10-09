import { HubspotEntity, HubspotProps } from "./entity.js";

type CompanyProps = {
    name: string;
    type: 'Partner' | null;
};

class Company extends HubspotEntity<CompanyProps> {

    override toAPI(): HubspotProps<CompanyProps> {
        return {
            name: this.props.name,
            type: this.props.type === 'Partner' ? 'PARTNER' : '',
        };
    }

    override fromAPI(data: HubspotProps<CompanyProps>): CompanyProps {
        return {
            name: data.name,
            type: data.type === 'PARTNER' ? 'Partner' : null,
        };
    }

}
