import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Box, Typography } from '@mui/material';
import CodeInterpreter from './CodeInterpreter';
import ToolExecutionDisplay from './ToolExecutionDisplay';

// Utility: Convert emoji unicode to codepoint string (e.g., '😀' -> '1f600')
function toCodePoint(unicodeSurrogates) {
  const r = [];
  let c = 0, p = 0, i = 0;
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++);
    if (p) {
      r.push(((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16)));
      p = 0;
    } else if (0xD800 <= c && c <= 0xDBFF) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join('-');
}

// Utility: Render emojis from unicode
function renderEmojis(text) {
  if (!text) return text;
  
  // Replace emoji unicode with img tags
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, (match) => {
    const codepoint = toCodePoint(match);
    return `<img src="/assets/emojis/${codepoint}.svg" alt="${match}" style="height: 1.2em; width: 1.2em; vertical-align: middle;" />`;
  });
}

// Utility: Parse code interpreter blocks from content
function parseCodeInterpreterBlocks(content) {
  const blocks = [];
  const codeInterpreterRegex = /<code_interpreter[^>]*>(.*?)<\/code_interpreter>/gs;
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeInterpreterRegex.exec(content)) !== null) {
    // Add text before the code interpreter block
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    // Add the code interpreter block
    blocks.push({
      type: 'code_interpreter',
      content: match[1].trim(),
      attributes: {
        lang: 'python' // Default to python for code interpreter
      }
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  return blocks.length > 0 ? blocks : [{ type: 'text', content }];
}

// Utility: Parse tool execution blocks from content
function parseToolExecutionBlocks(content) {
  const blocks = [];
  const toolExecutionRegex = /<details[^>]*type="tool_calls"[^>]*>(.*?)<\/details>/gs;
  
  let lastIndex = 0;
  let match;
  
  while ((match = toolExecutionRegex.exec(content)) !== null) {
    // Add text before the tool execution block
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    // Parse the tool execution details
    const detailsContent = match[1];
    const toolCall = parseToolCallFromDetails(detailsContent);
    
    if (toolCall) {
      blocks.push({
        type: 'tool_execution',
        toolCall: toolCall
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  return blocks.length > 0 ? blocks : [{ type: 'text', content }];
}

// Utility: Parse tool call information from details content
function parseToolCallFromDetails(detailsContent) {
  try {
    // Extract attributes from the details tag
    const idMatch = detailsContent.match(/id="([^"]*)"/);
    const nameMatch = detailsContent.match(/name="([^"]*)"/);
    const argumentsMatch = detailsContent.match(/arguments="([^"]*)"/);
    const resultMatch = detailsContent.match(/result="([^"]*)"/);
    const doneMatch = detailsContent.match(/done="([^"]*)"/);
    
    if (!nameMatch) return null;
    
    const id = idMatch ? idMatch[1] : '';
    const name = nameMatch[1];
    const args = argumentsMatch ? JSON.parse(argumentsMatch[1].replace(/&quot;/g, '"')) : {};
    const result = resultMatch ? JSON.parse(resultMatch[1].replace(/&quot;/g, '"')) : null;
    const done = doneMatch ? doneMatch[1] === 'true' : false;
    
    return {
      id,
      name,
      arguments: args,
      result,
      status: done ? (result ? 'success' : 'error') : 'pending'
    };
  } catch (error) {
    console.error('Error parsing tool call:', error);
    return null;
  }
}

// Utility: Parse all special blocks from content
function parseAllBlocks(content) {
  // First parse tool executions
  const toolBlocks = parseToolExecutionBlocks(content);
  
  // Then parse code interpreters within text blocks
  const allBlocks = [];
  
  for (const block of toolBlocks) {
    if (block.type === 'text') {
      const codeBlocks = parseCodeInterpreterBlocks(block.content);
      allBlocks.push(...codeBlocks);
    } else {
      allBlocks.push(block);
    }
  }
  
  return allBlocks;
}

const ChatMarkdown = ({ content }) => {
  const blocks = parseAllBlocks(content);
  
  return (
    <Box sx={{ mt: 1 }}>
      {blocks.map((block, index) => {
        if (block.type === 'code_interpreter') {
          return (
            <CodeInterpreter
              key={index}
              code={block.content}
              language={block.attributes?.lang || 'python'}
              disabled={false}
            />
          );
        }
        
        if (block.type === 'tool_execution') {
          return (
            <ToolExecutionDisplay
              key={index}
              toolCall={block.toolCall}
            />
          );
        }
        
        return (
          <ReactMarkdown
            key={index}
            components={{
              code({ node, inline, className, children, ...props }) {
                return !inline ? (
                  <Box component="pre" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, overflowX: 'auto', my: 1 }}>
                    <code {...props}>{children}</code>
                  </Box>
                ) : (
                  <code style={{ background: '#222', padding: '2px 6px', borderRadius: 4 }}>{children}</code>
                );
              },
              p({ children }) {
                // Render emojis in paragraphs
                const childrenArray = React.Children.toArray(children);
                return <Typography variant="body1" sx={{ mb: 1 }}>{childrenArray.map((child, i) => 
                  typeof child === 'string' 
                    ? <span key={i} dangerouslySetInnerHTML={{ __html: renderEmojis(child) }} />
                    : child
                )}</Typography>;
              },
              li({ children }) {
                const childrenArray = React.Children.toArray(children);
                return <li><Typography variant="body1" component="span">{childrenArray.map((child, i) => 
                  typeof child === 'string' 
                    ? <span key={i} dangerouslySetInnerHTML={{ __html: renderEmojis(child) }} />
                    : child
                )}</Typography></li>;
              }
            }}
          >
            {block.content}
          </ReactMarkdown>
        );
      })}
    </Box>
  );
};

export default ChatMarkdown; 