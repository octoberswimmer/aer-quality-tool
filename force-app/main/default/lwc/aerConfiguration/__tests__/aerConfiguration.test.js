jest.mock(
  "lightning/uiRecordApi",
  () => {
    const {
      createLdsTestWireAdapter
    } = require("@salesforce/wire-service-jest-util");

    return {
      getRecord: createLdsTestWireAdapter(jest.fn()),
      getFieldValue: jest.fn(
        (record, field) => record?.fields?.[field.fieldApiName]?.value
      ),
      updateRecord: jest.fn(() => Promise.resolve())
    };
  },
  { virtual: true }
);

jest.mock(
  "lightning/navigation",
  () => {
    const {
      createTestWireAdapter
    } = require("@salesforce/wire-service-jest-util");

    return {
      CurrentPageReference: createTestWireAdapter(jest.fn())
    };
  },
  { virtual: true }
);

import { createElement } from "lwc";
import EXTENSION_CONFIGURATION_DETAILS_FIELD from "@salesforce/schema/copado__ExtensionConfiguration__c.copado__Details__c";
import TEST_CONFIGURATION_FIELD from "@salesforce/schema/copado__Test__c.copado__Configuration__c";
import TEST_EXTENSION_CONFIGURATION_FIELD from "@salesforce/schema/copado__Test__c.copado__ExtensionConfiguration__c";
import aerConfiguration from "c/aerConfiguration";
import { CurrentPageReference } from "lightning/navigation";
import { getRecord, updateRecord } from "lightning/uiRecordApi";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-aer-configuration", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }

    jest.clearAllMocks();
  });

  it("loads defaults", () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    document.body.appendChild(element);

    expect(element.getValue()).toBe(
      JSON.stringify({
        source: ["force-app"],
        flags: "",
        defaultNamespace: "",
        version: "latest"
      })
    );
    expect(element.shadowRoot.querySelector("pre").textContent).toBe(
      "aer test force-app --junit=./aer-test-results.xml --coverage=./aer-coverage.json"
    );
  });

  it("validates empty source", () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    element.value = JSON.stringify({
      source: [""],
      flags: "",
      defaultNamespace: "",
      version: "latest"
    });
    document.body.appendChild(element);

    const result = element.validate();
    expect(result.isValid).toBe(false);
  });

  it("loads extension configuration details directly from the record", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    element.recordId = "a0f000000000001AAA";
    element.objectApiName = "copado__ExtensionConfiguration__c";
    document.body.appendChild(element);

    getRecord.emit({
      fields: {
        [EXTENSION_CONFIGURATION_DETAILS_FIELD.fieldApiName]: {
          value: JSON.stringify({
            source: ["pkg", "pkg-2"],
            flags: "--verbose",
            defaultNamespace: "ns",
            version: "v1.2.3"
          })
        }
      }
    });

    await flushPromises();

    expect(element.getValue()).toBe(
      JSON.stringify({
        source: ["pkg", "pkg-2"],
        flags: "--verbose",
        defaultNamespace: "ns",
        version: "v1.2.3"
      })
    );
  });

  it("loads test defaults from the related tool configuration when test config is blank", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    element.recordId = "a1m000000000001AAA";
    element.objectApiName = "copado__Test__c";
    document.body.appendChild(element);

    getRecord.emit({
      fields: {
        [TEST_CONFIGURATION_FIELD.fieldApiName]: {
          value: ""
        },
        [TEST_EXTENSION_CONFIGURATION_FIELD.fieldApiName]: {
          value: "a0f000000000001AAA"
        }
      }
    });
    getRecord.emit({
      fields: {
        [EXTENSION_CONFIGURATION_DETAILS_FIELD.fieldApiName]: {
          value: JSON.stringify({
            source: ["pkg", "pkg-2"],
            flags: "--verbose",
            defaultNamespace: "ns",
            version: "v1.2.3"
          })
        }
      }
    });
    await flushPromises();

    expect(element.getValue()).toBe(
      JSON.stringify({
        source: ["pkg", "pkg-2"],
        flags: "--verbose",
        defaultNamespace: "ns",
        version: "v1.2.3"
      })
    );
  });

  it("persists edits to copado__Configuration__c for tests", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    element.recordId = "a1m000000000001AAA";
    element.objectApiName = "copado__Test__c";
    document.body.appendChild(element);

    const sourceInputs = element.shadowRoot.querySelectorAll("lightning-input");
    sourceInputs[0].value = "force-app";
    sourceInputs[0].dispatchEvent(new CustomEvent("change"));

    const addSourceButton =
      element.shadowRoot.querySelector("lightning-button");
    addSourceButton.click();
    await flushPromises();

    const nextSourceInputs =
      element.shadowRoot.querySelectorAll("lightning-input");
    nextSourceInputs[1].value = "unpackaged";
    nextSourceInputs[1].dispatchEvent(new CustomEvent("change"));

    const flagsInput = element.shadowRoot.querySelector(
      'lightning-input[data-field="flags"]'
    );
    flagsInput.value = "--verbose";
    flagsInput.dispatchEvent(new CustomEvent("change"));

    const saveButton =
      element.shadowRoot.querySelectorAll("lightning-button")[1];
    saveButton.click();
    await flushPromises();

    expect(updateRecord).toHaveBeenCalledWith({
      fields: {
        Id: "a1m000000000001AAA",
        [TEST_CONFIGURATION_FIELD.fieldApiName]: JSON.stringify({
          source: ["force-app", "unpackaged"],
          flags: "--verbose",
          defaultNamespace: "",
          version: "latest"
        })
      }
    });
  });

  it("renders a live command preview from the current settings", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    document.body.appendChild(element);

    const addSourceButton =
      element.shadowRoot.querySelector("lightning-button");
    addSourceButton.click();
    await flushPromises();

    const primarySourceInput = element.shadowRoot.querySelector(
      'lightning-input[data-index="0"]'
    );
    primarySourceInput.value = "force-app";
    primarySourceInput.dispatchEvent(new CustomEvent("change"));

    const secondarySourceInput = element.shadowRoot.querySelector(
      'lightning-input[data-index="1"]'
    );
    secondarySourceInput.value = "pkg dir";
    secondarySourceInput.dispatchEvent(new CustomEvent("change"));

    const namespaceInput = element.shadowRoot.querySelector(
      'lightning-input[data-field="defaultNamespace"]'
    );
    namespaceInput.value = "aertest";
    namespaceInput.dispatchEvent(new CustomEvent("change"));

    const flagsInput = element.shadowRoot.querySelector(
      'lightning-input[data-field="flags"]'
    );
    flagsInput.value = "--verbose --json";
    flagsInput.dispatchEvent(new CustomEvent("change"));

    const versionInput = element.shadowRoot.querySelector(
      'lightning-input[data-field="version"]'
    );
    versionInput.value = "v0.12.4";
    versionInput.dispatchEvent(new CustomEvent("change"));

    await flushPromises();

    expect(element.shadowRoot.querySelector("pre").textContent).toBe(
      "aer test force-app 'pkg dir' --default-namespace aertest --verbose --json --junit=./aer-test-results.xml --coverage=./aer-coverage.json"
    );
  });

  it("uses the current page reference record id and object type when one is not passed directly", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    document.body.appendChild(element);

    CurrentPageReference.emit({
      attributes: {
        recordId: "a1m000000000001AAA",
        objectApiName: "copado__Test__c"
      }
    });
    await flushPromises();

    const saveButton =
      element.shadowRoot.querySelectorAll("lightning-button")[1];
    saveButton.click();
    await flushPromises();

    expect(updateRecord).toHaveBeenCalledWith({
      fields: {
        Id: "a1m000000000001AAA",
        [TEST_CONFIGURATION_FIELD.fieldApiName]: JSON.stringify({
          source: ["force-app"],
          flags: "",
          defaultNamespace: "",
          version: "latest"
        })
      }
    });
  });

  it("removes a source directory and keeps a non-empty array", async () => {
    const element = createElement("c-aer-configuration", {
      is: aerConfiguration
    });
    document.body.appendChild(element);

    const addSourceButton =
      element.shadowRoot.querySelector("lightning-button");
    addSourceButton.click();
    await flushPromises();

    const sourceInputs = element.shadowRoot.querySelectorAll("lightning-input");
    sourceInputs[1].value = "unpackaged";
    sourceInputs[1].dispatchEvent(new CustomEvent("change"));

    const removeButtons = element.shadowRoot.querySelectorAll(
      "lightning-button-icon"
    );
    removeButtons[0].click();
    await flushPromises();

    expect(element.getValue()).toBe(
      JSON.stringify({
        source: ["unpackaged"],
        flags: "",
        defaultNamespace: "",
        version: "latest"
      })
    );
  });
});
