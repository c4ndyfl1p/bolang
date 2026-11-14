# Gunicorn settings for production. Start with:  gunicorn -c gunicorn.conf.py app:app
import os

# Hosting platforms tell the app which port to listen on through the PORT env variable.
# 0.0.0.0 means "accept connections from outside this machine" (127.0.0.1 would only allow local ones).
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# ONE worker process. Each process loads its own copy of spaCy (~150-200 MB), and the free server
# has 512 MB. One process also means the in-memory cache and rate-limit counters are shared by all requests.
workers = 1

# ...but several threads inside it, so while one request waits on DeepL, others can be handled.
worker_class = "gthread"
threads = 4

# Kill and restart a request that takes longer than this (seconds). Page analysis normally takes < 2 s.
timeout = 60

# Log each request (method, path, status, time) to stdout, where the host's log viewer picks it up.
# Request bodies (page text) are never logged.
accesslog = "-"
