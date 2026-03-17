global without sharing class AerConfigExpression implements copado.ParameterExpressionCallable {
	global String execute(Id contextId) {
		if (contextId == null) {
			return '{}';
		}

		SObjectType contextType = contextId.getSObjectType();
		if (contextType == copado__Test__c.SObjectType) {
			return buildConfigForTests(new Set<Id>{ contextId }, null);
		}

		Id jobExecutionId = resolveJobExecutionId(contextId, contextType);
		if (jobExecutionId == null) {
			return '{}';
		}

		copado__JobExecution__c jobExecution = [
			SELECT
				copado__DataJson__c
			FROM
				copado__JobExecution__c
			WHERE
				Id = :jobExecutionId
			LIMIT 1
		];

		Map<String, Object> jobData = parseObject(jobExecution.copado__DataJson__c);
		return buildConfigForTests(extractIds(jobData.get('testIds')), extractSingleId(jobData.get('extensionConfigurationId')));
	}

	private static Id resolveJobExecutionId(Id contextId, SObjectType contextType) {
		if (contextType == copado__JobExecution__c.SObjectType) {
			return contextId;
		}

		if (contextType != copado__JobStep__c.SObjectType) {
			return null;
		}

		copado__JobStep__c jobStep = [
			SELECT
				copado__JobExecution__c
			FROM
				copado__JobStep__c
			WHERE
				Id = :contextId
			LIMIT 1
		];

		return jobStep.copado__JobExecution__c;
	}

	private static String buildConfigForTests(Set<Id> testIds, Id jobExtensionConfigurationId) {
		List<copado__Test__c> tests = testIds.isEmpty() ?
			new List<copado__Test__c>() :
			[
				SELECT
					copado__Configuration__c,
					copado__ExtensionConfiguration__c
				FROM
					copado__Test__c
				WHERE
					Id IN :testIds
				ORDER BY
					Id
			];

		Id extensionConfigurationId = resolveExtensionConfigurationId(jobExtensionConfigurationId, tests);
		Map<String, Object> mergedConfig = loadExtensionConfig(extensionConfigurationId);

		String commonTestConfiguration = resolveCommonTestConfiguration(tests);
		if (!String.isBlank(commonTestConfiguration)) {
			mergedConfig.putAll(parseObject(commonTestConfiguration));
		}

		return JSON.serialize(mergedConfig);
	}

	private static Id resolveExtensionConfigurationId(Id jobExtensionConfigurationId, List<copado__Test__c> tests) {
		if (jobExtensionConfigurationId != null) {
			return jobExtensionConfigurationId;
		}

		Id resolvedExtensionConfigurationId;
		for (copado__Test__c testRecord : tests) {
			if (testRecord.copado__ExtensionConfiguration__c == null) {
				continue;
			}

			if (resolvedExtensionConfigurationId == null) {
				resolvedExtensionConfigurationId = testRecord.copado__ExtensionConfiguration__c;
				continue;
			}

			if (resolvedExtensionConfigurationId != testRecord.copado__ExtensionConfiguration__c) {
				return null;
			}
		}

		return resolvedExtensionConfigurationId;
	}

	private static Map<String, Object> loadExtensionConfig(Id extensionConfigurationId) {
		if (extensionConfigurationId == null) {
			return new Map<String, Object>();
		}

		copado__ExtensionConfiguration__c extensionConfiguration = [
			SELECT
				copado__Details__c
			FROM
				copado__ExtensionConfiguration__c
			WHERE
				Id = :extensionConfigurationId
			LIMIT 1
		];

		return parseObject(extensionConfiguration.copado__Details__c);
	}

	private static String resolveCommonTestConfiguration(List<copado__Test__c> tests) {
		String commonConfiguration;
		for (copado__Test__c testRecord : tests) {
			if (String.isBlank(testRecord.copado__Configuration__c)) {
				continue;
			}

			String normalizedConfiguration = testRecord.copado__Configuration__c.trim();
			if (commonConfiguration == null) {
				commonConfiguration = normalizedConfiguration;
				continue;
			}

			if (commonConfiguration != normalizedConfiguration) {
				return null;
			}
		}

		return commonConfiguration;
	}

	private static Set<Id> extractIds(Object rawValue) {
		Set<Id> ids = new Set<Id>();
		if (!(rawValue instanceof List<Object>)) {
			return ids;
		}

		for (Object value : (List<Object>)rawValue) {
			Id recordId = extractSingleId(value);
			if (recordId != null) {
				ids.add(recordId);
			}
		}

		return ids;
	}

	private static Id extractSingleId(Object rawValue) {
		if (!(rawValue instanceof String) || String.isBlank((String)rawValue)) {
			return null;
		}

		try {
			return (Id)(String)rawValue;
		} catch (Exception ex) {
			return null;
		}
	}

	private static Map<String, Object> parseObject(String rawJson) {
		if (String.isBlank(rawJson)) {
			return new Map<String, Object>();
		}

		try {
			return (Map<String, Object>)JSON.deserializeUntyped(rawJson);
		} catch (Exception ex) {
			return new Map<String, Object>();
		}
	}
}
