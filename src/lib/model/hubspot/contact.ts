import { HubspotEntity, HubspotProps } from "./entity.js";

type ContactProps = {
    email: string;
    firstname: string | null;
    lastname: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;

    contact_type: 'Partner' | 'Customer';

    country: string;
    region: string;

    hosting: string;
    deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple';

    related_products: string[];
    license_tier: number;
    last_mpac_event: string;
};

class Contact extends HubspotEntity<ContactProps> {

    override toAPI(): HubspotProps<ContactProps> {
        return {
            contact_type: this.props.contact_type,

            email: this.props.email,
            hosting: this.props.hosting,
            country: this.props.country,
            region: this.props.region,

            firstname: this.props.firstname?.trim() || '',
            lastname: this.props.lastname?.trim() || '',
            phone: this.props.phone?.trim() || '',
            city: this.props.city?.trim() || '',
            state: this.props.state?.trim() || '',

            related_products: this.props.related_products.join(';'),
            license_tier: this.props.license_tier.toFixed(),
            deployment: this.props.deployment,
            last_mpac_event: this.props.last_mpac_event,
        };
    }

    override fromAPI(data: HubspotProps<ContactProps>): ContactProps {
        return {
            contact_type: data.contact_type as ContactProps['contact_type'],

            email: data.email,
            hosting: data.hosting,
            country: data.country,
            region: data.region,

            firstname: data.firstname || '',
            lastname: data.lastname || '',
            phone: data.phone || '',
            city: data.city || '',
            state: data.state || '',

            related_products: data.related_products ? data.related_products.split(';') : [],
            license_tier: +data.license_tier,
            deployment: data.deployment as ContactProps['deployment'],
            last_mpac_event: data.last_mpac_event,
        };
    }

}
