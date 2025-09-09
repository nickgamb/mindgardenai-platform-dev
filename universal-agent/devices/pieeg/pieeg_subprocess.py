#!/usr/bin/env python3
"""
PiEEG Subprocess Wrapper - Run the actual test_pieeg.py as subprocess
"""

import subprocess
import sys
import shutil
import os
import threading
import time
import logging
import signal
import os
from typing import Optional, List, Callable

# Setup logging
logger = logging.getLogger('pieeg_subprocess')

# Global variables for streaming
_is_streaming = False
_sample_callback = None
_process = None
_output_thread = None

def _select_python_interpreter() -> str:
    """Choose a Python interpreter that can import spidev and RPi.GPIO.
    Tries sys.executable, then /usr/bin/python3, then python3 in PATH.
    """
    candidates = []
    if sys.executable:
        candidates.append(sys.executable)
    # Prefer system python on Pi for GPIO/SPI access
    candidates.append('/usr/bin/python3')
    # Fallback to python3 in PATH
    python3_in_path = shutil.which('python3')
    if python3_in_path:
        candidates.append(python3_in_path)

    checked = set()
    for exe in candidates:
        if not exe or exe in checked:
            continue
        checked.add(exe)
        try:
            probe = subprocess.run(
                [exe, '-c', 'import spidev; from RPi import GPIO; print("OK")'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3
            )
            if probe.returncode == 0 and 'OK' in (probe.stdout or ''):
                return exe
        except Exception:
            continue
    # Last resort
    return sys.executable or 'python3'

def start_streaming(callback: Callable[[List[float]], None]):
    """Start streaming by running test_pieeg.py directly as subprocess"""
    global _is_streaming, _sample_callback, _process, _output_thread
    
    print("=== SUBPROCESS START_STREAMING CALLED ===")
    logger.info("=== SUBPROCESS START_STREAMING CALLED ===")
    
    if _is_streaming:
        logger.warning("Already streaming")
        return False
    
    _sample_callback = callback
    _is_streaming = True
    
    try:
        print("Starting PiEEG subprocess streamer...")
        logger.info("Starting PiEEG subprocess streamer...")
        
        # Prefer polling-based script on Pi 4, fallback to original test script
        scripts = [
            'test_pieeg_poll.py',
            'test_pieeg.py',
        ]
        base_dir = os.path.dirname(__file__)
        script_path = None
        for name in scripts:
            candidate = os.path.join(base_dir, name)
            if os.path.exists(candidate):
                script_path = candidate
                break
        if not script_path:
            raise FileNotFoundError("No PiEEG test script found (expected test_pieeg_poll.py or test_pieeg.py)")
        logger.info(f"Using script: {os.path.basename(script_path)}")
        interpreter = _select_python_interpreter()
        print(f"Using Python interpreter for subprocess: {interpreter}")
        logger.info(f"Using Python interpreter for subprocess: {interpreter}")

        _process = subprocess.Popen(
            [interpreter, '-u', script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True,
            cwd=os.path.dirname(script_path)
        )
        
        # Start a thread to read both stdout and stderr and parse samples from either
        def read_output():
            global _is_streaming
            samples_collected = 0
            print("Starting output reader thread (stdout+stderr)...")
            logger.info("Starting output reader thread (stdout+stderr)...")

            def maybe_parse_and_dispatch(line_text: str):
                nonlocal samples_collected
                if not line_text:
                    return
                # Echo lines for debugging
                print(f"test_pieeg.py: {line_text.strip()}")
                logger.info(f"test_pieeg.py: {line_text.strip()}")
                # Look for sample lines like "Sample 1: [123.45, -67.89, ...]"
                if "[" in line_text and "]" in line_text and "Sample" in line_text:
                    try:
                        start_idx = line_text.find('[')
                        end_idx = line_text.find(']')
                        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                            sample_str = line_text[start_idx + 1:end_idx]
                            sample_data = [float(x.strip()) for x in sample_str.split(',') if x.strip()]
                            samples_collected += 1
                            print(f"EXTRACTED sample {samples_collected}: {sample_data}")
                            logger.info(f"EXTRACTED sample {samples_collected}: {sample_data}")
                            if _sample_callback:
                                _sample_callback(sample_data)
                    except Exception as e:
                        print(f"Error parsing sample: {e}")
                        logger.error(f"Error parsing sample: {e}")

            try:
                import select
                streams = []
                if _process.stdout:
                    streams.append(_process.stdout)
                if _process.stderr:
                    streams.append(_process.stderr)

                while _is_streaming and _process.poll() is None:
                    if not streams:
                        time.sleep(0.05)
                        continue
                    ready, _, _ = select.select(streams, [], [], 0.2)
                    if not ready:
                        continue
                    for r in ready:
                        try:
                            line = r.readline()
                            if line:
                                maybe_parse_and_dispatch(line)
                        except Exception as e:
                            print(f"Error reading from stream: {e}")
                            logger.error(f"Error reading from stream: {e}")

                # Drain any remaining lines after process exits
                try:
                    if _process.stdout:
                        for line in _process.stdout.readlines():
                            maybe_parse_and_dispatch(line)
                    if _process.stderr:
                        for line in _process.stderr.readlines():
                            maybe_parse_and_dispatch(line)
                except Exception:
                    pass

                # Report exit code
                if _process.poll() is not None:
                    exit_code = _process.returncode
                    print(f"Process ended with exit code: {exit_code}")
                    logger.info(f"Process ended with exit code: {exit_code}")

                print(f"Output reading stopped after {samples_collected} samples")
                logger.info(f"Output reading stopped after {samples_collected} samples")

            except Exception as e:
                print(f"Error reading output: {e}")
                logger.error(f"Error reading output: {e}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Start the output reading thread
        _output_thread = threading.Thread(target=read_output)
        _output_thread.daemon = True
        _output_thread.start()
        
        print("test_pieeg.py subprocess started successfully")
        logger.info("test_pieeg.py subprocess started successfully")
        return True
        
    except Exception as e:
        print(f"Error starting test_pieeg.py subprocess: {e}")
        logger.error(f"Error starting test_pieeg.py subprocess: {e}")
        _is_streaming = False
        return False

def stop_streaming():
    """Stop streaming by killing the test_pieeg.py process"""
    global _is_streaming, _process, _output_thread
    
    print("subprocess stop_streaming() called")
    logger.info("subprocess stop_streaming() called")
    
    if not _is_streaming:
        print("Not streaming")
        logger.warning("Not streaming")
        return False
    
    _is_streaming = False
    
    if _process:
        print("Terminating test_pieeg.py subprocess...")
        logger.info("Terminating test_pieeg.py subprocess...")
        try:
            # Send SIGINT (Ctrl+C) to the process to trigger cleanup
            _process.send_signal(signal.SIGINT)
            _process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print("Force killing test_pieeg.py subprocess...")
            logger.info("Force killing test_pieeg.py subprocess...")
            _process.kill()
            _process.wait()
        except Exception as e:
            print(f"Error stopping subprocess: {e}")
            logger.error(f"Error stopping subprocess: {e}")
        _process = None
    
    if _output_thread:
        _output_thread.join(timeout=2)
        _output_thread = None
    
    print("Stopped PiEEG subprocess streaming")
    logger.info("Stopped PiEEG subprocess streaming")
    return True

def cleanup():
    """Cleanup by stopping the subprocess"""
    print("Subprocess cleaning up...")
    logger.info("Subprocess cleaning up...")
    stop_streaming()
    print("PiEEG subprocess cleanup completed")
    logger.info("PiEEG subprocess cleanup completed")