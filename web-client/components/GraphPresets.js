export const systemGraphPresets = [
  // Okta-shaped examples (match demo_graph.json)
  {
    key: 'okta_users_groups',
    label: 'OktaUser → memberOf → OktaGroup',
    mgql: 'PATH OktaUser -memberOf-> OktaGroup LIMIT 200',
    query: 'MATCH (u:OktaUser)-[r:memberOf]->(g:OktaGroup) RETURN u, r, g LIMIT 200'
  },
  {
    key: 'okta_users_apps',
    label: 'OktaUser → uses → App',
    mgql: 'PATH OktaUser -uses-> App LIMIT 200',
    query: 'MATCH (u:OktaUser)-[r:uses]->(a:App) RETURN u, r, a LIMIT 200'
  },
  {
    key: 'employee_identifies_okta',
    label: 'Employee → identifies → OktaUser',
    mgql: 'PATH Employee -identifies-> OktaUser LIMIT 200',
    query: 'MATCH (e:Employee)-[r:identifies]->(u:OktaUser) RETURN e, r, u LIMIT 200'
  },
  {
    key: 'employee_reports_manager',
    label: 'Employee → reportsTo → Manager',
    mgql: 'PATH Employee -reportsTo-> Manager LIMIT 200',
    query: 'MATCH (e:Employee)-[r:reportsTo]->(m:Manager) RETURN e, r, m LIMIT 200'
  },
  {
    key: 'from_employee_to_oktagroup',
    label: 'FROM Employee TO OktaGroup VIA identifies,memberOf',
    mgql: 'FROM Employee TO OktaGroup VIA identifies,memberOf LIMIT 200',
    query: 'MATCH p = (e:Employee)-[:identifies]->(:OktaUser)-[:memberOf]->(g:OktaGroup) RETURN nodes(p) as nodes, relationships(p) as rels LIMIT 200'
  },

  // Generic examples that work with demo
  {
    key: 'ad_users_groups',
    label: 'ADUser → memberOf → ADGroup',
    mgql: 'PATH ADUser -memberOf-> ADGroup LIMIT 200',
    query: 'MATCH (u:ADUser)-[:memberOf]->(g:ADGroup) RETURN u, g LIMIT 200'
  },

  // AWS-shaped examples
  {
    key: 'aws_user_policy',
    label: 'AwsUser → hasPolicy → AwsPolicy',
    mgql: 'PATH AwsUser -hasPolicy-> AwsPolicy LIMIT 200',
    query: 'MATCH (u:AwsUser)-[r:hasPolicy]->(p:AwsPolicy) RETURN u, r, p LIMIT 200'
  },
  {
    key: 'aws_user_role_bucket',
    label: 'AwsUser → assumes → AwsRole → grantsOn → S3Bucket',
    mgql: 'PATH AwsUser -assumes-> AwsRole -grantsOn-> S3Bucket LIMIT 200',
    query: 'MATCH (u:AwsUser)-[:assumes]->(ro:AwsRole)-[:grantsOn]->(b:S3Bucket) RETURN u, ro, b LIMIT 200'
  },
  {
    key: 'aws_identity_to_s3',
    label: 'FROM AwsUser TO S3Bucket VIA hasPolicy,grantsOn',
    mgql: 'FROM AwsUser TO S3Bucket VIA hasPolicy,grantsOn LIMIT 200',
    query: 'MATCH p = (u:AwsUser)-[:hasPolicy]->(:AwsPolicy)-[:grantsOn]->(b:S3Bucket) RETURN nodes(p) as nodes, relationships(p) as rels LIMIT 200'
  },

  // GCP-shaped examples
  {
    key: 'gcp_identity_project',
    label: 'GcpIdentity → hasRole → GcpProject',
    mgql: 'PATH GcpIdentity -hasRole-> GcpProject LIMIT 200',
    query: 'MATCH (i:GcpIdentity)-[r:hasRole]->(p:GcpProject) RETURN i, r, p LIMIT 200'
  },
  {
    key: 'gcp_identity_bq',
    label: 'GcpIdentity → hasRole → BigQueryDataset',
    mgql: 'PATH GcpIdentity -hasRole-> BigQueryDataset LIMIT 200',
    query: 'MATCH (i:GcpIdentity)-[r:hasRole]->(d:BigQueryDataset) RETURN i, r, d LIMIT 200'
  },

  // Azure-shaped examples
  {
    key: 'azure_principal_subscription',
    label: 'AzurePrincipal → hasRole → AzureSubscription',
    mgql: 'PATH AzurePrincipal -hasRole-> AzureSubscription LIMIT 200',
    query: 'MATCH (p:AzurePrincipal)-[r:hasRole]->(s:AzureSubscription) RETURN p, r, s LIMIT 200'
  },
  {
    key: 'azure_principal_resource',
    label: 'AzurePrincipal → hasRole → AzureResource',
    mgql: 'PATH AzurePrincipal -hasRole-> AzureResource LIMIT 200',
    query: 'MATCH (p:AzurePrincipal)-[r:hasRole]->(rsrc:AzureResource) RETURN p, r, rsrc LIMIT 200'
  },

  // Snowflake-shaped examples
  {
    key: 'snowflake_user_role_db',
    label: 'SnowflakeUser → hasRole → SnowflakeRole → grantsOn → SnowflakeDatabase',
    mgql: 'PATH SnowflakeUser -hasRole-> SnowflakeRole -grantsOn-> SnowflakeDatabase LIMIT 200',
    query: 'MATCH (u:SnowflakeUser)-[:hasRole]->(ro:SnowflakeRole)-[:grantsOn]->(db:SnowflakeDatabase) RETURN u, ro, db LIMIT 200'
  },

  // Databricks-shaped examples
  {
    key: 'databricks_group_workspace',
    label: 'DbxPrincipal → memberOf → DbxGroup → hasPermission → DbxWorkspace',
    mgql: 'PATH DbxPrincipal -memberOf-> DbxGroup -hasPermission-> DbxWorkspace LIMIT 200',
    query: 'MATCH (p:DbxPrincipal)-[:memberOf]->(g:DbxGroup)-[:hasPermission]->(w:DbxWorkspace) RETURN p, g, w LIMIT 200'
  },

  // ServiceNow-shaped examples
  {
    key: 'now_group_incidents',
    label: 'NowUser → memberOf → NowGroup → assignedTo → Incident',
    mgql: 'PATH NowUser -memberOf-> NowGroup -assignedTo-> Incident LIMIT 200',
    query: 'MATCH (u:NowUser)-[:memberOf]->(g:NowGroup)-[:assignedTo]->(i:Incident) RETURN u, g, i LIMIT 200'
  },

  // GitHub-shaped examples
  {
    key: 'github_team_repos',
    label: 'GhUser → memberOf → GhTeam → accesses → GhRepo',
    mgql: 'PATH GhUser -memberOf-> GhTeam -accesses-> GhRepo LIMIT 200',
    query: 'MATCH (u:GhUser)-[:memberOf]->(t:GhTeam)-[:accesses]->(r:GhRepo) RETURN u, t, r LIMIT 200'
  },

  // Google Workspace-shaped
  {
    key: 'gw_user_groups',
    label: 'GwUser → memberOf → GwGroup',
    mgql: 'PATH GwUser -memberOf-> GwGroup LIMIT 200',
    query: 'MATCH (u:GwUser)-[:memberOf]->(g:GwGroup) RETURN u, g LIMIT 200'
  },

  // HRIS-shaped
  {
    key: 'workday_reports_to',
    label: 'Worker → reportsTo → Manager',
    mgql: 'PATH Worker -reportsTo-> Manager LIMIT 200',
    query: 'MATCH (w:Worker)-[:reportsTo]->(m:Manager) RETURN w, m LIMIT 200'
  },

  // Security posture
  {
    key: 'device_used_by',
    label: 'Device → usedBy → User',
    mgql: 'PATH Device -usedBy-> User LIMIT 200',
    query: 'MATCH (d:Device)-[:usedBy]->(u:User) RETURN d, u LIMIT 200'
  },
  {
    key: 'identity_access_dataset',
    label: 'FROM User TO Dataset VIA hasRole,governs',
    mgql: 'FROM User TO Dataset VIA hasRole,governs LIMIT 200',
    query: 'MATCH p = (u:User)-[:hasRole]->(:Role)-[:governs]->(ds:Dataset) RETURN nodes(p) as nodes, relationships(p) as rels LIMIT 200'
  }
];

export const systemGraphPresetMap = Object.fromEntries(
  systemGraphPresets.map((p) => [p.key, p])
);


