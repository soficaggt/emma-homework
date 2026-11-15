# Plan: moving the proof photos

From: the Drive folder "Emma homework proof" (Sofia's Drive). Read only, never changed or deleted.
To: the private `proof-photos` bucket in Supabase, under Emma's own folder.

## What there is (Nov 15)

- 10 photos in the Drive folder, all JPEG, about 4 MB in total (the biggest is about 0.8 MB).
- 10 tasks link a photo, and every link points at one of those 10 files. No photo is missing and no
  photo is unlinked.
- Bucket limit is 10 MB per file, JPEG allowed, so nothing needs shrinking. The originals are kept as
  they are, because they are proof.

## Where each photo goes

`proof-photos/<Emma's account id>/<new task id>/<Drive file id>.jpg`

- The first folder is her account ID, which is what the bucket's security rule checks: only her coach
  and her parent can open it, through a short link, and every open is written to the audit log.
- The new task ID is worked out from the old task ID, so the path is the same on every run.
- `node scripts/import/photos.mjs manifest --snapshot DIR --student <id>` prints the full list.

Each photo also gets a `proof_images` row: the task, the path, the photo's SHA-256 fingerprint (so later
reuse can be caught, PRD 6f), and the Drive upload time. Camera or library, the time it was taken and
the look-alike fingerprint are not known for old photos and stay empty; step 5's checker can fill the
look-alike fingerprint later.

## Steps for the real run

1. **Download (read only).** Claude pulls each file with the Google Drive connector into the session's
   private scratch folder, named `<Drive file id>.jpg`. Tested on Nov 15 with one photo: it arrived
   byte-for-byte whole (same size, valid JPEG). If the connector is not available, Sofia can instead
   right-click the folder in Drive, choose Download, and attach the zip in the chat.
2. **Check.** `node scripts/import/photos.mjs check --snapshot DIR --photos-dir DIR` confirms every file is
   there, is a JPEG, and has the same size Drive reports. Must say `PHOTOS result=PASS`.
3. **Upload.** `node scripts/import/photos.mjs upload ... --confirm "upload photos for <id>"`. It never
   replaces a file that is already there, so a re-run is safe. It needs two settings in the
   environment settings (never in the chat or a file): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   The environment may also need the project's own address added to its allowed network hosts.
4. **Import.** Run the real import with `--photos-dir` so each `proof_images` row gets its fingerprint.
5. **Spot check.** Sofia opens two or three photos from the new proof board (step 12) or the Supabase
   dashboard.
6. **Clean up.** Delete the downloaded copies from the scratch folder. The Drive folder stays as it is
   until Sofia decides to retire it after switch-over.

## Not tested yet

The upload command has not been run, because it needs the service key, which is not in this
environment and should only be added for the real run.
