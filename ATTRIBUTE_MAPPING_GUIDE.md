# Attribute Mapping System Guide

The MindGarden Platform now features a comprehensive attribute mapping system that allows users to visually map input data fields to output fields with various transformation options.

## 🎯 **Key Features**

### **1. Visual Field Mapping Interface**
- **Drag-and-drop style mapping** between input and output schemas
- **Real-time validation** of mappings with error/warning indicators  
- **Schema detection** from uploaded files and sample data
- **Dynamic output schema creation** for transform nodes

### **2. Multiple Mapping Types**
- **Direct Copy**: Map input field directly to output field
- **Constant Value**: Set a fixed value for output field
- **Transform Function**: Apply transformation logic to input data
- **Expression**: Custom JavaScript expressions for complex mappings
- **Aggregate**: Sum, count, average, min/max operations (analytics nodes)
- **Concatenate**: Join multiple input fields (transform nodes)
- **API Lookup**: Use field values for API parameters (API nodes)

### **3. Smart Schema Detection**
- **Automatic type inference** from data samples
- **Field description generation** based on naming patterns
- **Example value collection** for better understanding
- **Statistical metadata** (min/max/average for numbers, length stats for strings)

### **4. Flow-Wide Schema Propagation**
- **Automatic schema updates** when flow structure changes
- **Schema inheritance** through connected nodes
- **Validation across the entire flow** pipeline
- **Conflict resolution** for merged schemas

## 🚀 **How to Use**

### **Step 1: Create a Flow with Data Nodes**
1. Open the Flow Designer
2. Add a **File Node** and configure it with a CSV/JSON file
3. Add a **Transform Node** or **API Node** that supports mapping
4. Connect the nodes with edges

### **Step 2: Configure Attribute Mapping**
1. **Double-click** the transform/API node to open configuration
2. Scroll down to the **"Attribute Mapping"** section
3. You'll see:
   - **Input Fields** (left panel): Shows fields from connected nodes
   - **Output Fields** (right panel): Shows target schema fields
   - **Mapping Status**: Green checkmarks for mapped fields, warning icons for unmapped

### **Step 3: Create Field Mappings**
1. **Click the "+" icon** next to any output field to create a mapping
2. **Choose mapping type**:
   - **Direct**: Select a source field to copy directly
   - **Constant**: Enter a fixed value
   - **Expression**: Write custom JavaScript (e.g., `row.firstName + ' ' + row.lastName`)
   - **Aggregate**: Choose function (sum/count/avg) and source field
3. **Preview** the mapping in the dialog before saving
4. **Validate** that all required fields are mapped

### **Step 4: Test and Execute**
1. **Save** the node configuration
2. **Run the flow** to see the mapping in action
3. **Check results** in subsequent nodes or outputs

## 📊 **Node Type Support**

### **Transform Nodes**
- ✅ **Full schema editing** - Add/remove output fields
- ✅ **All mapping types** supported
- ✅ **Advanced transformations** with expressions
- **Use Case**: Data cleaning, field combinations, format conversions

### **API Nodes** 
- ✅ **Parameter mapping** for API calls
- ✅ **Response schema** definition
- ✅ **Lookup mappings** for dynamic API parameters
- **Use Case**: Enriching data with external API calls

### **Analytics Nodes**
- ✅ **Aggregate functions** (sum, count, average, etc.)
- ✅ **Metric calculations** and reporting fields
- ✅ **Custom analysis** expressions
- **Use Case**: Creating reports, calculating KPIs

### **Storage Nodes**
- ✅ **Output format** configuration
- ✅ **Field filtering** and selection
- **Use Case**: Preparing data for storage, format conversion

### **AI Tools Nodes**
- ✅ **Input preparation** for AI models
- ✅ **Output interpretation** and formatting
- **Use Case**: Preparing data for ML models, formatting AI responses

## 🛠 **Advanced Features**

### **Custom Output Schema**
For **Transform Nodes**, you can define completely custom output schemas:

1. Click **"Add Field"** in the output panel
2. Enter **field name**, **data type**, and **description**
3. Create mappings for the new fields
4. **Remove fields** you don't need (user-defined fields only)

### **Expression Mappings**
Write JavaScript expressions with access to input data:

```javascript
// Simple concatenation
row.firstName + ' ' + row.lastName

// Conditional logic
row.salary > 50000 ? 'Senior' : 'Junior'

// Date formatting
new Date(row.hire_date).getFullYear()

// Array operations
row.skills.join(', ')

// Mathematical calculations
Math.round(row.salary * 1.1)
```

### **Validation and Errors**
The system provides comprehensive validation:

- **Red errors**: Missing required mappings, invalid expressions
- **Yellow warnings**: Unmapped optional fields, empty constants
- **Real-time feedback**: See issues as you configure mappings
- **Mapping summary**: Overview of completion status

## 🔧 **API Integration**

### **Schema Detection Endpoint**
```javascript
// Detect schema from uploaded file
const result = await api.detectSchema({
  source_type: 'file',
  file_id: 'your-file-id',
  sample_size: 100
});

// Detect schema from sample data
const result = await api.detectSchema({
  source_type: 'sample_data', 
  sample_data: [
    { name: 'John', age: 30, active: true },
    { name: 'Jane', age: 25, active: false }
  ]
});
```

### **Mapping Validation**
```javascript
// Validate attribute mappings
const validation = await api.validateMappings({
  input_schema: inputFields,
  output_schema: outputFields,
  mappings: fieldMappings
});

console.log(validation.is_valid); // true/false
console.log(validation.errors);   // Array of error messages
console.log(validation.warnings); // Array of warnings
```

## 📝 **Example Use Cases**

### **Employee Data Transformation**
**Input**: Raw employee CSV with `first_name`, `last_name`, `hire_date`, `dept_code`
**Output**: Clean employee records with `full_name`, `years_employed`, `department`

```javascript
// Mappings:
full_name: row.first_name + ' ' + row.last_name
years_employed: new Date().getFullYear() - new Date(row.hire_date).getFullYear()
department: row.dept_code === 'ENG' ? 'Engineering' : 'Other'
```

### **API Data Enrichment**
**Input**: User records with `user_id`, `email`
**API Call**: Lookup additional user details
**Output**: Enriched user profiles with external data

### **Analytics Aggregation**
**Input**: Sales transaction records
**Output**: Monthly sales summary with totals, averages, and counts

## ⚡ **Performance Tips**

1. **Limit sample size** for large files during schema detection
2. **Use direct mappings** when possible (faster than expressions)
3. **Validate mappings** before running large flows
4. **Test with small datasets** first
5. **Cache schema information** in node configurations

## 🐛 **Troubleshooting**

### **Schema Not Detected**
- Check file format (CSV, JSON, XLSX supported)
- Ensure file is properly uploaded
- Try with a smaller sample size
- Verify file contains valid data

### **Mapping Errors**
- Check expression syntax for JavaScript mappings
- Ensure source fields exist in input schema
- Verify data types match expected output
- Use browser console to debug expressions

### **Performance Issues**
- Reduce sample size for schema detection
- Simplify complex expressions
- Use direct mappings instead of expressions where possible
- Check for circular references in flow

## 🔮 **Future Enhancements**

- **AI-powered mapping suggestions** based on field names and patterns
- **Visual mapping lines** connecting input to output fields
- **Bulk mapping operations** for common patterns
- **Mapping templates** for reusable transformation patterns
- **Advanced data validation** rules and constraints
- **Schema versioning** and change tracking

---

The attribute mapping system provides a powerful yet intuitive way to handle data transformations in your mgflow flows. Start with simple direct mappings and gradually explore more advanced features as your needs grow!