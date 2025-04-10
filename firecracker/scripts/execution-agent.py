import sys
import json
import os
import importlib.util
import contextlib
import io
import traceback

def log_stderr(*args, **kwargs):
    """Helper to print debug logs to stderr"""
    print("[AgentLog]", *args, file=sys.stderr, **kwargs)
    sys.stderr.flush()

def execute_handler(code_relative_path, handler_name, event_data):
    """Loads and executes the user's handler function."""
    full_code_path = os.path.join("/function", code_relative_path)
    module_name = os.path.splitext(os.path.basename(code_relative_path))[0]

    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    result = None
    error_msg = None 

    log_stderr(f"Attempting to execute {handler_name} from {full_code_path}")

    try:
        if not os.path.isfile(full_code_path):
             raise FileNotFoundError(f"Code file not found at {full_code_path}")

        spec = importlib.util.spec_from_file_location(module_name, full_code_path)
        if not spec or not spec.loader:
             raise ImportError(f"Could not load spec for module {full_code_path}")

        module = importlib.util.module_from_spec(spec)

        module_dir = os.path.dirname(full_code_path)
        if module_dir not in sys.path:
            sys.path.insert(0, module_dir)
            path_added = True
        else:
            path_added = False

        spec.loader.exec_module(module) 

        if path_added:
            sys.path.pop(0)

        handler_func = getattr(module, handler_name)
        if not callable(handler_func):
            raise TypeError(f"Handler '{handler_name}' in {code_relative_path} is not callable.")

        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            context = {}
            log_stderr("Calling user handler function...")
            result = handler_func(event_data, context)
            log_stderr("User handler function finished.")

    except Exception as e:
         log_stderr(f"Execution Error Type: {type(e).__name__}")
         log_stderr(f"Execution Error Message: {e}")
         stderr_capture.write(f"\n--- Agent Traceback ---\n{traceback.format_exc()}")
         error_msg = f"{type(e).__name__}: {e}" 
    finally:
        if path_added and module_dir in sys.path and sys.path[0] == module_dir:
             sys.path.pop(0)
        log_stderr("Execution attempt finished.")

    return {
        "output": result, 
        "logs": {
            "stdout": stdout_capture.getvalue(),
            "stderr": stderr_capture.getvalue(), 
        },
        "error": error_msg 
    }

def main():
    """Main entry point. Reads args, input, calls handler, prints result."""
    # Expect handler string (e.g., "main.run") as the only argument
    if len(sys.argv) != 2:
        log_stderr("Usage: python execution-agent.py <handler_string>")
        print(json.dumps({"output": None, "logs": {}, "error": "Agent Usage Error: Missing handler string argument."}))
        sys.exit(1)

    handler_string = sys.argv[1]
    log_stderr(f"Agent started. Handler: {handler_string}")

    event_data = {}
    try:
        log_stderr("Reading event data from stdin...")
        event_json = sys.stdin.read()
        if event_json:
            event_data = json.loads(event_json)
            log_stderr("Event data read and parsed successfully.")
        else:
             log_stderr("Warning: Received empty event data from stdin.")
             event_data = {}

    except json.JSONDecodeError as e:
        log_stderr(f"Fatal: Error decoding event JSON from stdin: {e}")
        print(json.dumps({"output": None, "logs": {}, "error": f"Invalid event JSON input: {e}"}))
        sys.exit(1)
    except Exception as e:
        log_stderr(f"Fatal: Error reading event data from stdin: {e}")
        print(json.dumps({"output": None, "logs": {}, "error": f"Stdin read error: {e}"}))
        sys.exit(1)


    response = {} 
    try:
        handler_parts = handler_string.split('.')
        if len(handler_parts) < 2:
            raise ValueError("Invalid handler format. Expected 'filename.funcname'")

        file_base = handler_parts[0]
        handler_func_name = handler_parts[-1] # Use last part as function name
        relative_path = f"{file_base}.py"
        response = execute_handler(relative_path, handler_func_name, event_data)

    except Exception as e:
         log_stderr(f"Agent setup/execution error: {e}")
         response = {
             "output": None,
             "logs": {"stdout": "", "stderr": traceback.format_exc()}, 
             "error": f"Agent Error: {e}",
         }

    try:
        log_stderr("Sending final JSON response to stdout.")
        print(json.dumps(response))
        sys.stdout.flush() 
    except Exception as e:
         log_stderr(f"Fatal: Failed to serialize or print final response: {e}")
         print(json.dumps({"output": None, "logs": {"stderr": f"Failed to create final JSON: {e}"}, "error": "Agent Error: Failed to create final response"}))
         sys.exit(1)


    exit_code = 0 if response.get("error") is None else 1
    log_stderr(f"Agent exiting with code {exit_code}.")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()