import { LightningElement, api } from 'lwc';

const DEFAULT_CONFIG = Object.freeze({
    source: 'force-app',
    flags: '',
    'default-namespace': '',
    version: 'latest'
});

export default class aerConfiguration extends LightningElement {
    _value = '';
    _readOnly = false;

    config = { ...DEFAULT_CONFIG };
    errorMessage = '';

    @api
    get value() {
        return this._value;
    }

    set value(nextValue) {
        this._value = typeof nextValue === 'string' ? nextValue : '';
        this.config = this.normalizeConfig(this.parseConfig(this._value));
    }

    @api
    get readOnly() {
        return this._readOnly;
    }

    set readOnly(nextValue) {
        this._readOnly = nextValue === true || nextValue === 'true';
    }

    connectedCallback() {
        this.config = this.normalizeConfig(this.parseConfig(this._value));
    }

    @api
    getValue() {
        return JSON.stringify(this.config);
    }

    @api
    getConfig() {
        return this.getValue();
    }

    @api
    validate() {
        this.errorMessage = '';
        const source = (this.config.source || '').trim();

        if (!source) {
            this.errorMessage = 'source is required';
            return {
                isValid: false,
                errorMessage: this.errorMessage
            };
        }

        return {
            isValid: true,
            errorMessage: ''
        };
    }

    get sourceValue() {
        return this.config.source;
    }

    get flagsValue() {
        return this.config.flags;
    }

    get defaultNamespaceValue() {
        return this.config['default-namespace'];
    }

    get versionValue() {
        return this.config.version;
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        if (!field) {
            return;
        }

        this.config = {
            ...this.config,
            [field]: event.target.value
        };

        this.config = this.normalizeConfig(this.config);
        this.validate();
        this.emitValue();
    }

    parseConfig(rawValue) {
        if (!rawValue || typeof rawValue !== 'string') {
            return { ...DEFAULT_CONFIG };
        }

        try {
            const parsed = JSON.parse(rawValue);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch {
            return { ...DEFAULT_CONFIG };
        }

        return { ...DEFAULT_CONFIG };
    }

    normalizeConfig(value) {
        const normalized = {
            ...DEFAULT_CONFIG,
            ...(value || {})
        };

        normalized.source = (normalized.source || DEFAULT_CONFIG.source).toString();
        normalized.flags = (normalized.flags || '').toString();
        normalized['default-namespace'] = (normalized['default-namespace'] || '').toString();
        normalized.version = (normalized.version || DEFAULT_CONFIG.version).toString();

        return normalized;
    }

    emitValue() {
        const serialized = JSON.stringify(this.config);
        this._value = serialized;

        const detail = { value: serialized };

        this.dispatchEvent(
            new CustomEvent('change', {
                detail,
                bubbles: true,
                composed: true
            })
        );

        this.dispatchEvent(
            new CustomEvent('valuechange', {
                detail,
                bubbles: true,
                composed: true
            })
        );
    }
}
