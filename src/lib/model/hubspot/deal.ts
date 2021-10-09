import { DealStage, Pipeline } from "../../config/dynamic-enums.js";
import { HubspotEntity, HubspotProps } from "./entity.js";

type DealProps = {
    related_products: string;
    aa_app: string;
    addonLicenseId: string | null;
    transactionId: string | null;
    closedate: string;
    country: string;
    dealname: string;
    origin: 'MPAC Lead';
    deployment: 'Server' | 'Cloud' | 'Data Center';
    license_tier: number;
    pipeline: Pipeline;
    dealstage: DealStage;
    amount: number | null;
};

class Deal extends HubspotEntity<DealProps> {

    override toAPI(): HubspotProps<DealProps> {
        return {
            related_products: this.props.related_products,
            aa_app: this.props.aa_app,
            addonLicenseId: this.props.addonLicenseId || '',
            transactionId: this.props.transactionId || '',
            closedate: this.props.closedate,
            country: this.props.country,
            dealname: this.props.dealname,
            origin: this.props.origin,
            deployment: this.props.deployment,
            license_tier: this.props.license_tier.toFixed(),
            pipeline: this.props.pipeline,
            dealstage: this.props.dealstage,
            amount: this.props.amount?.toString() ?? '',
        };
    }

    override fromAPI(data: HubspotProps<DealProps>): DealProps {
        return {
            related_products: data.related_products,
            aa_app: data.aa_app,
            addonLicenseId: data.addonLicenseId,
            transactionId: data.transactionId,
            closedate: data.closedate,
            country: data.country,
            dealname: data.dealname,
            origin: data.origin as DealProps['origin'],
            deployment: data.deployment as DealProps['deployment'],
            license_tier: +data.license_tier,
            pipeline: data.pipeline,
            dealstage: data.dealstage,
            amount: data.amount === '' ? null : +data.amount,
        };
    }

}
