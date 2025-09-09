import logging
import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
import atexit

# Initialize scheduler
scheduler = None
jobstores = {
    'default': MemoryJobStore()
}
executors = {
    'default': ThreadPoolExecutor(20)
}
job_defaults = {
    'coalesce': False,
    'max_instances': 3
}

def init_scheduler():
    """Initialize the background scheduler"""
    global scheduler
    if scheduler is None:
        scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone='UTC'
        )
        scheduler.start()
        logging.info("✅ Flow scheduler initialized")
        
        # Ensure scheduler shuts down when the application exits
        atexit.register(lambda: scheduler.shutdown())
    
    return scheduler

def schedule_flow_execution(mgflow_id, trigger_node_id, schedule_datetime, flow_data, user_id, socketio):
    """Schedule a flow to execute at a specific datetime"""
    try:
        if scheduler is None:
            init_scheduler()
        
        # Create job ID
        job_id = f"flow_{mgflow_id}_{trigger_node_id}"
        
        # Remove existing job if it exists
        try:
            scheduler.remove_job(job_id)
            logging.info(f"🗑️ Removed existing scheduled job: {job_id}")
        except:
            pass  # Job doesn't exist, that's fine
        
        # Schedule new job
        trigger = DateTrigger(run_date=schedule_datetime)
        
        job = scheduler.add_job(
            func=execute_scheduled_flow,
            trigger=trigger,
            args=[flow_data, user_id, socketio, mgflow_id, trigger_node_id],
            id=job_id,
            name=f"Scheduled Flow Execution: {mgflow_id}",
            replace_existing=True
        )
        
        logging.info(f"📅 Scheduled flow execution: {job_id} at {schedule_datetime}")
        return job_id
        
    except Exception as e:
        logging.error(f"❌ Failed to schedule flow execution: {e}")
        raise

def execute_scheduled_flow(flow_data, user_id, socketio, mgflow_id, trigger_node_id):
    """Execute a scheduled flow"""
    try:
        logging.info(f"⏰ Executing scheduled flow: {mgflow_id}/{trigger_node_id}")
        
        # Import here to avoid circular imports
        try:
            from routes.flow_routes import execute_flow_background
        except ImportError:
            # Handle the case where the import fails
            logging.error("❌ Could not import execute_flow_background - flow execution may not work")
            return
        
        # Add scheduling metadata to flow data
        if isinstance(flow_data, dict):
            for node in flow_data.get('nodes', []):
                if node.get('id') == trigger_node_id and node.get('type') == 'flow_trigger':
                    if 'data' not in node:
                        node['data'] = {}
                    if 'config' not in node['data']:
                        node['data']['config'] = {}
                    
                    node['data']['config']['scheduled_execution'] = True
                    node['data']['config']['execution_time'] = datetime.utcnow().isoformat()
        
        # Execute the flow
        execute_flow_background(flow_data, user_id, socketio)
        
        logging.info(f"✅ Scheduled flow execution completed: {mgflow_id}/{trigger_node_id}")
        
    except Exception as e:
        logging.error(f"❌ Scheduled flow execution failed: {e}")

def cancel_scheduled_flow(mgflow_id, trigger_node_id=None):
    """Cancel scheduled flow execution(s)"""
    try:
        if scheduler is None:
            return False
        
        if trigger_node_id:
            # Cancel specific trigger
            job_id = f"flow_{mgflow_id}_{trigger_node_id}"
            try:
                scheduler.remove_job(job_id)
                logging.info(f"🗑️ Cancelled scheduled flow: {job_id}")
                return True
            except:
                logging.warning(f"⚠️ No scheduled job found to cancel: {job_id}")
                return False
        else:
            # Cancel all scheduled flows for this mgflow
            cancelled_count = 0
            for job in scheduler.get_jobs():
                if job.id.startswith(f"flow_{mgflow_id}_"):
                    scheduler.remove_job(job.id)
                    cancelled_count += 1
                    logging.info(f"🗑️ Cancelled scheduled flow: {job.id}")
            
            logging.info(f"🗑️ Cancelled {cancelled_count} scheduled flows for mgflow: {mgflow_id}")
            return cancelled_count > 0
            
    except Exception as e:
        logging.error(f"❌ Failed to cancel scheduled flows: {e}")
        return False

def get_scheduled_flows(mgflow_id=None):
    """Get list of scheduled flows"""
    try:
        if scheduler is None:
            return []
        
        scheduled_flows = []
        for job in scheduler.get_jobs():
            if mgflow_id is None or job.id.startswith(f"flow_{mgflow_id}_"):
                scheduled_flows.append({
                    'job_id': job.id,
                    'mgflow_id': job.id.split('_')[1] if '_' in job.id else None,
                    'trigger_node_id': job.id.split('_')[2] if len(job.id.split('_')) > 2 else None,
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'name': job.name
                })
        
        return scheduled_flows
        
    except Exception as e:
        logging.error(f"❌ Failed to get scheduled flows: {e}")
        return []

def get_scheduler_status():
    """Get scheduler status and statistics"""
    try:
        if scheduler is None:
            return {'running': False, 'job_count': 0}
        
        return {
            'running': scheduler.running,
            'job_count': len(scheduler.get_jobs()),
            'jobs': [
                {
                    'id': job.id,
                    'name': job.name,
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None
                }
                for job in scheduler.get_jobs()
            ]
        }
        
    except Exception as e:
        logging.error(f"❌ Failed to get scheduler status: {e}")
        return {'running': False, 'error': str(e)}