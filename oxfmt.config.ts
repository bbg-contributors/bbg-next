import { oxfmt } from '@mzwing/oxc-config'

export default oxfmt({
  overrides: [
    {
      files: ['packages/default-theme/src/**'],
      // el, link and iconButton take their class lists as plain string arguments.
      options: {
        sortTailwindcss: {
          stylesheet: './packages/default-theme/src/style.css',
          functions: ['el', 'link', 'iconButton'],
        },
      },
    },
  ],
})
