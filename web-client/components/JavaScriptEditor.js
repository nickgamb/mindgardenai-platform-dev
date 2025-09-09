import React from 'react';
import Editor from '@monaco-editor/react';
import { Box, Typography } from '@mui/material';

/**
 * JavaScriptEditor - Reusable code editor with JavaScript syntax highlighting
 * 
 * Features:
 * - JavaScript syntax highlighting and IntelliSense
 * - Dark theme matching the application
 * - Resizable editor
 * - Auto-completion and error detection
 * - Line numbers and minimap
 */

const JavaScriptEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter your JavaScript code here...",
  height = "400px",
  filename = "script.js",
  language = 'javascript',
  disableValidation = false
}) => {
  
  const handleEditorChange = (newValue) => {
    if (onChange) {
      // Create a synthetic event-like object for compatibility
      const syntheticEvent = {
        target: { value: newValue }
      };
      onChange(syntheticEvent);
    }
  };

  const editorOptions = {
    fontSize: 14,
    fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
    wordWrap: 'on',
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    formatOnPaste: true,
    formatOnType: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    quickSuggestions: true,
    parameterHints: { enabled: true },
    hover: { enabled: true },
    contextmenu: true,
    selectOnLineNumbers: true,
    lineNumbersMinChars: 3,
    glyphMargin: true,
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'mouseover',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true
    }
  };

  const editorTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'constant', foreground: '4FC1FF' }
    ],
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#1a1a1a',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editorCursor.foreground': '#8b5cf6',
      'editor.selectionHighlightBackground': '#ffffff10',
      'editor.wordHighlightBackground': '#ffffff10',
      'editor.findMatchBackground': '#515C6A',
      'editor.findMatchHighlightBackground': '#EA5C0055',
      'editorBracketMatch.background': '#0064001a',
      'editorBracketMatch.border': '#888888',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editorWhitespace.foreground': '#404040',
      'scrollbar.shadow': '#000000',
      'scrollbarSlider.background': '#797979',
      'scrollbarSlider.hoverBackground': '#646464',
      'scrollbarSlider.activeBackground': '#BFBFBF'
    }
  };

  return (
    <Box sx={{ 
      height: height,
      border: '2px solid #333',
      borderRadius: 2,
      overflow: 'auto',
      bgcolor: '#0a0a0a',
      resize: 'both',
      minHeight: '200px',
      minWidth: '300px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      '&:hover': {
        borderColor: '#8b5cf6'
      },
      '&:focus-within': {
        borderColor: '#8b5cf6',
        boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.2)'
      }
    }}>
      {/* Editor Header */}
      <Box sx={{ 
        bgcolor: '#111', 
        px: 2, 
        py: 1, 
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <Box sx={{ 
          width: 12, 
          height: 12, 
          borderRadius: '50%', 
          bgcolor: '#ef4444' 
        }} />
        <Box sx={{ 
          width: 12, 
          height: 12, 
          borderRadius: '50%', 
          bgcolor: '#f59e0b' 
        }} />
        <Box sx={{ 
          width: 12, 
          height: 12, 
          borderRadius: '50%', 
          bgcolor: '#10b981' 
        }} />
        <Typography variant="caption" sx={{ color: '#666', ml: 1 }}>
          {filename}
        </Typography>
      </Box>

      {/* Monaco Editor */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language={language}
          theme="custom-dark"
          value={value}
          onChange={handleEditorChange}
          options={editorOptions}
          beforeMount={(monaco) => {
            // Define custom theme
            monaco.editor.defineTheme('custom-dark', editorTheme);
            
            if (language === 'javascript') {
              // Add JavaScript type definitions for our EEG functions
              monaco.languages.typescript.javascriptDefaults.addExtraLib(`
                /**
                 * Analyze EEG data and return results
                 * @param {Array} data - EEG data array
                 * @param {string[]} channels - Channel names
                 * @param {number} sampleRate - Sampling rate in Hz  
                 * @param {Array} storageData - Historical data from storage
                 * @returns {Object} Analysis results
                 */
                declare function analyzeEEGData(data: any[], channels: string[], sampleRate: number, storageData?: any[]): any;
                
                /**
                 * Run an EEG experiment
                 * @param {Array} data - Current EEG data
                 * @param {string[]} channels - Channel names
                 * @param {number} sampleRate - Sampling rate in Hz
                 * @param {Object} experimentConfig - Experiment configuration
                 * @returns {Object} Experiment results
                 */
                declare function runExperiment(data: any[], channels: string[], sampleRate: number, experimentConfig: any): any;
                
                /**
                 * Apply a filter to EEG data
                 * @param {Array} data - EEG data to filter
                 * @param {string[]} channels - Channel names
                 * @param {number} sampleRate - Sampling rate in Hz
                 * @returns {Array} Filtered data
                 */
                declare function apply_bandpass_filter(data: any[], channels: string[], sampleRate: number): any[];
              `, 'eeg-functions.d.ts');
            }

            if (language === 'json') {
              // Optionally disable JSON validation to avoid red squiggles for relaxed JSON
              monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: !disableValidation,
                allowComments: true
              });
            }
          }}
          loading={
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: '#888'
            }}>
              Loading JavaScript Editor...
            </Box>
          }
        />
      </Box>
    </Box>
  );
};

export default JavaScriptEditor;