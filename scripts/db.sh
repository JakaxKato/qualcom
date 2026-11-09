#!/usr/bin/env bash
set -euo pipefail
if ! docker container inspect ruang-teduh-mongo >/dev/null 2>&1; then
  docker run -d --name ruang-teduh-mongo -p 127.0.0.1:27017:27017 -v ruang-teduh-mongo:/data/db mongo:8.0@sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142 --replSet rs0 --bind_ip_all
else
  docker start ruang-teduh-mongo >/dev/null
fi
for attempt in $(seq 1 60); do
  if docker exec ruang-teduh-mongo mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec ruang-teduh-mongo mongosh --quiet --eval 'try { rs.status() } catch(e) { if(e.code===94) rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]}); else throw e; }'
for attempt in $(seq 1 30); do
  if docker exec ruang-teduh-mongo mongosh --quiet --eval 'if (!db.hello().isWritablePrimary) quit(1)' >/dev/null 2>&1; then exit 0; fi
  sleep 1
done
exit 1
