type HubspotEntityCtorOptions<T> = (
    { props: T } |
    { props: { [key: string]: string }, id: string }
);

export type HubspotProps<T> = {
    [K in keyof T]: string;
};

export abstract class HubspotEntity<T extends { [key: string]: any }> {

    id?: string;
    props: T;
    newProps: Partial<T>;

    constructor(options: HubspotEntityCtorOptions<T>) {
        if ('id' in options) {
            this.id = options.id;
            this.props = this.fromAPI(options.props as HubspotProps<T>);
        }
        else {
            this.props = options.props;
        }
        this.newProps = {};
    }

    abstract toAPI(): HubspotProps<T>;
    abstract fromAPI(data: HubspotProps<T>): T;

    set<K extends keyof T>(key: K, val: T[K]) {
        const oldVal = this.props[key];
        if (oldVal === val) {
            delete this.newProps[key];
        }
        else {
            this.newProps[key] = val;
        }
    }

    hasChanges() {
        return Object.keys(this.newProps).length > 0;
    }

    applyUpdates() {
        Object.assign(this.props, this.newProps);
    }

}
