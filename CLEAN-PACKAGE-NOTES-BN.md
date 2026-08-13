# Golapi Shop Online — Complete Clean Package

এই zip-এ website source, Netlify config, Firebase rules/functions, Customer app source, Driver app source এবং GitHub Actions APK workflow রাখা হয়েছে।

বাদ দেওয়া হয়েছে: node_modules, dist/build output, generated android folders, cache, debug log, old zip/backup files।

GitHub-এ upload/push করার পর:
- Netlify website build করবে `npm run build` দিয়ে।
- APK বানাতে GitHub Actions থেকে `Build Golapi Customer and Driver APKs` workflow manually run করতে হবে।
