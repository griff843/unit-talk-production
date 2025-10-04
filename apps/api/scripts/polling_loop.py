#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automated Polling Loop for MLB Props Ingestion
Runs ingestion every 60 seconds with scoring pipeline
"""
import os
import sys
import time
import subprocess
from datetime import datetime, timezone

# Force UTF-8 encoding on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))  # 60 seconds default
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def log(message):
    """Log with timestamp"""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{timestamp}] {message}", flush=True)

def run_ingestion():
    """Run MLB props ingestion"""
    log("🔄 Running MLB props ingestion...")
    try:
        result = subprocess.run(
            ["python", os.path.join(SCRIPT_DIR, "mlb_props_ingest.py")],
            capture_output=True,
            text=True,
            timeout=55  # Must finish before next cycle
        )

        if result.returncode == 0:
            log("✅ Ingestion complete")
            # Print summary from output
            for line in result.stdout.split('\n'):
                if 'inserted' in line.lower() or 'summary' in line.lower():
                    log(f"   {line}")
        else:
            log(f"❌ Ingestion failed: {result.stderr[:200]}")

        return result.returncode == 0
    except subprocess.TimeoutExpired:
        log("⏰ Ingestion timeout (>55s) - continuing to next cycle")
        return False
    except Exception as e:
        log(f"❌ Ingestion error: {str(e)[:200]}")
        return False

def run_scoring():
    """Trigger scoring agent on new props"""
    log("📊 Triggering scoring agent...")
    try:
        # Use npm run to execute scoring agent
        result = subprocess.run(
            ["npm", "run", "agent:score"],
            cwd=os.path.join(SCRIPT_DIR, ".."),
            capture_output=True,
            text=True,
            timeout=30,
            shell=True  # Needed for npm on Windows
        )

        if result.returncode == 0:
            log("✅ Scoring complete")
        else:
            log(f"⚠️  Scoring had issues (continuing): {result.stderr[:200]}")

        return True  # Continue even if scoring has issues
    except Exception as e:
        log(f"⚠️  Scoring error (continuing): {str(e)[:200]}")
        return True

def main():
    log("=" * 60)
    log("🚀 AUTOMATED POLLING LOOP ACTIVATED")
    log(f"⏱️  Poll interval: {POLL_INTERVAL} seconds")
    log(f"🎯 Target: MLB player props with professional scoring")
    log("=" * 60)

    cycle_count = 0
    success_count = 0

    try:
        while True:
            cycle_count += 1
            start_time = time.time()

            log(f"\n{'=' * 60}")
            log(f"CYCLE #{cycle_count} - Starting")
            log(f"{'=' * 60}")

            # Run ingestion
            ingestion_success = run_ingestion()
            if ingestion_success:
                success_count += 1
                # Run scoring after successful ingestion
                run_scoring()

            # Calculate sleep time to maintain interval
            elapsed = time.time() - start_time
            sleep_time = max(0, POLL_INTERVAL - elapsed)

            log(f"⏸️  Cycle complete in {elapsed:.1f}s - sleeping {sleep_time:.1f}s")
            log(f"📈 Success rate: {success_count}/{cycle_count} ({100*success_count/cycle_count:.1f}%)")

            if sleep_time > 0:
                time.sleep(sleep_time)

    except KeyboardInterrupt:
        log("\n🛑 Polling loop stopped by user")
        log(f"📊 Final stats: {success_count}/{cycle_count} cycles successful")
        sys.exit(0)
    except Exception as e:
        log(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
