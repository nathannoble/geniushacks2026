# geniushacks2026
Genius Hacks 3 Repo

Docker compose:
docker compose down -v
docker compose up --build
docker compose exec app python scripts/seed_policy_library.py
docker compose exec app python scripts/setup_checkpointer.py
docker compose exec db psql -U fcrm -d fcrm_workbench -c "\dt"
