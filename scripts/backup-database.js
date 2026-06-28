require("../src/loadEnv")();
const {
  createDatabaseBackup,
  disconnectDatabaseBackupService,
} = require("../src/services/databaseBackupService");

async function main() {
  const result = await createDatabaseBackup();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabaseBackupService();
  });
