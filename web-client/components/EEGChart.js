import React, { useEffect, useRef, useState, useContext } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-luxon';
import StreamingPlugin from 'chartjs-plugin-streaming';
import { Box, Typography, Paper, Chip, Grid, Card, CardContent, FormControl, Select, MenuItem, InputLabel, OutlinedInput, Slider, Switch, FormControlLabel, Button } from '@mui/material';
import AICOREApiClient from '../lib/ai-core-api';
import { AppContext } from '../contexts/AppContext';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import api from '../lib/api';

Chart.register(StreamingPlugin);

const EEGChart = ({ isAnalyzing, deviceId, deviceType, deviceModel, simulatorMode, socket, isConnected }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const flatTimerRef = useRef(null);
  const [hasData, setHasData] = useState(false);
  const [lastDataTimestamp, setLastDataTimestamp] = useState(null);
  const [channelsInfo, setChannelsInfo] = useState([]);
  const [sampleRate, setSampleRate] = useState(250);
  const [dataCount, setDataCount] = useState(0);
  const [filters, setFilters] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [gain, setGain] = useState(37.5); // ~75% of 0.5–50 range
  const [acCouple, setAcCouple] = useState(true); // subtract running baseline
  const baselineRef = useRef([]); // per-channel running baseline for AC coupling
  const [aiFilter, setAiFilter] = useState(false);
  const aiBusyRef = useRef(false);
  const [windowSeconds, setWindowSeconds] = useState(46); // ~75% of 2–60 range
  const { user } = useContext(AppContext);
  
     // Throttle chart updates to prevent rapid fire updates
   const lastUpdateTime = useRef(0);
   const UPDATE_THROTTLE_MS = 25; // Minimum 25ms between updates for smoother streaming

  // Define beautiful colors for different channels
  const channelColors = [
    '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
    '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#22c55e', '#eab308', '#f43f5e', '#0ea5e9'
  ];

  // Fetch user filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        console.log('🔍 Fetching user filters...');
        console.log('👤 Current user:', user);
        
        // Fetch transforms and adapt to filter shape expected by chart UI
        const response = await api.fetchTransforms();
        const raw = Array.isArray(response) ? response : (response?.transforms || response?.data || []);
        const filterData = (Array.isArray(raw) ? raw : []).map(t => ({
          id: t.id,
          name: t.name,
          filter_type: t.transform_type,
          parameters: t.parameters
        }));
        
        console.log('📋 Processed filter data:', filterData);
        console.log('📋 Filter data type:', typeof filterData);
        console.log('📋 Filter data is array:', Array.isArray(filterData));
        console.log('📋 Filter data length:', filterData?.length);
        
        if (Array.isArray(filterData) && filterData.length > 0) {
          setFilters(filterData);
          console.log('✅ Loaded', filterData.length, 'filters');
          
          // Debug: Log each filter
          filterData.forEach((filter, index) => {
            console.log(`📋 Filter ${index + 1}:`, {
              id: filter.id,
              name: filter.name,
              filter_type: filter.filter_type,
              has_parameters: !!filter.parameters
            });
          });
        } else if (Array.isArray(filterData)) {
          console.log('⚠️ Filter data is empty array');
          setFilters([]);
        } else {
          console.log('⚠️ Filter data is not an array:', filterData);
          setFilters([]);
        }
      } catch (error) {
        console.error('❌ Error fetching filters:', error);
        console.error('❌ Error details:', {
          message: error.message,
          response: error.response,
          status: error.response?.status,
          data: error.response?.data
        });
        setFilters([]);
      }
    };

    if (user) {
      console.log('👤 User found, fetching filters for user:', user);
      fetchFilters();
        } else {
      console.log('⚠️ No user found, skipping filter fetch');
      setFilters([]);
    }
  }, [user]);

  // Update chart title when filters change
  useEffect(() => {
    if (chartInstanceRef.current) {
      const filterNames = (selectedFilters || []).map(filterId => 
        filters.find(f => f.id === filterId)?.name
      ).filter(Boolean);
      
      const title = filterNames.length > 0 
        ? `Time (Filtered: ${filterNames.join(' + ')})` 
        : 'Time';
      
      chartInstanceRef.current.options.scales.x.title.text = title;
      chartInstanceRef.current.update('none');
      console.log('📊 Updated chart title:', title);
    }
  }, [selectedFilters, filters]);

  // Apply multiple filters to EEG data
  const applyFilters = async (eegData, filterScripts) => {
    try {
      setIsFiltering(true);
      console.log('🔧 Applying', filterScripts.length, 'filter scripts...');
      
      let processedData = { ...eegData };
      
      // Apply each filter in sequence
      for (let i = 0; i < filterScripts.length; i++) {
        const filterScript = filterScripts[i];
        console.log(`🔧 Applying filter ${i + 1}/${filterScripts.length}...`);
        
        try {
          // Create a JavaScript function to filter the data
          // The script should define a function that takes (data, channels, sampleRate)
          const filterFunction = new Function('data', 'channels', 'sampleRate', `
            // Clean script execution environment
            'use strict';
            
            ${filterScript}
            
            // If the script doesn't return anything, assume it defines apply_bandpass_filter or similar
            if (typeof apply_bandpass_filter !== 'undefined') {
              return apply_bandpass_filter(data, channels, sampleRate);
            }
            if (typeof applyFilter !== 'undefined') {
              return applyFilter(data, channels, sampleRate);
            }
            // Otherwise return original data
            return data;
          `);
          
          // Execute the filter directly with real-time data
          // New filters can handle both real-time (single values) and batch (arrays) data
          console.log(`🔧 Executing filter with ${processedData.data.length} channel values`);
          
          const filteredData = filterFunction(
            processedData.data, 
            processedData.channels, 
            processedData.sample_rate || 250
          );
          
          // Update the processed data for the next filter
          if (Array.isArray(filteredData) && filteredData.length === processedData.data.length) {
            processedData = {
              ...processedData,
              data: filteredData
            };
            console.log('✅ Filter applied successfully');
          } else {
            console.log('⚠️ Filter returned invalid data structure, keeping original data');
            console.log('❌ Expected array of length', processedData.data.length, 'got:', filteredData);
          }
          
        } catch (error) {
          console.error('❌ Error in filter script:', error);
          console.error('❌ Filter script content:', filterScript.substring(0, 200) + '...');
          // Continue with original data if filter fails
        }
      }
      
      console.log('✅ All filters processed');
      return {
        ...processedData,
        filtered: true
      };
    } catch (error) {
      console.error('❌ Error applying filters:', error);
      return eegData; // Return original data if filters fail
    } finally {
      setIsFiltering(false);
    }
  };

  useEffect(() => {
    if (socket && isAnalyzing) {
      console.log('🎧 Setting up EEG data listeners...');

      const handleEEGData = async (data) => {
        console.log('📊 EEGChart received data:', data);
        
        // Enhanced debugging for raw data values
        if (data && data.data && Array.isArray(data.data)) {
          const sampleValues = data.data.slice(0, 3).map(val => parseFloat(val) || 0);
          const dataRange = {
            min: Math.min(...data.data.map(val => parseFloat(val) || 0)),
            max: Math.max(...data.data.map(val => parseFloat(val) || 0)),
            avg: data.data.reduce((sum, val) => sum + (parseFloat(val) || 0), 0) / data.data.length
          };
          console.log(`📊 Raw data sample [0-2]: [${sampleValues.join(', ')}]`);
          console.log(`📊 Data range - Min: ${dataRange.min.toFixed(1)}, Max: ${dataRange.max.toFixed(1)}, Avg: ${dataRange.avg.toFixed(1)}`);
          console.log(`📊 Data variation: ${(dataRange.max - dataRange.min).toFixed(1)}`);
        }
        
        // Check if we have selected filters to apply
        if (selectedFilters && selectedFilters.length > 0) {
          const selectedFilterScripts = selectedFilters
            .map(filterId => filters.find(f => f.id === filterId)?.parameters)
            .filter(Boolean);
          
          if (selectedFilterScripts.length > 0) {
            console.log('🔧 Applying', selectedFilterScripts.length, 'filters to data...');
            data = await applyFilters(data, selectedFilterScripts);
          }
        }
        
        // Ensure we have valid data structure
        if (!data || !data.data || !Array.isArray(data.data)) {
          console.log('⚠️ Invalid data structure received');
          return;
        }

        // Optional AI filter: non-blocking best-effort. If offline, ignore errors.
        if (aiFilter && !aiBusyRef.current) {
          aiBusyRef.current = true;
          try {
            const input = { device_id: data.device_id, sample_rate: data.sample_rate || 250, channels: data.channels || [], data: data.data };
            // Use a simple chat completion style prompt to normalize values; server determines model.
            const messages = [
              { role: 'system', content: 'You are an EEG denoising assistant. Return JSON {"data":[...]} with denoised microvolt values, same length and order.' },
              { role: 'user', content: JSON.stringify(input).slice(0, 4000) }
            ];
            AICOREApiClient.AICOREChat(messages, 'llama3').then(resp => {
              try {
                const text = (resp?.choices?.[0]?.message?.content || '').trim();
                const m = text.match(/\{[\s\S]*\}/);
                if (m) {
                  const parsed = JSON.parse(m[0]);
                  if (Array.isArray(parsed.data) && parsed.data.length === data.data.length) {
                    data = { ...data, data: parsed.data };
                  }
                }
              } catch {}
            }).finally(() => { aiBusyRef.current = false; });
          } catch { aiBusyRef.current = false; }
        }
        
        // Ensure chart is visible when real data arrives
        setHasData(true);
        // Populate channels if not provided
        if ((!data.channels || data.channels.length === 0) && Array.isArray(data.data)) {
          const inferred = Array.from({ length: data.data.length }, (_, i) => `CH${i + 1}`);
          data = { ...data, channels: inferred };
        }
        // Initialize chart on first data if needed
        if (!chartInstanceRef.current && chartRef.current) {
          console.log('📊 Initializing chart on first data packet');
          initChart();
        }

        console.log(`📊 Processing ${data.data.length} channels:`, data.data.slice(0, 5));
        
        // Update chart with processed data
        updateChart(data);
      };

      const handleStreamingStarted = (data) => {
        console.log('🚀 Streaming started:', data);
        setHasData(true);
        // Prefer channels from event, else infer by model across supported types
        let ch = data.channels;
        if (!Array.isArray(ch) || ch.length === 0) {
          const model = (deviceModel || '').toLowerCase();
          if (model === 'pieeg_8') {
            ch = ['CH1','CH2','CH3','CH4','CH5','CH6','CH7','CH8'];
          } else if (model === 'pieeg_16') {
            ch = Array.from({length: 16}, (_, i) => `CH${i+1}`);
          } else if (model === 'emotiv_epoc_x') {
            ch = ['AF3','F7','F3','FC5','T7','P7','O1','O2','P8','T8','FC6','F4','F8','AF4'];
          } else if (model === 'idun_guardian') {
            ch = ['EEG'];
          } else {
            ch = [];
          }
        }
        setChannelsInfo(ch);
        // Respect model-specific default sample rates if not provided
        const defaultSr = (() => {
          const model = (deviceModel || '').toLowerCase();
          if (model === 'emotiv_epoc_x') return 128;
          return 250;
        })();
        setSampleRate(data.sample_rate || defaultSr);
        // Reinitialize chart with the correct number of channels
        if (chartRef.current) {
          initChart(ch.length > 0 ? ch.length : 8);
        }
        try {
          if (chartInstanceRef.current && ch.length > 0) {
            const chart = chartInstanceRef.current;
            const timeMs = Date.now();
            for (let i = 0; i < ch.length; i++) {
              const dataset = chart.data.datasets[i];
              if (!dataset) continue;
              const channelOffset = i * 800;
              dataset.data.push({ x: timeMs, y: channelOffset });
              dataset.label = ch[i];
              dataset.hidden = false;
            }
            chart.options.scales.x.min = timeMs - Math.max(2, windowSeconds) * 1000;
            chart.options.scales.x.max = timeMs;
            chart.update('none');
          }
        } catch {}
      };

      const handleStreamingStopped = (data) => {
        console.log('⏹️ Streaming stopped:', data);
        setHasData(false);
      };

      // Set up event listeners
      socket.on('eeg_data', handleEEGData);
      socket.on('streaming_started', handleStreamingStarted);
      socket.on('streaming_stopped', handleStreamingStopped);

      // Cleanup function
    return () => {
        socket.off('eeg_data', handleEEGData);
        socket.off('streaming_started', handleStreamingStarted);
        socket.off('streaming_stopped', handleStreamingStopped);
      };
    }
  }, [socket, isAnalyzing, selectedFilters, filters]);

  const initChart = (channelsCountParam) => {
    // Destroy existing chart if it exists
      if (chartInstanceRef.current) {
      console.log('🧹 Destroying existing chart before reinitializing');
      try {
        chartInstanceRef.current.destroy();
      } catch (error) {
        console.error('Error destroying existing chart:', error);
      }
        chartInstanceRef.current = null;
      }

    if (!chartRef.current) {
      console.log('⚠️ Chart ref not available');
      return;
    }

    console.log('📊 Initializing EEG chart...');

    const ctx = chartRef.current.getContext('2d');
    
    // Create datasets for each channel (up to 16 channels)
    const datasets = [];
    const channelsCount = channelsCountParam || (channelsInfo?.length || 8);
    for (let i = 0; i < channelsCount; i++) {
      datasets.push({
        label: `Channel ${i + 1}`,
        data: [],
        borderColor: channelColors[i % channelColors.length],
        backgroundColor: channelColors[i % channelColors.length] + '20',
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
        hidden: false,
        spanGaps: false
      });
    }

    try {
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
          datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
          animation: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
           legend: {
              display: true,
              labels: {
                color: '#aaa',
                font: {
                  size: 12
                },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: '#1a1a1a',
              titleColor: '#fff',
              bodyColor: '#ccc',
              borderColor: '#333',
              borderWidth: 1,
              callbacks: {
                label: function(context) {
                  const value = context.parsed.y;
                  const unit = Math.abs(value) > 1000 ? 'mV' : 'μV';
                  const displayValue = Math.abs(value) > 1000 ? (value / 1000).toFixed(2) : value.toFixed(1);
                  return `${context.dataset.label}: ${displayValue} ${unit}`;
                }
              }
            }
          },
        scales: {
          x: {
              type: 'linear',
              position: 'bottom',
              grid: {
                color: '#444'
              },
              ticks: {
                color: '#aaa',
                maxTicksLimit: 8,
                callback: function(value) {
                  // Convert timestamp to readable time
                  const date = new Date(value);
                  return date.toLocaleTimeString();
                }
              },
              title: {
                display: true,
                text: 'Time',
                color: '#aaa'
            }
          },
          y: {
              grid: {
                color: '#444'
              },
              ticks: {
                color: '#aaa',
                callback: function(value) {
                  const unit = Math.abs(value) > 1000 ? 'mV' : 'μV';
                  const displayValue = Math.abs(value) > 1000 ? (value / 1000).toFixed(1) : value.toFixed(0);
                  return `${displayValue} ${unit}`;
                }
              },
              title: {
                display: true,
                text: 'Amplitude',
                color: '#aaa'
              }
          }
        }
      }
    });

      console.log('✅ Chart initialized successfully with', datasets.length, 'datasets');
      
    } catch (error) {
      console.error('❌ Error initializing chart:', error);
      chartInstanceRef.current = null;
    }
  };

  const updateChart = (eegData) => {
    if (!chartInstanceRef.current) {
      console.log('⚠️ Chart not initialized, initializing...');
      initChart();
      if (!chartInstanceRef.current) return;
    }

    const now = Date.now();
    if (now - lastUpdateTime.current < UPDATE_THROTTLE_MS) {
      return; // Throttle updates
    }
    lastUpdateTime.current = now;

    try {
      const chart = chartInstanceRef.current;
      const { data, channels, timestamp } = eegData;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('⚠️ No valid data to plot');
        return;
      }

      // Update data count (per-sample or per-batch)
      const increment = Array.isArray(eegData.samples) ? eegData.samples.length : 1;
      setDataCount(prev => prev + increment);
      setLastDataTimestamp(timestamp || Date.now());

      // Convert timestamp to milliseconds if it's in seconds
      const tsNum = Number(timestamp);
      const timeMs = tsNum ? (tsNum > 1e10 ? tsNum : tsNum * 1000) : Date.now();

      console.log(`📊 Processing ${data.length} channels at time ${new Date(timeMs).toLocaleTimeString()}`);

      // Update each channel's dataset
      data.forEach((channelData, channelIndex) => {
        if (channelIndex >= chart.data.datasets.length) {
          return;
        }

        const dataset = chart.data.datasets[channelIndex];
        if (!dataset) {
          return;
        }

        // Parse the raw value
        let rawValue = parseFloat(channelData) || 0;
        // Optional AC coupling: subtract slow running baseline to emphasize variations
        if (acCouple) {
          if (!Array.isArray(baselineRef.current) || baselineRef.current.length < channelIndex + 1) {
            baselineRef.current = new Array(Math.max(channelIndex + 1, baselineRef.current.length || 0)).fill(0);
          }
          const alpha = 0.01; // smoothing for baseline (lower = slower)
          const prev = baselineRef.current[channelIndex] || 0;
          const next = prev + alpha * (rawValue - prev);
          baselineRef.current[channelIndex] = next;
          rawValue = rawValue - next;
        }
        
        // OPTIMIZED: Scaling for realistic EEG data (-200 to +200 µV)
        let scaledValue = rawValue;
        
        // EEG signals are typically small, so we want to preserve and amplify variation
        // Scale to make variations clearly visible while maintaining signal characteristics
        if (Math.abs(rawValue) > 500) {
          // Very large values (likely artifacts) - scale down moderately
          scaledValue = rawValue / 5;
        } else {
          // Normal EEG range - amplify for visibility
          scaledValue = rawValue * 5; // base amplification (stronger)
        }
        // Apply user gain
        scaledValue = scaledValue * gain;
        
        // OPTIMIZED: Channel separation for 16-channel EEG display
        // Use larger offsets to accommodate realistic EEG signal ranges
        const channelOffset = channelIndex * 800; // Increased separation for amplified signals
        scaledValue += channelOffset;

        // Debug logging for first 3 channels to verify scaling
        if (channelIndex < 3) {
          console.log(`📊 Channel ${channelIndex + 1}: raw=${rawValue.toFixed(1)} -> scaled=${(scaledValue - channelOffset).toFixed(1)} + offset=${channelOffset} = final=${scaledValue.toFixed(1)}`);
        }

        // Add new data point
        dataset.data.push({
          x: timeMs,
          y: scaledValue
        });

        // Keep only the last 10 seconds of data (assuming 250Hz = 2500 points)
        if (dataset.data.length > 2500) {
          dataset.data.shift();
        }

        // Update dataset properties for active channels
        if (channelIndex < channels?.length) {
          dataset.label = channels[channelIndex] || `Channel ${channelIndex + 1}`;
          dataset.borderColor = channelColors[channelIndex % channelColors.length];
          dataset.backgroundColor = channelColors[channelIndex % channelColors.length] + '20';
          dataset.hidden = false;
        }

        // Enhanced debugging for first few channels
        if (channelIndex < 3) {
          console.log(`📊 Channel ${channelIndex + 1}: raw=${rawValue.toFixed(1)} -> scaled=${(scaledValue-channelOffset).toFixed(2)} + offset=${channelOffset} = final=${scaledValue.toFixed(2)}`);
        }
      });

      // Hide unused datasets
      for (let i = data.length; i < chart.data.datasets.length; i++) {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].hidden = true;
        }
      }

      // Update X-axis range to show a sliding window
      const latestTime = timeMs;
      const windowSize = Math.max(2, windowSeconds) * 1000; // adjustable window
      chart.options.scales.x.min = latestTime - windowSize;
      chart.options.scales.x.max = latestTime;

      // Update chart
      chart.update('none');
      console.log(`📊 Updated chart with ${data.length} channels, total datasets: ${chart.data.datasets.length}`);
      console.log(`📊 First dataset has ${chart.data.datasets[0]?.data?.length || 0} data points`);
      
    } catch (error) {
      console.error('❌ Error updating chart:', error);
      console.log('⚠️ Chart update error, will retry on next data');
    }
  };

  // Reset chart state when analysis stops OR when disconnected
  useEffect(() => {
    if (!isAnalyzing) {
      console.log('⏹️ Analysis stopped, resetting chart state');
      // Keep last samples count and last timestamp visible until disconnect/close
      
      // Don't destroy the chart immediately - let it show the last data
      // Only clear when starting again
    } else {
      // When analysis starts, ensure chart is ready
      console.log('🚀 Analysis starting, ensuring chart is ready');
      setHasData(true); // Ensure chart is visible when starting
      if (chartRef.current && !chartInstanceRef.current) {
        initChart();
      } else if (chartInstanceRef.current) {
        // Clear old data when restarting
        try {
          chartInstanceRef.current.data.datasets.forEach(dataset => {
            dataset.data = [];
          });
          chartInstanceRef.current.update('none');
          console.log('📊 Cleared old chart data for new session');
        } catch (error) {
          console.error('Error clearing chart data:', error);
          // If clearing fails, reinitialize
          initChart();
        }
      }
    }
  }, [isAnalyzing]);

  // Handle disconnection - reset chart to initial state
  useEffect(() => {
    if (!isConnected) {
      console.log('🔌 Device disconnected, resetting chart to initial state');
      // Reset all state variables to initial values
      setHasData(false);
      setDataCount(0);
      setLastDataTimestamp(null);
      setChannelsInfo([]);
      setSampleRate(250);
      setSelectedFilters([]); // Clear any applied filters
      
      // Destroy the chart to fully reset
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
          console.log('📊 Chart destroyed due to disconnection');
        } catch (error) {
          console.error('Error destroying chart on disconnect:', error);
        }
      }
    }
  }, [isConnected]);

  // While analyzing but no data yet, draw flat lines so user sees channels immediately
  useEffect(() => {
    const startFlatFeed = () => {
      if (!chartInstanceRef.current && chartRef.current) {
        initChart();
      }
      if (!chartInstanceRef.current) return;
      if (flatTimerRef.current) return;

      flatTimerRef.current = setInterval(() => {
        try {
          const chart = chartInstanceRef.current;
          const channelsCount = (channelsInfo && channelsInfo.length) ? channelsInfo.length : 8;
          const timeMs = Date.now();
          for (let i = 0; i < channelsCount; i++) {
            const dataset = chart.data.datasets[i];
            if (!dataset) continue;
            const channelOffset = i * 800; // keep offsets consistent with real plotting
            const scaledValue = 0 + channelOffset;
            dataset.data.push({ x: timeMs, y: scaledValue });
            if (dataset.data.length > 2500) dataset.data.shift();
            // Label and colors
            dataset.label = (channelsInfo && channelsInfo[i]) ? channelsInfo[i] : `CH${i + 1}`;
            dataset.borderColor = channelColors[i % channelColors.length];
            dataset.backgroundColor = channelColors[i % channelColors.length] + '20';
            dataset.hidden = false;
          }
          // Hide any unused datasets beyond channelsCount
          for (let j = channelsCount; j < chart.data.datasets.length; j++) {
            if (chart.data.datasets[j]) chart.data.datasets[j].hidden = true;
          }
          // Slide window
          const windowSize = 10000;
          chart.options.scales.x.min = timeMs - windowSize;
          chart.options.scales.x.max = timeMs;
          chart.update('none');
        } catch {}
      }, 50); // ~20 FPS placeholder
    };

    const stopFlatFeed = () => {
      if (flatTimerRef.current) {
        clearInterval(flatTimerRef.current);
        flatTimerRef.current = null;
      }
    };

    if (isAnalyzing && dataCount === 0) {
      startFlatFeed();
    } else {
      stopFlatFeed();
    }

    return () => stopFlatFeed();
  }, [isAnalyzing, dataCount, channelsInfo]);

  // Initialize chart when component mounts
  useEffect(() => {
    if (chartRef.current && !chartInstanceRef.current) {
      initChart();
    }
    
    // Cleanup chart when component unmounts
    return () => {
      if (chartInstanceRef.current) {
        console.log('🧹 Destroying chart instance on unmount');
        try {
          chartInstanceRef.current.destroy();
        } catch (error) {
          console.error('Error destroying chart:', error);
        }
        chartInstanceRef.current = null;
      }
    };
  }, []);

  const isChartReady = () => {
    return chartInstanceRef.current && 
           chartInstanceRef.current.data && 
           chartInstanceRef.current.data.datasets &&
           chartInstanceRef.current.data.datasets.length > 0;
  };

  const getDeviceIcon = () => {
    switch (deviceType) {
      case 'PiEEG': return '🧠';
      case 'Emotiv': return '🎧';
      default: return '📡';
    }
  };

  const getStatusColor = () => {
    if (!isConnected) return '#ef4444';
    if (!isAnalyzing) return '#10b981';
    return '#f59e0b';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (!isAnalyzing) return 'Connected';
    return 'Streaming';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleFilterChange = (event) => {
    const value = event.target.value;
    console.log('🔧 Filter change event value:', value);
    
    // Ensure value is an array
    if (!Array.isArray(value)) {
      console.log('⚠️ handleFilterChange received non-array value:', value);
      return;
    }
    
    // Handle the special "Raw Data (No Filter)" case
    if (value.includes('')) {
      // If "Raw Data" is selected, clear all filters
      setSelectedFilters([]);
      console.log('🔧 Filters cleared - showing raw data');
    } else {
      // Set the actual filters (value should not contain empty string)
      setSelectedFilters(value);
      console.log('🔧 Filters changed to:', value);
    }
  };

  const FilterSelector = () => {
    console.log('🔍 FilterSelector render - filters:', filters);
    console.log('🔍 FilterSelector render - selectedFilters:', selectedFilters);
    
    // Ensure filters is an array
    const safeFilters = Array.isArray(filters) ? filters : [];
    const safeSelectedFilters = Array.isArray(selectedFilters) ? selectedFilters : [];
    
    return (
      <FormControl size="small" sx={{ minWidth: 250 }}>
        <InputLabel sx={{ color: '#aaa' }}>Filters</InputLabel>
        <Select
          multiple
          value={safeSelectedFilters} // Don't include empty string in value
          onChange={handleFilterChange}
          input={<OutlinedInput label="Filters" />}
          renderValue={(selected) => {
            // If no filters are selected, show "Raw Data"
            if (!selected || selected.length === 0) {
              return <em>Raw Data (No Filter)</em>;
            }
            
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const filter = safeFilters.find(f => f.id === value);
                  return (
                    <Chip
                      key={value}
                      label={filter?.name || value}
                      size="small"
                      sx={{
                        bgcolor: '#f59e0b',
                        color: 'white',
                        '& .MuiChip-deleteIcon': {
                          color: 'white'
                        }
                      }}
                    />
                  );
                })}
              </Box>
            );
          }}
          displayEmpty
          sx={{
            color: 'white',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#444',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#666',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8b5cf6',
            },
            '& .MuiSvgIcon-root': {
              color: '#aaa',
            },
          }}
        >
          <MenuItem value="">
            <em>Raw Data (No Filter)</em>
          </MenuItem>
          {safeFilters.map((filter) => (
            <MenuItem key={filter.id} value={filter.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterAltIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                {filter.name}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      minHeight: '500px',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#0a0a0a',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {/* Header with device info and stats */}
      <Paper sx={{
        bgcolor: '#1a1a1a',
        borderBottom: '1px solid #333',
        p: 2,
        borderRadius: '8px 8px 0 0'
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: '24px' }}>{getDeviceIcon()}</span>
                {deviceModel?.replace('_', ' ').toUpperCase() || 'EEG Device'}
        </Typography>
              <Chip
                icon={<WifiIcon />}
                label={getStatusText()}
                size="small"
                sx={{
                  bgcolor: getStatusColor(),
                  color: 'white',
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              {simulatorMode && (
                <Chip
                  label="Simulator"
                  size="small"
                  sx={{
                    bgcolor: '#ff9800',
                    color: 'white',
                    fontWeight: 600
                  }}
                />
              )}
              {/* Removed extra selected-filters count chip to avoid overlapping the Filters dropdown */}
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
              <FilterSelector />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 180 }}>
                <Typography variant="caption" color="#888">Gain</Typography>
                <Slider size="small" min={0.5} max={50} step={0.5} value={gain} onChange={(_, v) => setGain(v)}
                  sx={{ color: '#8b5cf6' }} />
              </Box>
              <Box sx={{ width: 180 }}>
                <Typography variant="caption" color="#888">Window (s)</Typography>
                <Slider size="small" min={2} max={60} step={1} value={windowSeconds} onChange={(_, v) => setWindowSeconds(v)}
                  sx={{ color: '#8b5cf6' }} />
              </Box>
              <FormControlLabel
                control={<Switch checked={acCouple} onChange={(_, v) => setAcCouple(v)} size="small" sx={{ color: '#8b5cf6' }} />}
                label={<Typography variant="caption" color="#888">AC couple</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={aiFilter} onChange={(_, v) => setAiFilter(v)} size="small" sx={{ color: '#8b5cf6' }} />}
                label={<Typography variant="caption" color="#888">AI filter</Typography>}
              />
            </Box>
              {isFiltering && (
                <Chip
                  label="Processing..."
                  size="small"
                  sx={{
                    bgcolor: '#8b5cf6',
                    color: 'white',
                    fontWeight: 600
                  }}
                />
              )}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <Card sx={{ bgcolor: '#0a0a0a', border: '1px solid #333' }}>
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="#888">Channels</Typography>
                    <Typography variant="h6" color="white" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SignalCellularAltIcon fontSize="small" />
                      {channelsInfo.length || '--'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card sx={{ bgcolor: '#0a0a0a', border: '1px solid #333' }}>
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="#888">Sample Rate</Typography>
                    <Typography variant="h6" color="white" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <MonitorHeartIcon fontSize="small" />
                      {sampleRate} Hz
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card sx={{ bgcolor: '#0a0a0a', border: '1px solid #333' }}>
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="#888">Samples</Typography>
                    <Typography variant="h6" color="#4caf50" sx={{ fontFamily: 'monospace' }}>
                      {dataCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {/* Chart Area */}
      <Box sx={{ 
        flexGrow: 1, 
        position: 'relative',
        minHeight: 0,
        height: '400px', // Fixed height instead of flexGrow
        p: 2,
        bgcolor: '#0a0a0a'
      }}>
        {hasData ? (
          <canvas 
            ref={chartRef} 
            style={{ 
              width: '100%', 
              height: '100%',
              borderRadius: '8px',
              backgroundColor: '#0f0f0f',
              border: '1px solid #333'
            }} 
          />
        ) : (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            textAlign: 'center'
          }}>
            <Box sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: '#1a1a1a',
              border: '2px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              position: 'relative'
            }}>
              <Typography variant="h2" sx={{ color: '#8b5cf6' }}>
                {getDeviceIcon()}
        </Typography>
              {isConnected && isAnalyzing && (
                <Box sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: '#ff9800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 2s infinite'
                }}>
                  <WifiIcon sx={{ fontSize: 14, color: 'white' }} />
                </Box>
              )}
              {isConnected && !isAnalyzing && (
                <Box sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: '#4caf50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <WifiIcon sx={{ fontSize: 14, color: 'white' }} />
                </Box>
              )}
            </Box>
            
            <Typography variant="h5" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
              {!isConnected ? 'Connecting to Device...' : 
               !isAnalyzing ? 'Ready to Stream' :
               'Waiting for EEG Data...'}
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#888', mb: 2, maxWidth: 400 }}>
              {!isConnected 
                ? 'Establishing connection to your EEG device. Please wait...'
                : !isAnalyzing
                ? `Connected to ${deviceModel?.replace('_', ' ').toUpperCase()}. Click "Start Analysis" to begin streaming.`
                : `Streaming from ${deviceModel?.replace('_', ' ').toUpperCase()}. Real-time EEG data will appear here.`
              }
            </Typography>

            {lastDataTimestamp && (
              <Typography variant="caption" sx={{ color: '#666' }}>
                Last data received: {formatTimestamp(lastDataTimestamp)}
        </Typography>
      )}
          </Box>
        )}
      </Box>

      {/* Add pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
          }
        }
      `}</style>
    </Box>
  );
};

export default EEGChart;
