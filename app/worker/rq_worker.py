import os
from redis import Redis
from rq import Worker, Queue, Connection

listen = ['default', 'quiz']
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
conn = Redis.from_url(redis_url)

if __name__ == '__main__':
    with Connection(conn):
        worker = Worker(map(Queue, listen))
        worker.work()