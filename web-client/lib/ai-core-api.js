import axios from 'axios';
import Cookies from 'js-cookie';

// Helper to get the 'useLocalChat' setting (from localStorage for now)
function getUseLocalChatSetting() {
  try {
    return localStorage.getItem('useLocalChat') === 'true';
  } catch {
    return false;
  }
}

// Helper to get the local server list (comma or semicolon delimited)
function getLocalChatServers() {
  try {
    const val = localStorage.getItem('localChatServers');
    if (!val) return [];
    return val.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// --- AI Core API instance ---
let AICORE_API_URL = null;
async function getAICOREApiUrl() {
  // If not using local chat, always use the env variable
  if (!getUseLocalChatSetting()) {
    const envUrl = process.env.AICORE_API_URL;
    if (envUrl) {
      AICORE_API_URL = envUrl;
        return AICORE_API_URL;
      }
    throw new Error('GNOSISGPT_SERVER_UNAVAILABLE');
  }
  // Use local chat: try each server in the list
  const localServers = getLocalChatServers();
  for (const url of localServers) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/health`);
      if (res.ok) {
        AICORE_API_URL = url.replace(/\/$/, '');
        return AICORE_API_URL;
      }
    } catch (e) {}
  }
  // Fallback to env if no local servers respond
    const envUrl = process.env.AICORE_API_URL;
    if (envUrl) {
          AICORE_API_URL = envUrl;
          return AICORE_API_URL;
  }
  throw new Error('GNOSISGPT_SERVER_UNAVAILABLE');
}

// Cant be an interceptor because it needs to be async
const AICOREApi = async (config) => {
  const baseURL = await getAICOREApiUrl();
  const token = Cookies.get('access_token');
  
  // Get user email from localStorage to send with requests
  let userEmail = null;
  try {
    const cachedUserInfo = localStorage.getItem('userInfo');
    if (cachedUserInfo) {
      const userInfo = JSON.parse(cachedUserInfo);
      userEmail = userInfo.email;
    }
  } catch (error) {
    console.error('Error reading user email from localStorage:', error);
  }
  
  const headers = {
    ...(config.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userEmail ? { 'X-User-Email': userEmail } : {}),
  };
  return axios({
    ...config,
    baseURL,
    headers,
    withCredentials: true,
  });
};

const AICOREApiClient = {
  // =====================
  // AI Core BACKEND API METHODS (Open WebUI)
  // =====================
  AICOREUploadFile: async (file, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    const response = await AICOREApi({
      method: 'post',
      url: '/api/v1/files',
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  AICOREChat: async (messages, model = 'llama3', fileIds = [], options = {}, systemPrompt = '', toolIds = undefined) => {
    const body = {
      model,
      messages,
      stream: false,
      ...(fileIds.length > 0 || (toolIds && toolIds.length > 0) ? { metadata: { ...(fileIds.length > 0 ? { files: fileIds } : {}), ...(toolIds && toolIds.length > 0 ? { tool_ids: toolIds } : {}) } } : {}),
      ...(options && Object.keys(options).length > 0 ? { options } : {}),
      ...(systemPrompt ? { system: systemPrompt } : {}),
    };
    const response = await AICOREApi({
      method: 'post',
      url: '/api/chat/completions',
      data: body,
    });
    
    // Debug logging to see what we're actually getting back
    console.log('API Response:', response);
    console.log('Response data:', response.data);
    console.log('Response status:', response.status);
    
    return response.data;
  },

  AICOREChatStream: async (messages, model = 'llama3', fileIds = [], options = {}, systemPrompt = '', toolIds = undefined) => {
    const body = { model, messages, stream: true };
    if (fileIds.length > 0 || (toolIds && toolIds.length > 0)) {
      body.metadata = { ...(fileIds.length > 0 ? { files: fileIds } : {}), ...(toolIds && toolIds.length > 0 ? { tool_ids: toolIds } : {}) };
    }
    if (options && Object.keys(options).length > 0) body.options = options;
    if (systemPrompt) body.system = systemPrompt;
    const baseURL = await getAICOREApiUrl();
    const token = Cookies.get('access_token');
    const response = await fetch(`${baseURL}/api/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body)
    });
    if (!response.body) throw new Error('No response body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';
    return {
      async *[Symbol.asyncIterator]() {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.replace('data: ', '').trim();
                if (data === '[DONE]') return;
                try {
                  yield JSON.parse(data);
                } catch {}
              }
            }
          }
        }
      }
    };
  },

  fetchAICOREModels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/models' });
    return response.data;
  },

  fetchAICOREChats: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/chats' });
    return response.data;
  },

  createAICOREChat: async (title, messages) => {
    const response = await AICOREApi({ 
      method: 'post', 
      url: '/api/v1/chats/new',
      data: {
        chat: {
          title: title,
          messages: messages || []
        }
      }
    });
    return response.data;
  },

  updateAICOREChat: async (chatId, title, messages) => {
    const response = await AICOREApi({ 
      method: 'post', 
      url: `/api/v1/chats/${chatId}`,
      data: {
        chat: {
          title: title,
          messages: messages
        }
      }
    });
    return response.data;
  },

  fetchAICOREChatById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/chats/${id}` });
    return response.data;
  },

  shareAICOREChat: async (chatId) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/chats/${chatId}/share` });
    return response.data;
  },

  unshareAICOREChat: async (chatId) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/chats/${chatId}/share` });
    return response.data;
  },

  fetchAICORESharedChat: async (shareId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/chats/share/${shareId}` });
    return response.data;
  },

  deleteAICOREChat: async (chatId) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/chats/${chatId}` });
    return response.data;
  },

  exportAICOREChat: async (chatId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/chats/${chatId}` });
    return response.data;
  },

  fetchAICOREKnowledgeBases: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/knowledge' });
    return response.data;
  },

  fetchAICOREKnowledgeBaseById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/knowledge/${id}` });
    return response.data;
  },
  
  // --- Additional AI Core endpoints used by chat.js ---
  processWebSearch: async (query) => {
    // POST /process/web/search expects { queries: [query] }
    const response = await AICOREApi({
      method: 'post',
      url: '/process/web/search',
      data: { queries: [query] },
    });
    return response.data;
  },

  getTools: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/tools' });
    return response.data;
  },

  getToolById: async (toolId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/tools/id/${toolId}` });
    return response.data;
  },

  executeTool: async (toolName, parameters = {}) => {
    const response = await AICOREApi({
      method: 'post',
      url: '/api/v1/tools/execute',
      data: { tool_name: toolName, parameters },
    });
    return response.data;
  },

  getImageGenerationConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/images/config' });
    return response.data;
  },

  getImageGenerationModels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/images/models' });
    return response.data;
  },

  generateImage: async (prompt, options = {}) => {
    const response = await AICOREApi({
      method: 'post',
      url: '/api/v1/images/generations',
      data: {
        prompt: prompt,
        model: options.model,
        size: options.size,
        n: options.n || 1,
        negative_prompt: options.negative_prompt,
      },
    });
    return response.data;
  },

  executeCode: async (code) => {
    const response = await AICOREApi({
      method: 'post',
      url: '/api/v1/code/execute',
      data: { code },
    });
    return response.data;
  },

  // ===== FOLDERS ROUTES =====
  getFolders: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/folders' });
    return response.data;
  },
  createFolder: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/folders', data });
    return response.data;
  },
  getFolderById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/folders/${id}` });
    return response.data;
  },
  updateFolderNameById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/folders/${id}/update`, data });
    return response.data;
  },
  updateFolderParentIdById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/folders/${id}/update/parent`, data });
    return response.data;
  },
  updateFolderIsExpandedById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/folders/${id}/update/expanded`, data });
    return response.data;
  },
  deleteFolderById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/folders/${id}` });
    return response.data;
  },

  // ===== FILES ROUTES =====
  uploadFile: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/files', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  listFiles: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/files' });
    return response.data;
  },
  searchFiles: async (filename) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/files/search?filename=${encodeURIComponent(filename)}` });
    return response.data;
  },
  deleteAllFiles: async () => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/files/all' });
    return response.data;
  },
  getFileById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/files/${id}` });
    return response.data;
  },
  getFileDataContentById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/files/${id}/data/content` });
    return response.data;
  },
  updateFileDataContentById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/files/${id}/data/content/update`, data });
    return response.data;
  },
  getFileContentById: async (id, attachment = false) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/files/${id}/content?attachment=${attachment}` });
    return response.data;
  },
  getHtmlFileContentById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/files/${id}/content/html` });
    return response.data;
  },
  deleteFileById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/files/${id}` });
    return response.data;
  },

  // ===== NOTES ROUTES =====
  getNotes: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/notes' });
    return response.data;
  },
  getNoteList: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/notes/list' });
    return response.data;
  },
  createNote: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/notes/create', data });
    return response.data;
  },
  getNoteById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/notes/${id}` });
    return response.data;
  },
  updateNoteById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/notes/${id}/update`, data });
    return response.data;
  },
  deleteNoteById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/notes/${id}/delete` });
    return response.data;
  },

  // ===== PROMPTS ROUTES =====
  getPrompts: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/prompts' });
    return response.data;
  },
  getPromptList: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/prompts/list' });
    return response.data;
  },
  createPrompt: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/prompts/create', data });
    return response.data;
  },
  getPromptByCommand: async (command) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/prompts/command/${command}` });
    return response.data;
  },
  updatePromptByCommand: async (command, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/prompts/command/${command}/update`, data });
    return response.data;
  },
  deletePromptByCommand: async (command) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/prompts/command/${command}/delete` });
    return response.data;
  },

  // ===== CHANNELS ROUTES =====
  getChannels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/channels' });
    return response.data;
  },
  getAllChannels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/channels/list' });
    return response.data;
  },
  createChannel: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/channels/create', data });
    return response.data;
  },
  getChannelById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/channels/${id}` });
    return response.data;
  },
  updateChannelById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/channels/${id}/update`, data });
    return response.data;
  },
  deleteChannelById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/channels/${id}/delete` });
    return response.data;
  },
  getChannelMessages: async (id, skip = 0, limit = 50) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/channels/${id}/messages?skip=${skip}&limit=${limit}` });
    return response.data;
  },
  postChannelMessage: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/channels/${id}/messages/post`, data });
    return response.data;
  },
  getChannelMessage: async (id, messageId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/channels/${id}/messages/${messageId}` });
    return response.data;
  },
  getChannelThreadMessages: async (id, messageId, skip = 0, limit = 50) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/channels/${id}/messages/${messageId}/thread?skip=${skip}&limit=${limit}` });
    return response.data;
  },
  updateChannelMessageById: async (id, messageId, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/channels/${id}/messages/${messageId}/update`, data });
    return response.data;
  },
  addReactionToMessage: async (id, messageId, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/channels/${id}/messages/${messageId}/reactions/add`, data });
    return response.data;
  },
  removeReactionFromMessage: async (id, messageId, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/channels/${id}/messages/${messageId}/reactions/remove`, data });
    return response.data;
  },
  deleteChannelMessageById: async (id, messageId) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/channels/${id}/messages/${messageId}/delete` });
    return response.data;
  },

  // ===== TASKS ROUTES =====
  getTaskConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/tasks/config' });
    return response.data;
  },
  updateTaskConfig: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/config/update', data });
    return response.data;
  },
  generateTitle: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/title/completions', data });
    return response.data;
  },
  generateFollowUps: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/follow_up/completions', data });
    return response.data;
  },
  generateChatTags: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/tags/completions', data });
    return response.data;
  },
  generateImagePrompt: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/image_prompt/completions', data });
    return response.data;
  },
  generateQueries: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/queries/completions', data });
    return response.data;
  },
  generateAutocompletion: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/auto/completions', data });
    return response.data;
  },
  generateEmoji: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/emoji/completions', data });
    return response.data;
  },
  generateMoaResponse: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/tasks/moa/completions', data });
    return response.data;
  },

  // ===== PIPELINES ROUTES =====
  getPipelinesList: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/pipelines/list' });
    return response.data;
  },
  uploadPipeline: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/pipelines/upload', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  addPipeline: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/pipelines/add', data });
    return response.data;
  },
  deletePipeline: async (data) => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/pipelines/delete', data });
    return response.data;
  },
  getPipelines: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await AICOREApi({ method: 'get', url: `/api/v1/pipelines/${query ? '?' + query : ''}` });
    return response.data;
  },
  getPipelineValves: async (pipelineId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await AICOREApi({ method: 'get', url: `/api/v1/pipelines/${pipelineId}/valves${query ? '?' + query : ''}` });
    return response.data;
  },
  getPipelineValvesSpec: async (pipelineId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await AICOREApi({ method: 'get', url: `/api/v1/pipelines/${pipelineId}/valves/spec${query ? '?' + query : ''}` });
    return response.data;
  },
  updatePipelineValves: async (pipelineId, data, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await AICOREApi({ method: 'post', url: `/api/v1/pipelines/${pipelineId}/valves/update${query ? '?' + query : ''}`, data });
    return response.data;
  },

  // ===== GROUPS ROUTES =====
  getGroups: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/groups' });
    return response.data;
  },
  createGroup: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/groups/create', data });
    return response.data;
  },
  getGroupById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/groups/id/${id}` });
    return response.data;
  },
  updateGroupById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/groups/id/${id}/update`, data });
    return response.data;
  },
  addUserToGroup: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/groups/id/${id}/users/add`, data });
    return response.data;
  },
  removeUsersFromGroup: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/groups/id/${id}/users/remove`, data });
    return response.data;
  },
  deleteGroupById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/groups/id/${id}/delete` });
    return response.data;
  },

  // ===== MEMORIES ROUTES =====
  getMemories: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/memories' });
    return response.data;
  },
  addMemory: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/memories/add', data });
    return response.data;
  },
  queryMemory: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/memories/query', data });
    return response.data;
  },
  resetMemoryFromVectorDB: async () => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/memories/reset' });
    return response.data;
  },
  deleteMemoryByUserId: async () => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/memories/delete/user' });
    return response.data;
  },
  updateMemoryById: async (memoryId, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/memories/${memoryId}/update`, data });
    return response.data;
  },
  deleteMemoryById: async (memoryId) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/memories/${memoryId}` });
    return response.data;
  },

  // ===== FUNCTIONS ROUTES =====
  getFunctions: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/functions' });
    return response.data;
  },
  exportFunctions: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/functions/export' });
    return response.data;
  },
  loadFunctionFromUrl: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/functions/load/url', data });
    return response.data;
  },
  syncFunctions: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/functions/sync', data });
    return response.data;
  },
  createFunction: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/functions/create', data });
    return response.data;
  },
  getFunctionById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/functions/id/${id}` });
    return response.data;
  },
  toggleFunctionById: async (id) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/functions/id/${id}/toggle` });
    return response.data;
  },
  toggleGlobalById: async (id) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/functions/id/${id}/toggle/global` });
    return response.data;
  },
  updateFunctionById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/functions/id/${id}/update`, data });
    return response.data;
  },
  deleteFunctionById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/functions/id/${id}/delete` });
    return response.data;
  },
  getFunctionValvesById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/functions/id/${id}/valves` });
    return response.data;
  },
  getFunctionValvesSpecById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/functions/id/${id}/valves/spec` });
    return response.data;
  },
  updateFunctionValvesById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/functions/id/${id}/valves/update`, data });
    return response.data;
  },
  getFunctionUserValvesById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/functions/id/${id}/valves/user` });
    return response.data;
  },
  getFunctionUserValvesSpecById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/functions/id/${id}/valves/user/spec` });
    return response.data;
  },
  updateFunctionUserValvesById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/functions/id/${id}/valves/user/update`, data });
    return response.data;
  },

  // ===== EVALUATIONS ROUTES =====
  getEvaluationConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/evaluations/config' });
    return response.data;
  },
  updateEvaluationConfig: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/evaluations/config', data });
    return response.data;
  },
  getAllFeedbacks: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/evaluations/feedbacks/all' });
    return response.data;
  },
  deleteAllFeedbacks: async () => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/evaluations/feedbacks/all' });
    return response.data;
  },
  exportAllFeedbacks: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/evaluations/feedbacks/all/export' });
    return response.data;
  },
  getUserFeedbacks: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/evaluations/feedbacks/user' });
    return response.data;
  },
  deleteUserFeedbacks: async () => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/evaluations/feedbacks' });
    return response.data;
  },
  createFeedback: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/evaluations/feedback', data });
    return response.data;
  },
  getFeedbackById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/evaluations/feedback/${id}` });
    return response.data;
  },
  updateFeedbackById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/evaluations/feedback/${id}`, data });
    return response.data;
  },
  deleteFeedbackById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/evaluations/feedback/${id}` });
    return response.data;
  },

  // ===== AUDIO ROUTES =====
  getAudioConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/audio/config' });
    return response.data;
  },
  updateAudioConfig: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/audio/config/update', data });
    return response.data;
  },
  speech: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/audio/speech', data });
    return response.data;
  },
  transcription: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/audio/transcriptions', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  getAudioModels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/audio/models' });
    return response.data;
  },
  getAudioVoices: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/audio/voices' });
    return response.data;
  },

  // ===== RETRIEVAL ROUTES =====
  getRetrievalStatus: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/retrieval' });
    return response.data;
  },
  getEmbeddingConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/retrieval/embedding' });
    return response.data;
  },
  updateEmbeddingConfig: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/embedding/update', data });
    return response.data;
  },
  getRagConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/retrieval/config' });
    return response.data;
  },
  updateRagConfig: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/config/update', data });
    return response.data;
  },
  processFile: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/process/file', data });
    return response.data;
  },
  processText: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/process/text', data });
    return response.data;
  },
  processYoutube: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/process/youtube', data });
    return response.data;
  },
  processWeb: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/process/web', data });
    return response.data;
  },
  processFilesBatch: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/process/files/batch', data });
    return response.data;
  },
  queryDoc: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/query/doc', data });
    return response.data;
  },
  queryCollection: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/query/collection', data });
    return response.data;
  },
  deleteEntriesFromCollection: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/delete', data });
    return response.data;
  },
  resetVectorDb: async () => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/reset/db' });
    return response.data;
  },
  resetUploads: async () => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/retrieval/reset/uploads' });
    return response.data;
  },

  // ===== USERS ROUTES =====
  getActiveUsers: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/active' });
    return response.data;
  },
  getUsers: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await AICOREApi({ method: 'get', url: `/api/v1/users/${query ? '?' + query : ''}` });
    return response.data;
  },
  getAllUsers: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/all' });
    return response.data;
  },
  getUserGroups: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/groups' });
    return response.data;
  },
  getUserPermissions: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/permissions' });
    return response.data;
  },
  getDefaultUserPermissions: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/default/permissions' });
    return response.data;
  },
  updateDefaultUserPermissions: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/users/default/permissions', data });
    return response.data;
  },
  getUserSettings: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/user/settings' });
    return response.data;
  },
  updateUserSettings: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/users/user/settings/update', data });
    return response.data;
  },
  getUserInfo: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/users/user/info' });
    return response.data;
  },
  updateUserInfo: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/users/user/info/update', data });
    return response.data;
  },
  getUserById: async (userId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/users/${userId}` });
    return response.data;
  },
  getUserActiveStatusById: async (userId) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/users/${userId}/active` });
    return response.data;
  },
  updateUserById: async (userId, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/users/${userId}/update`, data });
    return response.data;
  },
  deleteUserById: async (userId) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/users/${userId}` });
    return response.data;
  },

  // ===== MODELS ROUTES =====
  getModels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/models' });
    return response.data;
  },
  getBaseModels: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/models/base' });
    return response.data;
  },
  createModel: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/models/create', data });
    return response.data;
  },
  getModelById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/models/model?id=${encodeURIComponent(id)}` });
    return response.data;
  },
  toggleModelById: async (id) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/models/model/toggle', data: { id } });
    return response.data;
  },
  updateModelById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/models/model/update', data: { id, ...data } });
    return response.data;
  },
  deleteModelById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/models/model/delete', data: { id } });
    return response.data;
  },
  deleteAllModels: async () => {
    const response = await AICOREApi({ method: 'delete', url: '/api/v1/models/delete/all' });
    return response.data;
  },

  // ===== KNOWLEDGE ROUTES =====
  getKnowledgeBases: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/knowledge' });
    return response.data;
  },
  getKnowledgeList: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/v1/knowledge/list' });
    return response.data;
  },
  createKnowledge: async (data) => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/knowledge/create', data });
    return response.data;
  },
  reindexKnowledgeFiles: async () => {
    const response = await AICOREApi({ method: 'post', url: '/api/v1/knowledge/reindex' });
    return response.data;
  },
  getKnowledgeById: async (id) => {
    const response = await AICOREApi({ method: 'get', url: `/api/v1/knowledge/${id}` });
    return response.data;
  },
  updateKnowledgeById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/update`, data });
    return response.data;
  },
  addFileToKnowledgeById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/file/add`, data });
    return response.data;
  },
  updateFileFromKnowledgeById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/file/update`, data });
    return response.data;
  },
  removeFileFromKnowledgeById: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/file/remove`, data });
    return response.data;
  },
  deleteKnowledgeById: async (id) => {
    const response = await AICOREApi({ method: 'delete', url: `/api/v1/knowledge/${id}/delete` });
    return response.data;
  },
  resetKnowledgeById: async (id) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/reset` });
    return response.data;
  },
  addFilesToKnowledgeBatch: async (id, data) => {
    const response = await AICOREApi({ method: 'post', url: `/api/v1/knowledge/${id}/files/batch/add`, data });
    return response.data;
  },

  // ===== CHAT SPECIAL ROUTES =====
  chatCompleted: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/chat/completed', data: formData });
    return response.data;
  },
  chatAction: async (actionId, formData) => {
    const response = await AICOREApi({ method: 'post', url: `/api/chat/actions/${actionId}`, data: formData });
    return response.data;
  },

  // ===== EMBEDDINGS ROUTE =====
  createEmbeddings: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/embeddings', data: formData });
    return response.data;
  },

  // ===== CONFIG/INFO ROUTES =====
  getConfig: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/config' });
    return response.data;
  },
  getVersion: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/version' });
    return response.data;
  },
  getVersionUpdates: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/version/updates' });
    return response.data;
  },
  getUsage: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/usage' });
    return response.data;
  },

  // ===== HEALTH ROUTES =====
  getHealth: async () => {
    const response = await AICOREApi({ method: 'get', url: '/health' });
    return response.data;
  },
  getHealthDb: async () => {
    const response = await AICOREApi({ method: 'get', url: '/health/db' });
    return response.data;
  },

  // ===== CACHE ROUTE =====
  getCacheFile: async (path) => {
    const response = await AICOREApi({ method: 'get', url: `/cache/${path}` });
    return response.data;
  },

  // ===== WEBHOOK ROUTES =====
  getWebhook: async () => {
    const response = await AICOREApi({ method: 'get', url: '/api/webhook' });
    return response.data;
  },
  updateWebhook: async (formData) => {
    const response = await AICOREApi({ method: 'post', url: '/api/webhook', data: formData });
    return response.data;
  },
};

export default AICOREApiClient;