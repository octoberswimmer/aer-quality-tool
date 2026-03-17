import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { getFieldValue, getRecord, updateRecord } from "lightning/uiRecordApi";
import EXTENSION_CONFIGURATION_ACCEPTANCE_CRITERIA_FIELD from "@salesforce/schema/copado__ExtensionConfiguration__c.copado__AcceptanceCriteria__c";
import EXTENSION_CONFIGURATION_DETAILS_FIELD from "@salesforce/schema/copado__ExtensionConfiguration__c.copado__Details__c";
import TEST_CONFIGURATION_FIELD from "@salesforce/schema/copado__Test__c.copado__Configuration__c";
import TEST_EXTENSION_CONFIGURATION_FIELD from "@salesforce/schema/copado__Test__c.copado__ExtensionConfiguration__c";

const DEFAULT_CONFIG = Object.freeze({
  source: ["force-app"],
  flags: "",
  defaultNamespace: "",
  version: "latest"
});
const EXTENSION_CONFIGURATION_OBJECT = "copado__ExtensionConfiguration__c";
const TEST_OBJECT = "copado__Test__c";
const EXTENSION_CONFIGURATION_FIELDS = [
  EXTENSION_CONFIGURATION_DETAILS_FIELD,
  EXTENSION_CONFIGURATION_ACCEPTANCE_CRITERIA_FIELD
];
const TEST_FIELDS = [
  TEST_CONFIGURATION_FIELD,
  TEST_EXTENSION_CONFIGURATION_FIELD
];

export default class aerConfiguration extends LightningElement {
  _value = "";
  _readOnly = false;
  _objectApiName = null;
  _recordId = null;
  hasExternalValue = false;
  hasLoadedInitialValue = false;

  config = { ...DEFAULT_CONFIG };
  errorMessage = "";
  statusMessage = "";
  isSaving = false;
  toolConfigurationId = null;
  recordFields = [];
  saveFieldApiName = null;

  @api
  get recordId() {
    return this._recordId;
  }

  set recordId(value) {
    const nextRecordId = value || null;
    if (nextRecordId !== this._recordId) {
      this._recordId = nextRecordId;
      this.resetRecordState();
    }
  }

  @api
  get objectApiName() {
    return this._objectApiName;
  }

  set objectApiName(value) {
    const nextObjectApiName = value || null;
    if (nextObjectApiName !== this._objectApiName) {
      this._objectApiName = nextObjectApiName;
      this.resetRecordState();
    }
  }

  @api
  get value() {
    return this._value;
  }

  set value(nextValue) {
    this._value = typeof nextValue === "string" ? nextValue : "";
    this.hasExternalValue = this._value.trim() !== "";
    this.hasLoadedInitialValue = this.hasExternalValue;
    this.config = this.normalizeConfig(this.parseConfig(this._value));
  }

  @api
  get readOnly() {
    return this._readOnly;
  }

  set readOnly(nextValue) {
    this._readOnly = nextValue === true || nextValue === "true";
  }

  connectedCallback() {
    this.config = this.normalizeConfig(this.parseConfig(this._value));
  }

  @wire(CurrentPageReference)
  wiredPageReference(pageReference) {
    if (!pageReference) {
      return;
    }

    this.applyPageReferenceContext(
      pageReference.attributes?.recordId ||
        pageReference.state?.recordId ||
        pageReference.state?.c__recordId ||
        null,
      pageReference.attributes?.objectApiName ||
        pageReference.state?.objectApiName ||
        pageReference.state?.c__objectApiName ||
        null
    );
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$recordFields" })
  wiredCurrentRecord({ data, error }) {
    if (error) {
      this.errorMessage = this.reduceError(error);
      return;
    }

    if (!data || this.hasLoadedInitialValue || !this.objectApiName) {
      return;
    }

    if (this.objectApiName === EXTENSION_CONFIGURATION_OBJECT) {
      this.applyConfigValue(
        getFieldValue(data, EXTENSION_CONFIGURATION_DETAILS_FIELD) ||
          getFieldValue(data, EXTENSION_CONFIGURATION_ACCEPTANCE_CRITERIA_FIELD)
      );
      return;
    }

    if (this.objectApiName !== TEST_OBJECT) {
      return;
    }

    const hasTestConfigurationField =
      Object.prototype.hasOwnProperty.call(
        data.fields || {},
        TEST_CONFIGURATION_FIELD.fieldApiName
      ) ||
      Object.prototype.hasOwnProperty.call(
        data.fields || {},
        TEST_EXTENSION_CONFIGURATION_FIELD.fieldApiName
      );
    if (!hasTestConfigurationField) {
      return;
    }

    const testConfiguration = getFieldValue(data, TEST_CONFIGURATION_FIELD);
    if (typeof testConfiguration === "string" && testConfiguration.trim()) {
      this.applyConfigValue(testConfiguration);
      return;
    }

    this.toolConfigurationId = getFieldValue(
      data,
      TEST_EXTENSION_CONFIGURATION_FIELD
    );
    if (!this.toolConfigurationId) {
      this.hasLoadedInitialValue = true;
    }
  }

  @wire(getRecord, {
    recordId: "$toolConfigurationId",
    fields: EXTENSION_CONFIGURATION_FIELDS
  })
  wiredToolConfiguration({ data, error }) {
    if (error) {
      this.errorMessage = this.reduceError(error);
      return;
    }

    if (!data || this.hasLoadedInitialValue) {
      return;
    }

    const hasExtensionConfigurationField =
      Object.prototype.hasOwnProperty.call(
        data.fields || {},
        EXTENSION_CONFIGURATION_DETAILS_FIELD.fieldApiName
      ) ||
      Object.prototype.hasOwnProperty.call(
        data.fields || {},
        EXTENSION_CONFIGURATION_ACCEPTANCE_CRITERIA_FIELD.fieldApiName
      );
    if (!hasExtensionConfigurationField) {
      return;
    }

    this.applyConfigValue(
      getFieldValue(data, EXTENSION_CONFIGURATION_DETAILS_FIELD) ||
        getFieldValue(data, EXTENSION_CONFIGURATION_ACCEPTANCE_CRITERIA_FIELD)
    );
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
    this.errorMessage = "";
    const hasSource = this.config.source.some((value) => value.trim());

    if (!hasSource) {
      this.errorMessage = "source is required";
      return {
        isValid: false,
        errorMessage: this.errorMessage
      };
    }

    return {
      isValid: true,
      errorMessage: ""
    };
  }

  get sourceValues() {
    return this.config.source.map((value, index) => ({
      id: `source-${index}`,
      index,
      value,
      canRemove: this.config.source.length > 1
    }));
  }

  get flagsValue() {
    return this.config.flags;
  }

  get defaultNamespaceValue() {
    return this.config.defaultNamespace;
  }

  get versionValue() {
    return this.config.version;
  }

  get canSave() {
    return !this._readOnly && !this.isSaving;
  }

  get saveDisabled() {
    return !this.canSave;
  }

  get commandPreview() {
    const args = ["aer", "test"];
    const sourcePaths = this.config.source
      .map((value) => value.trim())
      .filter((value) => value);

    args.push(...sourcePaths.map((value) => this.quoteShellArg(value)));

    if (this.defaultNamespaceValue.trim()) {
      args.push(
        "--default-namespace",
        this.quoteShellArg(this.defaultNamespaceValue.trim())
      );
    }

    if (this.flagsValue.trim()) {
      args.push(this.flagsValue.trim());
    }

    args.push(
      "--junit=./aer-test-results.xml",
      "--coverage=./aer-coverage.json"
    );

    return args.join(" ");
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
    this.statusMessage = "";
    this.emitValue();
  }

  handleSourceChange(event) {
    const index = Number(event.target.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }

    const nextSources = [...this.config.source];
    nextSources[index] = event.target.value;

    this.config = this.normalizeConfig({
      ...this.config,
      source: nextSources
    });
    this.validate();
    this.statusMessage = "";
    this.emitValue();
  }

  handleAddSource() {
    this.config = this.normalizeConfig({
      ...this.config,
      source: [...this.config.source, ""]
    });
    this.statusMessage = "";
    this.emitValue();
  }

  handleRemoveSource(event) {
    const index = Number(event.target.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }

    const nextSources = this.config.source.filter(
      (_, itemIndex) => itemIndex !== index
    );

    this.config = this.normalizeConfig({
      ...this.config,
      source: nextSources
    });
    this.validate();
    this.statusMessage = "";
    this.emitValue();
  }

  handleSaveClick() {
    this.persistConfig();
  }

  parseConfig(rawValue) {
    if (!rawValue || typeof rawValue !== "string") {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === "object") {
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

    normalized.source = this.normalizeSources(normalized.source);
    normalized.flags = (normalized.flags || "").toString();
    normalized.defaultNamespace = (
      normalized.defaultNamespace || ""
    ).toString();
    normalized.version = (
      normalized.version || DEFAULT_CONFIG.version
    ).toString();

    return normalized;
  }

  emitValue() {
    const serialized = JSON.stringify(this.config);
    this._value = serialized;

    const detail = { value: serialized };

    this.dispatchEvent(
      new CustomEvent("change", {
        detail,
        bubbles: true,
        composed: true
      })
    );

    this.dispatchEvent(
      new CustomEvent("valuechange", {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }

  async persistConfig() {
    if (this._readOnly) {
      return;
    }

    const validation = this.validate();
    if (!validation.isValid) {
      return;
    }

    if (!this.recordId) {
      this.errorMessage =
        "unable to save settings: record context is unavailable";
      this.statusMessage = "";
      return;
    }

    if (!this.saveFieldApiName) {
      this.errorMessage = "unable to save settings: unsupported record type";
      this.statusMessage = "";
      return;
    }

    try {
      this.isSaving = true;
      const serializedConfig = JSON.stringify(this.config);
      this._value = serializedConfig;
      await updateRecord({
        fields: {
          Id: this.recordId,
          [this.saveFieldApiName]: serializedConfig
        }
      });
      this.errorMessage = "";
      this.statusMessage = "settings saved";
    } catch (error) {
      this.statusMessage = "";
      this.errorMessage = this.reduceError(error);
    } finally {
      this.isSaving = false;
    }
  }

  reduceError(error) {
    return (
      error?.body?.output?.errors?.[0]?.message ||
      error?.body?.message ||
      error?.message ||
      "unable to save settings"
    );
  }

  resetRecordState() {
    this.toolConfigurationId = null;
    this.errorMessage = "";
    this.statusMessage = "";

    if (this._objectApiName === EXTENSION_CONFIGURATION_OBJECT) {
      this.recordFields = EXTENSION_CONFIGURATION_FIELDS;
      this.saveFieldApiName =
        EXTENSION_CONFIGURATION_DETAILS_FIELD.fieldApiName;
    } else if (this._objectApiName === TEST_OBJECT) {
      this.recordFields = TEST_FIELDS;
      this.saveFieldApiName = TEST_CONFIGURATION_FIELD.fieldApiName;
    } else {
      this.recordFields = [];
      this.saveFieldApiName = null;
    }

    this.hasLoadedInitialValue = this.hasExternalValue;
    if (!this.hasExternalValue) {
      this._value = "";
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  applyConfigValue(configValue) {
    this.hasLoadedInitialValue = true;

    if (typeof configValue !== "string" || !configValue.trim()) {
      return;
    }

    this._value = configValue;
    this.config = this.normalizeConfig(this.parseConfig(configValue));
  }

  normalizeSources(sourceValue) {
    const values = Array.isArray(sourceValue)
      ? sourceValue
      : typeof sourceValue === "string"
      ? [sourceValue]
      : Array.isArray(DEFAULT_CONFIG.source)
      ? [...DEFAULT_CONFIG.source]
      : [DEFAULT_CONFIG.source];

    const normalizedValues = values.map((value) => {
      return value == null ? "" : value.toString();
    });

    return normalizedValues.length > 0
      ? normalizedValues
      : [...DEFAULT_CONFIG.source];
  }

  quoteShellArg(value) {
    if (!value) {
      return "''";
    }

    if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
      return value;
    }

    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  applyPageReferenceContext(recordId, objectApiName) {
    let hasChanges = false;

    if (!this._recordId && recordId) {
      this._recordId = recordId;
      hasChanges = true;
    }

    if (!this._objectApiName && objectApiName) {
      this._objectApiName = objectApiName;
      hasChanges = true;
    }

    if (hasChanges) {
      this.resetRecordState();
    }
  }
}
