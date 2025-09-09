// Analytics Examples for MindGarden Platform
// These scripts help analyze mgflow data, success rates, and troubleshooting

export const analyticsExamples = {
  mgflowMetrics: `// MGFlow Success Rate Analysis
// Analyze mgflow performance and identify optimization opportunities

function analyzeMGFlowMetrics(mgflowLogs, configData) {
  /**
   * Analyze mgflow performance metrics and trends
   * 
   * Args:
   *   mgflowLogs: Array of mgflow execution logs
   *   configData: Configuration object with analysis parameters
   * 
   * Returns:
   *   Comprehensive mgflow analytics report
   */
  
  const metrics = {
    analysis_type: 'mgflow_performance',
    timestamp: new Date().toISOString(),
    period: configData.period || '30_days',
    total_mgflows: mgflowLogs.length,
    success_rate: 0,
    avg_execution_time: 0,
    error_patterns: {},
    recommendations: []
  };
  
  let successCount = 0;
  let totalExecutionTime = 0;
  const errorTypes = {};
  const performanceByType = {};
  
  mgflowLogs.forEach(log => {
    // Count successes
    if (log.status === 'success') {
      successCount++;
    }
    
    // Track execution time
    if (log.execution_time) {
      totalExecutionTime += log.execution_time;
    }
    
    // Categorize errors
    if (log.status === 'error' && log.error_message) {
      const errorCategory = categorizeError(log.error_message);
      errorTypes[errorCategory] = (errorTypes[errorCategory] || 0) + 1;
    }
    
    // Performance by mgflow type
    const mgflowType = log.mgflow_type || 'unknown';
    if (!performanceByType[mgflowType]) {
      performanceByType[mgflowType] = { count: 0, success: 0, totalTime: 0 };
    }
    performanceByType[mgflowType].count++;
    if (log.status === 'success') performanceByType[mgflowType].success++;
    if (log.execution_time) performanceByType[mgflowType].totalTime += log.execution_time;
  });
  
  // Calculate metrics
  metrics.success_rate = ((successCount / mgflowLogs.length) * 100).toFixed(2);
  metrics.avg_execution_time = (totalExecutionTime / mgflowLogs.length).toFixed(2);
  metrics.error_patterns = errorTypes;
  
  // Performance by type
  metrics.performance_by_type = {};
  Object.entries(performanceByType).forEach(([type, data]) => {
    metrics.performance_by_type[type] = {
      success_rate: ((data.success / data.count) * 100).toFixed(2),
      avg_time: (data.totalTime / data.count).toFixed(2),
      count: data.count
    };
  });
  
  // Generate recommendations
  if (metrics.success_rate < 90) {
    metrics.recommendations.push('Success rate below 90% - review error patterns and improve validation');
  }
  
  if (metrics.avg_execution_time > 300) {
    metrics.recommendations.push('Average execution time exceeds 5 minutes - consider optimization');
  }
  
  const topError = Object.keys(errorTypes).reduce((a, b) => 
    errorTypes[a] > errorTypes[b] ? a : b, '');
  if (topError && errorTypes[topError] > mgflowLogs.length * 0.1) {
    metrics.recommendations.push(\`Most common error: \${topError} - requires immediate attention\`);
  }
  
  return metrics;
}

function categorizeError(errorMessage) {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('auth') || msg.includes('token') || msg.includes('unauthorized')) {
    return 'authentication';
  }
  if (msg.includes('network') || msg.includes('connection') || msg.includes('timeout')) {
    return 'network';
  }
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('format')) {
    return 'data_validation';
  }
  if (msg.includes('permission') || msg.includes('access') || msg.includes('forbidden')) {
    return 'permissions';
  }
  if (msg.includes('quota') || msg.includes('limit') || msg.includes('rate')) {
    return 'rate_limiting';
  }
  return 'other';
}`,

  dataQualityAnalysis: `// Data Quality Assessment
// Analyze data quality issues before and after ETL processing

function assessDataQuality(sourceData, transformedData, qualityRules) {
  /**
   * Comprehensive data quality analysis for mgflow data
   * 
   * Args:
   *   sourceData: Original input data
   *   transformedData: Data after transformation
   *   qualityRules: Object defining quality criteria
   * 
   * Returns:
   *   Data quality report with scores and recommendations
   */
  
  const report = {
    analysis_type: 'data_quality',
    timestamp: new Date().toISOString(),
    source_records: sourceData.length,
    transformed_records: transformedData.length,
    quality_score: 0,
    metrics: {},
    issues: [],
    improvements: []
  };
  
  // Completeness analysis
  const completeness = analyzeCompleteness(sourceData, qualityRules.required_fields || []);
  report.metrics.completeness = completeness;
  
  // Uniqueness analysis
  const uniqueness = analyzeUniqueness(sourceData, qualityRules.unique_fields || []);
  report.metrics.uniqueness = uniqueness;
  
  // Format validation
  const formatValidation = analyzeFormats(sourceData, qualityRules.format_rules || {});
  report.metrics.format_validation = formatValidation;
  
  // Consistency check
  const consistency = analyzeConsistency(sourceData, transformedData);
  report.metrics.consistency = consistency;
  
  // Calculate overall quality score
  const scores = [
    completeness.score,
    uniqueness.score,
    formatValidation.score,
    consistency.score
  ];
  report.quality_score = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  
  // Generate recommendations
  if (completeness.score < 80) {
    report.issues.push('Low completeness score - missing required data');
    report.improvements.push('Implement data validation at source');
  }
  
  if (uniqueness.score < 90) {
    report.issues.push('Duplicate records detected');
    report.improvements.push('Add deduplication step in ETL process');
  }
  
  if (formatValidation.score < 85) {
    report.issues.push('Format validation issues detected');
    report.improvements.push('Standardize input data formats');
  }
  
  return report;
}

function analyzeCompleteness(data, requiredFields) {
  let totalChecks = 0;
  let passedChecks = 0;
  
  data.forEach(record => {
    requiredFields.forEach(field => {
      totalChecks++;
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        passedChecks++;
      }
    });
  });
  
  return {
    score: totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(2) : 100,
    total_checks: totalChecks,
    passed_checks: passedChecks
  };
}

function analyzeUniqueness(data, uniqueFields) {
  const uniquenessScores = {};
  let overallScore = 100;
  
  uniqueFields.forEach(field => {
    const values = data.map(record => record[field]).filter(v => v !== undefined);
    const uniqueValues = new Set(values);
    const uniquenessRate = (uniqueValues.size / values.length) * 100;
    uniquenessScores[field] = uniquenessRate.toFixed(2);
    overallScore = Math.min(overallScore, uniquenessRate);
  });
  
  return {
    score: overallScore.toFixed(2),
    field_scores: uniquenessScores
  };
}

function analyzeFormats(data, formatRules) {
  let totalChecks = 0;
  let passedChecks = 0;
  
  data.forEach(record => {
    Object.entries(formatRules).forEach(([field, pattern]) => {
      if (record[field] !== undefined) {
        totalChecks++;
        const regex = new RegExp(pattern);
        if (regex.test(record[field].toString())) {
          passedChecks++;
        }
      }
    });
  });
  
  return {
    score: totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(2) : 100,
    total_checks: totalChecks,
    passed_checks: passedChecks
  };
}

function analyzeConsistency(sourceData, transformedData) {
  const transformationRate = (transformedData.length / sourceData.length) * 100;
  
  return {
    score: Math.min(100, transformationRate).toFixed(2),
    source_count: sourceData.length,
    transformed_count: transformedData.length,
    transformation_rate: transformationRate.toFixed(2)
  };
}`,

  vezaAccessAnalysis: `// Veza Access Intelligence Analysis
// Analyze access patterns and compliance for mgflow validation

function analyzeAccessPatterns(accessData, complianceRules) {
  /**
   * Analyze access patterns and identify compliance issues
   * 
   * Args:
   *   accessData: Veza access data from API or OAA push
   *   complianceRules: Compliance requirements and policies
   * 
   * Returns:
   *   Access analysis report with compliance scores
   */
  
  const analysis = {
    analysis_type: 'access_intelligence',
    timestamp: new Date().toISOString(),
    total_users: 0,
    total_permissions: 0,
    compliance_score: 0,
    risk_indicators: [],
    violations: [],
    recommendations: []
  };
  
  // Count totals
  analysis.total_users = accessData.users ? accessData.users.length : 0;
  analysis.total_permissions = accessData.permissions ? accessData.permissions.length : 0;
  
  // Analyze user access patterns
  const userAnalysis = analyzeUserAccess(accessData.users || [], complianceRules);
  analysis.user_insights = userAnalysis;
  
  // Check for SOD violations
  const sodViolations = checkSeparationOfDuties(accessData, complianceRules.sod_rules || []);
  analysis.sod_violations = sodViolations;
  
  // Privileged access analysis
  const privilegedAnalysis = analyzePrivilegedAccess(accessData, complianceRules.privileged_roles || []);
  analysis.privileged_access = privilegedAnalysis;
  
  // Calculate compliance score
  const complianceMetrics = [
    userAnalysis.compliance_rate,
    100 - (sodViolations.length * 10), // Deduct 10 points per SOD violation
    privilegedAnalysis.compliance_rate
  ];
  analysis.compliance_score = Math.max(0, 
    complianceMetrics.reduce((a, b) => a + b, 0) / complianceMetrics.length
  ).toFixed(2);
  
  // Generate recommendations
  if (analysis.compliance_score < 80) {
    analysis.recommendations.push('Compliance score below threshold - review access policies');
  }
  
  if (sodViolations.length > 0) {
    analysis.recommendations.push(\`\${sodViolations.length} SOD violations detected - immediate review required\`);
  }
  
  if (privilegedAnalysis.excessive_access > 0) {
    analysis.recommendations.push('Excessive privileged access detected - implement least privilege');
  }
  
  return analysis;
}

function analyzeUserAccess(users, complianceRules) {
  let compliantUsers = 0;
  const accessDistribution = {};
  
  users.forEach(user => {
    const userPermissions = user.permissions || [];
    const permissionCount = userPermissions.length;
    
    // Check compliance with max permissions rule
    const maxAllowed = complianceRules.max_permissions_per_user || 50;
    if (permissionCount <= maxAllowed) {
      compliantUsers++;
    }
    
    // Track access distribution
    const accessLevel = getAccessLevel(permissionCount);
    accessDistribution[accessLevel] = (accessDistribution[accessLevel] || 0) + 1;
  });
  
  return {
    compliance_rate: ((compliantUsers / users.length) * 100).toFixed(2),
    access_distribution: accessDistribution,
    avg_permissions_per_user: (users.reduce((sum, user) => 
      sum + (user.permissions || []).length, 0) / users.length).toFixed(2)
  };
}

function checkSeparationOfDuties(accessData, sodRules) {
  const violations = [];
  
  sodRules.forEach(rule => {
    const conflictingRoles = rule.conflicting_roles || [];
    
    (accessData.users || []).forEach(user => {
      const userRoles = (user.roles || []).map(role => role.name || role);
      const conflicts = userRoles.filter(role => conflictingRoles.includes(role));
      
      if (conflicts.length > 1) {
        violations.push({
          user: user.name || user.id,
          rule: rule.name,
          conflicting_roles: conflicts
        });
      }
    });
  });
  
  return violations;
}

function analyzePrivilegedAccess(accessData, privilegedRoles) {
  const privilegedUsers = [];
  let excessiveAccess = 0;
  
  (accessData.users || []).forEach(user => {
    const userRoles = (user.roles || []).map(role => role.name || role);
    const privilegedRoleCount = userRoles.filter(role => 
      privilegedRoles.includes(role)).length;
    
    if (privilegedRoleCount > 0) {
      privilegedUsers.push({
        user: user.name || user.id,
        privileged_roles: privilegedRoleCount,
        last_activity: user.last_activity
      });
      
      if (privilegedRoleCount > 2) {
        excessiveAccess++;
      }
    }
  });
  
  return {
    privileged_user_count: privilegedUsers.length,
    excessive_access: excessiveAccess,
    compliance_rate: ((privilegedUsers.length - excessiveAccess) / Math.max(1, privilegedUsers.length) * 100).toFixed(2),
    privileged_users: privilegedUsers.slice(0, 10) // Top 10 for report
  };
}

function getAccessLevel(permissionCount) {
  if (permissionCount <= 5) return 'minimal';
  if (permissionCount <= 15) return 'standard';
  if (permissionCount <= 30) return 'elevated';
  return 'excessive';
}`,

  migrationAnalysis: `// Data Migration Impact Analysis
// Analyze the impact and success of data migrations

function analyzeMigrationImpact(preMigrationData, postMigrationData, migrationConfig) {
  /**
   * Analyze the impact and success of a data migration
   * 
   * Args:
   *   preMigrationData: Data state before migration
   *   postMigrationData: Data state after migration
   *   migrationConfig: Migration configuration and rules
   * 
   * Returns:
   *   Migration impact analysis report
   */
  
  const report = {
    analysis_type: 'migration_impact',
    timestamp: new Date().toISOString(),
    migration_success_rate: 0,
    data_integrity_score: 0,
    performance_impact: {},
    issues_identified: [],
    rollback_recommendations: []
  };
  
  // Calculate migration success rate
  const migrationSuccess = calculateMigrationSuccess(preMigrationData, postMigrationData);
  report.migration_success_rate = migrationSuccess.rate;
  report.records_migrated = migrationSuccess.migrated;
  report.records_failed = migrationSuccess.failed;
  
  // Data integrity analysis
  const integrityAnalysis = analyzeDataIntegrity(preMigrationData, postMigrationData);
  report.data_integrity_score = integrityAnalysis.score;
  report.integrity_details = integrityAnalysis.details;
  
  // Performance impact
  const performanceAnalysis = analyzePerformanceImpact(migrationConfig);
  report.performance_impact = performanceAnalysis;
  
  // Identify critical issues
  if (migrationSuccess.rate < 95) {
    report.issues_identified.push('Migration success rate below 95%');
  }
  
  if (integrityAnalysis.score < 90) {
    report.issues_identified.push('Data integrity concerns detected');
  }
  
  if (performanceAnalysis.degradation > 20) {
    report.issues_identified.push('Significant performance degradation');
  }
  
  // Rollback recommendations
  if (report.issues_identified.length > 0) {
    if (migrationSuccess.rate < 80) {
      report.rollback_recommendations.push('Consider immediate rollback - migration failure rate too high');
    } else if (integrityAnalysis.score < 85) {
      report.rollback_recommendations.push('Review data integrity issues before proceeding');
    } else {
      report.rollback_recommendations.push('Monitor closely and prepare rollback plan');
    }
  }
  
  return report;
}

function calculateMigrationSuccess(preData, postData) {
  const preMigrationCount = Array.isArray(preData) ? preData.length : Object.keys(preData).length;
  const postMigrationCount = Array.isArray(postData) ? postData.length : Object.keys(postData).length;
  
  const migrated = Math.min(preMigrationCount, postMigrationCount);
  const failed = preMigrationCount - migrated;
  const rate = ((migrated / preMigrationCount) * 100).toFixed(2);
  
  return { rate: parseFloat(rate), migrated, failed };
}

function analyzeDataIntegrity(preData, postData) {
  let integrityScore = 100;
  const details = {};
  
  // Sample integrity checks
  if (Array.isArray(preData) && Array.isArray(postData)) {
    // Check for data consistency
    const sampleSize = Math.min(10, preData.length);
    let consistentRecords = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      if (preData[i] && postData[i]) {
        const preKeys = Object.keys(preData[i]);
        const postKeys = Object.keys(postData[i]);
        
        if (preKeys.length === postKeys.length) {
          consistentRecords++;
        }
      }
    }
    
    const consistencyRate = (consistentRecords / sampleSize) * 100;
    integrityScore = consistencyRate;
    details.schema_consistency = consistencyRate.toFixed(2);
  }
  
  return {
    score: integrityScore.toFixed(2),
    details
  };
}

function analyzePerformanceImpact(migrationConfig) {
  // Simulated performance analysis based on migration size and complexity
  const recordCount = migrationConfig.record_count || 1000;
  const complexity = migrationConfig.complexity || 'medium';
  
  let baselineTime = recordCount * 0.01; // 0.01s per record baseline
  
  switch (complexity) {
    case 'low':
      baselineTime *= 0.5;
      break;
    case 'high':
      baselineTime *= 2;
      break;
    default: // medium
      baselineTime *= 1;
  }
  
  const actualTime = migrationConfig.actual_time || baselineTime * 1.2;
  const degradation = ((actualTime - baselineTime) / baselineTime * 100);
  
  return {
    baseline_time: baselineTime.toFixed(2),
    actual_time: actualTime.toFixed(2),
    degradation: Math.max(0, degradation).toFixed(2),
    status: degradation > 50 ? 'concerning' : degradation > 20 ? 'acceptable' : 'good'
  };
}`
};