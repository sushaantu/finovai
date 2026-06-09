const metadataFiles = ['.DS_Store', 'public/.DS_Store', 'dist/.DS_Store']

for (const file of metadataFiles) {
  await Bun.$`rm -f ${file}`
}

await Bun.$`bunx vite build`

for (const file of metadataFiles) {
  await Bun.$`rm -f ${file}`
}
