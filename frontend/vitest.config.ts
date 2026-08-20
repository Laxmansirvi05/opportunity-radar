import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment:  'node',
    globals:      false,
    setupFiles:   ['./vitest.setup.ts'],
    // CODE-02: 6 component tests under features/**/*.test.tsx and
    // libs/**/*.test.tsx were never collected at all — this glob only ever
    // matched tests/**/*.test.ts, so the missing @testing-library/react
    // dependency was only half the reason they never ran. Each affected
    // file already opts into a DOM environment per-file via a
    // `// @vitest-environment happy-dom` pragma, so the top-level
    // `environment: 'node'` above is unaffected for every other test.
    include:     ['tests/**/*.test.ts', 'features/**/*.test.tsx', 'libs/**/*.test.tsx'],
    // These 5 (of 7 newly-collected) still can't run: they exercise code
    // that calls Lingui's `t`/`msg` macro tags (@lingui/core/macro,
    // @lingui/react/macro), which only work when compiled away by
    // babel-plugin-macros — Next.js gets this via @lingui/swc-plugin (see
    // next.config.ts), but Vite/Vitest has no equivalent wired in, and
    // adding @vitejs/plugin-react to get one hit a real peer-dependency
    // conflict (React 19 / Vite 7 version mismatch) that needs a deliberate
    // dependency decision, not a silent --legacy-peer-deps override.
    // base.test.tsx (of the original 7) doesn't hit this path and now
    // genuinely passes — left in the run above. gallery.test.tsx turned out
    // to hit the same macro, via gallery.tsx's own template-metadata
    // (msg`...` descriptions), just not on its first-imported line.
    exclude: [
      '**/node_modules/**',
      'libs/resume/section.test.tsx',
      'features/command-palette/pages/preferences/index.test.tsx',
      'features/command-palette/pages/preferences/language.test.tsx',
      'features/command-palette/pages/preferences/theme.test.tsx',
      'features/resume/dialogs/resume/template/gallery.test.tsx',
    ],
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['lib/**/*.ts', 'types/**/*.ts'],
      exclude:   ['lib/ai-gateway/providers/**'],  // Require live API keys
    },
  },
  resolve: {
    alias: [
      // Mirrors tsconfig.json's "paths". Next.js/webpack resolves these
      // via tsconfig automatically; Vite/Vitest does not, and
      // node_modules/@reactive-resume/* is not actually a linked workspace
      // (confirmed empty) so there's no package.json "exports" fallback
      // either — this was part of why the component tests under
      // features/**/*.test.tsx never actually ran even once collected
      // (CODE-02). Array form with RegExp `find`, since plain object-key
      // aliases only exact-match in this Vite version rather than prefix-
      // matching a trailing slash.
      { find: /^@reactive-resume\/schema$/, replacement: path.resolve(__dirname, './packages/schema/src/index.ts') },
      { find: /^@reactive-resume\/schema\//, replacement: path.resolve(__dirname, './packages/schema/src/') + '/' },
      { find: /^@reactive-resume\/utils$/, replacement: path.resolve(__dirname, './packages/utils/src/index.ts') },
      { find: /^@reactive-resume\/utils\//, replacement: path.resolve(__dirname, './packages/utils/src/') + '/' },
      { find: /^@reactive-resume\/fonts$/, replacement: path.resolve(__dirname, './packages/fonts/src/index.ts') },
      { find: /^@reactive-resume\/fonts\//, replacement: path.resolve(__dirname, './packages/fonts/src/') + '/' },
      { find: /^@reactive-resume\/resume$/, replacement: path.resolve(__dirname, './packages/resume/src/index.ts') },
      { find: /^@reactive-resume\/resume\//, replacement: path.resolve(__dirname, './packages/resume/src/') + '/' },
      { find: /^@reactive-resume\/pdf$/, replacement: path.resolve(__dirname, './packages/pdf/src/index.ts') },
      { find: /^@reactive-resume\/pdf\//, replacement: path.resolve(__dirname, './packages/pdf/src/') + '/' },
      { find: /^@reactive-resume\/ui$/, replacement: path.resolve(__dirname, './packages/ui/src/index.ts') },
      { find: /^@reactive-resume\/ui\/components\//, replacement: path.resolve(__dirname, './packages/ui/src/components/') + '/' },
      { find: /^@reactive-resume\/ui\/hooks\//, replacement: path.resolve(__dirname, './packages/ui/src/hooks/') + '/' },
      { find: /^@\//, replacement: path.resolve(__dirname, '.') + '/' },
    ],
  },
})
