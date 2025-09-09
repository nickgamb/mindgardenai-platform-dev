// ETL Transform Examples for MindGarden Platform
// These scripts demonstrate business logic transformations for preparing data for Veza OAA API

export const transformExamples = {
  csvToOaa: `// CSV to OAA Application Object Transform
// Build a minimal OAA application payload (application_object) from CSV rows
// @outputSchema: [ { "name": "application_object", "type": "object", "description": "OAA application object payload" } ]
const outputSchema = [ { name: "application_object", type: "object", description: "OAA application object payload" } ];

function transformCsvToOaa(csvData, config = {}) {
  /**
   * Args:
   *   csvData: Array of CSV row objects with user data
   *   config: { applicationName?: string, applicationType?: string, userIdField?: string }
   *
   * Returns:
   *   { application_object } where application_object is a minimal OAA payload
   */
  
  const appName = config.applicationName || 'CSV Application';
  const appType = config.applicationType || 'csv_application';
  const userIdField = config.userIdField || 'email';

  // Define a minimal set of application custom properties (optional)
  const propertyDefinitions = {
    applications: [
      {
        application_type: appType,
        property_definitions: [
          { name: 'department', data_type: 'string' },
          { name: 'title', data_type: 'string' },
          { name: 'is_active', data_type: 'boolean' }
        ]
      }
    ]
  };

  // Convert CSV rows to local_users in OAA application model
  const localUsers = (Array.isArray(csvData) ? csvData : []).map((row) => {
    const id = row[userIdField] || row.email || row.user_id || row.employeeID || row.sAMAccountName;
    const displayName = row.displayName || row.name || [row.givenName, row.surname].filter(Boolean).join(' ').trim();
    const email = row.email || row.mail || '';

    return {
      name: id ? String(id) : undefined,
      display_name: displayName || email || undefined,
      email: email || undefined,
      custom_properties: {
        department: row.department || row.physicalDeliveryOfficeName || undefined,
        title: row.title || undefined,
        is_active: typeof row.is_active !== 'undefined' ? !!row.is_active : undefined
      }
    };
  }).filter(u => u.name); // require a name/id

  // Minimal OAA payload
  const application_object = {
    custom_property_definition: propertyDefinitions,
    applications: [
      {
        name: appName,
        application_type: appType,
        description: 'Generated from CSV',
        local_users: localUsers,
        local_groups: [],
        local_roles: [],
        local_access_creds: [],
        tags: [],
        custom_properties: {}
      }
    ],
    // No permissions or mappings by default; can be enriched later
    permissions: [],
    identity_to_permissions: []
  };

  return { application_object };
}`,

  adToOaa: `// Active Directory Business Logic Transform
// Applies AD-specific business rules and data transformations

function transformADToOAA(adData, config = {}) {
  /**
   * Transform Active Directory data with AD-specific business logic
   * 
   * Args:
   *   adData: Array of AD user objects from CSV export
   *   config: Configuration object with AD business rules
   * 
   * Returns:
   *   Transformed AD data with business logic applied
   */
  
  console.log('🔄 Applying AD business logic transformations...');
  
  const transformedData = [];
  const stats = {
    total: adData.length,
    enabled: 0,
    disabled: 0,
    locked: 0,
    expired: 0,
    departments: new Set(),
    groups: new Set(),
    ou_paths: new Set()
  };
  
  adData.forEach((user, index) => {
    try {
      // AD Business Logic 1: Account Status Analysis
      let accountStatus = 'enabled';
      let isLocked = false;
      let isExpired = false;
      
      if (user.userAccountControl) {
        const uac = parseInt(user.userAccountControl);
        // Check for disabled account (0x0002)
        if (uac & 0x0002) {
          accountStatus = 'disabled';
          stats.disabled++;
        } else {
          stats.enabled++;
        }
        // Check for locked account (0x800000)
        if (uac & 0x800000) {
          isLocked = true;
          stats.locked++;
        }
      }
      
      // AD Business Logic 2: Password Expiration Analysis
      if (user.pwdLastSet) {
        const pwdLastSet = parseInt(user.pwdLastSet);
        if (pwdLastSet === 0) {
          isExpired = true;
          stats.expired++;
        } else {
          // Convert Windows filetime to JavaScript date
          const pwdDate = new Date((pwdLastSet - 116444736000000000) / 10000);
          const daysSincePwdChange = (Date.now() - pwdDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSincePwdChange > 90) { // 90 days password policy
            isExpired = true;
            stats.expired++;
          }
        }
      }
      
      // AD Business Logic 3: OU Path Analysis
      let ouPath = '';
      let ouLevel = 0;
      if (user.distinguishedName) {
        const dnParts = user.distinguishedName.split(',');
        const ouParts = dnParts.filter(part => part.startsWith('OU='));
        ouPath = ouParts.map(part => part.replace('OU=', '')).reverse().join('/');
        ouLevel = ouParts.length;
        stats.ou_paths.add(ouPath);
      }
      
      // AD Business Logic 4: Group Membership Analysis
      let groupMemberships = [];
      if (user.memberOf) {
        // Handle single group or array of groups
        const groups = Array.isArray(user.memberOf) ? user.memberOf : [user.memberOf];
        groupMemberships = groups.map(group => {
          const groupName = group.split(',')[0].replace('CN=', '');
          stats.groups.add(groupName);
          return groupName;
        });
      }
      
      // AD Business Logic 5: Security Group Classification
      let securityLevel = 'standard';
      const securityGroups = ['Domain Admins', 'Enterprise Admins', 'Schema Admins'];
      if (groupMemberships.some(group => securityGroups.includes(group))) {
        securityLevel = 'administrative';
      } else if (groupMemberships.some(group => group.includes('Admin'))) {
        securityLevel = 'elevated';
      }
      
      // AD Business Logic 6: Last Logon Analysis
      let lastLogonStatus = 'recent';
      if (user.lastLogonTimestamp) {
        const lastLogon = parseInt(user.lastLogonTimestamp);
        if (lastLogon !== 0) {
          const logonDate = new Date((lastLogon - 116444736000000000) / 10000);
          const daysSinceLogon = (Date.now() - logonDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLogon > 30) {
            lastLogonStatus = 'inactive';
          } else if (daysSinceLogon > 7) {
            lastLogonStatus = 'recent';
          } else {
            lastLogonStatus = 'active';
          }
        }
      }
      
      // AD Business Logic 7: Department Mapping from OU
      let department = user.department;
      if (!department && ouPath) {
        // Extract department from OU path
        const ouParts = ouPath.split('/');
        if (ouParts.length > 0) {
          department = ouParts[0];
        }
      }
      
      // Create transformed record with AD business logic
      const transformedRow = {
        // Core AD fields
        sam_account_name: user.sAMAccountName,
        employee_id: user.employeeID,
        display_name: user.displayName,
        email: user.mail,
        
        // Business logic results
        account_status: accountStatus,
        is_locked: isLocked,
        is_expired: isExpired,
        security_level: securityLevel,
        last_logon_status: lastLogonStatus,
        ou_path: ouPath,
        ou_level: ouLevel,
        group_memberships: groupMemberships,
        department: department,
        
        // Additional AD fields
        first_name: user.givenName,
        last_name: user.surname,
        title: user.title,
        manager: user.manager,
        office: user.physicalDeliveryOfficeName,
        phone: user.telephoneNumber,
        
        // Metadata
        transformation_timestamp: new Date().toISOString(),
        original_uac: user.userAccountControl,
        original_pwd_last_set: user.pwdLastSet
      };
      
      transformedData.push(transformedRow);
      
    } catch (error) {
      console.warn('⚠️ Error processing AD user ' + index + ': ' + error.message);
    }
  });
  
  console.log('📊 AD Transformation Statistics:', stats);
  
  return {
    data: transformedData,
    metadata: {
      ad_transformation_stats: stats,
      total_records: transformedData.length,
      transformation_time: new Date().toISOString(),
      ad_business_rules_applied: [
        'Account status analysis',
        'Password expiration analysis',
        'OU path analysis',
        'Group membership analysis',
        'Security group classification',
        'Last logon analysis',
        'Department mapping from OU'
      ]
    }
  };
}`,

  pagerDutyUsersToOaa: `// PagerDuty Users to OAA Application Object Transform
// Build an OAA application payload (application_object) from PagerDuty users API response
// @outputSchema: [ { "name": "application_object", "type": "object", "description": "OAA application object payload" } ]
const outputSchema = [ { name: "application_object", type: "object", description: "OAA application object payload" } ];

function transformPagerDutyUsersToOAA(pdResponse, config = {}) {
  /**
   * Args:
   *   pdResponse: PagerDuty users API response { users: [ ... ] }
   *   config: { applicationName?: string, applicationType?: string, pdTeams?: object|array }
   *
   * Returns:
   *   { application_object } where application_object is a minimal OAA payload
   */

  const appName = config.applicationName || 'PagerDuty';
  const appType = config.applicationType || 'custom_application';

  // Prepare property definitions (these become local_user_properties downstream)
  const propertyDefinitions = {
    applications: [
      {
        application_type: appType,
        property_definitions: [
          { name: 'pd_id', data_type: 'string' },
          { name: 'display_name', data_type: 'string' },
          { name: 'role', data_type: 'string' },
          { name: 'time_zone', data_type: 'string' },
          { name: 'locale', data_type: 'string' },
          { name: 'billed', data_type: 'boolean' },
          { name: 'created_via_sso', data_type: 'boolean' },
          { name: 'job_title', data_type: 'string' },
          { name: 'team_count', data_type: 'number' },
          { name: 'contact_email', data_type: 'string' },
          { name: 'contact_phone', data_type: 'string' },
          { name: 'contact_sms', data_type: 'string' }
        ]
      }
    ]
  };

  const users = Array.isArray(pdResponse?.users)
    ? pdResponse.users
    : (Array.isArray(pdResponse) ? pdResponse : []);

  // Optional teams input (from include[]=teams or separate Teams API)
  const pdTeamsRaw = config && config.pdTeams;
  const teamsList = Array.isArray(pdTeamsRaw?.teams)
    ? pdTeamsRaw.teams
    : (Array.isArray(pdTeamsRaw) ? pdTeamsRaw : []);
  const teamById = new Map();
  teamsList.forEach(t => {
    if (t && (t.id || t.name)) teamById.set(t.id || t.name, t);
  });

  const localUsers = users
    .map((u) => {
      // Extract primary contact methods if available
      const emailCM = Array.isArray(u.contact_methods)
        ? u.contact_methods.find(cm => cm?.type === 'email_contact_method_reference')
        : null;
      const phoneCM = Array.isArray(u.contact_methods)
        ? u.contact_methods.find(cm => cm?.type === 'phone_contact_method_reference')
        : null;
      const smsCM = Array.isArray(u.contact_methods)
        ? u.contact_methods.find(cm => cm?.type === 'sms_contact_method_reference')
        : null;

      const email = (u.email || '').trim();
      const idOrName = u.id || email || u.name;

      if (!idOrName) return null; // require a stable name/id

      return {
        name: String(idOrName),
        // display_name is not a base field; server normalization will move it into custom_properties
        display_name: u.name || undefined,
        email: email || undefined,
        identities: email ? [email] : undefined,
        custom_properties: {
          pd_id: u.id || undefined,
          role: u.role || undefined,
          time_zone: u.time_zone || undefined,
          locale: u.locale || undefined,
          billed: typeof u.billed !== 'undefined' ? !!u.billed : undefined,
          created_via_sso: typeof u.created_via_sso !== 'undefined' ? !!u.created_via_sso : undefined,
          job_title: u.job_title || undefined,
          team_count: Array.isArray(u.teams) ? u.teams.length : undefined,
          contact_email: emailCM?.summary || undefined,
          contact_phone: phoneCM?.summary || undefined,
          contact_sms: smsCM?.summary || undefined
        }
      };
    })
    .filter(Boolean);

  // Build local_groups from user team refs and optional teams list
  const groupMap = new Map();
  users.forEach(u => {
    const userTeams = Array.isArray(u.teams) ? u.teams : [];
    userTeams.forEach(tref => {
      const tid = (tref && (tref.id || tref.name)) || null;
      if (!tid) return;
      const full = teamById.get(tid) || tref;
      const gname = (full && full.name) || tid;
      if (!groupMap.has(tid)) groupMap.set(tid, { id: tid, name: gname });
    });
  });
  teamsList.forEach(t => {
    const tid = t && (t.id || t.name);
    if (tid && !groupMap.has(tid)) groupMap.set(tid, { id: tid, name: t.name || tid });
  });
  const localGroups = Array.from(groupMap.values()).map(g => ({ name: String(g.name) }));

  // Build identity_to_permissions and collect permission catalog
  const idPerms = [];
  const permSet = new Set();
  users.forEach(u => {
    const email = (u.email || '').trim();
    if (!email) return;
    const role = (u.role || '').toLowerCase();
    let perm = 'view';
    if (role === 'owner' || role === 'admin') perm = 'admin';
    else if (role === 'manager') perm = 'manage';
    else if (role === 'responder' || role === 'user') perm = 'respond';
    permSet.add(perm);
    const perms = [perm];
    const userTeams = Array.isArray(u.teams) ? u.teams : [];
    userTeams.forEach(tref => {
      const tid = (tref && (tref.id || tref.name)) || null;
      if (tid) {
        const token = 'member:team:' + String(tid);
        perms.push(token);
        permSet.add(token); // ensure every used permission is declared
      }
    });
    idPerms.push({ identity: email, permissions: perms });
  });

  const application_object = {
    custom_property_definition: propertyDefinitions,
    applications: [
      {
        name: appName,
        application_type: appType,
        description: 'Generated from PagerDuty users API',
        local_users: localUsers,
        local_groups: localGroups,
        local_roles: [],
        local_access_creds: [],
        tags: [],
        custom_properties: {}
      }
    ],
    permissions: Array.from(permSet),
    identity_to_permissions: idPerms
  };

  // Omit empty permission fields to avoid Veza _PUSH_WARNINGS
  if (!application_object.permissions || application_object.permissions.length === 0) {
    try { delete application_object.permissions; } catch (e) {}
  }
  if (!application_object.identity_to_permissions || application_object.identity_to_permissions.length === 0) {
    try { delete application_object.identity_to_permissions; } catch (e) {}
  }

  return { application_object };
}

// Optional wrapper recognized by the transform engine
function applyTransform(pdResponse, params = {}) {
  return transformPagerDutyUsersToOAA(pdResponse, params);
}`,

  oktaToMGGraph: `// Okta → MG Graph transform
// Produces { nodes, edges } for graph storage ingestion

function applyTransform(oktaPayload, config = {}) {
  const nodes = [];
  const edges = [];

  const prefix = (s) => (s ? String(s) : '');

  // Users
  const users = Array.isArray(oktaPayload?.users) ? oktaPayload.users : (Array.isArray(oktaPayload) ? oktaPayload : []);
  users.forEach(u => {
    const email = prefix(u.profile?.email || u.profile?.login || u.credentials?.emails?.[0]);
    const id = prefix(u.id || email);
    if (!id) return;
    nodes.push({ label: 'OktaUser', id: 'okta:' + id, props: { email, status: u.status || 'ACTIVE', mfa: u?.factors?.[0]?.factorType || undefined, source: 'okta' } });
  });

  // Groups
  const groups = Array.isArray(oktaPayload?.groups) ? oktaPayload.groups : [];
  groups.forEach(g => {
    const gid = prefix(g.id || g.profile?.name);
    if (!gid) return;
    nodes.push({ label: 'OktaGroup', id: 'okta:' + gid, props: { name: g.profile?.name || gid, source: 'okta' } });
  });

  // Memberships: [{ userId, groupId }]
  const memberships = Array.isArray(oktaPayload?.memberships) ? oktaPayload.memberships : [];
  memberships.forEach(m => {
    if (!m?.userId || !m?.groupId) return;
    edges.push({ type: 'memberOf', from: { label: 'OktaUser', id: 'okta:' + m.userId }, to: { label: 'OktaGroup', id: 'okta:' + m.groupId } });
  });

  // App assignments: [{ userId, appId }]
  const appAssignments = Array.isArray(oktaPayload?.appAssignments) ? oktaPayload.appAssignments : [];
  appAssignments.forEach(a => {
    if (!a?.userId || !a?.appId) return;
    nodes.push({ label: 'App', id: 'app:' + a.appId, props: { name: a.appName || a.appId, provider: a.provider || 'SaaS' } });
    edges.push({ type: 'uses', from: { label: 'OktaUser', id: 'okta:' + a.userId }, to: { label: 'App', id: 'app:' + a.appId } });
  });

  return { nodes, edges };
}`,

  hrisLinkIdentities: `// HRIS → Identity linking (Employee → OktaUser/ADUser)
// Input: { workers: [{ employeeId, email, department, managerEmployeeId }] }
// Output: { nodes, edges }

function applyTransform(hrisPayload, config = {}) {
  const nodes = [];
  const edges = [];

  const workers = Array.isArray(hrisPayload?.workers) ? hrisPayload.workers : (Array.isArray(hrisPayload) ? hrisPayload : []);
  workers.forEach(w => {
    if (!w?.employeeId) return;
    nodes.push({ label: 'Employee', id: 'hris:' + w.employeeId, props: { employeeId: w.employeeId, email: w.email, department: w.department, cost_center: w.cost_center, status: w.status || 'active', is_manager: !!w.is_manager, source: 'hris' } });
    if (w.managerEmployeeId) {
      edges.push({ type: 'reportsTo', from: { label: 'Employee', id: 'hris:' + w.employeeId }, to: { label: 'Employee', id: 'hris:' + w.managerEmployeeId } });
    }
    if (w.email) {
      const eid = w.employeeId;
      edges.push({ type: 'identifies', from: { label: 'Employee', id: 'hris:' + eid }, to: { label: 'OktaUser', id: 'okta:' + (w.oktaId || w.email) } });
      edges.push({ type: 'identifies', from: { label: 'Employee', id: 'hris:' + eid }, to: { label: 'ADUser', id: 'ad:' + (w.adId || eid) } });
    }
  });

  return { nodes, edges };
}`,

  dataValidation: `// Data Validation and Business Rule Enforcement
// Validates and enforces business rules on user data

function validateAndCleanData(inputData, validationRules = {}) {
  /**
   * Apply business validation rules and data quality checks
   * 
   * Args:
   *   inputData: Array of user records
   *   validationRules: Object with validation configuration
   * 
   * Returns:
   *   Object with validated data and validation report
   */
  
  const cleanData = [];
  const errors = [];
  const warnings = [];
  const stats = {
    total: inputData.length,
    valid: 0,
    invalid: 0,
    warnings: 0,
    duplicates: 0,
    missing_required: 0
  };
  
  // Business Rule 1: Required Field Validation
  const requiredFields = validationRules.required_fields || ['email', 'name'];
  
  // Business Rule 2: Email Format and Domain Validation
  const allowedDomains = validationRules.allowed_domains || [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Business Rule 3: Duplicate Detection
  const seenEmails = new Set();
  const seenIds = new Set();
  
  inputData.forEach((record, index) => {
    const recordErrors = [];
    const recordWarnings = [];
    const cleanRecord = { ...record };
    
    // Business Rule 1: Required Field Check
    requiredFields.forEach(field => {
      if (!record[field] || record[field].toString().trim() === '') {
        recordErrors.push('Missing required field: ' + field);
        stats.missing_required++;
      }
    });
    
    // Business Rule 2: Email Validation
    if (record.email) {
      if (!emailRegex.test(record.email)) {
        recordErrors.push('Invalid email format: ' + record.email);
      } else {
        cleanRecord.email = record.email.toLowerCase().trim();
        
        // Domain validation
        const domain = cleanRecord.email.split('@')[1];
        if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
          recordWarnings.push('Email domain not in allowed list: ' + domain);
          stats.warnings++;
        }
        
        // Duplicate email check
        if (seenEmails.has(cleanRecord.email)) {
          recordErrors.push('Duplicate email: ' + cleanRecord.email);
          stats.duplicates++;
        } else {
          seenEmails.add(cleanRecord.email);
        }
      }
    }
    
    // Business Rule 3: ID Validation
    if (record.user_id || record.employee_id) {
      const id = record.user_id || record.employee_id;
      if (seenIds.has(id)) {
        recordErrors.push('Duplicate ID: ' + id);
        stats.duplicates++;
      } else {
        seenIds.add(id);
      }
    }
    
    // Business Rule 4: Name Standardization
    if (record.name) {
      cleanRecord.name = record.name.trim()
        .replace(/\s+/g, ' ')  // Remove extra spaces
        .replace(/[^\w\s-']/g, ''); // Remove special chars except dash and apostrophe
      
      if (cleanRecord.name.length < 2) {
        recordErrors.push('Name too short');
      }
    }
    
    // Business Rule 5: Status Normalization
    if (record.status) {
      const status = record.status.toLowerCase();
      cleanRecord.is_active = ['active', 'enabled', 'true', '1', 'yes'].includes(status);
    }
    
    // Business Rule 6: Department Standardization
    if (record.department) {
      const deptMap = {
        'hr': 'Human Resources',
        'it': 'Information Technology',
        'eng': 'Engineering',
        'sales': 'Sales',
        'fin': 'Finance',
        'marketing': 'Marketing',
        'ops': 'Operations'
      };
      cleanRecord.department = deptMap[record.department.toLowerCase()] || record.department;
    }
    
    // Business Rule 7: Date Validation
    if (record.hire_date) {
      const hireDate = new Date(record.hire_date);
      if (isNaN(hireDate.getTime())) {
        recordErrors.push('Invalid hire date: ' + record.hire_date);
      } else {
        cleanRecord.hire_date = hireDate.toISOString().split('T')[0];
      }
    }
    
    // Business Rule 8: Phone Number Standardization
    if (record.phone) {
      const phone = record.phone.replace(/[^0-9]/g, '');
      if (phone.length >= 10) {
        cleanRecord.phone = phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
      } else {
        recordWarnings.push('Invalid phone number format: ' + record.phone);
        stats.warnings++;
      }
    }
    
    if (recordErrors.length === 0) {
      cleanData.push(cleanRecord);
      stats.valid++;
    } else {
      stats.invalid++;
    }
  });
  
  return {
    data: cleanData,
    report: {
      stats,
      errors,
      warnings
    }
  };
}`
,

  eegBandpassFilter: `// EEG Bandpass Filter Example (EEG Filter)
// Simple IIR-like smoothing to demonstrate an EEG filter placeholder

function applyTransform(eegPacket, config = { alpha: 0.1 }) {
  // eegPacket: { channels: ["Fp1","Fp2",...], data: [[..samples per channel..], ...], sample_rate }
  const alpha = Math.min(1, Math.max(0, config.alpha || 0.1));
  const filtered = (eegPacket.data || []).map(channel => {
    const out = [];
    let prev = 0;
    for (let i = 0; i < channel.length; i++) {
      const x = Number(channel[i]) || 0;
      const y = alpha * x + (1 - alpha) * prev;
      out.push(y);
      prev = y;
    }
    return out;
  });
  return { channels: eegPacket.channels, data: filtered, sample_rate: eegPacket.sample_rate };
}`
};

// Export with legacy name for backward compatibility
export const filterExamples = transformExamples;