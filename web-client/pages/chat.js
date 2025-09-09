// NOTE: Chat functionality is complete and working - cosmetic improvements can be addressed in future iterations 
import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Box, Typography, CircularProgress, Chip, Grid, Button, Link, Snackbar, IconButton, Autocomplete, TextField, Collapse, Paper, Divider, Menu, MenuItem } from '@mui/material';
import Image from 'next/image';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import ChatFileUpload from '../components/ChatFileUpload';
import ChatHistory from '../components/ChatHistory';
import WebSearchToggle from '../components/WebSearchToggle';
import ImageGenerationModal from '../components/ImageGenerationModal';
import LoginButton from '../components/LoginButton';
import AICOREApiClient from '../lib/ai-core-api';
import { useRouter } from 'next/router';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';

const ChatPage = () => {
  // Use the standard pattern for auth context
  const { isAuthenticated, isAuthorized, isLoading, handleLogin, handleLogout } = useContext(AppContext);
  const router = useRouter();
  const mainContentRef = useRef(null);
  const loginCanvasRef = useRef(null); // Add canvas ref for login effects
  const [messages, setMessages] = useState([]);
  
  // Ensure messages is always an array
  useEffect(() => {
    if (!Array.isArray(messages)) {
      console.warn('Messages state corrupted, resetting to empty array');
      setMessages([]);
    }
  }, [messages]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [files, setFiles] = useState([]);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState(null);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState([]);
  const [knowledgeError, setKnowledgeError] = useState(null);
  const [tools, setTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [toolsError, setToolsError] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  
  // Debug state changes
  useEffect(() => {
    console.log('📊 Chats state updated:', { 
      count: chats?.length || 0, 
      chats: chats?.slice(0, 3).map(c => ({ id: c.id, title: c.title })) || []
    });
  }, [chats]);
  
  useEffect(() => {
    console.log('🎯 Selected chat ID updated:', selectedChatId);
  }, [selectedChatId]);
  
  useEffect(() => {
    console.log('🔐 Auth state:', { isAuthenticated, isAuthorized, isLoading });
  }, [isAuthenticated, isAuthorized, isLoading]);
  const [shareId, setShareId] = useState(null);
  const [shareError, setShareError] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(null);
  const [showCopySnackbar, setShowCopySnackbar] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchStatus, setWebSearchStatus] = useState(null);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageGenerationStatus, setImageGenerationStatus] = useState(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedChatLoading, setSharedChatLoading] = useState(false);
  const [sharedChatError, setSharedChatError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fileIds, setFileIds] = useState([]);
  const [deleteError, setDeleteError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [error, setError] = useState(null);
  // Add a new state for server connectivity error
  const [serverError, setServerError] = useState(null);
  const [unsavedChat, setUnsavedChat] = useState(false);
  
  // New UI state for ChatGPT-like interface
  const [showSettings, setShowSettings] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

  useEffect(() => {
    // Only fetch models if user is authenticated and authorized
    if (!isAuthenticated || !isAuthorized || isLoading) {
      console.log('⏳ Waiting for authentication before fetching models...', { isAuthenticated, isAuthorized, isLoading });
      return;
    }

    // Fetch available models from Alden Core backend
    const fetchModels = async () => {
      try {
        const res = await AICOREApiClient.fetchAICOREModels?.();
        if (res && Array.isArray(res.data)) {
          setModels(res.data);
          if (res.data.length > 0) setSelectedModel(res.data[0].id || res.data[0]);
          setServerError(null);
        } else {
          setModels([{ id: 'llama3', name: 'llama3' }]);
        }
      } catch (err) {
        console.error('Error fetching models:', err);
        setModels([{ id: 'llama3', name: 'llama3' }]);
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      }
    };
    fetchModels();
  }, [isAuthenticated, isAuthorized, isLoading]);

  useEffect(() => {
    // Only fetch chats if user is authenticated and authorized
    if (!isAuthenticated || !isAuthorized || isLoading) {
      console.log('⏳ Waiting for authentication before fetching chats...', { isAuthenticated, isAuthorized, isLoading });
      return;
    }
    
    // Fetch chat history from backend
    const fetchChats = async () => {
      console.log('🔄 Fetching chat history on mount...');
      setHistoryLoading(true);
      try {
        const res = await AICOREApiClient.fetchAICOREChats?.();
        console.log('📝 Chat history response:', res);
        if (res && Array.isArray(res)) {
          console.log(`✅ Found ${res.length} chats, setting them in state`);
          setChats(res);
          if (res.length > 0) {
            const firstChatId = res[0].id || res[0];
            console.log('🎯 Setting initial selected chat ID:', firstChatId);
            setSelectedChatId(firstChatId);
          } else {
            console.log('📭 No chats found, clearing selection');
            setSelectedChatId(null);
          }
          setServerError(null);
        } else {
          console.log('❌ Invalid chat response format:', res);
          setChats([]);
          setSelectedChatId(null);
        }
      } catch (err) {
        console.error('❌ Error fetching chats:', err);
        console.error('Error details:', {
          message: err?.message,
          status: err?.response?.status,
          statusText: err?.response?.statusText
        });
        setChats([]);
        setSelectedChatId(null);
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchChats();
  }, [isAuthenticated, isAuthorized, isLoading]);

  useEffect(() => {
    // Load messages for selected chat from backend
    const fetchChat = async () => {
      console.log('🔄 useEffect triggered for selectedChatId:', selectedChatId);
      console.log('🔐 Auth state in messages useEffect:', { isAuthenticated, isAuthorized, isLoading });
      
      if (!selectedChatId) {
        console.log('❌ No selectedChatId, clearing messages');
        setMessages([]);
        setLoading(false);
        return;
      }
      
      if (!isAuthenticated || !isAuthorized || isLoading) {
        console.log('⏳ Waiting for authentication before fetching messages...');
        return;
      }
      
      console.log('📥 Fetching messages for chat:', selectedChatId);
      setLoading(true);
      try {
        const res = await AICOREApiClient.fetchAICOREChatById(selectedChatId);
        console.log('📝 Chat messages response:', res);
        console.log('📝 Response structure check:', {
          hasData: !!res.data,
          hasChat: !!res.chat,
          hasDirectMessages: !!res.messages,
          chatMessages: res.chat?.messages,
          dataMessages: res.data?.messages
        });
        
        // The API returns the chat object directly, with messages in chat.messages
        if (res && res.chat && Array.isArray(res.chat.messages)) {
          console.log(`✅ Loaded ${res.chat.messages.length} messages for chat ${selectedChatId} from res.chat.messages`);
          setMessages(res.chat.messages);
          setServerError(null);
        } else if (res && Array.isArray(res.messages)) {
          console.log(`✅ Loaded ${res.messages.length} messages for chat ${selectedChatId} from res.messages`);
          setMessages(res.messages);
          setServerError(null);
        } else if (res && res.data && Array.isArray(res.data.messages)) {
          console.log(`✅ Loaded ${res.data.messages.length} messages for chat ${selectedChatId} from res.data.messages`);
          setMessages(res.data.messages);
          setServerError(null);
        } else {
          console.log('❌ Invalid messages response format - clearing messages. Response:', res);
          setMessages([]);
        }
      } catch (err) {
        console.error('❌ Error fetching chat messages:', err);
        console.error('Error details:', {
          message: err?.message,
          status: err?.response?.status,
          statusText: err?.response?.statusText
        });
        // Handle different types of errors appropriately
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          console.warn('🔐 Authentication error fetching chat - keeping current messages');
          setError('Authentication error - please try refreshing the page');
        } else if (err?.response?.status === 404) {
          console.warn('📭 Chat not found - clearing messages');
          setMessages([]);
          setError('Chat not found');
        } else {
          // Only clear messages for actual data errors, not auth issues
          console.log('🗑️ Clearing messages due to error:', err?.response?.status || 'unknown');
          setMessages([]);
          setError(`Error loading chat: ${err?.message || 'Unknown error'}`);
        }
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchChat();
  }, [selectedChatId, isAuthenticated, isAuthorized, isLoading]);

  useEffect(() => {
    // Fetch shareId for selected chat
    const fetchShareId = async () => {
      setShareId(null);
      setShareError(null);
      if (!selectedChatId) return;
      try {
        const res = await AICOREApiClient.fetchAICOREChatById(selectedChatId);
        if (res && res.data && res.data.share_id) {
          setShareId(res.data.share_id);
          setServerError(null);
        }
      } catch (err) {
        console.error('Error fetching share status:', err);
        // Don't show share errors for auth issues - they're not critical
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          console.warn('Authentication error fetching share status - skipping');
          return; // Don't set error states for auth issues
        }
        setShareError('Could not fetch share status.');
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      }
    };
    fetchShareId();
  }, [selectedChatId]);

  // On mount, check for ?share= in the URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (shareParam) {
      setIsSharedView(true);
      setSharedChatLoading(true);
      setSharedChatError(null);
      AICOREApiClient.fetchAICORESharedChat(shareParam)
        .then((res) => {
          if (res && res.chat && Array.isArray(res.chat.history?.messages)) {
            setMessages(res.chat.history.messages);
          } else {
            setMessages([]);
          }
          setSharedChatLoading(false);
        })
        .catch((err) => {
          setSharedChatError('Could not load shared chat.');
          setMessages([]);
          setSharedChatLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    // Only fetch knowledge bases if user is authenticated and authorized
    if (!isAuthenticated || !isAuthorized || isLoading) {
      console.log('⏳ Waiting for authentication before fetching knowledge bases...', { isAuthenticated, isAuthorized, isLoading });
      return;
    }

    // Fetch knowledge bases for RAG
    const fetchKBs = async () => {
      setKnowledgeError(null);
      try {
        const res = await AICOREApiClient.fetchAICOREKnowledgeBases();
        if (Array.isArray(res)) {
          setKnowledgeBases(res);
          setServerError(null);
        } else {
          setKnowledgeBases([]);
        }
      } catch (err) {
        console.error('Error fetching knowledge bases:', err);
        setKnowledgeError('Failed to load knowledge bases.');
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      }
    };
    fetchKBs();
  }, [isAuthenticated, isAuthorized, isLoading]);

  useEffect(() => {
    // Only fetch tools if user is authenticated and authorized
    if (!isAuthenticated || !isAuthorized || isLoading) {
      console.log('⏳ Waiting for authentication before fetching tools...', { isAuthenticated, isAuthorized, isLoading });
      return;
    }

    // Fetch tools/plugins for plugin/tool support
    const fetchTools = async () => {
      setToolsError(null);
      try {
        const res = await AICOREApiClient.getTools();
        // Ensure res is an array before setting it
        if (res && Array.isArray(res)) {
          setTools(res);
          setServerError(null);
        } else {
          console.warn('Tools response is not an array:', res);
          setTools([]);
        }
      } catch (err) {
        console.error('Error fetching tools:', err);
        setToolsError('Failed to load tools/plugins.');
        setTools([]);
        // Only show server error for actual server issues, not network timeouts
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
            (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
          setServerError('Cannot connect to the server. Please check your connection or try again later.');
        }
      }
    };
    fetchTools();
  }, [isAuthenticated, isAuthorized, isLoading]);

  const handleFileUpload = async (newFiles) => {
    if (!Array.isArray(newFiles)) {
      console.error('handleFileUpload: newFiles is not an array:', newFiles);
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setFileUploadLoading(true);
    setFileUploadError(null);
    try {
      const uploadedIds = [];
      for (const file of newFiles) {
        const res = await AICOREApiClient.AICOREUploadFile(file);
        if (res && res.id) {
          uploadedIds.push(res.id);
        }
      }
      setFileIds((prev) => [...prev, ...uploadedIds]);
      setServerError(null);
    } catch (err) {
      console.error('Error uploading files:', err);
      setFileUploadError('File upload failed: ' + (err?.message || err));
      // Only show server error for actual server issues, not network timeouts
      if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
          (err?.message?.includes('Network Error') && !err?.message?.includes('timeout'))) {
        setServerError('Cannot connect to the server. Please check your connection or try again later.');
      }
    } finally {
      setFileUploadLoading(false);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return [...safePrev, userMessage];
    });
    setLoading(true);

    try {
      let chatMessages = [
        ...(Array.isArray(messages) ? messages : []),
        userMessage
      ];

      // If web search is enabled, perform web search first
      if (webSearchEnabled) {
        setWebSearchStatus('Searching the web...');
        try {
          const searchResults = await AICOREApiClient.processWebSearch(message);
          if (searchResults && searchResults.collection_names) {
            setWebSearchStatus(`Found ${searchResults.filenames?.length || 0} sources`);
            // Add web search results to the chat context
            chatMessages.push({
              id: Date.now() + 1,
              role: 'system',
              content: `Web search results: ${Array.isArray(searchResults.collection_names) ? searchResults.collection_names.join(', ') : 'Unknown sources'}`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Web search failed:', error);
          setWebSearchStatus('Web search failed');
          // Only show server error for actual server issues, not network timeouts
          if (error?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
              (error?.message?.includes('Network Error') && !error?.message?.includes('timeout'))) {
            setServerError('Cannot connect to the server. Please check your connection or try again later.');
          }
        }
      }

      const response = await AICOREApiClient.AICOREChat(
        chatMessages,
        selectedModel,
        Array.isArray(files) ? files.map(f => f.id) : [],
        {
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty
        },
        systemPrompt,
        Array.isArray(selectedTools) ? selectedTools.filter(t => t && typeof t === 'object' && t.id).map(t => t.id) : []
      );

      // Debug logging to see what we're getting
      console.log('Chat response received:', response);
      console.log('Response type:', typeof response);
      console.log('Is response an array?', Array.isArray(response));

      // Add defensive checks for response structure
      if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response format from chat API');
      }

      const assistantMessage = {
        id: Date.now() + 2,
        role: 'assistant',
        content: response.choices[0].message?.content || 'No response content available',
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [
        ...(Array.isArray(messages) ? messages : []),
        userMessage,
        assistantMessage
      ];

      setMessages(updatedMessages);

      // Save or update the chat in the backend
      try {
        const chatTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '');
        
        if (!selectedChatId) {
          // Create new chat
          console.log('💾 Creating new chat with title:', chatTitle);
          const newChat = await AICOREApiClient.createAICOREChat(chatTitle, updatedMessages);
          console.log('💾 New chat creation response:', newChat);
          if (newChat && newChat.id) {
            // Only set the chat ID if saving was successful
            console.log('✅ New chat created with ID:', newChat.id);
            setSelectedChatId(newChat.id);
            setUnsavedChat(false); // Clear unsaved state on successful save
            // Refresh chat list
            try {
              console.log('🔄 Refreshing chat list after creating new chat...');
              const chatsResponse = await AICOREApiClient.fetchAICOREChats();
              console.log('📝 Refreshed chat list response:', chatsResponse);
              if (chatsResponse && Array.isArray(chatsResponse.data)) {
                console.log(`✅ Updated chat list with ${chatsResponse.data.length} chats`);
                setChats(chatsResponse.data);
              } else if (chatsResponse && Array.isArray(chatsResponse)) {
                console.log(`✅ Updated chat list with ${chatsResponse.length} chats (direct array)`);
                setChats(chatsResponse);
              } else {
                console.log('❌ Invalid chat list response format:', chatsResponse);
              }
            } catch (listError) {
              console.warn('❌ Failed to refresh chat list:', listError);
              // Don't fail if we can't refresh the list
            }
          } else {
            console.warn('Failed to create chat - no ID returned:', newChat);
            setUnsavedChat(true);
          }
        } else {
          // Update existing chat
          console.log('💾 Updating existing chat:', selectedChatId, 'with title:', chatTitle);
          const updateResult = await AICOREApiClient.updateAICOREChat(selectedChatId, chatTitle, updatedMessages);
          console.log('💾 Chat update result:', updateResult);
          setUnsavedChat(false); // Clear unsaved state on successful update
        }
      } catch (chatSaveError) {
        console.error('Failed to save chat:', chatSaveError);
        // If it's an auth error, show a warning but don't fail the conversation
        if (chatSaveError?.response?.status === 401 || chatSaveError?.response?.status === 403) {
          console.warn('Authentication error saving chat - conversation will continue in memory only');
          setUnsavedChat(true);
          setError('Warning: Chat not saved - please check your authentication');
        } else {
          console.error('Chat save error:', chatSaveError?.response?.status, chatSaveError?.message);
          setUnsavedChat(true);
          setError(`Warning: Failed to save chat: ${chatSaveError?.message || 'Unknown error'}`);
        }
        // Don't fail the whole operation if chat saving fails - keep the conversation going
      }

      setWebSearchStatus(null);
      setServerError(null);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 2,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, errorMessage];
      });
      setWebSearchStatus(null);
      // Only show server error for actual server issues, not network timeouts
      if (error?.message === 'GNOSISGPT_SERVER_UNAVAILABLE' || 
          (error?.message?.includes('Network Error') && !error?.message?.includes('timeout'))) {
        setServerError('Cannot connect to the server. Please check your connection or try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = (chatId) => {
    console.log('🎯 User selected chat:', chatId);
    console.log('📊 Current selectedChatId:', selectedChatId);
    console.log('📝 Current messages count:', messages?.length || 0);
    
    // If it's the same chat, don't reload
    if (selectedChatId === chatId) {
      console.log('⏩ Same chat selected, skipping reload');
      return;
    }
    
    // Clear current state first to ensure a clean transition
    setMessages([]);
    setLoading(true);
    setError(null); // Clear any existing errors
    
    // Then set the new chat ID (this will trigger the useEffect to load messages)
    setSelectedChatId(chatId);
  };

  const handleNewChat = () => {
    console.log('🆕 Starting new chat - clearing all state');
    console.log('📊 Before clearing - selectedChatId:', selectedChatId, 'messages:', messages?.length || 0);
    setSelectedChatId(null);
    setMessages([]);
    setFiles([]);
    setFileIds([]);
    setSelectedKnowledgeBases([]);
    setSelectedTools([]);
    setUnsavedChat(false);
    setShareId(null);
    setShareError(null);
    setShareSuccess(null);
    setError(null); // Clear any existing errors
    console.log('✅ New chat state cleared');
  };

  const handleCopyLink = () => {
    if (shareId) {
      const url = `${window.location.origin}/chat?share=${shareId}`;
      navigator.clipboard.writeText(url);
      setShowCopySnackbar(true);
    }
    setMoreMenuAnchor(null); // Close the menu after copying
  };

  const handleShare = async () => {
    setShareError(null);
    setShareSuccess(null);
    try {
      const res = await AICOREApiClient.shareAICOREChat(selectedChatId);
      if (res && res.share_id) {
        setShareId(res.share_id);
        setShareSuccess('Chat is now shareable!');
      }
    } catch (err) {
      setShareError('Failed to share chat.');
    }
    setMoreMenuAnchor(null); // Close the menu
  };

  const handleUnshare = async () => {
    setShareError(null);
    setShareSuccess(null);
    try {
      await AICOREApiClient.unshareAICOREChat(selectedChatId);
      setShareId(null);
      setShareSuccess('Chat is no longer shared.');
    } catch (err) {
      setShareError('Failed to unshare chat.');
    }
    setMoreMenuAnchor(null); // Close the menu
  };

  const handleDeleteChat = async () => {
    setDeleteError(null);
    try {
      await AICOREApiClient.deleteAICOREChat(selectedChatId);
      setDeleteDialogOpen(false);
      // Remove deleted chat from history and select next available chat
      setChats((prev) => Array.isArray(prev) ? prev.filter((c) => (c.id || c) !== selectedChatId) : []);
      setSelectedChatId((prev) => {
        if (!Array.isArray(chats)) return null;
        const idx = chats.findIndex((c) => (c.id || c) === prev);
        if (idx > 0) return chats[idx - 1].id || chats[idx - 1];
        if (chats.length > 1) return chats[1].id || chats[1];
        return null;
      });
      setMessages([]);
    } catch (err) {
      setDeleteError('Failed to delete chat.');
    }
    setMoreMenuAnchor(null); // Close the menu
  };

  const handleExportChat = async () => {
    setExportError(null);
    try {
      const res = await AICOREApiClient.exportAICOREChat(selectedChatId);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', dataStr);
      downloadAnchorNode.setAttribute('download', `chat-${selectedChatId}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      setExportError('Failed to export chat.');
    }
    setMoreMenuAnchor(null); // Close the menu
  };

  const handleImageGeneration = async (images) => {
    if (images && Array.isArray(images) && images.length > 0) {
      // Add generated images to files
      const imageFiles = images.map((image, index) => ({
        id: `generated-image-${Date.now()}-${index}`,
        name: `Generated Image ${index + 1}`,
        url: image.url,
        type: 'image',
        size: 0,
        status: 'uploaded'
      }));

      setFiles(prev => [...prev, ...imageFiles]);
      setImageGenerationStatus('Images generated successfully');
      
      // Add a system message about the generated images
      const systemMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `I've generated ${images.length} image(s) based on your request. The images have been added to the chat and can be used in our conversation.`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, systemMessage];
      });
    }
  };

  const handleImageGenerationError = (error) => {
    setImageGenerationStatus('Image generation failed');
    console.error('Image generation error:', error);
  };

  // Add atmospheric effect for login screen and waitlist
  useEffect(() => {
    // Only run the atmospheric effect when not authenticated or not authorized, and canvas exists
    if ((isAuthenticated && isAuthorized) || !loginCanvasRef.current) return;

    const canvas = loginCanvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrame;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mystical Particle constructor
    class MysticalParticle {
      constructor() {
        this.reset();
      }
    
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        // Varied size for depth
        this.size = Math.random() * 4 + 1;
        
        // Subtle opacity for mystical effect
        this.opacity = Math.random() * 0.3 + 0.1;
        this.maxOpacity = this.opacity;
        
        // Gentle floating movement
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.3 - 0.15;
        
        // Pulsing effect
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseOffset = Math.random() * Math.PI * 2;
        
        // Color variation for depth
        this.hue = Math.random() * 60 + 270; // Purple to magenta range
      }
    
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Pulse effect
        this.opacity = this.maxOpacity * (0.7 + 0.3 * Math.sin(Date.now() * this.pulseSpeed + this.pulseOffset));
        
        // Wrap around edges
        if (this.x < -50) this.x = canvas.width + 50;
        if (this.x > canvas.width + 50) this.x = -50;
        if (this.y < -50) this.y = canvas.height + 50;
        if (this.y > canvas.height + 50) this.y = -50;
      }

      draw(ctx) {
        // Create mystical purple gradient
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
        
        // Purple/magenta mystical glow
        gradient.addColorStop(0, `hsla(${this.hue}, 80%, 80%, ${this.opacity * 0.8})`); // Bright core
        gradient.addColorStop(0.3, `hsla(${this.hue}, 70%, 60%, ${this.opacity * 0.6})`); // Mid glow
        gradient.addColorStop(0.7, `hsla(${this.hue}, 60%, 40%, ${this.opacity * 0.3})`); // Outer glow
        gradient.addColorStop(1, `hsla(${this.hue}, 50%, 20%, 0)`); // Fade to transparent
      
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Floating Orb constructor for larger mystical elements
    class FloatingOrb {
      constructor() {
        this.reset();
      }
    
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        // Larger size for orbs
        this.size = Math.random() * 8 + 4;
        
        // Very subtle opacity
        this.opacity = Math.random() * 0.15 + 0.05;
        this.maxOpacity = this.opacity;
        
        // Very slow movement
        this.speedX = Math.random() * 0.2 - 0.1;
        this.speedY = Math.random() * 0.2 - 0.1;
        
        // Slow pulsing
        this.pulseSpeed = Math.random() * 0.01 + 0.005;
        this.pulseOffset = Math.random() * Math.PI * 2;
      }
    
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Gentle pulse
        this.opacity = this.maxOpacity * (0.5 + 0.5 * Math.sin(Date.now() * this.pulseSpeed + this.pulseOffset));
        
        // Wrap around edges
        if (this.x < -100) this.x = canvas.width + 100;
        if (this.x > canvas.width + 100) this.x = -100;
        if (this.y < -100) this.y = canvas.height + 100;
        if (this.y > canvas.height + 100) this.y = -100;
      }

      draw(ctx) {
        // Create large mystical gradient
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
        
        // Purple mystical orb
        gradient.addColorStop(0, `rgba(139, 92, 246, ${this.opacity * 0.6})`); // Purple core
        gradient.addColorStop(0.2, `rgba(167, 139, 250, ${this.opacity * 0.4})`); // Light purple
        gradient.addColorStop(0.5, `rgba(139, 92, 246, ${this.opacity * 0.2})`); // Mid purple
        gradient.addColorStop(0.8, `rgba(124, 58, 237, ${this.opacity * 0.1})`); // Deep purple
        gradient.addColorStop(1, `rgba(109, 40, 217, 0)`); // Fade to transparent
      
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
   
    // Mobile optimization - fewer particles on smaller screens
    const particleCount = window.innerWidth < 500 ? 15 : 25;
    const orbCount = window.innerWidth < 500 ? 3 : 5;
    
    // Populate mystical particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new MysticalParticle());
    }
    
    // Populate floating orbs
    for (let i = 0; i < orbCount; i++) {
      particles.push(new FloatingOrb());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw all particles
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });
      
      animationFrame = requestAnimationFrame(animate);
    };

    animate();
    
         return () => {
       cancelAnimationFrame(animationFrame);
       window.removeEventListener('resize', resizeCanvas);
     };
   }, [isAuthenticated, isAuthorized]); // Re-run when authentication or authorization state changes

  if (isSharedView) {
    if (sharedChatLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      );
    }
    if (sharedChatError) {
      return (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="h4" color="error" gutterBottom>
            {sharedChatError}
          </Typography>
        </Box>
      );
    }
    return (
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={3} />
        <Grid item xs={12} md={9}>
          <Typography variant="h3" gutterBottom>
            Shared Chat (Read-Only)
          </Typography>
          {console.log('Shared chat - messages:', messages, 'Type:', typeof messages, 'Is array:', Array.isArray(messages))}
          <ChatMessages messages={messages} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This is a read-only shared chat. To start your own chat, <Link href="/chat">go to chat</Link>.
          </Typography>
        </Grid>
      </Grid>
    );
  }

  // Show loading spinner while auth state is being determined
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
             <Box sx={{ 
         position: 'fixed',
         top: 0,
         left: 0,
         right: 0,
         bottom: 0,
         display: 'flex', 
         flexDirection: 'column', 
         alignItems: 'center', 
         justifyContent: 'center',
         minHeight: '100vh',
         width: '100vw',
         bgcolor: '#0a0a0a',
         background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)',
         padding: '16px',
         overflow: 'hidden',
         zIndex: 9999
       }}>
       {/* Mystical Particle Canvas */}
       <canvas
         ref={loginCanvasRef}
         style={{
           position: 'absolute',
           top: 0,
           left: 0,
           width: '100%',
           height: '100%',
           zIndex: 1,
           pointerEvents: 'none',
           opacity: 0.6
         }}
       />
       
       <Paper sx={{
           maxWidth: 400,
           width: '100%',
           p: 4,
           bgcolor: '#1a1a1a',
           border: '1px solid #333',
           borderRadius: 3,
           boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
           textAlign: 'center',
           position: 'relative',
           zIndex: 2,
           backdropFilter: 'blur(1px)'
         }}>
         {/* Logo/Brand Section */}
           <Box sx={{ mb: 3 }}>
                         <Box sx={{ 
               display: 'flex', 
               justifyContent: 'center', 
               alignItems: 'center',
               mb: 2 
             }}>
               <Image 
                 src="/GnosisGPT.png" 
                 alt="GnosisGPT Logo" 
                 width={200} 
                 height={80} 
                 style={{ 
                   maxWidth: '100%', 
                   height: 'auto',
                   filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))',
                   animation: 'logoGlow 3s ease-in-out infinite'
                 }}
                 priority
               />
             </Box>
             
             <style jsx>{`
               @keyframes logoGlow {
                 0%, 100% {
                   filter: drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3)) drop-shadow(0 0 10px rgba(139, 92, 246, 0.2));
                 }
                 50% {
                   filter: drop-shadow(0 4px 12px rgba(139, 92, 246, 0.5)) drop-shadow(0 0 20px rgba(139, 92, 246, 0.4));
                 }
               }
             `}</style>
                         <Typography 
               variant="h6" 
               sx={{ 
                 color: '#a78bfa',
                 fontWeight: 400,
                 opacity: 0.9
               }}
             >
               Please log in or register to continue
             </Typography>
          </Box>

                                {/* Login Button */}
            <Button
              variant="contained"
              size="large"
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '1.1rem',
                textTransform: 'none',
                py: 1.5,
                px: 4,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4), 0 0 10px rgba(139, 92, 246, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                '&:before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transition: 'left 0.6s ease-in-out'
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  boxShadow: '0 6px 30px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
                  transform: 'translateY(-2px) scale(1.02)',
                  '&:before': {
                    left: '100%'
                  }
                },
                '&:active': {
                  transform: 'translateY(-1px) scale(1.01)'
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onClick={handleLogin}
            >
              Sign In
            </Button>
        </Paper>
      </Box>
    );
  }

  if (!isAuthorized) {
    return (
             <Box sx={{ 
         position: 'fixed',
         top: 0,
         left: 0,
         right: 0,
         bottom: 0,
         display: 'flex', 
         flexDirection: 'column', 
         alignItems: 'center', 
         justifyContent: 'center',
         minHeight: '100vh',
         width: '100vw',
         bgcolor: '#0a0a0a',
         background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)',
         padding: '16px',
         overflow: 'hidden',
         zIndex: 9999
       }}>
       {/* Mystical Particle Canvas */}
       <canvas
         ref={loginCanvasRef}
         style={{
           position: 'absolute',
           top: 0,
           left: 0,
           width: '100%',
           height: '100%',
           zIndex: 1,
           pointerEvents: 'none',
           opacity: 0.6
         }}
       />
       
       <Paper sx={{
           maxWidth: 500,
           width: '100%',
           p: 4,
           bgcolor: '#1a1a1a',
           border: '1px solid #333',
           borderRadius: 3,
           boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
           textAlign: 'center',
           position: 'relative',
           zIndex: 2,
           backdropFilter: 'blur(1px)'
         }}>
         {/* Logo/Brand Section */}
           <Box sx={{ mb: 3 }}>
                         <Box sx={{ 
               display: 'flex', 
               justifyContent: 'center', 
               alignItems: 'center',
               mb: 2 
             }}>
               <Image 
                 src="/GnosisGPT.png" 
                 alt="GnosisGPT Logo" 
                 width={200} 
                 height={80} 
                 style={{ 
                   maxWidth: '100%', 
                   height: 'auto',
                   filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))',
                   animation: 'logoGlow 3s ease-in-out infinite'
                 }}
                 priority
               />
             </Box>
             
             <style jsx>{`
               @keyframes logoGlow {
                 0%, 100% {
                   filter: drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3)) drop-shadow(0 0 10px rgba(139, 92, 246, 0.2));
                 }
                 50% {
                   filter: drop-shadow(0 4px 12px rgba(139, 92, 246, 0.5)) drop-shadow(0 0 20px rgba(139, 92, 246, 0.4));
                 }
               }
             `}</style>
                         <Typography 
               variant="h5" 
               sx={{ 
                 color: 'white',
                 fontWeight: 600,
                 mb: 2,
                 lineHeight: 1.3
               }}
             >
               Thank you for registering!
             </Typography>
             <Typography 
               variant="body1" 
               sx={{ 
                 color: '#a78bfa',
                 fontWeight: 400,
                 opacity: 0.9,
                 lineHeight: 1.5
               }}
             >
               You have been added to the GnosisGPT waitlist.<br/>
               We'll notify you when access is available.
             </Typography>
          </Box>

                                {/* Logout Button */}
            <Button
              variant="contained"
              size="large"
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '1.1rem',
                textTransform: 'none',
                py: 1.5,
                px: 4,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4), 0 0 10px rgba(139, 92, 246, 0.2)',
                position: 'relative',
                overflow: 'hidden',
                '&:before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transition: 'left 0.6s ease-in-out'
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  boxShadow: '0 6px 30px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
                  transform: 'translateY(-2px) scale(1.02)',
                  '&:before': {
                    left: '100%'
                  }
                },
                '&:active': {
                  transform: 'translateY(-1px) scale(1.01)'
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onClick={handleLogout}
            >
              Sign Out
            </Button>
        </Paper>
      </Box>
    );
  }

  if (serverError) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h4" color="error" gutterBottom>
          {serverError}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'fixed',
      top: 64, // Height of the AppBar 
      left: 0,
      right: 0,
      bottom: 0,
      height: 'calc(100vh - 64px)', 
      width: '100vw', 
      bgcolor: '#111111', 
      color: 'white',
      display: 'flex',
      overflow: 'hidden',
      zIndex: 1300, // Higher z-index to ensure it's above any parent containers
      margin: 0, // Reset any inherited margins
      padding: 0 // Reset any inherited padding
    }} id="main-content" ref={mainContentRef} tabIndex={-1}>
      <a href="#main-content" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden', zIndex: 9999 }} onFocus={e => { e.target.style.left = 0; e.target.style.width = 'auto'; e.target.style.height = 'auto'; }}>Skip to main content</a>
      
      {/* Left Sidebar - Chat History */}
      <Box sx={{ 
        width: '260px', 
        height: 'calc(100vh - 64px)',
        bgcolor: '#1a1a1a', 
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
           display: 'flex', 
           justifyContent: 'space-between', 
           alignItems: 'center', 
           padding: '42px 16px 30px',
           paddingTop: '42px',
           paddingRight: '16px',
           paddingBottom: '30px',
           paddingLeft: '16px',
           borderBottom: '1px solid #333',
           bgcolor: '#1a1a1a',
           height: '64px',
           boxSizing: 'border-box'
         }}>
          <Typography variant="h6" sx={{ 
            color: 'white', 
            fontWeight: 600,
            margin: '0px 0px 10px',
            marginTop: '0px',
            marginRight: '0px', 
            marginBottom: '10px',
            marginLeft: '0px'
          }}>
            Chat History
          </Typography>
          <Button
            onClick={handleNewChat}
            variant="outlined"
            size="small"
            sx={{
              borderColor: '#8b5cf6',
              color: '#8b5cf6',
              '&:hover': {
                borderColor: '#a78bfa',
                bgcolor: 'rgba(139, 92, 246, 0.1)'
              },
              minWidth: 'auto',
              px: 1.5,
              py: 0.5,
              fontSize: '0.75rem'
            }}
          >
            New
          </Button>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress size={24} sx={{ color: '#666' }} />
            </Box>
          ) : (
            <ChatHistory chats={chats} selectedChatId={selectedChatId} onSelect={handleSelectChat} />
          )}
        </Box>
      </Box>
      
      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        height: 'calc(100vh - 64px)',
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#111111',
        overflow: 'hidden'
      }}>
      {/* Header with Title and Controls */}
         <Box sx={{ 
           display: 'flex', 
           justifyContent: 'space-between', 
           alignItems: 'center', 
           p: 2,
           borderBottom: '1px solid #333',
           bgcolor: '#1a1a1a',
           minHeight: '64px',
           boxSizing: 'border-box'
         }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'white' }}>
              MindGarden Chat
            </Typography>
            {unsavedChat && (
              <Chip 
                label="Unsaved" 
                size="small" 
                sx={{ 
                  bgcolor: '#f59e0b', 
                  color: 'white',
                  fontSize: '0.7rem',
                  height: '20px'
                }} 
              />
            )}
          </Box>
          
          {/* Primary Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Settings Toggle */}
            <IconButton 
              onClick={() => setShowSettings(!showSettings)}
              sx={{ 
                color: showSettings ? '#8b5cf6' : '#888',
                '&:hover': { bgcolor: '#333' }
              }}
              aria-label="Toggle settings"
            >
              <SettingsIcon />
            </IconButton>
            
            {/* Web Search Toggle */}
            <Box sx={{ 
              bgcolor: webSearchEnabled ? '#1f2937' : 'transparent',
              borderRadius: 1,
              border: webSearchEnabled ? '1px solid #8b5cf6' : '1px solid #444'
            }}>
              <WebSearchToggle
                enabled={webSearchEnabled}
                onToggle={setWebSearchEnabled}
                disabled={loading}
              />
            </Box>
            
            {/* Generate Image Button */}
            <IconButton
              onClick={() => setShowImageModal(true)}
              disabled={loading}
              sx={{ 
                color: '#888',
                '&:hover': { bgcolor: '#333', color: 'white' }
              }}
              aria-label="Generate image"
            >
              <ImageIcon />
            </IconButton>
            
            {/* More Actions Menu */}
            <IconButton
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              disabled={!selectedChatId}
              sx={{ 
                color: '#888',
                '&:hover': { bgcolor: '#333', color: 'white' }
              }}
              aria-label="More actions"
            >
              <MoreVertIcon />
            </IconButton>
            
            {/* More Actions Dropdown */}
            <Menu
              anchorEl={moreMenuAnchor}
              open={Boolean(moreMenuAnchor)}
              onClose={() => setMoreMenuAnchor(null)}
              PaperProps={{
                sx: {
                  bgcolor: '#1a1a1a',
                  border: '1px solid #333',
                  '& .MuiMenuItem-root': {
                    color: 'white',
                    '&:hover': { bgcolor: '#333' }
                  }
                }
              }}
            >
              <MenuItem onClick={handleExportChat} disabled={!selectedChatId}>
                <DownloadIcon sx={{ mr: 1 }} />
                Export Chat
              </MenuItem>
              <MenuItem onClick={() => setDeleteDialogOpen(true)} disabled={!selectedChatId}>
                <DeleteIcon sx={{ mr: 1 }} />
                Delete Chat
              </MenuItem>
              <Divider sx={{ bgcolor: '#333' }} />
              {shareId ? (
                <MenuItem onClick={handleUnshare}>
                  Unshare Chat
                </MenuItem>
              ) : (
                <MenuItem onClick={handleShare}>
                  Share Chat
                </MenuItem>
              )}
              {shareId && (
                <MenuItem onClick={handleCopyLink}>
                  <ContentCopyIcon sx={{ mr: 1 }} />
                  Copy Share Link
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>

        {/* Collapsible Settings Panel */}
        <Collapse in={showSettings}>
          <Paper sx={{ 
            m: 2, 
            p: 3, 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            color: 'white'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                Chat Settings
              </Typography>
              <IconButton 
                onClick={() => setShowSettings(false)}
                size="small"
                sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
                aria-label="Close settings"
              >
                <ExpandLessIcon />
              </IconButton>
            </Box>
            
            {/* Model Selection and Parameters */}
            <Box sx={{ 
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: '#444' },
                '&:hover fieldset': { borderColor: '#666' },
                '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
              },
              '& .MuiInputLabel-root': { color: '#888' },
              '& .MuiSlider-root': { color: '#8b5cf6' },
              '& .MuiTypography-root': { color: 'white' }
            }}>
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onChange={setSelectedModel}
                temperature={temperature}
                onTemperatureChange={setTemperature}
                systemPrompt={systemPrompt}
                onSystemPromptChange={setSystemPrompt}
                topP={topP}
                onTopPChange={setTopP}
                maxTokens={maxTokens}
                onMaxTokensChange={setMaxTokens}
                frequencyPenalty={frequencyPenalty}
                onFrequencyPenaltyChange={setFrequencyPenalty}
                presencePenalty={presencePenalty}
                onPresencePenaltyChange={setPresencePenalty}
              />
            </Box>
            
            <Divider sx={{ my: 2, bgcolor: '#333' }} />
            
            {/* File Upload */}
            <ChatFileUpload onUpload={handleFileUpload} disabled={loading} />
            
            {/* Uploaded Files Display */}
            {Array.isArray(files) && files.length > 0 && (
              <Box sx={{ mt: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ mr: 1, fontWeight: 500, color: '#888' }}>Files:</Typography>
                {files.map((file, idx) => (
                  <Chip 
                    key={idx} 
                    label={file.name} 
                    size="small" 
                    variant="outlined" 
                    sx={{ 
                      color: 'white', 
                      borderColor: '#444',
                      '& .MuiChip-label': { color: 'white' }
                    }} 
                  />
                ))}
              </Box>
            )}
            
            {fileUploadLoading && (
              <Typography color="#8b5cf6" sx={{ mt: 1, fontSize: '0.875rem' }}>Uploading file(s)...</Typography>
            )}
            {fileUploadError && (
              <Typography color="#ef4444" sx={{ mt: 1, fontSize: '0.875rem' }}>{fileUploadError}</Typography>
            )}
            
            <Divider sx={{ my: 2, bgcolor: '#333' }} />
            
            {/* Knowledge Bases and Tools */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 300 }}>
                <Autocomplete
                  multiple
                  options={Array.isArray(knowledgeBases) ? knowledgeBases : []}
                  getOptionLabel={kb => kb.name || kb.id}
                  value={selectedKnowledgeBases}
                  onChange={(_, value) => setSelectedKnowledgeBases(value)}
                  renderInput={params => (
                    <TextField {...params} label="Knowledge Bases (RAG)" placeholder="Select knowledge bases" size="small" />
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disableCloseOnSelect
                  sx={{
                    '& .MuiAutocomplete-tag': { 
                      bgcolor: '#333', 
                      color: 'white',
                      '& .MuiSvgIcon-root': { color: '#888' }
                    },
                    '& .MuiAutocomplete-popupIndicator': { color: '#888' }
                  }}
                />
                {knowledgeError && <Typography color="#ef4444" sx={{ mt: 1, fontSize: '0.75rem' }}>{knowledgeError}</Typography>}
              </Box>

              <Box sx={{ flex: 1, minWidth: 300 }}>
                <Autocomplete
                  multiple
                  options={Array.isArray(tools) ? tools : []}
                  getOptionLabel={tool => {
                    if (!tool || typeof tool !== 'object') return 'Unknown Tool';
                    return tool.name || tool.id || 'Unknown Tool';
                  }}
                  value={selectedTools}
                  onChange={(_, value) => {
                    if (Array.isArray(value)) {
                      const validTools = value.filter(tool => tool && typeof tool === 'object' && tool.id);
                      setSelectedTools(validTools);
                    } else {
                      setSelectedTools([]);
                    }
                  }}
                  renderInput={params => (
                    <TextField {...params} label="Tools/Plugins" placeholder="Select tools/plugins" size="small" />
                  )}
                  isOptionEqualToValue={(option, value) => {
                    if (!option || !value || typeof option !== 'object' || typeof value !== 'object') return false;
                    return option.id === value.id;
                  }}
                  disableCloseOnSelect
                  sx={{
                    '& .MuiAutocomplete-tag': { 
                      bgcolor: '#333', 
                      color: 'white',
                      '& .MuiSvgIcon-root': { color: '#888' }
                    },
                    '& .MuiAutocomplete-popupIndicator': { color: '#888' }
                  }}
                />
                {toolsError && <Typography color="#ef4444" sx={{ mt: 1, fontSize: '0.75rem' }}>{toolsError}</Typography>}
              </Box>
            </Box>
          </Paper>
        </Collapse>

        {/* Status Messages */}
        {webSearchStatus && (
          <Box sx={{ mx: 2, mb: 1 }}>
            <Typography variant="body2" color="#8b5cf6" sx={{ fontStyle: 'italic' }}>
              {webSearchStatus}
            </Typography>
          </Box>
        )}
        
        {imageGenerationStatus && (
          <Box sx={{ mx: 2, mb: 1 }}>
            <Typography variant="body2" color="#8b5cf6" sx={{ fontStyle: 'italic' }}>
              {imageGenerationStatus}
            </Typography>
          </Box>
        )}

        {/* Main Chat Messages Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0 // Critical for flex layout to work properly
        }}>
          <Paper sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            bgcolor: '#111111',
            border: '1px solid #333',
            m: 2,
            minHeight: 0 // Critical for flex layout to work properly
          }}>
            <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#111111', minHeight: 0 }}>
              {console.log('Main chat - messages:', messages, 'Type:', typeof messages, 'Is array:', Array.isArray(messages))}
              <ChatMessages messages={messages} />
            </Box>
            
            {/* Loading Indicator */}
            {loading && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                p: 2, 
                borderTop: '1px solid #333',
                bgcolor: '#1a1a1a',
                flexShrink: 0 // Prevent this from shrinking
              }}>
                <CircularProgress size={20} sx={{ mr: 1, color: '#8b5cf6' }} />
                <Typography variant="body2" color="#888">Assistant is typing...</Typography>
              </Box>
            )}
            
            {/* Chat Input */}
            <Box sx={{ 
              borderTop: '1px solid #333', 
              p: 2,
              bgcolor: '#1a1a1a',
              flexShrink: 0 // Prevent this from shrinking
            }}>
              <ChatInput onSend={handleSendMessage} disabled={loading} />
            </Box>
          </Paper>
        </Box>

        {/* Error Messages */}
        {error && (
          <Box sx={{ mx: 2, mb: 1 }}>
            <Typography color="#ef4444" sx={{ fontSize: '0.875rem' }}>{error}</Typography>
          </Box>
        )}
        {serverError && (
          <Box sx={{ mx: 2, mb: 1 }}>
            <Typography color="#ef4444" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{serverError}</Typography>
          </Box>
        )}
      </Box>

      {/* Share Success Messages */}
      {shareSuccess && (
        <Snackbar
          open={Boolean(shareSuccess)}
          autoHideDuration={4000}
          onClose={() => setShareSuccess(null)}
          message={shareSuccess}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      )}
      
      <Snackbar
        open={showCopySnackbar}
        autoHideDuration={2000}
        onClose={() => setShowCopySnackbar(false)}
        message="Link copied!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Delete confirmation dialog */}
      {deleteDialogOpen && (
        <Box role="dialog" aria-modal="true" sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          bgcolor: 'rgba(0,0,0,0.8)', 
          zIndex: 2000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Box sx={{ 
            bgcolor: '#1a1a1a', 
            color: 'white',
            p: 4, 
            borderRadius: 2, 
            minWidth: 300, 
            boxShadow: 3,
            border: '1px solid #333'
          }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>Delete Chat</Typography>
            <Typography gutterBottom sx={{ color: '#888' }}>Are you sure you want to delete this chat? This action cannot be undone.</Typography>
            {deleteError && <Typography color="#ef4444" sx={{ mt: 1, fontSize: '0.875rem' }}>{deleteError}</Typography>}
            <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
              <Button 
                onClick={() => setDeleteDialogOpen(false)} 
                variant="outlined"
                sx={{ 
                  borderColor: '#444', 
                  color: 'white',
                  '&:hover': { borderColor: '#666', bgcolor: '#333' }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteChat} 
                variant="contained"
                sx={{ 
                  bgcolor: '#ef4444',
                  '&:hover': { bgcolor: '#dc2626' }
                }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      <ImageGenerationModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onGenerate={handleImageGeneration}
        disabled={loading}
      />
    </Box>
  );
};

export default ChatPage; 