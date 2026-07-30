# Standalone Admin Portal at `/admin`

The admin portal remains an independent FastAPI application. It does not need
to be moved into the Next.js source tree.

## Required environment variables

- `MONGODB_URI`: the same MongoDB/Cosmos connection used by the learning backend.
- `SECRET_KEY`: exactly the same value used by the learning backend.
- `BACKEND_URL`: the private or public origin of the learning backend, without a trailing slash.
- `ADMIN_BASE_PATH`: `/admin`.

The portal writes only to these collections in the shared `ai_avatar` database:

- `admin_users`
- `admin_teachers`
- `admin_subjects`
- `admin_lessons`
- `admin_activity_logs`

## Gateway routing

Configure the public gateway or Azure Front Door with two origins:

1. Existing Next.js frontend origin — default route `/*`.
2. Admin Portal origin — higher-priority routes `/admin` and `/admin/*`.

Forward the `/admin` path unchanged. The admin service accepts prefixed paths
directly, while also continuing to support unprefixed paths for local tests.
No Next.js admin page or source-code migration is required.

The admin origin health probe can continue to use `/health` directly.

## Publication flow

After an admin finalizes a lesson, the portal automatically uploads the ZIP to
`BACKEND_URL/api/admin/ingest` using the current administrator JWT. The backend
copies UTF-8 topic files and supported images into its existing corpus folders
and rebuilds its existing Chroma collection.

For production durability, mount persistent storage for the backend's
`documents_unicode`, `images`, and `chroma_db` paths, or these published files
will be lost when the backend container is replaced.

