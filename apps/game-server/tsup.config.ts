import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle workspace packages (they ship TypeScript source); keep real npm deps external.
  noExternal: [/^@masoi\//],
  external: ['@prisma/client', '.prisma/client'],
});
