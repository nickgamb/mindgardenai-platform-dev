# Node Connector System Guide

The MindGarden Platform now features a completely redesigned connector system with color-coded, properly typed connectors that enforce logical flow connections while supporting attribute mapping.

## 🎯 **Connector Types & Colors**

### **🟢 Data Connectors (Green)**
- **Purpose**: Structured data flow between nodes
- **Color**: `#10b981` (Green)
- **Usage**: CSV files, JSON objects, transformed data, database records
- **Compatible**: Can connect to other data inputs for processing chains

### **🟡 Trigger Connectors (Yellow)**
- **Purpose**: Flow execution triggers and control signals
- **Color**: `#f59e0b` (Amber/Yellow)
- **Usage**: Manual triggers, scheduled execution, webhook calls
- **Compatible**: Only connects to trigger inputs

### **🔴 API Connectors (Red)**
- **Purpose**: API request/response data flows
- **Color**: `#ef4444` (Red)
- **Usage**: REST API responses, API call results, external data
- **Compatible**: Can connect to data inputs for further processing

### **🟟 Visual Connectors (Purple)**
- **Purpose**: Visual content and media files
- **Color**: `#8b5cf6` (Purple)
- **Usage**: Images, charts, SVGs, visual outputs from AI
- **Compatible**: Only connects to visual inputs for display

### **🔵 Storage Connectors (Cyan)**
- **Purpose**: Storage operations and file management
- **Color**: `#06b6d4` (Cyan)
- **Usage**: Database writes, file saves, data persistence
- **Compatible**: Can output data for further processing

### **🟠 Analytics Connectors (Orange)**
- **Purpose**: Analytics results and reporting data
- **Color**: `#f97316` (Orange)
- **Usage**: Reports, metrics, analysis results, dashboards
- **Compatible**: Can connect to data inputs for visualization

## 🏗 **Node Configurations**

### **File Node**
```
Inputs:  🟡 Trigger (optional) - Start file processing
Outputs: 🟢 Data - File contents and schema
```
- **Attribute Mapping**: ✅ Supported
- **Use Case**: Load CSV/JSON files, detect schema, output structured data
- **Trigger**: Can be triggered to reload or refresh file data

### **Storage Node**
```
Inputs:  🟡 Trigger (optional) - Start storage operation
         🟢 Data 1 (optional) - First data source 
         🟢 Data 2 (optional) - Second data source
Outputs: 🟢 Data 1 (optional) - Stored data output 1
         🟢 Data 2 (optional) - Stored data output 2
```
- **Attribute Mapping**: ✅ Supported (treats inputs like sheets/tables)
- **Use Case**: Database operations, file saves, data merging from multiple sources
- **Multi-Input**: Can combine/merge data from two sources
- **Source Mode**: Can act as data source even without inputs (stored data)

### **Transform Node**
```
Inputs:  🟢 Data - Input data to transform
Outputs: 🟢 Data - Transformed output data
```
- **Attribute Mapping**: ✅ Supported (script defines output schema)
- **Use Case**: Data cleaning, field mapping, calculations, filtering
- **Script Integration**: Transform script defines available output fields

### **API Node**
```
Inputs:  🟢 Data (optional) - Data for API parameters
         🟡 Trigger (optional) - Trigger API call
Outputs: 🔴 API Data - API response data
```
- **Attribute Mapping**: ✅ Supported (parameter mapping pending)
- **Use Case**: External API calls, data enrichment, integrations
- **Parameter Mapping**: Input data can be mapped to API parameters
- **Response Handling**: API responses mapped to output schema

### **Analytics Node**
```
Inputs:  🟢 Data - Data to analyze
Outputs: 🟠 Analytics - Analysis results and reports
```
- **Attribute Mapping**: ✅ Supported (script defines metrics)
- **Use Case**: Generate reports, calculate KPIs, create dashboards
- **Script Integration**: Analytics script defines output metrics

### **Flow Trigger Node**
```
Inputs:  (none)
Outputs: 🟡 Trigger - Flow execution trigger
```
- **Types**: Manual, Scheduled, Webhook
- **Use Case**: Start flows, scheduled execution, external triggers
- **Configuration**: Trigger type determines execution behavior

### **AI Tools Node**
```
Inputs:  🟢 Data (optional) - Input data for AI processing
         🟡 Trigger (optional) - Trigger AI execution
Outputs: 🟢 Data (optional) - Processed data output
         🟟 Visual (optional) - Generated visual content
```
- **Attribute Mapping**: ✅ Supported (maps AI outputs)
- **Use Case**: AI/ML processing, image generation, text analysis
- **Dual Output**: Can output both data and visual content

### **Visual Preview Node**
```
Inputs:  🟢 Data (optional) - Data to visualize (expects SVG/chart data)
         🟟 Visual (optional) - Visual content to display
Outputs: (none - display only)
```
- **Use Case**: Display charts, images, visual content
- **Data Mode**: Expects SVG or chart data from data connector
- **Visual Mode**: Displays images from visual connector



## 🔗 **Connection Rules**

### **Valid Connections**
- **🟢 Data → 🟢 Data**: Standard data processing chains
- **🔴 API → 🟢 Data**: API responses can be processed as data
- **🟠 Analytics → 🟢 Data**: Analytics results can be further processed
- **🟡 Trigger → 🟡 Trigger**: Control flow and execution
- **🟟 Visual → 🟟 Visual**: Visual content display
- **🟢 Data → 🟟 Visual**: Data can create visual content (charts, etc.)

### **Invalid Connections**
- **🟡 Trigger → 🟢 Data**: Triggers don't carry data
- **🟟 Visual → 🟢 Data**: Visual content can't become structured data
- **🔴 API → 🟡 Trigger**: API responses can't trigger flows
- **Cross-type mixing** without proper conversion

## 🎨 **Visual Design**

### **Connector Appearance**
- **Size**: 12px diameter circles
- **Border**: 2px white border for visibility
- **Position**: Left side for inputs, right side for outputs
- **Tooltips**: Hover to see connector type and description
- **Animation**: Smooth hover effects and connection animations

### **Color Consistency**
- **Node Colors**: Match their primary connector type
- **Connection Lines**: Use source connector color
- **Status Indicators**: Green (connected), gray (unconnected), red (error)

## 🔧 **Attribute Mapping Integration**

### **Storage Node Special Handling**
When multiple data inputs are connected to Storage Node:
- **Sheet/Table Mode**: Each input treated as separate data source
- **Cross-Expression Mapping**: Can reference fields from both inputs
- **Example**: `input1.user_id = input2.employee_id` for joins

### **Transform Node Integration**
- **Script Output Schema**: Transform script defines available output fields
- **Mapping Validation**: Ensures mappings match script outputs
- **Dynamic Schema**: Output schema updates when script changes

### **API Node Parameter Mapping**
- **Input to Parameters**: Map input data fields to API parameters
- **Response Mapping**: Map API response to output schema
- **Authentication**: Handle API keys and authentication data

## 📊 **Example Flow Patterns**

### **Basic Data Processing**
```
Flow Trigger → File Node → Transform Node → Storage Node
    🟡           🟢         🟢            🟢
```

### **API Data Enrichment**
```
File Node → API Node → Transform Node → Analytics Node
   🟢       🔴          🟢             🟠
```

### **Multi-Source Analytics**
```
File Node 1 ─┐
             ├─→ Storage Node → Analytics Node → Visual Preview
File Node 2 ─┘      🟢            🟠              🟟
   🟢                
```

### **AI Processing Pipeline**
```
Data → AI Tools → Visual Preview
 🟢      🟟         🟟
   └──→ Transform → Storage
        🟢          🟢
```

## ⚡ **Performance & Validation**

### **Real-Time Validation**
- **Connection Check**: Validates connector compatibility on hover
- **Visual Feedback**: Invalid connections show red indicators
- **Type Checking**: Ensures data type compatibility
- **Schema Validation**: Checks field mappings in real-time

### **Error Prevention**
- **Smart Suggestions**: Highlights compatible connectors
- **Type Coercion**: Automatic conversion where possible
- **Validation Messages**: Clear error descriptions
- **Recovery Options**: Suggests fixes for invalid connections

## 🚀 **Usage Tips**

### **Best Practices**
1. **Start with Triggers**: Begin flows with Flow Trigger nodes
2. **Color Coordination**: Match connector colors for valid connections
3. **Schema Planning**: Design output schemas before mapping
4. **Test Incrementally**: Validate each connection as you build
5. **Use Tooltips**: Hover over connectors to understand their purpose

### **Common Patterns**
- **ETL Pipeline**: File → Transform → Storage
- **API Integration**: Trigger → API → Transform → Display
- **Analytics Flow**: Data → Analytics → Visual Preview
- **AI Processing**: Data → AI Tools → Visual + Data outputs

### **Troubleshooting**
- **Red Connectors**: Check type compatibility
- **Missing Data**: Verify upstream connections
- **Mapping Errors**: Check attribute mapping configuration
- **Performance Issues**: Limit complex expression mappings

---

The new connector system provides a clear, visual way to understand data flow while enforcing logical connections and supporting comprehensive attribute mapping across all node types! 🎉