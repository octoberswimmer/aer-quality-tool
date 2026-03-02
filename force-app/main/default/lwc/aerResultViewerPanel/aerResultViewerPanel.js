import { LightningElement, api, track, wire } from 'lwc';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';

import LATEST_PUBLISHED_VERSION_FIELD from '@salesforce/schema/ContentDocumentLink.ContentDocument.LatestPublishedVersionId';
import TITLE_FIELD from '@salesforce/schema/ContentDocumentLink.ContentDocument.Title';
import FILE_TYPE_FIELD from '@salesforce/schema/ContentDocumentLink.ContentDocument.FileType';
import VERSION_DATA_FIELD from '@salesforce/schema/ContentVersion.VersionData';

const SUMMARY_COLUMNS = [
    { fieldName: 'metric', label: 'Metric', type: 'text' },
    { fieldName: 'value', label: 'Value', type: 'text' }
];

const COVERAGE_COLUMNS = [
    { fieldName: 'className', label: 'Class', type: 'text' },
    { fieldName: 'coverageText', label: 'Coverage', type: 'text' },
    { fieldName: 'linesText', label: 'Lines Covered', type: 'text' }
];

const FAILED_COLUMNS = [
    { fieldName: 'name', label: 'Test', type: 'text' },
    { fieldName: 'message', label: 'Failure Message', type: 'text' }
];

const TEST_COLUMNS = [
    { fieldName: 'status', label: 'Status', type: 'text' },
    { fieldName: 'name', label: 'Test', type: 'text' },
    { fieldName: 'durationText', label: 'Duration', type: 'text' }
];

const FILE_COLUMNS = [
    {
        fieldName: 'downloadUrl',
        label: 'File',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'title' },
            target: '_blank'
        }
    },
    { fieldName: 'fileType', label: 'Type', type: 'text' },
    { fieldName: 'contentSizeText', label: 'Size', type: 'text' }
];

const MAX_ALL_TEST_ROWS = 300;

export default class AerResultViewerPanel extends LightningElement {
    @api recordId;

    @track errorMessage;
    @track summary = this.newSummary();
    @track summaryRows = [];
    @track coverageRows = [];
    @track failingRows = [];
    @track slowestRows = [];
    @track allRows = [];
    @track fileRows = [];
    @track coverageBarText = '';

    summaryColumns = SUMMARY_COLUMNS;
    coverageColumns = COVERAGE_COLUMNS;
    failedColumns = FAILED_COLUMNS;
    testColumns = TEST_COLUMNS;
    fileColumns = FILE_COLUMNS;

    relatedFiles = [];
    junitVersionId;
    coverageVersionId;
    summaryVersionId;

    junitText;
    coverageText;
    summaryText;

    linksLoaded = false;
    junitLoaded = false;
    coverageLoaded = false;
    summaryLoaded = false;

    @wire(getRelatedListRecords, {
        fields: [
            `${LATEST_PUBLISHED_VERSION_FIELD.objectApiName}.${LATEST_PUBLISHED_VERSION_FIELD.fieldApiName}`,
            `${TITLE_FIELD.objectApiName}.${TITLE_FIELD.fieldApiName}`,
            `${FILE_TYPE_FIELD.objectApiName}.${FILE_TYPE_FIELD.fieldApiName}`
        ],
        parentRecordId: '$recordId',
        relatedListId: 'ContentDocumentLinks'
    })
    relatedLinksInfo({ data, error }) {
        this.linksLoaded = true;

        if (error) {
            this.errorMessage = this.reduceError(error);
            this.refreshComputedData();
            return;
        }

        if (!data) {
            return;
        }

        this.errorMessage = undefined;
        this.relatedFiles = (data.records || []).map((doc) => {
            const title = getFieldValue(doc, TITLE_FIELD) || 'attachment';
            const latestVersionId = getFieldValue(doc, LATEST_PUBLISHED_VERSION_FIELD);
            const fileType = getFieldValue(doc, FILE_TYPE_FIELD) || '';

            return {
                title,
                latestVersionId,
                fileType,
                key: latestVersionId || title,
                downloadUrl: latestVersionId
                    ? `/sfc/servlet.shepherd/version/download/${latestVersionId}`
                    : null,
                contentSizeText: ''
            };
        });

        this.junitVersionId = this.findVersionId('aer-test-results');
        this.coverageVersionId = this.findVersionId('aer-coverage');
        this.summaryVersionId = this.findVersionId('aer-results-summary');

        this.junitLoaded = !this.junitVersionId;
        this.coverageLoaded = !this.coverageVersionId;
        this.summaryLoaded = !this.summaryVersionId;

        this.fileRows = this.relatedFiles.filter((file) => file.downloadUrl);
        this.refreshComputedData();
    }

    @wire(getRecord, { recordId: '$junitVersionId', fields: [VERSION_DATA_FIELD] })
    junitRecord({ data, error }) {
        if (!this.junitVersionId) {
            return;
        }

        this.junitLoaded = true;

        if (error) {
            this.errorMessage = this.reduceError(error);
            this.refreshComputedData();
            return;
        }

        if (data) {
            const encoded = getFieldValue(data, VERSION_DATA_FIELD);
            this.junitText = this.b64DecodeUnicode(encoded);
            this.refreshComputedData();
        }
    }

    @wire(getRecord, { recordId: '$coverageVersionId', fields: [VERSION_DATA_FIELD] })
    coverageRecord({ data, error }) {
        if (!this.coverageVersionId) {
            return;
        }

        this.coverageLoaded = true;

        if (error) {
            this.errorMessage = this.reduceError(error);
            this.refreshComputedData();
            return;
        }

        if (data) {
            const encoded = getFieldValue(data, VERSION_DATA_FIELD);
            this.coverageText = this.b64DecodeUnicode(encoded);
            this.refreshComputedData();
        }
    }

    @wire(getRecord, { recordId: '$summaryVersionId', fields: [VERSION_DATA_FIELD] })
    summaryRecord({ data, error }) {
        if (!this.summaryVersionId) {
            return;
        }

        this.summaryLoaded = true;

        if (error) {
            this.errorMessage = this.reduceError(error);
            this.refreshComputedData();
            return;
        }

        if (data) {
            const encoded = getFieldValue(data, VERSION_DATA_FIELD);
            this.summaryText = this.b64DecodeUnicode(encoded);
            this.refreshComputedData();
        }
    }

    get isLoading() {
        return !this.linksLoaded || !this.junitLoaded || !this.coverageLoaded || !this.summaryLoaded;
    }

    get statusBadge() {
        return this.summary.status || 'Unknown';
    }

    get statusClass() {
        const status = (this.summary.status || '').toLowerCase();
        if (status === 'passed') {
            return 'status-pill status-pass';
        }
        if (status === 'failed') {
            return 'status-pill status-fail';
        }
        return 'status-pill status-neutral';
    }

    get hasCoverage() {
        return this.coverageRows.length > 0 || this.coverageBarText;
    }

    get hasCoverageRows() {
        return this.coverageRows.length > 0;
    }

    get hasFailures() {
        return this.failingRows.length > 0;
    }

    get hasSlowestTests() {
        return this.slowestRows.length > 0;
    }

    get hasAllTests() {
        return this.allRows.length > 0;
    }

    get hasFiles() {
        return this.fileRows.length > 0;
    }

    get allTestsFootnote() {
        if (this.summary.totalTests > MAX_ALL_TEST_ROWS) {
            return `Showing first ${MAX_ALL_TEST_ROWS} of ${this.summary.totalTests} tests`;
        }
        return '';
    }

    findVersionId(partialName) {
        const target = partialName.toLowerCase();
        const match = this.relatedFiles.find((file) =>
            (file.title || '').toLowerCase().includes(target)
        );
        return match?.latestVersionId;
    }

    refreshComputedData() {
        const junit = this.parseJunit(this.junitText);
        const coverage = this.parseCoverage(this.coverageText);
        const summaryJson = this.parseJson(this.summaryText);

        let status = 'Unknown';
        let statusDetail = this.fileRows.length > 0 ? 'Attached files found' : 'No test files found';
        let totalTests = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let durationSeconds = 0;

        let failingRows = [];
        let allRows = [];
        let slowestRows = [];
        let coverageRows = [];
        let coverageBarText = '';

        if (junit) {
            totalTests = junit.totalTests;
            passed = junit.passed;
            failed = junit.failed;
            skipped = junit.skipped;
            durationSeconds = junit.durationSeconds;
            failingRows = junit.failingTests;
            allRows = junit.allTests.slice(0, MAX_ALL_TEST_ROWS);
            slowestRows = [...junit.allTests]
                .sort((a, b) => b.durationSeconds - a.durationSeconds)
                .slice(0, 10);

            status = failed > 0 ? 'Failed' : 'Passed';
            statusDetail = failed > 0
                ? `${failed} failed, ${passed} passed`
                : `${passed}/${totalTests} tests passed`;
        }

        let coverageText = 'n/a';
        let coveredLines = 0;
        let totalLines = 0;

        if (coverage) {
            coverageText = `${coverage.overallCoverage.toFixed(2)}%`;
            coveredLines = coverage.coveredLines;
            totalLines = coverage.totalLines;
            coverageBarText = this.generateCoverageBar(coverage.overallCoverage);

            const aggregated = this.aggregateCoverageByTopLevel(coverage.classes)
                .sort((a, b) => b.percentage - a.percentage);

            coverageRows = aggregated.map((cls) => ({
                key: cls.className,
                className: cls.className,
                coverageText: `${this.coverageEmoji(cls.percentage)} ${cls.percentage.toFixed(1)}% ${this.generateMiniBar(cls.percentage)}`,
                linesText: `${cls.coveredCount} / ${cls.totalLines}`
            }));
        }

        if (!junit && summaryJson) {
            const exitCode = Number(summaryJson.exitCode);
            if (Number.isFinite(exitCode)) {
                status = exitCode === 0 ? 'Passed' : 'Failed';
                statusDetail = `exit code ${exitCode}`;
            }
        }

        this.summary = {
            status,
            statusDetail,
            totalTests,
            passed,
            failed,
            skipped,
            durationText: this.formatDurationSeconds(durationSeconds),
            coverageText,
            coveredLines,
            totalLines
        };

        this.summaryRows = this.buildSummaryRows(this.summary);
        this.failingRows = failingRows;
        this.slowestRows = slowestRows;
        this.allRows = allRows;
        this.coverageRows = coverageRows;
        this.coverageBarText = coverageBarText;
    }

    buildSummaryRows(summary) {
        const rows = [
            { key: 'tests', metric: 'Total Tests', value: String(summary.totalTests) },
            { key: 'passed', metric: 'Passed', value: String(summary.passed) },
            { key: 'failed', metric: 'Failed', value: String(summary.failed) },
            { key: 'skipped', metric: 'Skipped', value: String(summary.skipped) },
            { key: 'duration', metric: 'Duration', value: summary.durationText },
            { key: 'coverage', metric: 'Code Coverage', value: summary.coverageText }
        ];

        if (summary.totalLines > 0) {
            rows.push({
                key: 'lines',
                metric: 'Lines Covered',
                value: `${summary.coveredLines} / ${summary.totalLines}`
            });
        }

        return rows;
    }

    parseJunit(xmlText) {
        if (!xmlText) {
            return null;
        }

        const parser = new DOMParser();
        const documentNode = parser.parseFromString(xmlText, 'text/xml');
        if (documentNode.querySelector('parsererror')) {
            return null;
        }

        const testCases = Array.from(documentNode.querySelectorAll('testcase'));
        if (testCases.length === 0) {
            return null;
        }

        let failed = 0;
        let skipped = 0;
        let durationSeconds = 0;
        const failingTests = [];

        const allTests = testCases.map((testCase, index) => {
            const className = testCase.getAttribute('classname') || '';
            const methodName = testCase.getAttribute('name') || `test_${index}`;
            const name = className ? `${className}.${methodName}` : methodName;

            const failureNode = testCase.querySelector('failure, error');
            const skippedNode = testCase.querySelector('skipped');
            const duration = this.toNumber(testCase.getAttribute('time')) || 0;
            durationSeconds += duration;

            let status = 'Passed';
            let message = '';

            if (skippedNode) {
                status = 'Skipped';
                skipped += 1;
            }

            if (failureNode) {
                status = 'Failed';
                failed += 1;
                message = failureNode.getAttribute('message') ||
                    (failureNode.textContent ? failureNode.textContent.trim() : '');
                failingTests.push({
                    key: `${name}-${index}`,
                    name,
                    message
                });
            }

            return {
                key: `${name}-${index}`,
                status,
                statusRaw: status,
                name,
                durationSeconds: duration,
                durationText: this.formatDurationSeconds(duration)
            };
        });

        const totalTests = allTests.length;
        const passed = Math.max(totalTests - failed - skipped, 0);

        return {
            totalTests,
            passed,
            failed,
            skipped,
            durationSeconds,
            failingTests,
            allTests
        };
    }

    parseCoverage(text) {
        const parsed = this.parseJson(text);
        if (!parsed) {
            return null;
        }

        const classes = Array.isArray(parsed.classes) ? parsed.classes : [];

        let totalLines = this.toNumber(parsed.totalLines);
        let coveredLines = this.toNumber(parsed.coveredLines);
        let overallCoverage = this.toNumber(parsed.overallCoverage);

        if (!Number.isFinite(totalLines)) {
            totalLines = this.toNumber(parsed.total);
        }
        if (!Number.isFinite(coveredLines)) {
            coveredLines = this.toNumber(parsed.covered);
        }

        if (!Number.isFinite(totalLines)) {
            totalLines = classes.reduce((sum, cls) => sum + (this.toNumber(cls.totalLines) || 0), 0);
        }
        if (!Number.isFinite(coveredLines)) {
            coveredLines = classes.reduce((sum, cls) => {
                const total = this.toNumber(cls.totalLines) || 0;
                const uncoveredCount = this.toNumber(cls.uncoveredCount);
                const uncoveredLinesArray = Array.isArray(cls.uncoveredLines) ? cls.uncoveredLines.length : 0;
                const coveredCount = this.toNumber(cls.coveredCount);

                if (Number.isFinite(coveredCount)) {
                    return sum + Math.max(coveredCount, 0);
                }
                if (Number.isFinite(uncoveredCount)) {
                    return sum + Math.max(total - uncoveredCount, 0);
                }
                return sum + Math.max(total - uncoveredLinesArray, 0);
            }, 0);
        }

        if (!Number.isFinite(overallCoverage)) {
            if (totalLines > 0) {
                overallCoverage = (coveredLines / totalLines) * 100;
            } else {
                overallCoverage = 0;
            }
        }

        if (overallCoverage <= 1) {
            overallCoverage *= 100;
        }

        overallCoverage = Number(overallCoverage.toFixed(2));

        return {
            classes,
            totalLines: Math.max(Math.floor(totalLines || 0), 0),
            coveredLines: Math.max(Math.floor(coveredLines || 0), 0),
            overallCoverage
        };
    }

    aggregateCoverageByTopLevel(classes) {
        const aggregates = new Map();

        (classes || []).forEach((cls) => {
            const className = (cls.className || '').trim();
            if (!className) {
                return;
            }

            let topLevelClass = (cls.topLevelClass || '').trim();
            if (!topLevelClass) {
                topLevelClass = className.includes('.')
                    ? className.split('.')[0]
                    : className;
            }

            const totalLines = this.toNumber(cls.totalLines) || 0;
            const coveredCountRaw = this.toNumber(cls.coveredCount);
            const uncoveredCountRaw = this.toNumber(cls.uncoveredCount);
            const uncoveredArray = Array.isArray(cls.uncoveredLines) ? cls.uncoveredLines.length : 0;
            const coveredCount = Number.isFinite(coveredCountRaw)
                ? coveredCountRaw
                : Number.isFinite(uncoveredCountRaw)
                    ? Math.max(totalLines - uncoveredCountRaw, 0)
                    : Math.max(totalLines - uncoveredArray, 0);

            const current = aggregates.get(topLevelClass) || {
                className: topLevelClass,
                totalLines: 0,
                coveredCount: 0,
                percentage: 0
            };

            current.totalLines += totalLines;
            current.coveredCount += coveredCount;
            aggregates.set(topLevelClass, current);
        });

        return Array.from(aggregates.values()).map((item) => {
            const percentage = item.totalLines > 0
                ? (item.coveredCount / item.totalLines) * 100
                : 0;

            return {
                ...item,
                percentage
            };
        });
    }

    parseJson(text) {
        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    b64DecodeUnicode(value) {
        if (!value) {
            return '';
        }

        return decodeURIComponent(atob(value)
            .split('')
            .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join(''));
    }

    toNumber(value) {
        const converted = Number(value);
        return Number.isFinite(converted) ? converted : NaN;
    }

    formatDurationSeconds(seconds) {
        const ms = seconds * 1000;
        if (ms < 1000) {
            return `${Math.round(ms)}ms`;
        }
        if (ms < 60000) {
            return `${seconds.toFixed(2)}s`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainder = seconds - (minutes * 60);
        return `${minutes}m ${remainder.toFixed(1)}s`;
    }

    coverageEmoji(percentage) {
        if (percentage >= 80) {
            return '[HIGH]';
        }
        if (percentage >= 60) {
            return '[MED]';
        }
        if (percentage >= 40) {
            return '[LOW]';
        }
        return '[RISK]';
    }

    generateCoverageBar(percentage) {
        const barLength = 50;
        const filled = Math.max(0, Math.min(barLength, Math.round((percentage / 100) * barLength)));
        const empty = barLength - filled;
        return `Coverage: ${percentage.toFixed(2)}% [${'■'.repeat(filled)}${'□'.repeat(empty)}]`;
    }

    generateMiniBar(percentage) {
        const barLength = 10;
        const filled = Math.max(0, Math.min(barLength, Math.round((percentage / 100) * barLength)));
        const empty = barLength - filled;
        return `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`;
    }

    newSummary() {
        return {
            status: 'Unknown',
            statusDetail: 'No test files found',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationText: '0ms',
            coverageText: 'n/a',
            coveredLines: 0,
            totalLines: 0
        };
    }

    reduceError(error) {
        if (!error) {
            return 'Unknown error';
        }

        if (Array.isArray(error.body)) {
            return error.body.map((entry) => entry.message).join(', ');
        }

        if (error.body?.message) {
            return error.body.message;
        }

        return error.message || 'Unknown error';
    }
}
