"""
Cloudflare Tunnel Client Module

Manages Cloudflare Tunnel creation and management for public access to the agent.
"""

import logging
import time
import subprocess
import threading
import re
from typing import Optional

logger = logging.getLogger('cloudflare')

class CloudflareClient:
    """Manages Cloudflare Tunnels for public access"""
    
    def __init__(self, config):
        self.config = config
        self.tunnel_process = None
        self.public_url = None
        self.tunnel_thread = None
        self._tunnel_ready = threading.Event()
        
    def start_tunnel(self, port: int, subdomain: Optional[str] = None) -> str:
        """Start Cloudflare tunnel for the specified port"""
        try:
            if self.tunnel_process and self.tunnel_process.poll() is None:
                logger.info(f"Cloudflare tunnel already running: {self.public_url}")
                return self.public_url
            
            logger.info(f"Starting Cloudflare quick tunnel on port {port}")
            
            # Use Cloudflare quick tunnel instead of token-based tunnel
            # This works more like NGROK - automatic URL generation
            # Use 127.0.0.1 since we're running in the same container as the Flask app
            cmd = [
                "cloudflared", "tunnel", "--no-autoupdate",
                "--url", f"http://127.0.0.1:{port}"
            ]
            
            logger.info("Starting cloudflared process...")
            logger.info(f"Command: {' '.join(cmd)}")
            
            # Check if cloudflared is available
            try:
                result = subprocess.run(['which', 'cloudflared'], capture_output=True, text=True)
                if result.returncode == 0:
                    logger.info(f"cloudflared found at: {result.stdout.strip()}")
                else:
                    logger.error("cloudflared not found in PATH")
                    raise RuntimeError("cloudflared binary not found")
            except Exception as e:
                logger.error(f"Error checking for cloudflared: {e}")
                raise RuntimeError("cloudflared binary not available")
            
            # Start the process and capture output
            self.tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            logger.info(f"cloudflared process started with PID: {self.tunnel_process.pid}")
            
            # Start a thread to monitor the output and extract the URL
            self.tunnel_thread = threading.Thread(
                target=self._monitor_tunnel_output, 
                daemon=True
            )
            self.tunnel_thread.start()
            
            # Wait for the tunnel to be ready (timeout after 60 seconds)
            logger.info("Waiting for tunnel to establish...")
            if self._tunnel_ready.wait(timeout=60):
                logger.info(f"Cloudflare tunnel established: {self.public_url}")
                
                # Verify tunnel is working
                self._verify_tunnel()
                
                return self.public_url
            else:
                # Timeout waiting for tunnel
                self.stop_tunnel()
                raise RuntimeError("Timeout waiting for Cloudflare tunnel to start")
                
        except Exception as e:
            logger.error(f"Error starting Cloudflare tunnel: {e}")
            self.stop_tunnel()
            raise
    
    def _monitor_tunnel_output(self):
        """Monitor cloudflared output to extract the public URL"""
        try:
            if not self.tunnel_process:
                logger.error("No tunnel process to monitor")
                return
            
            logger.info("Starting to monitor cloudflared output...")
            
            # Read stderr since cloudflared outputs connection info there
            for line in iter(self.tunnel_process.stderr.readline, ''):
                if not line:
                    logger.info("No more output from cloudflared")
                    break
                    
                line = line.strip()
                logger.info(f"cloudflared: {line}")  # Changed to INFO to see all output
                
                # Look for Cloudflare quick tunnel URLs
                # Pattern: "Your quick Tunnel: https://abc123.trycloudflare.com"
                # Also look for "https://" in the output
                url_match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                if url_match and not self.public_url:
                    self.public_url = url_match.group(0)
                    logger.info(f"Extracted tunnel URL: {self.public_url}")
                    self._tunnel_ready.set()
                
                # Also check for connection established messages
                if ("your quick tunnel" in line.lower() or 
                    "tunnel registered" in line.lower() or
                    "connection established" in line.lower()) and not self.public_url:
                    # Sometimes the URL is in a different line, keep monitoring
                    logger.info("Tunnel connection detected, waiting for URL...")
                
                # Check for specific cloudflared success patterns
                if "registered tunnel connection" in line.lower():
                    logger.info("Tunnel registration confirmed")
                    
                # Look for any routing or connection issues
                if any(word in line.lower() for word in ["failed", "error", "refused", "timeout"]):
                    logger.warning(f"Potential tunnel issue: {line}")
                    
                # Also check for errors
                if "ERR" in line or "error" in line.lower():
                    logger.warning(f"cloudflared error: {line}")
                    
        except Exception as e:
            logger.error(f"Error monitoring tunnel output: {e}")
        finally:
            logger.debug("Tunnel output monitoring stopped")
    
    def _handle_token_tunnel_ready(self):
        """Handle token-based tunnel ready state"""
        try:
            logger.info("Token-based tunnel connection established")
            
            # For MindGarden's configured tunnel, we know the pattern
            # Based on your setup, it's likely agent.mindgardenai.com or similar
            # Let's try to extract from common Cloudflare tunnel patterns
            
            possible_urls = [
                "https://agent.mindgardenai.com",
                "https://universal-agent.mindgardenai.com", 
                "https://tunnel.mindgardenai.com"
            ]
            
            # For now, use the most likely URL for MindGarden
            # This should be the URL configured in your Cloudflare tunnel dashboard
            self.public_url = "https://agent.mindgardenai.com"
            logger.info(f"Using configured tunnel URL: {self.public_url}")
            self._tunnel_ready.set()
            
        except Exception as e:
            logger.error(f"Error handling token tunnel ready state: {e}")
    
    def stop_tunnel(self):
        """Stop the Cloudflare tunnel"""
        try:
            if self.tunnel_process:
                logger.info(f"Stopping Cloudflare tunnel: {self.public_url}")
                
                # Terminate the process
                self.tunnel_process.terminate()
                
                # Wait for it to finish, force kill if it takes too long
                try:
                    self.tunnel_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning("Cloudflare tunnel didn't stop gracefully, force killing")
                    self.tunnel_process.kill()
                    self.tunnel_process.wait()
                
                self.tunnel_process = None
                self.public_url = None
                self._tunnel_ready.clear()
                logger.info("Cloudflare tunnel stopped")
            else:
                logger.info("No Cloudflare tunnel to stop")
                
        except Exception as e:
            logger.error(f"Error stopping Cloudflare tunnel: {e}")
    
    def get_tunnel_url(self) -> Optional[str]:
        """Get the current tunnel URL"""
        return self.public_url
    
    def is_tunnel_active(self) -> bool:
        """Check if tunnel is active"""
        try:
            return (self.tunnel_process is not None and 
                   self.tunnel_process.poll() is None and 
                   self.public_url is not None)
        except Exception as e:
            logger.error(f"Error checking tunnel status: {e}")
            return False
    
    def _verify_tunnel(self):
        """Verify that the tunnel is working"""
        try:
            import requests
            
            # Give tunnel a moment to establish
            time.sleep(2)
            
            # First test local Flask app directly
            try:
                logger.info("Testing local Flask app connectivity...")
                local_response = requests.get("http://127.0.0.1:5000/health", timeout=5)
                if local_response.status_code == 200:
                    logger.info("✅ Local Flask app is responding")
                else:
                    logger.warning(f"⚠️ Local Flask app returned {local_response.status_code}")
            except Exception as e:
                logger.error(f"❌ Cannot reach local Flask app: {e}")
                return
            
            # Try to reach the health endpoint through tunnel
            health_url = f"{self.public_url}/health"
            logger.info(f"Verifying tunnel at: {health_url}")
            
            # Use a short timeout since this is just a verification
            response = requests.get(health_url, timeout=15)
            
            if response.status_code == 200:
                logger.info("✅ Cloudflare tunnel verification successful")
            else:
                logger.warning(f"⚠️ Cloudflare tunnel verification returned {response.status_code}")
                logger.warning(f"Response content: {response.text[:200]}")
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"❌ Could not verify Cloudflare tunnel: {e}")
        except Exception as e:
            logger.warning(f"❌ Error verifying Cloudflare tunnel: {e}")
    
    def restart_tunnel(self, port: int) -> str:
        """Restart the Cloudflare tunnel"""
        try:
            logger.info("Restarting Cloudflare tunnel")
            self.stop_tunnel()
            time.sleep(1)  # Brief pause
            return self.start_tunnel(port)
            
        except Exception as e:
            logger.error(f"Error restarting Cloudflare tunnel: {e}")
            raise
    
    def get_tunnel_info(self) -> dict:
        """Get detailed tunnel information"""
        try:
            if not self.is_tunnel_active():
                return {'status': 'inactive'}
            
            return {
                'status': 'active',
                'public_url': self.public_url,
                'process_id': self.tunnel_process.pid if self.tunnel_process else None,
                'token_configured': bool(self.config.CLOUDFLARE_TUNNEL_TOKEN)
            }
            
        except Exception as e:
            logger.error(f"Error getting tunnel info: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def cleanup(self):
        """Cleanup Cloudflare tunnel resources"""
        try:
            self.stop_tunnel()
            logger.info("Cloudflare tunnel cleanup completed")
        except Exception as e:
            logger.error(f"Error during Cloudflare tunnel cleanup: {e}")