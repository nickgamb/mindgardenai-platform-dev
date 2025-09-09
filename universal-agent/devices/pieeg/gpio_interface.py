"""
GPIO/SPI Interface for PiEEG using RPi.GPIO polling on BOARD pin 37 (BCM26).

This interface performs on-demand initialization at start_stream time and
polls the DRDY line to read ADS1299 samples via spidev. No GPIO/SPI is
accessed at import or device construction time.
"""

from typing import Callable, List, Optional
import time
import logging

logger = logging.getLogger('device.pieeg.gpio')


class GPIOInterface:
    """Handles SPI communication with ADS1299 for PiEEG using RPi.GPIO polling."""

    # ADS1299 Commands
    RESET = 0x06
    STOP = 0x0A
    START = 0x08
    SDATAC = 0x11
    RDATAC = 0x10
    WAKEUP = 0x02

    DATA_TEST = 0x7FFFFF
    DATA_CHECK = 0xFFFFFF

    def __init__(self, spi_bus: int = 0, spi_device: int = 0, board_pin: int = 37, gain: int = 6):
        self.spi_bus = spi_bus
        self.spi_device = spi_device
        self.board_pin = board_pin  # BOARD numbering, 37 == BCM26
        self.gain = gain if gain in (1, 2, 4, 6, 8, 12, 24) else 6

        # Lazy-loaded modules/handles
        self._spi = None
        self._gpio = None

        # State
        self._is_initialized = False
        self._prev_pin_state: Optional[int] = None

    def _send_command(self, cmd: int):
        self._spi.xfer([cmd])

    def _write_byte(self, register: int, data: int):
        write = 0x40
        register_write = write | register
        packet = [register_write, 0x00, data]
        self._spi.xfer(packet)

    def initialize(self) -> bool:
        """Initialize SPI and GPIO and configure ADS1299.

        This method performs the exact init sequence known to work from the
        standalone polling test: configures SPI, sets BOARD pin to input,
        configures ADS1299 registers, and starts RDATAC.
        """
        try:
            if self._is_initialized:
                # Re-arm ADS1299 on subsequent starts
                try:
                    if self._spi is not None:
                        self._send_command(self.SDATAC)
                        self._send_command(self.RDATAC)
                        self._send_command(self.START)
                    # Force baseline to HIGH so first LOW is treated as a falling edge
                    self._prev_pin_state = 1
                except Exception as re:
                    logger.debug(f"Re-arm warning: {re}")
                return True

            # Lazy import to avoid GPIO/SPI at import time
            import spidev  # type: ignore
            from RPi import GPIO  # type: ignore

            # Setup GPIO first
            GPIO.setwarnings(False)
            GPIO.setmode(GPIO.BOARD)
            GPIO.setup(self.board_pin, GPIO.IN)
            # Force baseline to HIGH so the next LOW is immediately treated as a falling edge
            self._prev_pin_state = 1

            # Setup SPI
            spi = spidev.SpiDev()
            spi.open(self.spi_bus, self.spi_device)
            spi.max_speed_hz = 600000
            spi.lsbfirst = False
            spi.mode = 0b01
            spi.bits_per_word = 8

            # Store handles
            self._spi = spi
            self._gpio = GPIO

            # ADS1299 init sequence
            self._send_command(self.WAKEUP)
            self._send_command(self.STOP)
            self._send_command(self.RESET)
            self._send_command(self.SDATAC)

            # Register writes (matching working script)
            self._write_byte(0x14, 0x80)  # GPIO
            self._write_byte(0x01, 0x96)  # config1
            self._write_byte(0x02, 0xD4)  # config2
            self._write_byte(0x03, 0xFF)  # config3
            self._write_byte(0x04, 0x00)
            self._write_byte(0x0D, 0x00)
            self._write_byte(0x0E, 0x00)
            self._write_byte(0x0F, 0x00)
            self._write_byte(0x10, 0x00)
            self._write_byte(0x11, 0x00)
            self._write_byte(0x15, 0x20)
            self._write_byte(0x17, 0x00)
            self._write_byte(0x05, 0x00)  # ch1set
            self._write_byte(0x06, 0x00)  # ch2set
            self._write_byte(0x07, 0x00)  # ch3set
            self._write_byte(0x08, 0x00)  # ch4set
            self._write_byte(0x09, 0x00)  # ch5set
            self._write_byte(0x0A, 0x00)  # ch6set
            self._write_byte(0x0B, 0x00)  # ch7set
            self._write_byte(0x0C, 0x00)  # ch8set

            # Start continuous conversion
            self._send_command(self.RDATAC)
            self._send_command(self.START)
            time.sleep(0.1)

            self._is_initialized = True
            logger.info("GPIOInterface initialized (polling)")
            return True

        except Exception as e:
            logger.error(f"GPIOInterface initialize error: {e}")
            self.cleanup()
            return False

    def read_one_sample(self, timeout_seconds: float = 1.0) -> Optional[List[float]]:
        """Poll the DRDY pin for a falling edge and read one sample.

        Returns channel values (8 floats) or None on timeout.
        """
        if not self._is_initialized:
            return None

        start_ts = time.time()
        try:
            # Poll for falling edge
            while (time.time() - start_ts) < timeout_seconds:
                cur = self._gpio.input(self.board_pin)
                prev = self._prev_pin_state
                self._prev_pin_state = cur
                if prev == 1 and cur == 0:
                    # Read 27 bytes
                    output = self._spi.readbytes(27)
                    # Parse to signed 24-bit int then convert to microvolts
                    result_uV = [0.0] * 8
                    idx = 0
                    for a in range(3, 25, 3):
                        raw24 = (output[a] << 16) | (output[a + 1] << 8) | output[a + 2]
                        # Sign extend 24-bit
                        if raw24 & 0x800000:
                            raw24 -= 1 << 24
                        # Convert to microvolts: (raw / 2^23) * (Vref/gain) * 1e6
                        uV = (raw24 / 8388607.0) * ((2.4e6) / float(self.gain))
                        result_uV[idx] = round(uV, 2)
                        idx += 1
                    return result_uV
                # Small sleep to reduce CPU; tuned from working script
                time.sleep(0.0005)
            return None

        except Exception as e:
            logger.error(f"GPIOInterface read_one_sample error: {e}")
            return None

    def stop(self):
        """Send STOP command to ADS1299 to halt conversions."""
        try:
            if self._spi:
                self._send_command(self.STOP)
            # Update prev state baseline
            if self._gpio is not None:
                self._prev_pin_state = self._gpio.input(self.board_pin)
        except Exception as e:
            logger.debug(f"GPIOInterface stop warning: {e}")

    def cleanup(self):
        """Cleanup SPI and GPIO resources."""
        try:
            # Send STOP if possible
            try:
                self.stop()
            except Exception:
                pass

            # Close SPI
            if self._spi is not None:
                try:
                    self._spi.close()
                except Exception:
                    pass
                self._spi = None

            # GPIO cleanup
            if self._gpio is not None:
                try:
                    self._gpio.cleanup()
                except Exception:
                    pass
                self._gpio = None

        finally:
            self._is_initialized = False
            self._prev_pin_state = None
            logger.info("GPIOInterface cleaned up")


