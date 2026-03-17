@IsTest
private class AerConfigExpressionTest {
    @IsTest
    static void executeReturnsMergedConfigForTestContext() {
        copado__ExtensionConfiguration__c extensionConfiguration = insertExtensionConfiguration(
            'aer config test',
            '{"source":["force-app"],"flags":"--verbose","defaultNamespace":"base","version":"latest"}'
        );
        copado__Test__c testRecord = insertTest(
            'aer test config',
            extensionConfiguration.Id,
            '{"source":["pkg"],"defaultNamespace":"override"}'
        );

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(testRecord.Id);
        Test.stopTest();

        Map<String, Object> parsed = parseConfig(resolvedConfig);
        assertResolvedConfig(parsed, 'override', '--verbose', 'latest', 'pkg');
    }

    @IsTest
    static void executeReturnsMergedConfigForJobExecutionContext() {
        copado__ExtensionConfiguration__c extensionConfiguration = insertExtensionConfiguration(
            'job execution config',
            '{"source":["force-app"],"flags":"--verbose","defaultNamespace":"base","version":"latest"}'
        );
        copado__Test__c testRecord = insertTest(
            'job execution test',
            extensionConfiguration.Id,
            '{"source":["pkg"],"defaultNamespace":"override"}'
        );
        copado__JobExecution__c jobExecution = insertJobExecution(
            '{"testIds":["' + testRecord.Id + '","","not-an-id"],"extensionConfigurationId":"' +
            extensionConfiguration.Id +
            '"}'
        );

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(jobExecution.Id);
        Test.stopTest();

        Map<String, Object> parsed = parseConfig(resolvedConfig);
        assertResolvedConfig(parsed, 'override', '--verbose', 'latest', 'pkg');
    }

    @IsTest
    static void executeReturnsMergedConfigForJobStepContext() {
        copado__ExtensionConfiguration__c extensionConfiguration = insertExtensionConfiguration(
            'job step config',
            '{"source":["force-app"],"flags":"--verbose","defaultNamespace":"base","version":"latest"}'
        );
        copado__Test__c testRecord = insertTest(
            'job step test',
            extensionConfiguration.Id,
            '{"source":["pkg"],"defaultNamespace":"override"}'
        );
        copado__JobExecution__c jobExecution = insertJobExecution(
            '{"testIds":["' + testRecord.Id + '"]}'
        );
        copado__JobStep__c jobStep = new copado__JobStep__c(
            Name = 'run aer test',
            copado__ApiName__c = 'run_aer_test',
            copado__JobExecution__c = jobExecution.Id,
            copado__Order__c = 1,
            copado__Type__c = 'Function'
        );
        insert jobStep;

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(jobStep.Id);
        Test.stopTest();

        Map<String, Object> parsed = parseConfig(resolvedConfig);
        assertResolvedConfig(parsed, 'override', '--verbose', 'latest', 'pkg');
    }

    @IsTest
    static void executeReturnsExtensionDefaultsWhenTestConfigIsInvalidJson() {
        copado__ExtensionConfiguration__c extensionConfiguration = insertExtensionConfiguration(
            'invalid config fallback',
            '{"source":["force-app"],"flags":"--verbose","defaultNamespace":"base","version":"latest"}'
        );
        copado__Test__c testRecord = insertTest(
            'invalid test config',
            extensionConfiguration.Id,
            '{invalid-json'
        );

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(testRecord.Id);
        Test.stopTest();

        Map<String, Object> parsed = parseConfig(resolvedConfig);
        assertResolvedConfig(parsed, 'base', '--verbose', 'latest', 'force-app');
    }

    @IsTest
    static void executeReturnsEmptyJsonForUnsupportedContext() {
        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(UserInfo.getUserId());
        Test.stopTest();

        System.assertEquals('{}', resolvedConfig);
    }

    @IsTest
    static void executeReturnsEmptyJsonForNullContext() {
        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(null);
        Test.stopTest();

        System.assertEquals('{}', resolvedConfig);
    }

    @IsTest
    static void executeReturnsEmptyJsonForInvalidJobExecutionData() {
        copado__JobExecution__c jobExecution = insertJobExecution('not-json');

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(jobExecution.Id);
        Test.stopTest();

        System.assertEquals('{}', resolvedConfig);
    }

    @IsTest
    static void executeReturnsEmptyJsonWhenTestsDoNotShareConfiguration() {
        copado__ExtensionConfiguration__c firstExtensionConfiguration = insertExtensionConfiguration(
            'first config',
            null
        );
        copado__ExtensionConfiguration__c secondExtensionConfiguration = insertExtensionConfiguration(
            'second config',
            '{"source":["force-app"],"flags":"--json","defaultNamespace":"base","version":"latest"}'
        );
        copado__Test__c firstTest = insertTest(
            'first conflicting test',
            firstExtensionConfiguration.Id,
            '{"defaultNamespace":"one"}'
        );
        copado__Test__c secondTest = insertTest(
            'second conflicting test',
            secondExtensionConfiguration.Id,
            '{"defaultNamespace":"two"}'
        );
        copado__JobExecution__c jobExecution = insertJobExecution(
            '{"testIds":["' + firstTest.Id + '","' + secondTest.Id + '"]}'
        );

        Test.startTest();
        String resolvedConfig = new AerConfigExpression().execute(jobExecution.Id);
        Test.stopTest();

        System.assertEquals('{}', resolvedConfig);
    }

    private static copado__ExtensionConfiguration__c insertExtensionConfiguration(
        String name,
        String detailsJson
    ) {
        copado__ExtensionConfiguration__c extensionConfiguration = new copado__ExtensionConfiguration__c(
            Name = name,
            copado__Active__c = true,
            copado__ExtensionApplication__c = 'Test',
            copado__ExtensionTool__c = 'Manual Tests',
            copado__Status__c = 'Active',
            copado__TestType__c = 'aer test',
            copado__Details__c = detailsJson
        );
        insert extensionConfiguration;
        return extensionConfiguration;
    }

    private static copado__Test__c insertTest(
        String name,
        Id extensionConfigurationId,
        String configurationJson
    ) {
        copado__Test__c testRecord = new copado__Test__c(
            Name = name,
            copado__Configuration__c = configurationJson,
            copado__ExtensionConfiguration__c = extensionConfigurationId,
            copado__Status__c = 'Draft'
        );
        insert testRecord;
        return testRecord;
    }

    private static copado__JobExecution__c insertJobExecution(String dataJson) {
        copado__JobExecution__c jobExecution = new copado__JobExecution__c(
            copado__Status__c = 'Not Started',
            copado__DataJson__c = dataJson
        );
        insert jobExecution;
        return jobExecution;
    }

    private static Map<String, Object> parseConfig(String resolvedConfig) {
        return (Map<String, Object>)JSON.deserializeUntyped(resolvedConfig);
    }

    private static void assertResolvedConfig(
        Map<String, Object> parsed,
        String expectedDefaultNamespace,
        String expectedFlags,
        String expectedVersion,
        String expectedSource
    ) {
        System.assertEquals(expectedDefaultNamespace, (String)parsed.get('defaultNamespace'));
        System.assertEquals(expectedFlags, (String)parsed.get('flags'));
        System.assertEquals(expectedVersion, (String)parsed.get('version'));

        List<Object> sourcePaths = (List<Object>)parsed.get('source');
        System.assertEquals(1, sourcePaths.size());
        System.assertEquals(expectedSource, (String)sourcePaths[0]);
    }
}
